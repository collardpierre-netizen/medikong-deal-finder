import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardPeriod } from "@/hooks/useVendorMonthlyDashboard";

/**
 * KPIs secondaires vendeur (offres actives + prévisionnel).
 *
 * ⚠️ Le CA / GMV / nombre de commandes réels ne sont **plus** calculés ici :
 *   ils viennent de `useVendorMonthlyDashboard` (source unique `order_lines`,
 *   mêmes règles de statuts / mêmes unités). Cela corrige le bug d'unité qui
 *   divisait par 100 des euros stockés dans `sub_orders.subtotal_incl_vat`.
 */
export function useVendorDashboardKpis(
  vendorId: string | undefined,
  period?: DashboardPeriod,
) {
  const { start, end } = useMemo(() => {
    if (period) {
      const s = new Date(period.start); s.setHours(0, 0, 0, 0);
      const e = new Date(period.end); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: s, end: e };
  }, [period?.start?.getTime(), period?.end?.getTime()]);

  return useQuery({
    queryKey: ["vendor-dashboard-kpis", vendorId, start.toISOString(), end.toISOString()],
    enabled: !!vendorId,
    queryFn: async () => {
      const { count: activeOffers } = await supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId!)
        .eq("is_active", true);

      // CA prévisionnel — agrège la part vendeur des commandes prévisionnelles
      // (actives, converties ou annulées) créées dans la période sélectionnée.
      const { data: forecastLines } = await supabase
        .from("order_lines")
        .select(
          "line_total_incl_vat, line_total_excl_vat, line_margin, orders!inner(id, created_at, is_forecast, was_forecast, forecast_created_at)",
        )
        .eq("vendor_id", vendorId!)
        .or("is_forecast.eq.true,was_forecast.eq.true", { foreignTable: "orders" })
        .gte("orders.created_at", start.toISOString())
        .lte("orders.created_at", end.toISOString());

      const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
      const forecastRevenueCents = (forecastLines ?? []).reduce(
        (sum, l: any) => sum + toCents(l.line_total_incl_vat),
        0,
      );
      const forecastExclVatCents = (forecastLines ?? []).reduce(
        (sum, l: any) => sum + toCents(l.line_total_excl_vat),
        0,
      );
      const forecastMarginCents = (forecastLines ?? []).reduce(
        (sum, l: any) => sum + toCents(l.line_margin),
        0,
      );
      const forecastMarginPct =
        forecastExclVatCents > 0
          ? (forecastMarginCents / forecastExclVatCents) * 100
          : 0;
      const forecastOrders = new Set(
        (forecastLines ?? []).map((l: any) => l.orders?.id).filter(Boolean),
      ).size;

      return {
        activeOffers: activeOffers ?? 0,
        forecastRevenueCents,
        forecastMarginCents,
        forecastMarginPct,
        forecastOrders,
      };
    },
  });
}
