import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  gtin: string;
  cnk: string;
  ean: string;
  price: number;
  pub: number;
  pct: number;
  sellers: number;
  rating: number;
  reviews: number;
  best: string;
  unit: string;
  stock: boolean;
  mk: boolean;
  category?: string;
  color?: string;
  iconName?: string;
  imageUrl?: string;
  imageUrls?: string[];
  categoryL1?: string;
  categoryL2?: string;
  categoryL3?: string;
  descriptionShort?: string;
  weightG?: number;
  brandId?: string;
}

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function mapDbProduct(row: any, offersData?: any[]): Product {
  const productOffers = offersData?.filter((o: any) => o.product_id === row.id) || [];
  const lowestPrice = productOffers.length > 0
    ? Math.min(...productOffers.map((o: any) => Number(o.price_excl_vat)))
    : Number(row.best_price_excl_vat) || 0;
  const bestInclVat = productOffers.length > 0
    ? Math.min(...productOffers.map((o: any) => Number(o.price_incl_vat)))
    : Number(row.best_price_incl_vat) || lowestPrice * 1.21;
  const pct = bestInclVat > 0 && lowestPrice > 0 ? Math.round(((bestInclVat - lowestPrice) / bestInclVat) * 100) : 0;

  return {
    id: row.id,
    slug: row.slug || slugify(row.name),
    name: row.name,
    brand: row.brand_name || "",
    gtin: row.gtin || "",
    cnk: row.cnk_code || "",
    ean: row.gtin || "",
    price: lowestPrice,
    pub: bestInclVat,
    pct: Math.max(0, pct),
    sellers: row.offer_count || productOffers.length || 0,
    rating: 0,
    reviews: 0,
    best: productOffers.length > 0 ? "Meilleur prix" : "",
    unit: "unité",
    stock: row.is_in_stock || productOffers.some((o: any) => o.stock_quantity > 0),
    mk: productOffers.length > 0,
    category: undefined,
    color: ["blue", "teal", "green", "amber", "rose", "purple", "orange", "cyan"][row.name.length % 8],
    iconName: "Package",
    imageUrl: (() => {
      const urls = row.image_urls;
      if (Array.isArray(urls) && urls.length > 0) return urls[0] || undefined;
      if (typeof urls === 'string') { try { const p = JSON.parse(urls); return Array.isArray(p) ? p[0] : undefined; } catch { return undefined; } }
      return undefined;
    })(),
    imageUrls: (() => {
      const urls = row.image_urls;
      if (Array.isArray(urls)) return urls.filter(Boolean);
      if (typeof urls === 'string') { try { const p = JSON.parse(urls); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; } }
      return [];
    })(),
    descriptionShort: row.short_description || undefined,
    brandId: row.brand_id || undefined,
  };
}

/** @deprecated Use useFeaturedProducts(limit) or useCatalogProducts instead */
export function useProducts() {
  return useFeaturedProducts(24);
}

/**
 * Lightweight hook: fetches only `limit` products with offers, no full table scan.
 */
export function useFeaturedProducts(limit = 10, options?: { promotion?: boolean; brandSlug?: string }) {
  const { country } = useCountry();
  return useQuery({
    queryKey: ["featured-products", limit, country, options?.promotion, options?.brandSlug],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, slug, name, brand_name, brand_id, gtin, cnk_code, image_urls, short_description, is_promotion, promotion_label, best_price_excl_vat, best_price_incl_vat, offer_count, total_stock, is_in_stock, category_name")
        .eq("is_active", true)
        .gt("offer_count", 0)
        .gt("best_price_excl_vat", 0);

      if (options?.promotion) query = query.eq("is_promotion", true);
      if (options?.brandSlug) {
        const { data: brand } = await supabase.from("brands").select("id").eq("slug", options.brandSlug).maybeSingle();
        if (brand) query = query.eq("brand_id", brand.id);
      }

      const { data, error } = await query
        .order("offer_count", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((row: any) => mapDbProduct(row));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProduct(slug: string | undefined) {
  const { country } = useCountry();
  return useQuery({
    queryKey: ["product", slug, country],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: offers } = await supabase.from("offers").select("*").eq("product_id", data.id).eq("is_active", true).eq("country_code", country);
      return mapDbProduct(data, offers || []);
    },
    enabled: !!slug,
  });
}

export interface Offer {
  id: string;
  productId: string;
  sellerId: string;
  unitPriceEur: number;
  unitPriceInclVat: number;
  stockQuantity: number;
  movEur: number;
  bundleSize: number;
  deliveryDays: number;
  shipFromCountry: string;
  priceTiers: any[] | null;
  isActive: boolean;
  sellerName?: string;
  sellerSlug?: string;
  isVerified?: boolean;
  isTopRated?: boolean;
  displayCode?: string;
}

export function useProductOffers(productId: string | undefined) {
  const { country } = useCountry();
  return useQuery({
    queryKey: ["offers", productId, country],
    queryFn: async () => {
      const { data: offers, error } = await supabase
        .from("offers")
        .select("*")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .eq("country_code", country)
        .order("price_excl_vat", { ascending: true });
      if (error) throw error;

      const vendorIds = [...new Set((offers || []).map((o: any) => o.vendor_id))];
      const { data: vendors } = vendorIds.length > 0
        ? await supabase.from("vendors").select("id, name, slug, is_verified, rating, display_code, type").in("id", vendorIds)
        : { data: [] };

      const vendorMap = new Map((vendors || []).map((v: any) => [v.id, v]));

      return (offers || []).map((o: any): Offer => {
        const vendor = vendorMap.get(o.vendor_id);
        return {
          id: o.id,
          productId: o.product_id,
          sellerId: o.vendor_id,
          unitPriceEur: Number(o.price_excl_vat),
          unitPriceInclVat: Number(o.price_incl_vat),
          stockQuantity: o.stock_quantity,
          movEur: Number(o.mov || 0),
          bundleSize: o.moq || 1,
          deliveryDays: o.delivery_days,
          shipFromCountry: o.shipping_from_country || 'BE',
          priceTiers: o.price_tiers || null,
          isActive: o.is_active,
          sellerName: vendor?.display_code || vendor?.name?.slice(0, 6)?.toUpperCase() || o.vendor_id.slice(0, 6).toUpperCase(),
          sellerSlug: vendor?.slug || undefined,
          isVerified: vendor?.is_verified || false,
          isTopRated: (vendor?.rating || 0) >= 4.5,
          displayCode: vendor?.display_code || o.vendor_id.slice(0, 6).toUpperCase(),
        };
      });
    },
    enabled: !!productId,
  });
}
