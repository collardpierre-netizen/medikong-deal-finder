import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns market prices for a product, filtered by user profile visibility config.
 */
export function useMarketPrices(productId: string | undefined) {
  const { user } = useAuth();

  // Get user's profile assignment
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-assignment", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_profile_assignments")
        .select("profile_id, user_profiles(*)")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Get visibility config for profile
  const profileId = (userProfile as any)?.profile_id;

  const { data: visibility = [] } = useQuery({
    queryKey: ["profile-visibility", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_visibility")
        .select("feature_key, is_visible")
        .eq("profile_id", profileId);
      return data || [];
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });

  // Get source config for profile
  const { data: sourceConfig = [] } = useQuery({
    queryKey: ["source-profile-config", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("source_profile_config")
        .select("*, market_price_sources(*)")
        .eq("profile_id", profileId);
      return data || [];
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });

  // Get market prices for product
  const { data: marketPrices = [] } = useQuery({
    queryKey: ["market-prices-product", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_prices")
        .select("*, market_price_sources(*)")
        .eq("product_id", productId!);
      return data || [];
    },
    enabled: !!productId,
  });

  const visMap: Record<string, boolean> = {};
  visibility.forEach((v: any) => {
    visMap[v.feature_key] = v.is_visible;
  });

  // Default: show everything if no profile config
  const hasProfileConfig = visibility.length > 0;
  const getVis = (key: string) => hasProfileConfig ? (visMap[key] ?? true) : true;

  const getSourceMode = (sourceId: string) => {
    const config = sourceConfig.find((sc: any) => sc.source_id === sourceId);
    return config?.display_mode || "market_price"; // default to market_price
  };

  const getSourceLabel = (sourceId: string) => {
    const config = sourceConfig.find((sc: any) => sc.source_id === sourceId);
    return config?.display_label;
  };

  // Split into market prices vs external offers
  const marketPriceItems = marketPrices.filter((mp: any) => {
    const mode = getSourceMode(mp.source_id);
    return mode === "market_price";
  });

  const externalOfferItems = marketPrices.filter((mp: any) => {
    const mode = getSourceMode(mp.source_id);
    return mode === "external_offer";
  });

  return {
    marketPriceItems,
    externalOfferItems,
    visMap: {
      show_wholesale_price: getVis("show_wholesale_price"),
      show_pharmacist_price: getVis("show_pharmacist_price"),
      show_public_price: getVis("show_public_price"),
      show_tva: getVis("show_tva"),
      show_supplier_name: getVis("show_supplier_name"),
    },
    getSourceLabel,
    hasProfileConfig,
    profileName: (userProfile as any)?.user_profiles?.name,
  };
}
