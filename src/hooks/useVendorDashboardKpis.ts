import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVendorDashboardKpis(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-dashboard-kpis", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { count: activeOffers } = await supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId!)
        .eq("is_active", true);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: subOrders, count: monthOrders } = await supabase
        .from("sub_orders")
        .select("subtotal_incl_vat,status", { count: "exact" })
        .eq("vendor_id", vendorId!)
        .gte("created_at", startOfMonth.toISOString());

      const revenueCents = (subOrders ?? [])
        .filter((r: any) =>
          ["confirmed", "processing", "shipped", "partially_shipped", "delivered"].includes(
            r.status,
          ),
        )
        .reduce((sum, r: any) => sum + Number(r.subtotal_incl_vat ?? 0), 0);

      // CA prévisionnel — agrège la part vendeur des commandes prévisionnelles (actives, converties ou annulées)
      // créées ce mois-ci, à partir des lignes order_lines vendor_id = ce vendeur.
      const { data: forecastLines } = await supabase
        .from("order_lines")
        .select("line_total_incl_vat, orders!inner(id, created_at, is_forecast, was_forecast, forecast_created_at)")
        .eq("vendor_id", vendorId!)
        .or("is_forecast.eq.true,was_forecast.eq.true", { foreignTable: "orders" })
        .gte("orders.created_at", startOfMonth.toISOString());

      const forecastRevenueCents = (forecastLines ?? []).reduce(
        (sum, l: any) => sum + Number(l.line_total_incl_vat ?? 0),
        0,
      );
      const forecastOrders = new Set((forecastLines ?? []).map((l: any) => l.orders?.id).filter(Boolean)).size;

      return {
        activeOffers: activeOffers ?? 0,
        monthOrders: monthOrders ?? 0,
        revenueCents,
        forecastRevenueCents,
        forecastOrders,
      };
    },
  });
}
