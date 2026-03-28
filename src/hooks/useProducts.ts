import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    brand: "",
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
    imageUrl: row.image_urls?.[0] || undefined,
    descriptionShort: row.short_description || undefined,
    brandId: row.brand_id || undefined,
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const [productsRes, offersRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: true }),
        supabase.from("offers").select("*").eq("is_active", true),
      ]);
      if (productsRes.error) throw productsRes.error;
      return (productsRes.data || []).map((row: any) => mapDbProduct(row, offersRes.data || []));
    },
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: offers } = await supabase.from("offers").select("*").eq("product_id", data.id).eq("is_active", true);
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
}

export function useProductOffers(productId: string | undefined) {
  return useQuery({
    queryKey: ["offers", productId],
    queryFn: async () => {
      const { data: offers, error } = await supabase
        .from("offers")
        .select("*")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .order("price_excl_vat", { ascending: true });
      if (error) throw error;

      const vendorIds = [...new Set((offers || []).map((o: any) => o.vendor_id))];
      const { data: vendors } = vendorIds.length > 0
        ? await supabase.from("vendors").select("id, name, slug, is_verified, rating").in("id", vendorIds)
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
          sellerName: vendor?.name || `Vendor-${o.vendor_id.slice(0, 6)}`,
          sellerSlug: vendor?.slug || undefined,
          isVerified: vendor?.is_verified || false,
          isTopRated: (vendor?.rating || 0) >= 4.5,
        };
      });
    },
    enabled: !!productId,
  });
}
