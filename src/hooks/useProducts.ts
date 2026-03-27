import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
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
}

function mapDbProduct(row: any): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    cnk: row.cnk || "",
    ean: row.ean || "",
    price: Number(row.price),
    pub: Number(row.pub_price) || Number(row.price) * 2,
    pct: row.discount_pct || 0,
    sellers: row.sellers_count || 1,
    rating: Number(row.rating) || 0,
    reviews: row.reviews_count || 0,
    best: row.best_seller || "",
    unit: row.unit_price || "",
    stock: row.in_stock !== false,
    mk: row.is_medikong === true,
    category: row.category || undefined,
    color: row.color || "blue",
    iconName: row.icon_name || "Package",
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map(mapDbProduct);
    },
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapDbProduct(data);
    },
    enabled: !!slug,
  });
}
