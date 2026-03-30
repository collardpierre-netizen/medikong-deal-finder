import { MeiliSearch } from "meilisearch";

// These are public, read-only search keys — safe for client-side
const MEILI_URL = import.meta.env.VITE_MEILISEARCH_URL || "";
const MEILI_SEARCH_KEY = import.meta.env.VITE_MEILISEARCH_SEARCH_KEY || "";

export const meiliClient = new MeiliSearch({
  host: MEILI_URL,
  apiKey: MEILI_SEARCH_KEY,
});

export interface MeiliProduct {
  id: string;
  name: string;
  slug: string;
  brand_name: string;
  gtin: string;
  cnk_code: string;
  image_url: string;
  best_price_excl_vat: number;
  best_price_incl_vat: number;
  offer_count: number;
  is_in_stock: boolean;
  category_name: string;
}

export interface MeiliBrand {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  product_count: number;
}

export interface MeiliCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image_url: string;
}

export interface FederatedResults {
  products: MeiliProduct[];
  brands: MeiliBrand[];
  categories: MeiliCategory[];
}

export async function federatedSearch(query: string): Promise<FederatedResults> {
  if (!query.trim() || !MEILI_URL) {
    return { products: [], brands: [], categories: [] };
  }

  const response = await meiliClient.multiSearch({
    queries: [
      { indexUid: "products", q: query, limit: 6 },
      { indexUid: "brands", q: query, limit: 3 },
      { indexUid: "categories", q: query, limit: 3 },
    ],
  });

  return {
    products: (response.results[0]?.hits || []) as MeiliProduct[],
    brands: (response.results[1]?.hits || []) as MeiliBrand[],
    categories: (response.results[2]?.hits || []) as MeiliCategory[],
  };
}

export function isMeilisearchConfigured(): boolean {
  return !!(MEILI_URL && MEILI_SEARCH_KEY);
}
