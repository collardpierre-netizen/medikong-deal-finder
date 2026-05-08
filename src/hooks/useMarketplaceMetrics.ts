import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MarketplaceMetrics = {
  suppliersCount: number;
  brandsCount: number;
  productsCount: number;
  offersCount: number;
  productsOnPromo: number;
  avgOffersPerProduct: number;
  maxOffersPerProduct: number;
  multiVendorProductsCount: number;
  avgOffersPerMultiProduct: number;
  medianOffersPerMultiProduct: number;
  refreshedAt: string;
};

/**
 * Source unique de vérité pour les chiffres clés affichés sur les pages publiques.
 * Lit la vue matérialisée `public_marketplace_metrics`, rafraîchie chaque nuit.
 */
export function useMarketplaceMetrics() {
  return useQuery<MarketplaceMetrics>({
    queryKey: ["public-marketplace-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_marketplace_metrics" as any)
        .select("*")
        .single();
      if (error) throw error;
      const row = data as any;
      return {
        suppliersCount: Number(row.suppliers_count) || 0,
        brandsCount: Number(row.brands_count) || 0,
        productsCount: Number(row.products_count) || 0,
        offersCount: Number(row.offers_count) || 0,
        productsOnPromo: Number(row.products_on_promo) || 0,
        avgOffersPerProduct: Number(row.avg_offers_per_product) || 0,
        maxOffersPerProduct: Number(row.max_offers_per_product) || 0,
        multiVendorProductsCount: Number(row.multi_vendor_products_count) || 0,
        avgOffersPerMultiProduct: Number(row.avg_offers_per_multi_product) || 0,
        medianOffersPerMultiProduct: Number(row.median_offers_per_multi_product) || 0,
        refreshedAt: row.refreshed_at,
      };
    },
    staleTime: 60 * 60 * 1000, // 1h
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
