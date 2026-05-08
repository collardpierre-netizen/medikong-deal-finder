import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * SKU multi-vendeurs avec écart de prix significatif entre offres actives.
 * Lecture de la vue publique `public_top_price_deltas` (security_invoker).
 *
 * Filtres appliqués côté DB :
 *   - ≥ 3 offres actives non masquées par produit
 *   - écart 15% à 80% (exclut outliers / promos extrêmes)
 *   - top 30 par delta décroissant
 *
 * Utilisé sur la home pour la preuve chiffrée d'économie (PriceDeltaShowcase).
 */
export type PriceDelta = {
  productId: string;
  slug: string;
  name: string;
  brandName: string | null;
  imageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  offerCount: number;
  deltaPct: number;
};

export function useTopPriceDeltas(limit = 3) {
  return useQuery<PriceDelta[]>({
    queryKey: ["top-price-deltas", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_top_price_deltas" as any)
        .select(
          "product_id, slug, name, name_fr, brand_name, image_url, image_urls, min_price, max_price, offer_count, delta_pct"
        )
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        productId: d.product_id,
        slug: d.slug,
        name: d.name_fr ?? d.name,
        brandName: d.brand_name ?? null,
        imageUrl:
          d.image_url ??
          (Array.isArray(d.image_urls) && d.image_urls.length > 0
            ? d.image_urls[0]
            : null),
        minPrice: Number(d.min_price),
        maxPrice: Number(d.max_price),
        offerCount: Number(d.offer_count),
        deltaPct: Number(d.delta_pct),
      }));
    },
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
