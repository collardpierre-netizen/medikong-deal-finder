import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, Trash2, Send, Copy, Search, Shield, User as UserIcon, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PendingInvitation {
  id: string;
  account_kind: "vendor" | "buyer";
  account_id: string;
  account_name: string;
  email: string | null;
  role: "admin" | "member";
  join_code: string | null;
  expires_at: string;
  created_at: string;
  created_by: string | null;
  invited_by_name: string | null;
  is_expired: boolean;
}

export default function AdminAccountInvitations() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "vendor" | "buyer">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");

  const queryKey = ["admin-pending-invitations"];

  const { data: invitations = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PendingInvitation[]> => {
      const { data, error } = await (supabase.rpc as any)("admin_list_pending_invitations");
      if (error) throw error;
      return (data || []) as PendingInvitation[];
    },
  });

  const revoke = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc("account_revoke_invitation", { _invitation_id: invitationId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation révoquée");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const resend = useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await (supabase.rpc as any)("admin_resend_invitation", { _invitation_id: invitationId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const token = row?.token as string | undefined;
      const email = row?.email as string | undefined;
      const accountKind = row?.account_kind as string | undefined;
      const role = row?.role as string | undefined;
      if (!token || !email) throw new Error("Token manquant");
      const invitationUrl = `${window.location.origin}/account/invitation/${token}`;
      try {
        await supabase.functions.invoke("send-app-email", {
          body: {
            templateName: "account-invitation",
            recipientEmail: email,
            idempotencyKey: `account-invite-resend-${invitationId}-${Date.now()}`,
            templateData: { invitationUrl, role, accountKind, expiresAt: null },
          },
        });
      } catch (e) {
        console.warn("send-app-email failed", e);
      }
      return { token, invitationUrl };
    },
    onSuccess: ({ invitationUrl }) => {
      toast.success("Email renvoyé · lien copié dans le presse-papier");
      navigator.clipboard?.writeText(invitationUrl).catch(() => {});
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invitations.filter((inv) => {
      if (kindFilter !== "all" && inv.account_kind !== kindFilter) return false;
      if (statusFilter === "active" && inv.is_expired) return false;
      if (statusFilter === "expired" && !inv.is_expired) return false;
      if (!q) return true;
      return (
        (inv.email || "").toLowerCase().includes(q) ||
        (inv.account_name || "").toLowerCase().includes(q) ||
        (inv.invited_by_name || "").toLowerCase().includes(q)
      );
    });
  }, [invitations, search, kindFilter, statusFilter]);

  const copyLink = async (id: string) => {
    // Cannot derive the token from list — only resend regenerates. Provide hint.
    toast.info("Utilise « Renvoyer » pour générer un nouveau lien.");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1D2530]">Invitations en attente</h1>
        <p className="text-sm text-[#616B7C] mt-1">
          Toutes les invitations vendeurs et acheteurs non acceptées et non révoquées.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white border border-[#E2E8F0] rounded-lg p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher email, compte, invité par…"
            className="pl-9 h-9"
          />
        </div>
        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les comptes</SelectItem>
            <SelectItem value="vendor">Vendeurs</SelectItem>
            <SelectItem value="buyer">Acheteurs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actives</SelectItem>
            <SelectItem value="expired">Expirées</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-[#8B95A5] ml-auto">
          {filtered.length} / {invitations.length}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#8B95A5]" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#8B95A5]">Aucune invitation en attente.</div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {filtered.map((inv) => (
              <div key={inv.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#616B7C] shrink-0">
                  {inv.email ? <Mail size={14} /> : <KeyRound size={14} />}
                </div>
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-[#1D2530]">
                      {inv.email ?? `Code : ${inv.join_code}`}
                    </span>
                    {inv.role === "admin" ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold uppercase">
                        <Shield size={10} className="mr-1" /> Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">
                        <UserIcon size={10} className="mr-1" /> Membre
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {inv.account_kind === "vendor" ? "Vendeur" : "Acheteur"}
                    </Badge>
                    {inv.is_expired && (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive">Expirée</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[#8B95A5] flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 size={11} /> {inv.account_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Expire le {new Date(inv.expires_at).toLocaleDateString("fr-BE")}
                    </span>
                    {inv.invited_by_name && (
                      <span>· Invité par {inv.invited_by_name}</span>
                    )}
                    <span>· Créée le {new Date(inv.created_at).toLocaleDateString("fr-BE")}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {inv.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resend.isPending}
                      onClick={() => resend.mutate(inv.id)}
                    >
                      <Send size={14} className="mr-1.5" /> Renvoyer
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Révoquer cette invitation ?")) revoke.mutate(inv.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
