import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { applyMargin } from "@/lib/pricing";
import { useBestOfferPrice } from "./useBestOfferPrice";

/**
 * Returns the user's price level code and the resolved price for a product.
 * Falls back to MediKong price (Qogita + margin) if no custom price exists.
 */
export function useUserPriceLevel() {
  const { user } = useAuth();

  const { data: levelCode } = useQuery({
    queryKey: ["user-price-level", user?.id],
    queryFn: async () => {
      if (!user) return "public";
      const { data } = await supabase
        .from("profiles")
        .select("price_level_code")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any)?.price_level_code || "pharmacien";
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  return levelCode || (user ? "pharmacien" : "public");
}

/**
 * Résout le prix affiché à l'acheteur pour un produit.
 *
 * Cascade (du plus spécifique au plus général) :
 *   1. **Prix par profil acheteur** sur la meilleure offre active
 *      (table `offer_buyer_profile_prices` via RPC `resolve_offer_price_for_profile`).
 *      C'est la nouvelle source de vérité marketplace.
 *   2. **Prix RBAC niveau** (table `product_prices` × `price_levels`) — legacy,
 *      conservé pour compat (clients sans système d'offres).
 *   3. **Prix MediKong** = `bestPriceExclVat` (Qogita) + marge par défaut.
 */
export function useProductPrice(
  productId: string | undefined,
  bestPriceExclVat: number | null | undefined
) {
  const levelCode = useUserPriceLevel();
  const { user } = useAuth();

  // 1. Prix marketplace par profil acheteur (priorité la plus haute)
  const { data: marketplace } = useBestOfferPrice(productId);

  // 2. Legacy: prix par niveau RBAC
  const { data: customPrice } = useQuery({
    queryKey: ["product-level-price", productId, levelCode],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_prices")
        .select("price, price_level_id, price_levels!inner(code, label_fr)")
        .eq("product_id", productId!)
        .order("price_levels(sort_order)");
      return data || [];
    },
    enabled: !!productId && !!user,
  });

  const userLevelPrice = customPrice?.find(
    (p: any) => (p as any).price_levels?.code === levelCode
  );

  // Cascade de résolution
  let resolvedPrice: number;
  let priceSource: "marketplace_profile" | "rbac_level" | "medikong_margin";

  if (marketplace?.best && marketplace.best.resolved_price_excl_vat > 0) {
    resolvedPrice = marketplace.best.resolved_price_excl_vat;
    priceSource = "marketplace_profile";
  } else if (userLevelPrice) {
    resolvedPrice = Number(userLevelPrice.price);
    priceSource = "rbac_level";
  } else {
    resolvedPrice = applyMargin(bestPriceExclVat || 0);
    priceSource = "medikong_margin";
  }

  return {
    levelCode,
    resolvedPrice,
    hasCustomPrice: !!userLevelPrice || !!marketplace?.best,
    allPrices: customPrice || [],
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
  };
  return labels[code] || "Prix";
}

