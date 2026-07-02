import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendorGmvProgress {
  vendor_id: string;
  rule_id: string | null;
  rule_name: string | null;
  gmv_window: "calendar_year" | "rolling_12m";
  tiers_direction: "decreasing" | "increasing";
  window_start: string;
  window_end: string;
  current_gmv_cents: number;
  current_tier_percentage: number | null;
  current_tier_label: string | null;
  base_percentage: number | null;
  next_tier_min_gmv_cents: number | null;
  next_tier_percentage: number | null;
  next_tier_label: string | null;
  progress_pct: number;
  has_tiers: boolean;
}

/**
 * Progression GMV vendeur vs paliers de commission négociée
 * configurés dans /admin/commissions (table margin_rule_tiers).
 */
export function useVendorGmvProgress(vendorId: string | undefined) {
  return useQuery<VendorGmvProgress | null>({
    queryKey: ["vendor-gmv-progress", vendorId],
    enabled: !!vendorId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_gmv_progress", {
        _vendor_id: vendorId!,
      });
      if (error) throw error;
      return (data as unknown as VendorGmvProgress) ?? null;
    },
  });
}
