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
  categoryL1?: string;
  categoryL2?: string;
  categoryL3?: string;
  descriptionShort?: string;
  weightG?: number;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function mapDbProduct(row: any, offersData?: any[]): Product {
  const productOffers = offersData?.filter((o: any) => o.product_id === row.id) || [];
  const lowestPrice = productOffers.length > 0
    ? Math.min(...productOffers.map((o: any) => Number(o.price_ht)))
    : Number(row.rrp_eur) || 0;
  const rrp = Number(row.rrp_eur) || lowestPrice * 1.5;
  const pct = rrp > 0 ? Math.round(((rrp - lowestPrice) / rrp) * 100) : 0;

  return {
    id: row.id,
    slug: slugify(row.product_name),
    name: row.product_name,
    brand: row.brand,
    gtin: row.gtin,
    cnk: row.mpn || "",
    ean: row.gtin,
    price: lowestPrice,
    pub: rrp,
    pct: Math.max(0, pct),
    sellers: productOffers.filter((o: any) => o.status === 'active').length || 1,
    rating: productOffers.length > 0 ? Number(productOffers[0].rating) || 0 : 0,
    reviews: 0,
    best: productOffers.length > 0 ? "Meilleur prix" : "",
    unit: `${row.weight_g || 0}g`,
    stock: productOffers.some((o: any) => o.stock > 0),
    mk: productOffers.length > 0,
    category: row.category_l1 || undefined,
    color: ["blue", "teal", "green", "amber", "rose", "purple", "orange", "cyan"][
      row.product_name.length % 8
    ],
    iconName: "Package",
    imageUrl: row.primary_image_url,
    categoryL1: row.category_l1,
    categoryL2: row.category_l2,
    categoryL3: row.category_l3,
    descriptionShort: row.description_short,
    weightG: row.weight_g ? Number(row.weight_g) : undefined,
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const [productsRes, offersRes] = await Promise.all([
        supabase.from("products").select("*").eq("status", "active").order("created_at", { ascending: true }),
        supabase.from("offers_direct").select("*").eq("status", "active"),
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
      const [productsRes, offersRes] = await Promise.all([
        supabase.from("products").select("*").eq("status", "active"),
        supabase.from("offers").select("*").eq("is_active", true),
      ]);
      if (productsRes.error) throw productsRes.error;
      const match = (productsRes.data || []).find((row: any) => slugify(row.product_name) === slug);
      if (!match) return null;
      return mapDbProduct(match, offersRes.data || []);
    },
    enabled: !!slug,
  });
}

export interface Offer {
  id: string;
  productId: string;
  sellerId: string;
  unitPriceEur: number;
  stockQuantity: number;
  movEur: number;
  bundleSize: number;
  deliveryDays: number;
  shipFromCountry: string;
  priceTiers: any[] | null;
  isActive: boolean;
  sellerName?: string;
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
        .order("unit_price_eur", { ascending: true });
      if (error) throw error;

      const sellerIds = [...new Set((offers || []).map((o: any) => o.seller_id))];
      const { data: sellers } = await supabase
        .from("sellers")
        .select("id, company_name, is_verified, is_top_rated")
        .in("id", sellerIds);

      const sellerMap = new Map((sellers || []).map((s: any) => [s.id, s]));

      return (offers || []).map((o: any): Offer => {
        const seller = sellerMap.get(o.seller_id);
        return {
          id: o.id,
          productId: o.product_id,
          sellerId: o.seller_id,
          unitPriceEur: Number(o.unit_price_eur),
          stockQuantity: o.stock_quantity,
          movEur: Number(o.mov_eur),
          bundleSize: o.bundle_size,
          deliveryDays: o.delivery_days,
          shipFromCountry: o.ship_from_country,
          priceTiers: o.price_tiers,
          isActive: o.is_active,
          sellerName: seller?.company_name || `Seller-${o.seller_id.slice(0, 6)}`,
          isVerified: seller?.is_verified,
          isTopRated: seller?.is_top_rated,
        };
      });
    },
    enabled: !!productId,
  });
}
