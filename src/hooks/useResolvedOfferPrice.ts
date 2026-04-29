import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Résout le buyer_profile_id (référentiel) de l'utilisateur connecté
 * en fonction de sa profession déclarée. Retourne 'autre' par défaut.
 */
export function useBuyerProfileId(): string | null {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["resolve-buyer-profile-for-user", user?.id],
    queryFn: async () => {
      if (!user) return "autre";
      const { data, error } = await supabase.rpc(
        "resolve_buyer_profile_for_user" as any,
        { _user_id: user.id }
      );
      if (error) return "autre";
      return (data as string) || "autre";
    },
    enabled: true,
    staleTime: 10 * 60 * 1000,
  });

  return data ?? (user ? null : null);
}

/**
 * Résout le prix HTVA effectif pour une offre, en tenant compte
 * du profil acheteur de l'utilisateur connecté.
 *
 * Cascade serveur (RPC resolve_offer_price_for_profile) :
 *   override offre absolu > override offre % > défaut vendeur absolu
 *   > défaut vendeur % > prix de base de l'offre
 */
export function useResolvedOfferPrice(offerId: string | null | undefined) {
  const buyerProfileId = useBuyerProfileId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["resolve-offer-price-for-profile", offerId, buyerProfileId],
    queryFn: async () => {
      if (!offerId || !buyerProfileId) return null;
      const { data, error } = await supabase.rpc(
        "resolve_offer_price_for_profile" as any,
        { _offer_id: offerId, _buyer_profile_id: buyerProfileId }
      );
      if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        price_excl_vat: Number((row as any).price_excl_vat),
        source: (row as any).source as
          | "offer_absolute"
          | "offer_discount"
          | "vendor_default_absolute"
          | "vendor_default_discount"
          | "offer_base",
      };
    },
    enabled: !!offerId && !!buyerProfileId && !!user,
    staleTime: 60 * 1000,
  });
}
