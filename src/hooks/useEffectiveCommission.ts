import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VendorCommissionConfig } from "@/lib/vendorMargin";

export type EffectiveCommissionSource = "offer" | "product" | "vendor";

export interface EffectiveCommission extends VendorCommissionConfig {
  source: EffectiveCommissionSource;
  valid_from: string | null;
  valid_until: string | null;
  via_admin_shortcut: boolean;
}

/**
 * Résout la commission effective pour une offre via la cascade
 * offer override > product override (vendor_product_commissions) > vendor default.
 * Voir RPC public.resolve_effective_commission(uuid).
 */
export function useEffectiveCommission(offerId: string | null | undefined) {
  return useQuery({
    enabled: !!offerId,
    queryKey: ["effective-commission", offerId],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<EffectiveCommission | null> => {
      if (!offerId) return null;
      const { data, error } = await supabase.rpc("resolve_effective_commission", {
        _offer_id: offerId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        source: (row as any).source as EffectiveCommissionSource,
        commission_model: ((row as any).commission_model as any) ?? "flat_percentage",
        commission_rate: (row as any).commission_rate as number | null,
        margin_split_pct: (row as any).margin_split_pct as number | null,
        fixed_commission_amount: (row as any).fixed_commission_amount as number | null,
        valid_from: (row as any).valid_from as string | null,
        valid_until: (row as any).valid_until as string | null,
        via_admin_shortcut: Boolean((row as any).via_admin_shortcut),
      };
    },
  });
}

