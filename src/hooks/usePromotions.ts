import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromoProduct {
  id: string;
  slug: string;
  name: string;
  brand_name: string;
  brand_slug?: string;
  image_url?: string;
  image_urls?: string[];
  best_price_excl_vat: number;
  best_price_incl_vat: number;
  reference_price: number;
  discount_percentage: number;
  offer_count: number;
  is_in_stock: boolean;
  category_name?: string;
  category_id?: string;
  brand_id?: string;
}

export interface FlashDeal {
  id: string;
  product_id: string;
  discount_price_incl_vat: number;
  original_price_incl_vat: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  label: string;
  campaign_id: string | null;
  product?: PromoProduct;
}

export interface PromotionCampaign {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  banner_image_url: string | null;
  is_active: boolean;
}

export interface PromoFilters {
  discountFilter: "all" | "20" | "40" | "flash";
  categoryId?: string;
  brandId?: string;
  inStockOnly?: boolean;
  sortBy?: "discount" | "price_asc" | "price_desc" | "newest";
}

export function usePromoProducts(filter: "all" | "20" | "40" | "flash" = "all", extras?: Omit<PromoFilters, 'discountFilter'>) {
  return useQuery({
    queryKey: ["promo-products", filter, extras?.categoryId, extras?.brandId, extras?.inStockOnly, extras?.sortBy],
    queryFn: async () => {
      if (filter === "flash") {
        const now = new Date().toISOString();
        let query = supabase
          .from("flash_deals")
          .select("*, product:products(id, slug, name, brand_name, brand_id, category_id, image_url, image_urls, best_price_excl_vat, best_price_incl_vat, reference_price, discount_percentage, offer_count, is_in_stock, category_name, brands(slug))")
          .eq("is_active", true)
          .lte("starts_at", now)
          .gte("ends_at", now)
          .order("ends_at", { ascending: true });
        const { data, error } = await query;
        if (error) throw error;
        let results = (data || []) as any[];
        // Client-side filtering for flash deals (nested product)
        if (extras?.categoryId) results = results.filter(fd => fd.product?.category_id === extras.categoryId);
        if (extras?.brandId) results = results.filter(fd => fd.product?.brand_id === extras.brandId);
        if (extras?.inStockOnly) results = results.filter(fd => fd.product?.is_in_stock);
        return { products: [], flashDeals: results };
      }

      const minDiscount = filter === "40" ? 40 : filter === "20" ? 20 : 10;
      let query = supabase
        .from("products")
        .select("id, slug, name, brand_name, brand_id, category_id, image_url, image_urls, best_price_excl_vat, best_price_incl_vat, reference_price, discount_percentage, offer_count, is_in_stock, category_name, brands(slug)")
        .eq("is_active", true)
        .not("reference_price", "is", null)
        .gte("discount_percentage", minDiscount)
        .gt("best_price_incl_vat", 0);

      if (extras?.categoryId) query = query.eq("category_id", extras.categoryId);
      if (extras?.brandId) query = query.eq("brand_id", extras.brandId);
      if (extras?.inStockOnly) query = query.eq("is_in_stock", true);

      const sortBy = extras?.sortBy || "discount";
      if (sortBy === "price_asc") query = query.order("best_price_excl_vat", { ascending: true });
      else if (sortBy === "price_desc") query = query.order("best_price_excl_vat", { ascending: false });
      else if (sortBy === "newest") query = query.order("updated_at", { ascending: false });
      else query = query.order("discount_percentage", { ascending: false });

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return { products: (data || []) as any[], flashDeals: [] };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function usePromoCount() {
  return useQuery({
    queryKey: ["promo-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .not("reference_price", "is", null)
        .gte("discount_percentage", 10)
        .gt("best_price_incl_vat", 0);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Categories that have at least one promo product */
export function usePromoCategories() {
  return useQuery({
    queryKey: ["promo-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category_id, category_name")
        .eq("is_active", true)
        .not("reference_price", "is", null)
        .gte("discount_percentage", 10)
        .gt("best_price_incl_vat", 0)
        .not("category_id", "is", null)
        .not("category_name", "is", null)
        .limit(1000);
      if (error) throw error;
      // Dedupe by category_id
      const map = new Map<string, string>();
      for (const row of data || []) {
        if (row.category_id && row.category_name && !map.has(row.category_id)) {
          map.set(row.category_id, row.category_name);
        }
      }
      return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Brands that have at least one promo product */
export function usePromoBrands() {
  return useQuery({
    queryKey: ["promo-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("brand_id, brand_name")
        .eq("is_active", true)
        .not("reference_price", "is", null)
        .gte("discount_percentage", 10)
        .gt("best_price_incl_vat", 0)
        .not("brand_id", "is", null)
        .not("brand_name", "is", null)
        .limit(1000);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data || []) {
        if (row.brand_id && row.brand_name && !map.has(row.brand_id)) {
          map.set(row.brand_id, row.brand_name);
        }
      }
      return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFlashDeals() {
  return useQuery({
    queryKey: ["flash-deals-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flash_deals")
        .select("*, product:products(id, slug, name, brand_name, image_url, best_price_incl_vat, reference_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function usePromotionCampaigns() {
  return useQuery({
    queryKey: ["promotion-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotion_campaigns")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PromotionCampaign[];
    },
  });
}
