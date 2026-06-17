import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Retourne le `buyer_profiles.id` du compte courant via la RPC SECURITY DEFINER
 * `current_buyer_profile_id`. Renvoie `null` si l'utilisateur n'est pas connecté
 * ou si aucun profil acheteur ne lui est rattaché.
 */
export function useCurrentBuyerProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current-buyer-profile", user?.id ?? null],
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("current_buyer_profile_id");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useIsResellerPro() {
  const q = useCurrentBuyerProfile();
  return { ...q, isReseller: q.data === "revendeur_pro" };
}
