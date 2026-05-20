import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendorActiveMarginRule {
  id: string;
  name: string;
  margin_percentage: number;
  priority: number;
  brand_id: string | null;
  category_id: string | null;
}

/**
 * Récupère la règle de commission active la plus prioritaire ciblant
 * spécifiquement ce vendeur (margin_rules.vendor_id = vendor.id, is_active = true).
 * Ne couvre pas la cascade marque/catégorie/global (qui dépend de l'offre).
 */
export function useVendorActiveMarginRule(vendorId: string | null | undefined) {
  return useQuery({
    enabled: !!vendorId,
    queryKey: ["vendor-active-margin-rule", vendorId],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<VendorActiveMarginRule | null> => {
      if (!vendorId) return null;
      const { data, error } = await supabase
        .from("margin_rules")
        .select("id, name, margin_percentage, priority, brand_id, category_id")
        .eq("vendor_id", vendorId)
        .eq("is_active", true)
        .is("brand_id", null)
        .is("category_id", null)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as VendorActiveMarginRule | null) ?? null;
    },
  });
}
