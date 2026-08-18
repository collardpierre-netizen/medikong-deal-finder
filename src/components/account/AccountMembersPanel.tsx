import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Copy, Check, Shield, User as UserIcon, Mail, Clock, KeyRound, RotateCcw, AlertCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AccountKind = "vendor" | "buyer";
type Role = "admin" | "member";

interface Props {
  accountKind: AccountKind;
  accountId: string;
  canManage: boolean;
  ownerUserId?: string | null;
}

interface Membership {
  id: string;
  user_id: string;
  role: Role;
  status: string;
  invited_email: string | null;
  accepted_at: string | null;
  created_at: string;
  profile?: { full_name: string | null } | null;
  display_name?: string | null;
  email?: string | null;
}

interface Invitation {
  id: string;
  email: string | null;
  role: Role;
  join_code: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

export function AccountMembersPanel({ accountKind, accountId, canManage, ownerUserId }: Props) {

  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [inviteEmail, setInviteEmail] = useState("");


  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviteSending, setInviteSending] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [resetConfirmTarget, setResetConfirmTarget] = useState<{ userId: string; label: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ success: boolean; email?: string; error?: string } | null>(null);

  const membersKey = ["account-memberships", accountKind, accountId];
  const invitesKey = ["account-invitations", accountKind, accountId];

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: membersKey,
    queryFn: async (): Promise<Membership[]> => {
      // RPC serveur : renvoie nom (profiles) + email (compte auth) même quand
      // la lecture directe de `profiles` est bloquée par les policies.
      const { data: rpcData, error: rpcError } = await supabase.rpc("account_list_members", {
        _kind: accountKind,
        _account_id: accountId,
      });
      if (!rpcError && rpcData) {
        return (rpcData as any[]).map((m) => ({
          ...m,
          profile: m.display_name ? { full_name: m.display_name } : null,
        })) as Membership[];
      }

      // Fallback : lecture directe si la RPC n'est pas disponible.
      const { data, error } = await supabase
        .from("account_memberships")
        .select("id, user_id, role, status, invited_email, accepted_at, created_at")
        .eq("account_kind", accountKind)
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((m: any) => m.user_id))];
      let profilesMap: Record<string, { full_name: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        profilesMap = Object.fromEntries((profs || []).map((p: any) => [p.id, { full_name: p.full_name }]));
      }
      return (data || []).map((m: any) => ({ ...m, profile: profilesMap[m.user_id] ?? null })) as Membership[];
    },
    enabled: !!accountId,
  });

  const { data: invitations = [], isLoading: loadingInvites } = useQuery({
    queryKey: invitesKey,
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from("account_invitations")
        .select("id, email, role, join_code, expires_at, accepted_at, revoked_at, created_at")
        .eq("account_kind", accountKind)
        .eq("account_id", accountId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Invitation[];
    },
    enabled: !!accountId && canManage,
  });

  const inviteByEmail = useMutation({
    mutationFn: async () => {
      setInviteSending(true);
      setInviteError(null);
      setEmailStatus(null);
      const email = inviteEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Adresse email invalide — vérifie le format (nom@domaine.com).");
      }
      // Doublons côté client : membre déjà actif ou invitation déjà en attente.
      const alreadyMember = members.some(
        (m) => (m.email || m.invited_email || "").toLowerCase() === email,
      );
      if (alreadyMember) {
        throw new Error(`${email} est déjà membre de ce compte — modifie son rôle dans la liste plutôt que de l'inviter à nouveau.`);
      }
      const alreadyInvited = invitations.some((inv) => (inv.email || "").toLowerCase() === email);
      if (alreadyInvited) {
        throw new Error(`Une invitation est déjà en attente pour ${email} — révoque-la avant d'en envoyer une nouvelle.`);
      }

      const { data, error } = await supabase.rpc("account_invite_by_email", {
        _kind: accountKind,
        _account_id: accountId,
        _email: email,
        _role: inviteRole,
      });
      if (error) {
        const raw = (error.message || "").toLowerCase();
        if (raw.includes("already") || raw.includes("duplicate") || raw.includes("exists") || raw.includes("unique")) {
          throw new Error(`${email} a déjà un accès ou une invitation en cours sur ce compte.`);
        }
        throw new Error(error.message || "Erreur lors de la création de l'invitation.");
      }
      const row = Array.isArray(data) ? data[0] : data;
      const token = row?.token as string | undefined;
      const invitationId = row?.invitation_id as string | undefined;
      if (!token) throw new Error("Invitation créée mais lien indisponible — réessaie.");
      // Envoi email best-effort, statut remonté à l'utilisateur.
      try {
        const invitationUrl = `${window.location.origin}/account/invitation/${token}`;
        const { error: mailError } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "account-invitation",
            recipientEmail: email,
            idempotencyKey: `account-invite-${invitationId}`,
            templateData: {
              invitationUrl,
              role: inviteRole,
              accountKind,
              expiresAt: null,
            },
          },
        });
        setEmailStatus(mailError ? "failed" : "sent");
      } catch (e) {
        console.warn("send-transactional-email failed", e);
        setEmailStatus("failed");
      }
      setGeneratedToken(token);
      return { token };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitesKey });
    },
    onError: (err: any) => {
      setInviteError(err?.message || "Erreur lors de l'invitation");
    },
    onSettled: () => setInviteSending(false),
  });


  const createJoinCode = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("account_create_join_code", {
        _kind: accountKind,
        _account_id: accountId,
        _role: inviteRole,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const code = row?.join_code as string | undefined;
      if (!code) throw new Error("Code manquant");
      setGeneratedCode(code);
      return code;
    },
    onSuccess: () => {
      toast.success("Code généré");
      qc.invalidateQueries({ queryKey: invitesKey });
    },
    onError: (err: any) => toast.error(err?.message || "Erreur"),
  });

  const revokeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.rpc("account_revoke_member", { _membership_id: membershipId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membre retiré");
      qc.invalidateQueries({ queryKey: membersKey });
    },
    onError: (err: any) => toast.error(err?.message || "Erreur"),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const { error } = await supabase.rpc("account_update_member_role", { _membership_id: id, _new_role: role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: membersKey });
    },
    onError: (err: any) => toast.error(err?.message || "Erreur"),
  });

  const revokeInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc("account_revoke_invitation", { _invitation_id: invitationId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation révoquée");
      qc.invalidateQueries({ queryKey: invitesKey });
    },
    onError: (err: any) => toast.error(err?.message || "Erreur"),
  });

  const sendPasswordReset = useMutation({
    mutationFn: async (payload: { userId: string; label: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-send-password-reset", {
        body: { user_id: payload.userId },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Erreur");
      return data;
    },
    onSuccess: (data: any) => {
      setResetResult({ success: true, email: data?.email });
      setResetConfirmTarget(null);
    },
    onError: (e: any) => {
      setResetResult({ success: false, error: e?.message || "Erreur d'envoi" });
      setResetConfirmTarget(null);
    },
  });

  const closeInviteDialog = () => {
    setShowInvite(false);
    setInviteEmail("");
    setInviteRole("member");
    setGeneratedToken(null);
  };

  const closeJoinDialog = () => {
    setShowJoinCode(false);
    setInviteRole("member");
    setGeneratedCode(null);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Copie impossible");
    }
  };

  const memberLabel = (m: Membership) =>
    m.profile?.full_name ||
    m.display_name ||
    m.email ||
    m.invited_email ||
    `Utilisateur ${m.user_id.slice(0, 8)}`;

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const haystack = [
        memberLabel(m),
        m.email,
        m.invited_email,
        m.display_name,
        m.profile?.full_name,
        m.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [members, memberSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const currentPage = Math.min(memberPage, totalPages);
  const pagedMembers = filteredMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const roleBadge = (role?: string | null) => {
    if (role === "admin") {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold uppercase">
          <Shield size={10} className="mr-1" /> Admin
        </Badge>
      );
    }
    if (role === "member") {
      return (
        <Badge variant="outline" className="text-[10px] font-bold uppercase">
          <UserIcon size={10} className="mr-1" /> Membre
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-bold uppercase text-[#8B95A5]">
        <UserIcon size={10} className="mr-1" /> {role || "Rôle inconnu"}
      </Badge>
    );
  };



  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-[#1D2530]">Utilisateurs & accès</h3>
          <p className="text-[12px] text-[#8B95A5] mt-1">
            Membres pouvant se connecter et gérer ce compte {accountKind === "vendor" ? "vendeur" : "acheteur"}.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowJoinCode(true)}>
              <KeyRound size={14} className="mr-1.5" /> Code d'accès
            </Button>
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus size={14} className="mr-1.5" /> Inviter par email
            </Button>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center gap-2">
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#616B7C]">Membres actifs</h4>
          <Badge variant="secondary" className="text-[10px]">{members.length}</Badge>
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
            <Input
              value={memberSearch}
              onChange={(e) => {
                setMemberSearch(e.target.value);
                setMemberPage(1);
              }}
              placeholder="Rechercher un membre…"
              className="h-8 pl-8 text-[12px] bg-white"
            />
          </div>
        </div>
        {loadingMembers ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#8B95A5]" size={20} /></div>
        ) : members.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[#8B95A5]">Aucun membre — invite quelqu'un pour commencer.</div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[#8B95A5]">Aucun membre ne correspond à « {memberSearch} ».</div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {pagedMembers.map((m) => {
              const isOwner = ownerUserId && m.user_id === ownerUserId;
              const label = memberLabel(m);

              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#1B5BDA] text-[12px] font-bold uppercase">
                    {label.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-[#1D2530] truncate">{label}</span>
                      {roleBadge(m.role)}
                      {isOwner && <Badge className="text-[9px] bg-amber-100 text-amber-800 hover:bg-amber-100">Propriétaire</Badge>}
                    </div>
                    {(m.email || m.invited_email) && (
                      <p className="text-[11px] text-[#8B95A5] truncate">{m.email || m.invited_email}</p>
                    )}
                  </div>

                  {canManage && !isOwner ? (
                    <Select value={m.role} onValueChange={(v) => updateRole.mutate({ id: m.id, role: v as Role })}>
                      <SelectTrigger className="w-[110px] h-8 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Membre</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    roleBadge(m.role)
                  )}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Envoyer un email de réinitialisation du mot de passe"
                      disabled={sendPasswordReset.isPending}
                      onClick={() => setResetConfirmTarget({ userId: m.user_id, label })}
                    >
                      <RotateCcw size={14} />
                    </Button>
                  )}
                  {canManage && !isOwner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`Retirer ${label} de ce compte ?`)) revokeMember.mutate(m.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loadingMembers && filteredMembers.length > PAGE_SIZE && (
          <div className="px-4 py-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
            <span className="text-[11px] text-[#8B95A5]">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredMembers.length)} sur {filteredMembers.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={currentPage <= 1}
                onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-[11px] text-[#616B7C]">Page {currentPage} / {totalPages}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={currentPage >= totalPages}
                onClick={() => setMemberPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>


      {/* Pending invitations */}
      {canManage && (
        <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#616B7C]">Invitations en attente</h4>
            <Badge variant="secondary" className="text-[10px]">{invitations.length}</Badge>
          </div>
          {loadingInvites ? (
            <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#8B95A5]" size={18} /></div>
          ) : invitations.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-[#8B95A5]">Aucune invitation en attente.</div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {invitations.map((inv) => {
                const isExpired = new Date(inv.expires_at) < new Date();
                return (
                  <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#616B7C]">
                      {inv.email ? <Mail size={14} /> : <KeyRound size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#1D2530] truncate">
                          {inv.email ?? `Code : ${inv.join_code}`}
                        </span>
                        {roleBadge(inv.role)}
                        {isExpired && <Badge variant="outline" className="text-[9px] text-destructive border-destructive">Expirée</Badge>}
                      </div>
                      <p className="text-[11px] text-[#8B95A5] flex items-center gap-1">
                        <Clock size={10} /> Expire le {new Date(inv.expires_at).toLocaleDateString("fr-BE")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-red-50"
                      onClick={() => {
                        if (confirm("Révoquer cette invitation ?")) revokeInvite.mutate(inv.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Invite by email dialog */}
      <Dialog open={showInvite} onOpenChange={(o) => (o ? setShowInvite(true) : closeInviteDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter un utilisateur</DialogTitle>
          </DialogHeader>
          {!generatedToken ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="utilisateur@exemple.com"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Rôle</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — tout faire (y compris gérer l'équipe)</SelectItem>
                    <SelectItem value="member">Membre — gérer offres, commandes, RFQ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-[#8B95A5]">
                Un email d'invitation sera envoyé. L'invité doit cliquer sur le lien et se connecter avec cet email exact.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={closeInviteDialog}>Annuler</Button>
                <Button onClick={() => inviteByEmail.mutate()} disabled={inviteSending}>
                  {inviteSending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Mail className="mr-2" size={14} />}
                  Envoyer l'invitation
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-[#1D2530]">
                Invitation envoyée à <strong>{inviteEmail}</strong>. Tu peux aussi partager le lien direct :
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/account/invitation/${generatedToken}`}
                  className="font-mono text-[11px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(`${window.location.origin}/account/invitation/${generatedToken}`, "link")}
                >
                  {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeInviteDialog}>Fermer</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Join code dialog */}
      <Dialog open={showJoinCode} onOpenChange={(o) => (o ? setShowJoinCode(true) : closeJoinDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Générer un code d'accès</DialogTitle>
          </DialogHeader>
          {!generatedCode ? (
            <div className="space-y-4">
              <p className="text-[12px] text-[#616B7C]">
                Un code à 6 caractères que n'importe quel utilisateur connecté peut saisir pour rejoindre ce compte.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="code-role">Rôle attribué</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger id="code-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Membre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeJoinDialog}>Annuler</Button>
                <Button onClick={() => createJoinCode.mutate()}>
                  <KeyRound className="mr-2" size={14} /> Générer
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-[#1D2530]">Partage ce code avec la personne à inviter :</p>
              <div className="flex gap-2 items-center justify-center bg-[#F8FAFC] p-6 rounded-lg border border-[#E2E8F0]">
                <span className="font-mono text-[28px] font-bold tracking-[0.3em] text-[#1B5BDA]">{generatedCode}</span>
                <Button size="sm" variant="outline" onClick={() => copy(generatedCode, "code")}>
                  {copied === "code" ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              <p className="text-[11px] text-[#8B95A5] text-center">
                Elle pourra le saisir sur <code className="bg-[#F1F5F9] px-1 rounded">/account/invitation</code>
              </p>
              <DialogFooter>
                <Button onClick={closeJoinDialog}>Fermer</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password confirmation */}
      <AlertDialog
        open={!!resetConfirmTarget}
        onOpenChange={(open) => {
          if (!open) setResetConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le mot de passe</AlertDialogTitle>
            <AlertDialogDescription>
              Envoyer un email de réinitialisation de mot de passe à{" "}
              <strong>{resetConfirmTarget?.label}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetConfirmTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetConfirmTarget) {
                  sendPasswordReset.mutate({
                    userId: resetConfirmTarget.userId,
                    label: resetConfirmTarget.label,
                  });
                }
              }}
            >
              {sendPasswordReset.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password result */}
      <Dialog open={!!resetResult} onOpenChange={(open) => { if (!open) setResetResult(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resetResult?.success ? "Email envoyé" : "Erreur d'envoi"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Résultat de la demande de réinitialisation de mot de passe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {resetResult?.success ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <Check size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#1D2530]">
                    L'email de réinitialisation a bien été envoyé.
                  </p>
                  {resetResult.email && (
                    <p className="text-[12px] text-[#616B7C] mt-1">{resetResult.email}</p>
                  )}
                  <p className="text-[11px] text-[#8B95A5] mt-2">
                    L'utilisateur recevra un lien valable 24 heures pour définir un nouveau mot de passe.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <AlertCircle size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#1D2530]">
                    L'email n'a pas pu être envoyé.
                  </p>
                  {resetResult?.error && (
                    <p className="text-[12px] text-destructive mt-1">{resetResult.error}</p>
                  )}
                  <p className="text-[11px] text-[#8B95A5] mt-2">
                    Vérifiez que l'adresse email est valide ou réessayez plus tard.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AccountMembersPanel;
