import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CountryOfferCounts = Record<string, { visible: number; hidden: number }>;

async function fetchCountForCountry(code: string): Promise<{ visible: number; hidden: number }> {
  // Total actives
  const totalRes = await supabase
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const visibleRes = await supabase
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .or(`country_code.eq.${code},country_codes.cs.{${code}}`);

  const total = totalRes.count ?? 0;
  const visible = visibleRes.count ?? 0;
  return { visible, hidden: Math.max(0, total - visible) };
}

export function useCountryOfferCounts(codes: string[]) {
  return useQuery<CountryOfferCounts>({
    queryKey: ["country-offer-counts", codes.slice().sort().join(",")],
    queryFn: async () => {
      const results = await Promise.all(codes.map((c) => fetchCountForCountry(c)));
      const map: CountryOfferCounts = {};
      codes.forEach((c, i) => {
        map[c] = results[i];
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
    enabled: codes.length > 0,
  });
}
