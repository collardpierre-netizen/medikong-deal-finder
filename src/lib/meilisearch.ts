import { MeiliSearch } from "meilisearch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Cache the config so we only fetch once
let _meiliClient: MeiliSearch | null = null;
let _configured: boolean | null = null;
let _configPromise: Promise<{ url: string; key: string } | null> | null = null;
let _warnedOnce = false;

function warnSearchDegraded(reason: string) {
  if (_warnedOnce) return;
  _warnedOnce = true;
  console.warn("[meilisearch] recherche instantanée indisponible :", reason);
  // Best-effort UI message — n'arrête jamais le rendu, on retombe sur Postgres.
  try {
    toast.warning("Recherche instantanée indisponible", {
      description:
        "Nous utilisons une recherche de secours. Les résultats restent disponibles, sans tolérance aux fautes de frappe.",
      duration: 5000,
    });
  } catch {
    // toast peut ne pas être monté (SSR / pages sans Toaster) — on ignore.
  }
}

async function fetchMeiliConfig(): Promise<{ url: string; key: string } | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const headers: Record<string, string> = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};

    const { data, error } = await supabase.functions.invoke("sync-meilisearch", {
      body: { action: "get-search-key" },
      headers,
    });
    if (error) {
      warnSearchDegraded(error.message || "edge function error");
      return null;
    }
    if (!data?.url || !data?.searchKey) {
      warnSearchDegraded("réponse invalide de sync-meilisearch");
      return null;
    }
    return { url: data.url, key: data.searchKey };
  } catch (err) {
    warnSearchDegraded(err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function getClient(): Promise<MeiliSearch | null> {
  if (_meiliClient) return _meiliClient;
  if (!_configPromise) {
    _configPromise = fetchMeiliConfig();
  }
  let config: { url: string; key: string } | null = null;
  try {
    config = await _configPromise;
  } catch (err) {
    // Sécurité : ne jamais propager une rejection (risque d'écran blanc via
    // un unhandledrejection sur les pages sans ErrorBoundary).
    warnSearchDegraded(err instanceof Error ? err.message : String(err));
    config = null;
  }
  if (!config) {
    _configured = false;
    // Permet une nouvelle tentative lors d'une prochaine recherche.
    _configPromise = null;
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
        { indexUid: "products", q: query, limit: 6, filter: "is_active = true" },
        { indexUid: "brands", q: query, limit: 3, filter: "is_active = true" },
        { indexUid: "categories", q: query, limit: 3, filter: "is_active = true" },
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
