import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { resolveVendorVisibility, getVendorPublicName } from "@/lib/vendor-display";

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
  brandSlug?: string;
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
    imageUrl: Array.isArray(row.image_urls) ? row.image_urls[0] || undefined : undefined,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [],
    descriptionShort: row.short_description || undefined,
    brandId: row.brand_id || undefined,
    brandSlug: row.brands?.slug || (row.brand_name ? slugify(row.brand_name) : undefined),
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
      // First get the product (needed for ID)
      const { data, error } = await supabase.from("products").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Offers fetched separately by useProductOffers — no need to duplicate here
      return mapDbProduct(data);
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export interface DiscountTier {
  id: string;
  mov_amount: number;
  mov_currency: string;
  unit_price: number;
  price_currency: string;
  is_active: boolean;
  mov_progress: number;
}

export interface OfferPriceTier {
  id: string;
  offer_id: string;
  tier_index: number;
  mov_threshold: number;
  mov_currency: string;
  qogita_unit_price: number;
  price_excl_vat: number;
  price_incl_vat: number;
  margin_amount: number;
  is_active: boolean;
  mov_progress: number;
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
  discountTiers: DiscountTier[];
  offerPriceTiers: OfferPriceTier[];
  isActive: boolean;
  sellerName?: string;
  sellerSlug?: string;
  isVerified?: boolean;
  isTopRated?: boolean;
  isTopSeller?: boolean;
  displayCode?: string;
  isTraceable?: boolean;
  hasExtendedDelivery?: boolean;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  estimatedDeliveryDays?: number;
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

      const offerIds = (offers || []).map((o: any) => o.id);
      const vendorIds = [...new Set((offers || []).map((o: any) => o.vendor_id))];

      // Fetch vendors and discount tiers in parallel
      const [vendorsResult, tiersResult, visRulesResult, priceTiersResult] = await Promise.all([
        vendorIds.length > 0
          ? supabase.from("vendors").select("id, name, company_name, slug, is_verified, rating, display_code, is_top_seller, type, show_real_name").in("id", vendorIds)
          : Promise.resolve({ data: [] }),
        offerIds.length > 0
          ? supabase.from("discount_tiers").select("*").in("offer_id", offerIds).order("mov_amount", { ascending: true })
          : Promise.resolve({ data: [] }),
        vendorIds.length > 0
          ? supabase.from("vendor_visibility_rules" as any).select("*").in("vendor_id", vendorIds)
          : Promise.resolve({ data: [] }),
        offerIds.length > 0
          ? supabase.from("offer_price_tiers").select("*").in("offer_id", offerIds).order("tier_index", { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);
      const visRules: any[] = (visRulesResult as any).data || [];

      const vendorMap = new Map((vendorsResult.data || []).map((v: any) => [v.id, v]));
      const tiersMap = new Map<string, any[]>();
      for (const t of (tiersResult.data || [])) {
        const arr = tiersMap.get(t.offer_id) || [];
        arr.push(t);
        tiersMap.set(t.offer_id, arr);
      }
      const priceTiersMap = new Map<string, any[]>();
      for (const t of (priceTiersResult.data || [])) {
        const arr = priceTiersMap.get(t.offer_id) || [];
        arr.push(t);
        priceTiersMap.set(t.offer_id, arr);
      }

      return (offers || []).map((o: any): Offer => {
        const vendor = vendorMap.get(o.vendor_id);
        return {
          id: o.id,
          productId: o.product_id,
          sellerId: o.vendor_id,
          unitPriceEur: Number(o.price_excl_vat),
          unitPriceInclVat: Number(o.price_incl_vat),
          stockQuantity: o.stock_quantity,
          movEur: Number(o.mov || o.mov_amount || 0),
          bundleSize: o.moq || 1,
          deliveryDays: o.delivery_days,
          shipFromCountry: o.shipping_from_country || 'BE',
          priceTiers: o.price_tiers || null,
          discountTiers: tiersMap.get(o.id) || [],
          offerPriceTiers: priceTiersMap.get(o.id) || [],
          isActive: o.is_active,
          sellerName: (() => {
            const showReal = resolveVendorVisibility(
              { ...vendor, id: o.vendor_id },
              visRules,
              { country }
            );
            return getVendorPublicName({ ...vendor, display_code: vendor?.display_code }, showReal);
          })(),
          sellerSlug: vendor?.slug || undefined,
          isVerified: vendor?.is_verified || false,
          isTopRated: (vendor?.rating || 0) >= 4.5,
          isTopSeller: vendor?.is_top_seller || false,
          displayCode: vendor?.display_code || o.vendor_id.slice(0, 6).toUpperCase(),
          isTraceable: o.is_traceable || false,
          hasExtendedDelivery: o.has_extended_delivery || false,
          minDeliveryDays: o.min_delivery_days || undefined,
          maxDeliveryDays: o.max_delivery_days || undefined,
          estimatedDeliveryDays: o.estimated_delivery_days || undefined,
        };
      });
    },
    enabled: !!productId,
    staleTime: 3 * 60 * 1000,
  });
}
