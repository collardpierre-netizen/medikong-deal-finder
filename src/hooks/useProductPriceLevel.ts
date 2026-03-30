import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { applyMargin } from "@/lib/pricing";

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

export function useProductPrice(productId: string | undefined, bestPriceExclVat: number | null | undefined) {
  const levelCode = useUserPriceLevel();
  const { user } = useAuth();

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

  // Find the price for user's level
  const userLevelPrice = customPrice?.find((p: any) => (p as any).price_levels?.code === levelCode);
  const resolvedPrice = userLevelPrice
    ? Number(userLevelPrice.price)
    : applyMargin(bestPriceExclVat || 0);

  return {
    levelCode,
    resolvedPrice,
    hasCustomPrice: !!userLevelPrice,
    allPrices: customPrice || [],
    levelLabel: getLevelLabel(levelCode),
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
