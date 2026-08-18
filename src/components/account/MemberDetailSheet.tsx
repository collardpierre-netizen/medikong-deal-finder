import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

type AccountKind = "vendor" | "buyer";

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

export function MemberDetailSheet({ open, onOpenChange, accountKind, accountId, member }: Props) {
  const email = member?.email?.toLowerCase() ?? null;

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
    </Sheet>
  );
}
