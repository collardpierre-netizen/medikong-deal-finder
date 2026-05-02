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

      const { count: monthOrders } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId!)
        .gte("created_at", startOfMonth.toISOString());

      const { data: revenueRows } = await supabase
        .from("orders")
        .select("total_amount_cents")
        .eq("vendor_id", vendorId!)
        .gte("created_at", startOfMonth.toISOString())
        .in("status", ["paid", "shipped", "delivered", "completed"]);

      const revenueCents = (revenueRows ?? []).reduce(
        (sum, r: any) => sum + (r.total_amount_cents ?? 0),
        0,
      );

      return {
        activeOffers: activeOffers ?? 0,
        monthOrders: monthOrders ?? 0,
        revenueCents,
      };
    },
  });
}
