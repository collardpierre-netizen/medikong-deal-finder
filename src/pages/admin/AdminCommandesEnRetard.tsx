import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ALERT_LABEL: Record<string, string> = {
  not_viewed: "Non consultée",
  not_confirmed: "Non confirmée",
  not_shipped: "Non expédiée",
  critical_escalation: "Escalade critique",
};

export default function AdminCommandesEnRetard() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-sla-alerts-open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_vendor_sla_alerts")
        .select(`
          id, alert_type, severity, hours_overdue, threshold_hours,
          notified_vendor_at, notified_admin_at, created_at,
          payload, vendor_id, sub_order_id, order_id,
          orders:order_id ( order_number, total_incl_vat, payment_status, status ),
          vendors:vendor_id ( name, company_name, email )
        `)
        .is("resolved_at", null)
        .order("severity", { ascending: false })
        .order("hours_overdue", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const runScan = async () => {
    await supabase.functions.invoke("check-order-sla", { body: {} });
    await refetch();
  };

  const counts = (data ?? []).reduce(
    (acc, a: any) => {
      acc.total++;
      if (a.severity === "critical") acc.critical++;
      else acc.warning++;
      return acc;
    },
    { total: 0, critical: 0, warning: 0 },
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mk-navy">Lignes en retard de prise en charge</h1>
          <p className="text-sm text-mk-sec mt-1">
            Alertes SLA ouvertes sur les sous-commandes vendeurs (consultation, confirmation, expédition).
          </p>
        </div>
        <Button onClick={runScan} disabled={isFetching} variant="outline">
          {isFetching ? "Scan en cours…" : "Forcer un scan SLA"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-mk-line rounded-lg p-4 bg-background">
          <div className="text-xs text-mk-sec">Total alertes ouvertes</div>
          <div className="text-2xl font-bold text-mk-navy mt-1">{counts.total}</div>
        </div>
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="text-xs text-red-700">Critiques</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{counts.critical}</div>
        </div>
        <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
          <div className="text-xs text-amber-700">Warnings</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{counts.warning}</div>
        </div>
      </div>

      <div className="border border-mk-line rounded-lg overflow-hidden bg-background">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec">
          <span className="col-span-2">Commande</span>
          <span className="col-span-3">Vendeur</span>
          <span className="col-span-2">Type d'alerte</span>
          <span className="col-span-1 text-right">Retard</span>
          <span className="col-span-1 text-right">Seuil</span>
          <span className="col-span-1">Sévérité</span>
          <span className="col-span-2">Notifié</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-mk-sec">Chargement…</div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-12 text-center text-sm text-mk-sec">
            ✅ Aucune ligne en retard. Tout est sous contrôle.
          </div>
        ) : (
          (data ?? []).map((a: any) => (
            <div
              key={a.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-mk-line text-sm items-center hover:bg-mk-alt"
            >
              <span className="col-span-2 font-medium text-mk-navy">
                <Link to={`/admin/commandes`} className="hover:underline">
                  {a.orders?.order_number ?? "—"}
                </Link>
              </span>
              <span className="col-span-3 text-mk-navy truncate" title={a.vendors?.email ?? ""}>
                {a.vendors?.company_name || a.vendors?.name || "—"}
              </span>
              <span className="col-span-2 text-mk-sec">{ALERT_LABEL[a.alert_type] ?? a.alert_type}</span>
              <span className="col-span-1 text-right font-bold text-red-700">+{Math.round(a.hours_overdue)}h</span>
              <span className="col-span-1 text-right text-mk-sec">{a.threshold_hours}h</span>
              <span className="col-span-1">
                <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>
                  {a.severity}
                </Badge>
              </span>
              <span className="col-span-2 text-xs text-mk-sec">
                {a.notified_vendor_at ? "✓ Vendeur" : "—"}
                {a.notified_admin_at ? " · ✓ Admin" : ""}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
