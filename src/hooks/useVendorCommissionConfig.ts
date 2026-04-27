import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VendorCommissionConfig } from "@/lib/vendorMargin";

/**
 * Charge la configuration commission d'un vendeur (modèle + taux/share/montant fixe).
 * Stale long car ces valeurs changent rarement.
 */
export function useVendorCommissionConfig(vendorId: string | null | undefined) {
  return useQuery({
    enabled: !!vendorId,
    queryKey: ["vendor-commission-config", vendorId],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VendorCommissionConfig | null> => {
      if (!vendorId) return null;
      const { data, error } = await supabase
        .from("vendors")
        .select("commission_model, commission_rate, margin_split_pct, fixed_commission_amount")
        .eq("id", vendorId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        commission_model: (data.commission_model as any) ?? "flat_percentage",
        commission_rate: data.commission_rate as number | null,
        margin_split_pct: data.margin_split_pct as number | null,
        fixed_commission_amount: (data as any).fixed_commission_amount as number | null,
      };
    },
  });
}
