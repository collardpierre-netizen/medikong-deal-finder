import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductCagnotteStatus {
  has_eligible_offer: boolean;
  nb_eligible_offers: number;
  nb_total_offers: number;
}

/**
 * Éligibilité cagnotte au niveau PRODUIT, dérivée des offres
 * (vue `product_cagnotte_status`) : au moins une offre éligible suffit.
 */
export function useProductCagnotteStatus(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-cagnotte-status", productId],
    queryFn: async (): Promise<ProductCagnotteStatus | null> => {
      const { data, error } = await supabase
        .from("product_cagnotte_status" as any)
        .select("has_eligible_offer, nb_eligible_offers, nb_total_offers")
        .eq("product_id", productId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as any;
      return {
        has_eligible_offer: !!row.has_eligible_offer,
        nb_eligible_offers: Number(row.nb_eligible_offers || 0),
        nb_total_offers: Number(row.nb_total_offers || 0),
      };
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}
