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

      return {
        activeOffers: activeOffers ?? 0,
        monthOrders: monthOrders ?? 0,
        revenueCents,
      };
    },
  });
}
