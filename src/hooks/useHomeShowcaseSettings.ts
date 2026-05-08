import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lit la config du bloc "Comparaison live" de la home (singleton).
 * Le produit pinné est admin-éditable via /admin/cms/home/comparaison.
 */
export function useHomeShowcaseSettings() {
  return useQuery({
    queryKey: ["home-showcase-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("home_showcase_settings")
        .select("pinned_product_id, updated_at")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as { pinned_product_id: string | null; updated_at: string } | null;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
