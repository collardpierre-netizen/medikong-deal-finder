import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { applyMargin } from "@/lib/pricing";
import { useBestOfferPrice } from "./useBestOfferPrice";
import { useBuyerProfileId } from "./useResolvedOfferPrice";

/**
 * Code de niveau de prix de l'utilisateur connecté (legacy, conservé pour
 * compatibilité d'affichage). Utilise désormais buyer_profile_id comme code
 * canonique afin d'être cohérent avec la nouvelle cascade marketplace.
 */
export function useUserPriceLevel() {
  const { user } = useAuth();
  const buyerProfileId = useBuyerProfileId();

  const { data: levelCode } = useQuery({
    queryKey: ["user-price-level", user?.id, buyerProfileId],
    queryFn: async () => {
      if (!user) return "public";
      // Source unique : buyer_profile_id résolu (profession → buyer_profile).
      // Plus de lecture de profiles.price_level_code (legacy product_prices).
      return buyerProfileId || "autre";
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return levelCode || (user ? "autre" : "public");
}

/**
 * Résout le prix affiché à l'acheteur pour un produit.
 *
 * Cascade (alignée sur la vue DB `effective_offer_prices_v`) :
 *   1. **Prix marketplace par profil** sur la meilleure offre active
 *      (RPC `resolve_offer_price_for_profile` → `offer_buyer_profile_prices`
 *      + `vendor_profile_defaults`).
 *   2. **Prix MediKong** = `bestPriceExclVat` (Qogita) + marge par défaut.
 *
 * NOTE: La lecture directe de `product_prices` × `price_levels` a été retirée.
 * La table `product_prices` est conservée DEPRECATED en DB et reste prise en
 * compte via la cascade serveur (vue `effective_offer_prices_v`) pour ne pas
 * casser un éventuel client qui dépendrait encore d'un prix legacy.
 */
export function useProductPrice(
  productId: string | undefined,
  bestPriceExclVat: number | null | undefined
) {
  const levelCode = useUserPriceLevel();

  // 1. Prix marketplace par profil acheteur (priorité la plus haute)
  const { data: marketplace } = useBestOfferPrice(productId);

  // Cascade de résolution
  let resolvedPrice: number;
  let priceSource: "marketplace_profile" | "medikong_margin";

  if (marketplace?.best && marketplace.best.resolved_price_excl_vat > 0) {
    resolvedPrice = marketplace.best.resolved_price_excl_vat;
    priceSource = "marketplace_profile";
  } else {
    resolvedPrice = applyMargin(bestPriceExclVat || 0);
    priceSource = "medikong_margin";
  }

  return {
    levelCode,
    resolvedPrice,
    hasCustomPrice: !!marketplace?.best,
    // allPrices vide : l'écran "Comparaison des prix par profil" basé sur
    // product_prices ne s'affiche plus (la longueur reste à 0).
    allPrices: [] as Array<never>,
    levelLabel: getLevelLabel(levelCode),
    // Marketplace details
    marketplaceBest: marketplace?.best ?? null,
    marketplaceOffers: marketplace?.offers ?? [],
    buyerProfileId: marketplace?.buyerProfileId ?? null,
    priceSource,
  };
}

function getLevelLabel(code: string): string {
  const labels: Record<string, string> = {
    public: "Prix public",
    pharmacien: "Prix pharmacien",
    grossiste: "Prix grossiste",
    hopital: "Prix hospitalier",
    medikong: "Prix MediKong",
    autre: "Prix",
  };
  return labels[code] || "Prix";
}
