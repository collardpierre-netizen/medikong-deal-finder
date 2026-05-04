import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock } from "lucide-react";

const labels: Record<string, string> = {
  not_viewed: "Non vue par le vendeur",
  not_confirmed: "Non confirmée",
  not_shipped: "Non expédiée",
  critical_escalation: "Escalade critique",
};

export default function AdminOrderSlaPanel() {
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-sla-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_orders_sla_overview_v" as any)
        .select("*")
        .is("resolved_at", null)
        .order("severity", { ascending: false })
        .order("alert_created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const triggerScan = async () => {
    await supabase.functions.invoke("check-order-sla", { body: {} });
    await refetch();
  };

  const resolve = async (alertId: string) => {
    await supabase
      .from("order_vendor_sla_alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_reason: "manual: admin acknowledged" })
      .eq("id", alertId);
    await refetch();
  };

  const criticals = alerts.filter((a: any) => a.severity === "critical").length;
  const warnings = alerts.filter((a: any) => a.severity === "warning").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
            <AlertTriangle size={14} /> <span className="text-[13px] font-bold">{criticals} critiques</span>
          </div>
          <div className="px-3 py-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
            <Clock size={14} /> <span className="text-[13px] font-bold">{warnings} avertissements</span>
          </div>
        </div>
        <button onClick={triggerScan} className="px-3 py-2 rounded-md text-[12px] font-semibold" style={{ backgroundColor: "#1B5BDA", color: "#fff" }}>
          Lancer un scan maintenant
        </button>
      </div>

      <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {isLoading ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement…</div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#059669" }}>
            ✅ Aucun retard détecté. Tous les vendeurs sont dans les délais.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Sévérité", "Commande", "Vendeur", "Acheteur", "Problème", "Retard", "Détecté", "Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((a: any) => (
                <tr key={a.alert_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={a.severity === "critical"
                        ? { backgroundColor: "#FEE2E2", color: "#B91C1C" }
                        : { backgroundColor: "#FEF3C7", color: "#92400E" }}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px] font-mono font-bold" style={{ color: "#1B5BDA" }}>{a.order_number}</td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: "#1D2530" }}>{a.vendor_name || "—"}</td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{a.buyer_name || "—"}</td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: "#1D2530" }}>{labels[a.alert_type] || a.alert_type}</td>
                  <td className="px-3 py-3 text-[12px] font-mono font-bold" style={{ color: "#B91C1C" }}>+{Math.round(Number(a.hours_overdue))}h</td>
                  <td className="px-3 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{new Date(a.alert_created_at).toLocaleString("fr-BE")}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => resolve(a.alert_id)} className="px-2 py-1 rounded text-[11px] font-semibold"
                      style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>
                      Marquer traité
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
