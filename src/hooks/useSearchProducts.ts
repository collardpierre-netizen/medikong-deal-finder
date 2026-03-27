import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "./useProducts";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function mapSearchResult(row: any, offersData?: any[]): Product {
  const productOffers = offersData?.filter((o: any) => o.product_id === row.id) || [];
  const lowestPrice = productOffers.length > 0
    ? Math.min(...productOffers.map((o: any) => Number(o.unit_price_eur)))
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
    sellers: productOffers.filter((o: any) => o.is_active).length || 1,
    rating: 0,
    reviews: 0,
    best: productOffers.length > 0 ? "Meilleur prix" : "",
    unit: `${row.weight_g || 0}g`,
    stock: productOffers.some((o: any) => o.stock_quantity > 0),
    mk: productOffers.length > 0,
    category: row.category_l1 || undefined,
    color: ["blue", "teal", "green", "amber", "rose", "purple", "orange", "cyan"][row.product_name.length % 8],
    iconName: "Package",
    imageUrl: row.primary_image_url,
    categoryL1: row.category_l1,
    categoryL2: row.category_l2,
    categoryL3: row.category_l3,
    descriptionShort: row.description_short,
    weightG: row.weight_g ? Number(row.weight_g) : undefined,
  };
}

export type SortOption = "relevance" | "price_asc" | "price_desc" | "offers";

export function useSearchProducts(query: string, sort: SortOption = "relevance") {
  return useQuery({
    queryKey: ["search-products", query, sort],
    queryFn: async () => {
      let productsData: any[];

      if (query.trim()) {
        const { data, error } = await supabase.rpc("search_products", { search_query: query.trim() });
        if (error) throw error;
        productsData = data || [];
      } else {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: true });
        if (error) throw error;
        productsData = data || [];
      }

      // Fetch offers for these products
      const productIds = productsData.map((p: any) => p.id);
      const { data: offersData } = productIds.length > 0
        ? await supabase.from("offers").select("*").eq("is_active", true).in("product_id", productIds)
        : { data: [] };

      let results = productsData.map((row: any) => mapSearchResult(row, offersData || []));

      // Client-side sorting
      if (sort === "price_asc") results.sort((a, b) => a.price - b.price);
      else if (sort === "price_desc") results.sort((a, b) => b.price - a.price);
      else if (sort === "offers") results.sort((a, b) => b.sellers - a.sellers);

      return results;
    },
  });
}
