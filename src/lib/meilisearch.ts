import { MeiliSearch } from "meilisearch";
import { supabase } from "@/integrations/supabase/client";

// Cache the config so we only fetch once
let _meiliClient: MeiliSearch | null = null;
let _configured: boolean | null = null;
let _configPromise: Promise<{ url: string; key: string } | null> | null = null;

async function fetchMeiliConfig(): Promise<{ url: string; key: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("sync-meilisearch", {
      body: { action: "get-search-key" },
    });
    if (error || !data?.url || !data?.searchKey) return null;
    return { url: data.url, key: data.searchKey };
  } catch {
    return null;
  }
}

async function getClient(): Promise<MeiliSearch | null> {
  if (_meiliClient) return _meiliClient;
  if (!_configPromise) {
    _configPromise = fetchMeiliConfig();
  }
  const config = await _configPromise;
  if (!config) {
    _configured = false;
    return null;
  }
  _configured = true;
  _meiliClient = new MeiliSearch({ host: config.url, apiKey: config.key });
  return _meiliClient;
}

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
  const empty = { products: [], brands: [], categories: [] };
  if (!query.trim()) return empty;

  const client = await getClient();
  if (!client) return empty;

  try {
    const response = await client.multiSearch({
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
  } catch (err) {
    console.error("Meilisearch error:", err);
    return empty;
  }
}

export async function isMeilisearchConfigured(): Promise<boolean> {
  if (_configured !== null) return _configured;
  const client = await getClient();
  return !!client;
}
