import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBuyerProfileId } from "./useResolvedOfferPrice";

export type ResolvedOfferPriceRow = {
  offer_id: string;
  vendor_id: string | null;
  base_price_excl_vat: number;
  resolved_price_excl_vat: number;
  source:
    | "offer_absolute"
    | "offer_discount"
    | "vendor_default_absolute"
    | "vendor_default_discount"
    | "offer_base";
};

/**
 * Marketplace pricing pour la fiche produit côté acheteur.
 *
 * Liste toutes les offres actives du produit, résout le prix HTVA effectif
 * de chacune via la RPC `resolve_offer_price_for_profile` (qui lit
 * `offer_buyer_profile_prices` + `vendor_profile_defaults`), et expose :
 *   - `best`: l'offre la moins chère pour le profil acheteur courant
 *   - `offers`: la liste complète triée par prix résolu croissant
 *
 * NOTE: la table `offer_profile_rules` ne contient PAS de prix — uniquement
 * MOQ/MOV. C'est `offer_buyer_profile_prices` qui porte les prix par profil.
 */
export function useBestOfferPrice(productId: string | null | undefined) {
  const buyerProfileId = useBuyerProfileId();

  return useQuery({
    queryKey: ["best-offer-price-by-profile", productId, buyerProfileId],
    queryFn: async (): Promise<{
      best: ResolvedOfferPriceRow | null;
      offers: ResolvedOfferPriceRow[];
      buyerProfileId: string | null;
    }> => {
      if (!productId || !buyerProfileId) {
        return { best: null, offers: [], buyerProfileId };
      }

      const { data: offers, error } = await supabase
        .from("offers")
        .select("id, vendor_id, price_excl_vat, is_active")
        .eq("product_id", productId)
        .eq("is_active", true);

      if (error || !offers || offers.length === 0) {
        return { best: null, offers: [], buyerProfileId };
      }

      const resolved = await Promise.all(
        offers.map(async (o: any) => {
          const { data: rpcData } = await supabase.rpc(
            "resolve_offer_price_for_profile" as any,
            { _offer_id: o.id, _buyer_profile_id: buyerProfileId }
          );
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const resolved_price = row
            ? Number((row as any).price_excl_vat)
            : Number(o.price_excl_vat ?? 0);
          const source = (row as any)?.source ?? "offer_base";
          return {
            offer_id: o.id,
            vendor_id: o.vendor_id ?? null,
            base_price_excl_vat: Number(o.price_excl_vat ?? 0),
            resolved_price_excl_vat: resolved_price,
            source,
          } as ResolvedOfferPriceRow;
        })
      );

      const sorted = resolved
        .filter((r) => r.resolved_price_excl_vat > 0)
        .sort((a, b) => a.resolved_price_excl_vat - b.resolved_price_excl_vat);

      return {
        best: sorted[0] ?? null,
        offers: sorted,
        buyerProfileId,
      };
    },
    enabled: !!productId && !!buyerProfileId,
    staleTime: 60 * 1000,
  });
}
