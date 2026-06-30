import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { useBuyerProfileId } from "@/hooks/useResolvedOfferPrice";
import { resolveVendorLabel } from "@/lib/vendor-display";

export interface BatchBestOffer {
  productId: string;
  offerId: string;
  vendorId: string;
  sellerName: string;
  sellerSlug?: string | null;
  displayCode?: string | null;
  isVerified: boolean;
  unitPriceEur: number;
  unitPriceInclVat: number;
  priceSource: string;
  deliveryDays: number | null;
  stockQuantity: number;
  offerCount: number;
  totalStock: number;
}

/**
 * Hydrate les meilleures offres pour N produits via 1 seul RPC
 * (`get_best_offers_for_products`) au lieu de N appels parallèles
 * `useProductOffers`. Utilisé sur les vues catalogue Trivago pour éviter
 * la saturation du pool PostgREST (24 cards × 1 RPC = 24 round-trips).
 *
 * Le détail complet des offres (autres vendeurs, paliers, tiers…) reste
 * chargé en lazy par `useProductOffers` au survol/expand de la card.
 */
export function useBestOffersBatch(productIds: string[]) {
  const { country } = useCountry();
  const buyerProfileId = useBuyerProfileId();
  // Clé stable triée pour bénéficier du cache React Query sur refetch d'ordre.
  const sortedIds = [...productIds].sort();
  return useQuery({
    queryKey: ["best-offers-batch", country, buyerProfileId, sortedIds],
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, BatchBestOffer>> => {
      const { data, error } = await supabase.rpc("get_best_offers_for_products" as any, {
        _product_ids: sortedIds,
        _country: country,
        _buyer_profile_id: buyerProfileId ?? null,
      });
      if (error) throw error;
      const map = new Map<string, BatchBestOffer>();
      const ctx = { country, customerType: buyerProfileId || undefined };
      for (const r of (data || []) as any[]) {
        const vendorLike = {
          id: r.vendor_id,
          name: r.vendor_name,
          company_name: r.vendor_company_name,
          display_name: r.vendor_display_name,
          display_code: r.vendor_display_code,
          show_real_name: r.vendor_show_real_name,
        };
        const sellerName = resolveVendorLabel(
          vendorLike as any,
          r.vendor_show_real_name_resolved
            ? [{ vendor_id: r.vendor_id, country_code: null, customer_type: null, show_real_name: true, priority: 1 }]
            : [],
          ctx
        );
        map.set(r.product_id, {
          productId: r.product_id,
          offerId: r.offer_id,
          vendorId: r.vendor_id,
          sellerName,
          sellerSlug: null,
          displayCode: r.vendor_display_code,
          isVerified: !!r.vendor_is_verified,
          unitPriceEur: Number(r.effective_price_excl_vat) || 0,
          unitPriceInclVat: Number(r.effective_price_incl_vat) || 0,
          priceSource: r.price_source ?? "offer_base",
          deliveryDays: r.delivery_days ?? null,
          stockQuantity: Number(r.stock_quantity) || 0,
          offerCount: Number(r.offer_count) || 0,
          totalStock: Number(r.total_stock) || 0,
        });
      }
      return map;
    },
  });
}
