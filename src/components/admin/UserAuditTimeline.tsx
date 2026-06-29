import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Shield, Eye, Trash2, UserCheck, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  customerId: string;
  authUserId: string | null;
}

const ACTION_LABELS: Record<string, { label: string; icon: any; tone: string }> = {
  "impersonate.start":  { label: "Impersonate début",  icon: Shield, tone: "bg-red-100 text-red-800" },
  "impersonate.stop":   { label: "Impersonate fin",    icon: Shield, tone: "bg-red-50 text-red-700" },
  "impersonate.page_view": { label: "Page consultée",  icon: Eye, tone: "bg-amber-50 text-amber-700" },
  "customer.verify":    { label: "Validation",         icon: UserCheck, tone: "bg-emerald-100 text-emerald-800" },
  "customer.suspend":   { label: "Suspension",         icon: UserCheck, tone: "bg-orange-100 text-orange-800" },
  "customer.profile_change.customer_type":      { label: "Type client",       icon: Pencil, tone: "bg-blue-100 text-blue-800" },
  "customer.profile_change.visibility_profile": { label: "Profil visibilité", icon: Pencil, tone: "bg-blue-50 text-blue-700" },
  "order.hard_delete":  { label: "Hard delete cmd",    icon: Trash2, tone: "bg-red-100 text-red-800" },
};

export default function UserAuditTimeline({ customerId, authUserId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Match either on customer.id or auth_user_id as target
      const ids = [customerId, authUserId].filter(Boolean) as string[];
      const { data } = await (supabase as any)
        .from("admin_audit_log")
        .select("id, admin_email, action, target_id, target_type, path, metadata, created_at")
        .in("target_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setRows(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [customerId, authUserId]);

  return (
    <div className="border-t border-border mt-4 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Audit — actions admin sur ce compte ({rows.length})</h3>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground italic">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune action admin enregistrée.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {rows.map((r) => {
            const meta = ACTION_LABELS[r.action] || { label: r.action, icon: Activity, tone: "bg-muted text-muted-foreground" };
            const Icon = meta.icon;
            return (
              <div key={r.id} className="text-[11px] bg-background border rounded p-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${meta.tone} border-transparent gap-1`}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <span className="text-muted-foreground">{r.admin_email || "—"}</span>
                  <span className="text-muted-foreground ml-auto">
                    {format(new Date(r.created_at), "dd/MM/yy HH:mm:ss", { locale: fr })}
                  </span>
                </div>
                {r.path && (
                  <div className="text-[10px] text-muted-foreground font-mono mt-1 break-all">{r.path}</div>
                )}
                {r.metadata?.reason && (
                  <div className="text-[10px] text-muted-foreground italic mt-1">« {r.metadata.reason} »</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
