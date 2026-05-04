import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSiteFeatures() {
  return useQuery({
    queryKey: ["site-features"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_config")
        .select("restock_enabled")
        .eq("id", 1)
        .maybeSingle();
      return {
        restockEnabled: data?.restock_enabled ?? true,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
