import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Loader2,
  Shield,
  User as UserIcon,
  Mail,
  KeyRound,
  UserPlus,
  LogIn,
  Ban,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  AlertCircle,
} from "lucide-react";

type AccountKind = "vendor" | "buyer";
type Role = "admin" | "member";

export interface MemberDetailTarget {
  membershipId: string;
  userId: string;
  label: string;
  email: string | null;
  role: string | null;
  status: string | null;
  createdAt: string | null;
  acceptedAt: string | null;
  isOwner?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountKind: AccountKind;
  accountId: string;
  member: MemberDetailTarget | null;
  canManage?: boolean;
  onRevoke?: (membershipId: string) => Promise<void> | void;
  onUpdateRole?: (membershipId: string, role: Role) => Promise<void> | void;
}


interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  detail?: string | null;
  icon: "invite" | "join" | "access" | "revoke" | "role";
}

const ICONS = {
  invite: Mail,
  join: UserPlus,
  access: LogIn,
  revoke: Ban,
  role: Shield,
} as const;

const ICON_CLASSES: Record<TimelineEvent["icon"], string> = {
  invite: "bg-[#EFF6FF] text-[#1B5BDA]",
  join: "bg-emerald-50 text-emerald-700",
  access: "bg-[#F1F5F9] text-[#616B7C]",
  revoke: "bg-red-50 text-red-600",
  role: "bg-amber-50 text-amber-700",
};

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MemberDetailSheet({
  open,
  onOpenChange,
  accountKind,
  accountId,
  member,
  canManage = false,
  onRevoke,
  onUpdateRole,
}: Props) {
  const email = member?.email?.toLowerCase() ?? null;
  const qc = useQueryClient();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["member-detail-invitations", accountKind, accountId, email, member?.userId],
    queryFn: async () => {
      let query = supabase
        .from("account_invitations")
        .select("id, email, role, join_code, created_at, accepted_at, revoked_at, expires_at, accepted_by")
        .eq("account_kind", accountKind)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((inv: any) => {
        if (email && (inv.email || "").toLowerCase() === email) return true;
        if (member?.userId && inv.accepted_by === member.userId) return true;
        return false;
      }) as any[];
    },
    enabled: open && !!member && !!accountId,
  });

  const invitesKey = ["account-invitations", accountKind, accountId];
  const membersKey = ["account-memberships", accountKind, accountId];
  const detailKey = ["member-detail-invitations", accountKind, accountId, email, member?.userId];

  // Invitation "en échec" = créée, jamais acceptée, non révoquée (expirée ou non).
  const failedInvitation = useMemo(
    () => invitations.find((inv: any) => !inv.accepted_at && !inv.revoked_at && inv.email) ?? null,
    [invitations],
  );
  const needsInvitationResend = !member?.acceptedAt || !!failedInvitation;

  const resendInvitation = useMutation({
    mutationFn: async () => {
      if (!email) throw new Error("Aucune adresse email connue pour cet utilisateur.");
      if (failedInvitation) {
        const { error: revokeError } = await supabase.rpc("account_revoke_invitation", {
          _invitation_id: failedInvitation.id,
        });
        if (revokeError) throw revokeError;
      }
      const role: Role = member?.role === "admin" ? "admin" : "member";
      const { data, error } = await supabase.rpc("account_invite_by_email", {
        _kind: accountKind,
        _account_id: accountId,
        _email: email,
        _role: role,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const token = row?.token as string | undefined;
      const invitationId = row?.invitation_id as string | undefined;
      if (!token) throw new Error("Invitation créée mais lien indisponible.");
      const invitationUrl = `${window.location.origin}/account/invitation/${token}`;
      const { error: mailError } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "account-invitation",
          recipientEmail: email,
          idempotencyKey: `account-invite-${invitationId}`,
          templateData: { invitationUrl, role, accountKind, expiresAt: null },
        },
      });
      if (mailError) throw new Error("Invitation recréée mais l'email n'a pas pu être envoyé.");
    },
    onSuccess: () => {
      toast.success(`Invitation renvoyée à ${email}`);
      qc.invalidateQueries({ queryKey: invitesKey });
      qc.invalidateQueries({ queryKey: detailKey });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors du renvoi de l'invitation"),
  });

  const applyRole = useMutation({
    mutationFn: async (role: Role) => {
      if (onUpdateRole && member) {
        await onUpdateRole(member.membershipId, role);
        return;
      }
      const { error } = await supabase.rpc("account_update_member_role", {
        _membership_id: member!.membershipId,
        _new_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: membersKey });
      setPendingRole(null);
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erreur lors de la mise à jour du rôle");
      setPendingRole(null);
    },
  });

  const revokeAccess = useMutation({
    mutationFn: async () => {
      if (onRevoke && member) {
        await onRevoke(member.membershipId);
        return;
      }
      const { error } = await supabase.rpc("account_revoke_member", {
        _membership_id: member!.membershipId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Accès révoqué");
      qc.invalidateQueries({ queryKey: membersKey });
      setConfirmRevoke(false);
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erreur lors de la révocation");
      setConfirmRevoke(false);
    },
  });



  const events = useMemo<TimelineEvent[]>(() => {
    if (!member) return [];
    const list: TimelineEvent[] = [];

    for (const inv of invitations) {
      list.push({
        id: `inv-${inv.id}`,
        at: inv.created_at,
        title: inv.email ? "Invitation envoyée par email" : "Code d'accès généré",
        detail: inv.email
          ? `${inv.email} · rôle ${inv.role === "admin" ? "admin" : "membre"}`
          : `Code ${inv.join_code} · rôle ${inv.role === "admin" ? "admin" : "membre"}`,
        icon: "invite",
      });
      if (inv.accepted_at) {
        list.push({
          id: `inv-acc-${inv.id}`,
          at: inv.accepted_at,
          title: "Invitation acceptée",
          detail: "Accès au compte activé",
          icon: "join",
        });
      }
      if (inv.revoked_at) {
        list.push({
          id: `inv-rev-${inv.id}`,
          at: inv.revoked_at,
          title: "Invitation révoquée",
          detail: inv.email || inv.join_code,
          icon: "revoke",
        });
      }
    }

    if (member.createdAt) {
      list.push({
        id: "mem-created",
        at: member.createdAt,
        title: member.isOwner ? "Compte créé (propriétaire)" : "Accès ajouté au compte",
        detail: `Rôle ${member.role === "admin" ? "admin" : "membre"}`,
        icon: "role",
      });
    }
    if (member.acceptedAt) {
      list.push({
        id: "mem-accepted",
        at: member.acceptedAt,
        title: "Accès confirmé",
        detail: "Le membre peut se connecter",
        icon: "access",
      });
    }
    if (member.status && member.status !== "active") {
      list.push({
        id: "mem-status",
        at: member.acceptedAt || member.createdAt || new Date().toISOString(),
        title: `Statut : ${member.status}`,
        icon: member.status === "revoked" ? "revoke" : "role",
      });
    }

    return list
      .filter((e) => !!e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [invitations, member]);

  const roleBadge = (role?: string | null) =>
    role === "admin" ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold uppercase">
        <Shield size={10} className="mr-1" /> Admin
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] font-bold uppercase">
        <UserIcon size={10} className="mr-1" /> {role === "member" ? "Membre" : role || "Rôle inconnu"}
      </Badge>
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[16px]">{member?.label ?? "Utilisateur"}</SheetTitle>
          <SheetDescription className="text-[12px]">
            Détails de l'accès et historique des actions récentes.
          </SheetDescription>
        </SheetHeader>

        {!member ? null : (
          <div className="mt-5 space-y-5">
            {/* Identity */}
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#1B5BDA] text-[13px] font-bold uppercase">
                  {member.label.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#1D2530] truncate">{member.label}</p>
                  <p className="text-[11px] text-[#8B95A5] truncate">{member.email || "Email non disponible"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wide text-[#8B95A5]">Rôle</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {roleBadge(member.role)}
                    {member.isOwner && (
                      <Badge className="text-[9px] bg-amber-100 text-amber-800 hover:bg-amber-100">Propriétaire</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wide text-[#8B95A5]">Statut</p>
                  <div className="mt-1 flex items-center gap-1 text-[12px] text-[#1D2530]">
                    {member.status === "active" ? (
                      <>
                        <CheckCircle2 size={12} className="text-emerald-600" /> Actif
                      </>
                    ) : (
                      <>
                        <Clock size={12} className="text-[#8B95A5]" /> {member.status || "Inconnu"}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wide text-[#8B95A5]">Ajouté le</p>
                  <p className="text-[12px] text-[#1D2530] mt-1">{fmt(member.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wide text-[#8B95A5]">Accès confirmé</p>
                  <p className="text-[12px] text-[#1D2530] mt-1">{fmt(member.acceptedAt)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {canManage && (
              <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#616B7C]">Actions</h4>
                </div>
                <div className="p-4 space-y-4">
                  {/* Rôle */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#1D2530] mb-1.5">Modifier le rôle</p>
                    {member.isOwner ? (
                      <p className="text-[11px] text-[#8B95A5]">
                        Le rôle du propriétaire du compte ne peut pas être modifié.
                      </p>
                    ) : (
                      <Select
                        value={member.role === "admin" ? "admin" : "member"}
                        onValueChange={(v) => {
                          const next = v as Role;
                          if (next !== (member.role === "admin" ? "admin" : "member")) setPendingRole(next);
                        }}
                        disabled={applyRole.isPending}
                      >
                        <SelectTrigger className="h-8 text-[12px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin — gère les accès et les paramètres</SelectItem>
                          <SelectItem value="member">Membre — accès opérationnel uniquement</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Renvoyer l'invitation */}
                  <div className="pt-1 border-t border-[#F1F5F9]">
                    <p className="text-[11px] font-semibold text-[#1D2530] mt-3 mb-1.5">Invitation</p>
                    {!member.email ? (
                      <p className="text-[11px] text-[#8B95A5] flex items-start gap-1.5">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        Aucune adresse email connue — impossible de renvoyer une invitation.
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-[#8B95A5] mb-2">
                          {needsInvitationResend
                            ? "L'invitation n'a pas été acceptée. Un nouveau lien remplacera le précédent."
                            : "Cet accès est déjà actif — un renvoi n'est normalement pas nécessaire."}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[12px]"
                          disabled={resendInvitation.isPending}
                          onClick={() => resendInvitation.mutate()}
                        >
                          {resendInvitation.isPending ? (
                            <Loader2 size={13} className="mr-1.5 animate-spin" />
                          ) : (
                            <Send size={13} className="mr-1.5" />
                          )}
                          Renvoyer l'invitation
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Révoquer */}
                  {!member.isOwner && (
                    <div className="pt-1 border-t border-[#F1F5F9]">
                      <p className="text-[11px] font-semibold text-[#1D2530] mt-3 mb-1.5">Révoquer l'accès</p>
                      <p className="text-[11px] text-[#8B95A5] mb-2">
                        L'utilisateur perdra immédiatement l'accès à ce compte.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[12px] text-destructive border-destructive/30 hover:bg-red-50 hover:text-destructive"
                        disabled={revokeAccess.isPending}
                        onClick={() => setConfirmRevoke(true)}
                      >
                        {revokeAccess.isPending ? (
                          <Loader2 size={13} className="mr-1.5 animate-spin" />
                        ) : (
                          <Trash2 size={13} className="mr-1.5" />
                        )}
                        Révoquer l'accès
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* Timeline */}
            <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#616B7C]">Actions récentes</h4>
                <Badge variant="secondary" className="text-[10px]">{events.length}</Badge>
              </div>
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="animate-spin text-[#8B95A5]" size={18} />
                </div>
              ) : events.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-[#8B95A5]">Aucune action enregistrée.</div>
              ) : (
                <ol className="divide-y divide-[#F1F5F9]">
                  {events.map((e) => {
                    const Icon = ICONS[e.icon] ?? KeyRound;
                    return (
                      <li key={e.id} className="px-4 py-3 flex gap-3">
                        <div
                          className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${ICON_CLASSES[e.icon]}`}
                        >
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-[#1D2530]">{e.title}</p>
                          {e.detail && <p className="text-[11px] text-[#8B95A5] break-words">{e.detail}</p>}
                          <p className="text-[10.5px] text-[#A2ABB8] mt-0.5">{fmt(e.at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        )}
      </SheetContent>

      <AlertDialog open={!!pendingRole} onOpenChange={(o) => !o && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifier le rôle ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole === "admin"
                ? `${member?.label} pourra gérer les utilisateurs, les invitations et les paramètres du compte.`
                : `${member?.label} perdra la gestion des utilisateurs et des paramètres du compte.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingRole) applyRole.mutate(pendingRole);
              }}
            >
              {applyRole.isPending && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l'accès ?</AlertDialogTitle>
            <AlertDialogDescription>
              {member?.label} n'aura plus accès à ce compte. Une nouvelle invitation sera nécessaire pour le
              rétablir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                revokeAccess.mutate();
              }}
            >
              {revokeAccess.isPending && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
