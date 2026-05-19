import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiscountReference = "pvp" | "market";

export interface DiscountSearchParams {
  reference: DiscountReference;
  minDiscountPct: number;
  brandIds?: string[];
  manufacturerIds?: string[];
  country: string; // 'BE'|'FR'|'LU'
  categoryIds?: string[];
  perPage?: number;
}

export interface DiscountRow {
  product_id: string;
  product_slug: string | null;
  product_name: string;
  cnk: string | null;
  brand_id: string | null;
  brand_name: string | null;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  country_code: string;
  best_price_htva_cents: number;
  reference_price_cents: number;
  reference_kind: string;
  discount_pct: number;
  total_count: number;
}

async function fetchDiscountPage(params: DiscountSearchParams, offset: number, limit: number): Promise<DiscountRow[]> {
  const { data, error } = await (supabase as any).rpc("search_discount_offers", {
    _reference: params.reference,
    _min_discount_pct: params.minDiscountPct,
    _brand_ids: params.brandIds?.length ? params.brandIds : null,
    _manufacturer_ids: params.manufacturerIds?.length ? params.manufacturerIds : null,
    _country: params.country,
    _category_ids: params.categoryIds?.length ? params.categoryIds : null,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return (data || []) as DiscountRow[];
}

export function useDiscountSearch(params: DiscountSearchParams, enabled: boolean) {
  const perPage = params.perPage ?? 100;
  return useInfiniteQuery({
    queryKey: ["discount-search", params],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) => fetchDiscountPage(params, pageParam as number, perPage),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.length) return undefined;
      const total = lastPage[0]?.total_count ?? 0;
      const loaded = allPages.reduce((acc, p) => acc + p.length, 0);
      return loaded < total ? loaded : undefined;
    },
    staleTime: 60_000,
  });
}

export async function fetchAllDiscountResults(params: DiscountSearchParams, max = 5000): Promise<DiscountRow[]> {
  // Single call up to 5000 for export
  return fetchDiscountPage(params, 0, max);
}
