import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendorCompetitorAlert {
  id: string;
  vendor_id: string;
  product_id: string;
  country_code: string;
  my_offer_id: string | null;
  my_price: number;
  competitor_vendor_id: string | null;
  competitor_price: number;
  previous_rank: number | null;
  current_rank: number;
  total_competitors: number;
  gap_amount: number;
  gap_percentage: number;
  suggested_price: number | null;
  status: "new" | "seen" | "resolved" | "dismissed";
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    gtin: string | null;
    image_url: string | null;
    brand_name: string | null;
  };
  competitor?: {
    id: string;
    company_name: string | null;
    name: string | null;
  };
}

export function useVendorCompetitorAlerts(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-competitor-alerts", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      // Trigger detection first (idempotent)
      await supabase.rpc("detect_vendor_competitor_alerts" as any).throwOnError();

      const { data, error } = await (supabase as any)
        .from("vendor_competitor_alerts")
        .select(`
          *,
          product:products!inner(id, name, gtin, image_url, brand_name),
          competitor:vendors!vendor_competitor_alerts_competitor_vendor_id_fkey(id, company_name, name)
        `)
        .eq("vendor_id", vendorId!)
        .in("status", ["new", "seen"])
        .order("gap_percentage", { ascending: false });
      if (error) throw error;
      return (data || []) as VendorCompetitorAlert[];
    },
  });
}

export function useCompetitorAlertsCount(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-competitor-alerts-count", vendorId],
    enabled: !!vendorId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("vendor_competitor_alerts")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId!)
        .eq("status", "new");
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useMarkAlertSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await (supabase as any)
        .from("vendor_competitor_alerts")
        .update({ status: "seen", read_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-competitor-alerts"] });
      qc.invalidateQueries({ queryKey: ["vendor-competitor-alerts-count"] });
    },
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await (supabase as any)
        .from("vendor_competitor_alerts")
        .update({ status: "dismissed" })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-competitor-alerts"] });
      qc.invalidateQueries({ queryKey: ["vendor-competitor-alerts-count"] });
    },
  });
}

export function useAdjustOfferPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      offerId,
      newPrice,
      vatRate = 21,
      alertId,
    }: { offerId: string; newPrice: number; vatRate?: number; alertId?: string }) => {
      const { error } = await supabase
        .from("offers")
        .update({
          price_excl_vat: newPrice,
          price_incl_vat: Math.round(newPrice * (1 + vatRate / 100) * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq("id", offerId);
      if (error) throw error;

      if (alertId) {
        await (supabase as any)
          .from("vendor_competitor_alerts")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", alertId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-competitor-alerts"] });
      qc.invalidateQueries({ queryKey: ["vendor-competitor-alerts-count"] });
      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
    },
  });
}
