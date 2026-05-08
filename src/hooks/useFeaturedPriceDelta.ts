import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PriceDelta } from "./useTopPriceDeltas";

export type FeaturedPriceDeltaResult =
  | { status: "ok"; delta: PriceDelta }
  | {
      status: "no_offers" | "single_offer";
      product: {
        id: string;
        slug: string;
        name: string;
        brandName: string | null;
        imageUrl: string | null;
      };
      offerCount: number;
    }
  | { status: "not_found" };

/**
 * Calcule en live le delta min/max sur un produit pinné par l'admin
 * (utilisé sur la home pour la preuve chiffrée d'économie).
 *
 * Retourne un statut explicite pour permettre à l'UI d'afficher
 * "pas encore d'offres" plutôt que de basculer silencieusement sur le top delta.
 */
export function useFeaturedPriceDelta(productId: string | null | undefined) {
  return useQuery<FeaturedPriceDeltaResult | null>({
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
      if (!product) return { status: "not_found" } as const;

      const prices = (offersRes.data ?? [])
        .map((o: any) => Number(o.price_excl_vat))
        .filter((p) => Number.isFinite(p) && p > 0);

      const productLite = {
        id: product.id,
        slug: product.slug,
        name: (product as any).name_fr ?? product.name,
        brandName: (product as any).brand?.name ?? null,
        imageUrl:
          product.image_url ??
          (Array.isArray(product.image_urls) && product.image_urls.length > 0
            ? (product.image_urls[0] as string)
            : null),
      };

      if (prices.length < 2) {
        return {
          status: prices.length === 0 ? "no_offers" : "single_offer",
          product: productLite,
          offerCount: prices.length,
        } as const;
      }

      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const delta = max > 0 ? ((max - min) / max) * 100 : 0;

      return {
        status: "ok",
        delta: {
          productId: product.id,
          slug: product.slug,
          name: productLite.name,
          brandName: productLite.brandName,
          imageUrl: productLite.imageUrl,
          minPrice: min,
          maxPrice: max,
          offerCount: prices.length,
          deltaPct: Math.round(delta * 10) / 10,
        },
      } as const;
    },
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
