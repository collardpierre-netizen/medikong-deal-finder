import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import type { Product } from "./useProducts";

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function mapSearchResult(row: any, offersData?: any[]): Product {
  const productOffers = offersData?.filter((o: any) => o.product_id === row.id) || [];
  const lowestPrice = productOffers.length > 0
    ? Math.min(...productOffers.map((o: any) => Number(o.price_excl_vat)))
    : Number(row.best_price_excl_vat) || 0;

  return {
    id: row.id,
    slug: row.slug || slugify(row.name || ""),
    name: row.name || "",
    brand: row.brand_name || "",
    gtin: row.gtin || "",
    cnk: row.cnk_code || "",
    ean: row.gtin || "",
    price: lowestPrice,
    pub: Number(row.best_price_incl_vat) || lowestPrice * 1.21,
    pct: 0,
    sellers: row.offer_count || productOffers.length || 0,
    rating: 0,
    reviews: 0,
    best: productOffers.length > 0 ? "Meilleur prix" : "",
    unit: row.unit_quantity > 1 ? `${row.unit_quantity} unités` : "unité",
    stock: row.is_in_stock || productOffers.some((o: any) => o.stock_quantity > 0),
    mk: productOffers.length > 0,
    category: row.category_name || undefined,
    color: ["blue", "teal", "green", "amber", "rose", "purple", "orange", "cyan"][(row.name || "").length % 8],
    iconName: "Package",
    imageUrl: row.image_urls?.[0] || undefined,
    descriptionShort: row.short_description || row.description || undefined,
  };
}

export type SortOption = "relevance" | "price_asc" | "price_desc" | "offers";

export function useSearchProducts(query: string, sort: SortOption = "relevance") {
  const { country } = useCountry();
  return useQuery({
    queryKey: ["search-products", query, sort, country],
    queryFn: async () => {
      let productsData: any[];

      if (query.trim()) {
        const trimmed = query.trim();
        // Main search
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .or(`name.ilike.%${trimmed}%,gtin.ilike.%${trimmed}%,cnk_code.ilike.%${trimmed}%,brand_name.ilike.%${trimmed}%`)
          .limit(100);
        if (error) throw error;
        productsData = data || [];

        // Also search market codes if few results
        if (productsData.length < 10) {
          const { data: mcResults } = await supabase
            .from("product_market_codes")
            .select("product_id")
            .ilike("code_value", `%${trimmed}%`)
            .limit(20);
          if (mcResults?.length) {
            const extraIds = mcResults.map((r: any) => r.product_id).filter((id: string) => !productsData.some((p: any) => p.id === id));
            if (extraIds.length > 0) {
              const { data: extraProducts } = await supabase.from("products").select("*").eq("is_active", true).in("id", extraIds);
              if (extraProducts) productsData = [...productsData, ...extraProducts];
            }
          }
        }
      } else {
        const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: true }).limit(100);
        if (error) throw error;
        productsData = data || [];
      }

      const productIds = productsData.map((p: any) => p.id);
      const { data: offersData } = productIds.length > 0
        ? await supabase.from("offers").select("*").eq("is_active", true).eq("country_code", country).in("product_id", productIds)
        : { data: [] as any[] };

      let results = productsData.map((row: any) => mapSearchResult(row, offersData || []));

      if (sort === "price_asc") results.sort((a, b) => a.price - b.price);
      else if (sort === "price_desc") results.sort((a, b) => b.price - a.price);
      else if (sort === "offers") results.sort((a, b) => b.sellers - a.sellers);

      return results;
    },
  });
}
