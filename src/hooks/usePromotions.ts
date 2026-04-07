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

export function usePromoProducts(filter: "all" | "20" | "40" | "flash" = "all") {
  return useQuery({
    queryKey: ["promo-products", filter],
    queryFn: async () => {
      if (filter === "flash") {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("flash_deals")
          .select("*, product:products(id, slug, name, brand_name, image_url, image_urls, best_price_excl_vat, best_price_incl_vat, reference_price, discount_percentage, offer_count, is_in_stock, category_name, brand_id, brands(slug))")
          .eq("is_active", true)
          .lte("starts_at", now)
          .gte("ends_at", now)
          .order("ends_at", { ascending: true });
        if (error) throw error;
        return { products: [], flashDeals: (data || []) as any[] };
      }

      const minDiscount = filter === "40" ? 40 : filter === "20" ? 20 : 10;
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, brand_name, brand_id, image_url, image_urls, best_price_excl_vat, best_price_incl_vat, reference_price, discount_percentage, offer_count, is_in_stock, category_name, brands(slug)")
        .eq("is_active", true)
        .not("reference_price", "is", null)
        .gte("discount_percentage", minDiscount)
        .gt("best_price_incl_vat", 0)
        .order("discount_percentage", { ascending: false })
        .limit(200);
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
