import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PriceDelta } from "./useTopPriceDeltas";

/**
 * Calcule en live le delta min/max sur un produit pinné par l'admin
 * (utilisé sur la home pour la preuve chiffrée d'économie).
 *
 * Lecture directe de `offers` (RLS publique sur is_active=true) + `products`
 * pour bypasser le filtre top-30 / 15-80% de la vue `public_top_price_deltas`.
 */
export function useFeaturedPriceDelta(productId: string | null | undefined) {
  return useQuery<PriceDelta | null>({
    queryKey: ["featured-price-delta", productId],
    enabled: !!productId,
    queryFn: async () => {
      if (!productId) return null;

      const [productRes, offersRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, slug, name, name_fr, image_url, image_urls, brand:brands(name)")
          .eq("id", productId)
          .maybeSingle(),
        supabase
          .from("offers")
          .select("price_excl_vat")
          .eq("product_id", productId)
          .eq("is_active", true)
          .not("price_excl_vat", "is", null),
      ]);

      if (productRes.error) throw productRes.error;
      if (offersRes.error) throw offersRes.error;

      const product = productRes.data;
      const prices = (offersRes.data ?? [])
        .map((o: any) => Number(o.price_excl_vat))
        .filter((p) => Number.isFinite(p) && p > 0);

      if (!product || prices.length < 2) return null;

      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const delta = max > 0 ? ((max - min) / max) * 100 : 0;

      return {
        productId: product.id,
        slug: product.slug,
        name: (product as any).name_fr ?? product.name,
        brandName: (product as any).brand?.name ?? null,
        imageUrl:
          product.image_url ??
          (Array.isArray(product.image_urls) && product.image_urls.length > 0
            ? (product.image_urls[0] as string)
            : null),
        minPrice: min,
        maxPrice: max,
        offerCount: prices.length,
        deltaPct: Math.round(delta * 10) / 10,
      };
    },
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
