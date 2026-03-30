import { supabase } from "@/integrations/supabase/client";

export interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  gtin: string | null;
  cnk_code: string | null;
  image_urls: string[] | null;
  best_price_excl_vat: number | null;
  best_price_incl_vat: number | null;
  offer_count: number;
  is_in_stock: boolean;
  category_name: string | null;
}

export interface SearchBrand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  product_count: number;
}

export interface SearchCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  image_url: string | null;
}

export interface FederatedResults {
  products: SearchProduct[];
  brands: SearchBrand[];
  categories: SearchCategory[];
}

export async function federatedSearch(query: string): Promise<FederatedResults> {
  const empty: FederatedResults = { products: [], brands: [], categories: [] };
  const q = query.trim();
  if (!q) return empty;

  const pattern = `%${q}%`;

  const [productsRes, brandsRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, brand_name, gtin, cnk_code, image_urls, best_price_excl_vat, best_price_incl_vat, offer_count, is_in_stock, category_name")
      .eq("is_active", true)
      .or(`name.ilike.${pattern},gtin.ilike.${pattern},cnk_code.ilike.${pattern},brand_name.ilike.${pattern}`)
      .order("offer_count", { ascending: false })
      .limit(6),
    supabase
      .from("brands")
      .select("id, name, slug, logo_url, product_count")
      .eq("is_active", true)
      .ilike("name", pattern)
      .order("product_count", { ascending: false })
      .limit(3),
    supabase
      .from("categories")
      .select("id, name, slug, icon, image_url")
      .eq("is_active", true)
      .ilike("name", pattern)
      .order("display_order", { ascending: true })
      .limit(3),
  ]);

  return {
    products: (productsRes.data || []) as SearchProduct[],
    brands: (brandsRes.data || []) as SearchBrand[],
    categories: (categoriesRes.data || []) as SearchCategory[],
  };
}
