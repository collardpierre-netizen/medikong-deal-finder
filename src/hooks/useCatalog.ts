import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { useCallback, useMemo } from "react";

export interface CatalogFilters {
  category?: string;
  brands?: string[];
  manufacturers?: string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  sort: string;
  page: number;
  perPage: number;
  search?: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  brand_name: string | null;
  brand_id: string | null;
  category_id: string | null;
  category_name: string | null;
  gtin: string | null;
  cnk_code: string | null;
  image_urls: string[] | null;
  short_description: string | null;
  is_promotion: boolean;
  promotion_label: string | null;
  best_price_excl_vat: number | null;
  best_price_incl_vat: number | null;
  offer_count: number;
  total_stock: number;
  is_in_stock: boolean;
  created_at: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  product_count: number;
  children?: CategoryNode[];
}

export interface BrandCount {
  id: string;
  name: string;
  slug: string;
  product_count: number;
}

export interface ManufacturerCount {
  id: string;
  name: string;
  slug: string;
  product_count: number;
}

function parseFiltersFromParams(params: URLSearchParams): CatalogFilters {
  return {
    category: params.get("category") || undefined,
    brands: params.get("brand") ? params.get("brand")!.split(",") : undefined,
    manufacturers: params.get("manufacturer") ? params.get("manufacturer")!.split(",") : undefined,
    priceMin: params.get("price_min") ? Number(params.get("price_min")) : undefined,
    priceMax: params.get("price_max") ? Number(params.get("price_max")) : undefined,
    inStock: params.get("stock") === "1" ? true : undefined,
    sort: params.get("sort") || "relevance",
    page: Number(params.get("page")) || 1,
    perPage: Number(params.get("per_page")) || 24,
    search: params.get("q") || undefined,
  };
}

export function useCatalogFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);

  const setFilter = useCallback((key: string, value: string | string[] | number | undefined | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        next.delete(key);
      } else if (Array.isArray(value)) {
        next.set(key, value.join(","));
      } else {
        next.set(key, String(value));
      }
      // Reset to page 1 on filter change (except page itself)
      if (key !== "page") next.set("page", "1");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearAll = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return { filters, setFilter, clearAll, searchParams, setSearchParams };
}

export function useCatalogProducts(filters: CatalogFilters) {
  const { country } = useCountry();

  return useQuery({
    queryKey: ["catalog-products", filters, country],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, slug, name, brand_name, brand_id, category_id, category_name, gtin, cnk_code, image_urls, short_description, is_promotion, promotion_label, best_price_excl_vat, best_price_incl_vat, offer_count, total_stock, is_in_stock, created_at", { count: "exact" })
        .eq("is_active", true);

      if (filters.category) {
        // Get category and its children
        const { data: cat } = await supabase.from("categories").select("id").eq("slug", filters.category).maybeSingle();
        if (cat) {
          const { data: children } = await supabase.from("categories").select("id").eq("parent_id", cat.id);
          const ids = [cat.id, ...(children || []).map(c => c.id)];
          query = query.in("category_id", ids);
        }
      }

      if (filters.brands && filters.brands.length > 0) {
        const { data: brandRows } = await supabase.from("brands").select("id").in("slug", filters.brands);
        if (brandRows && brandRows.length > 0) {
          query = query.in("brand_id", brandRows.map(b => b.id));
        }
      }

      if (filters.manufacturers && filters.manufacturers.length > 0) {
        const { data: mfRows } = await supabase.from("manufacturers").select("id").in("slug", filters.manufacturers);
        if (mfRows && mfRows.length > 0) {
          query = query.in("manufacturer_id", mfRows.map(m => m.id));
        }
      }

      if (filters.priceMin !== undefined) query = query.gte("best_price_excl_vat", filters.priceMin);
      if (filters.priceMax !== undefined) query = query.lte("best_price_excl_vat", filters.priceMax);
      if (filters.inStock) query = query.eq("is_in_stock", true);

      if (filters.search) {
        const pattern = `%${filters.search}%`;
        query = query.or(`name.ilike.${pattern},gtin.ilike.${pattern},cnk_code.ilike.${pattern},brand_name.ilike.${pattern},category_name.ilike.${pattern}`);
      }

      // Sort
      switch (filters.sort) {
        case "price_asc": query = query.order("best_price_excl_vat", { ascending: true, nullsFirst: false }); break;
        case "price_desc": query = query.order("best_price_excl_vat", { ascending: false }); break;
        case "name_asc": query = query.order("name", { ascending: true }); break;
        case "name_desc": query = query.order("name", { ascending: false }); break;
        case "newest": query = query.order("created_at", { ascending: false }); break;
        case "stock_desc": query = query.order("total_stock", { ascending: false }); break;
        default: query = query.order("offer_count", { ascending: false }); break;
      }

      const offset = (filters.page - 1) * filters.perPage;
      query = query.range(offset, offset + filters.perPage - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { products: (data || []) as CatalogProduct[], total: count || 0 };
    },
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: ["catalog-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;

      // Build tree
      const all = data || [];
      const roots = all.filter(c => !c.parent_id);
      return roots.map(r => ({
        ...r,
        product_count: 0,
        children: all.filter(c => c.parent_id === r.id).map(c => ({ ...c, product_count: 0 })),
      })) as CategoryNode[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCatalogBrands(categorySlug?: string) {
  return useQuery({
    queryKey: ["catalog-brands", categorySlug],
    queryFn: async () => {
      let query = supabase
        .from("brands")
        .select("id, name, slug, product_count")
        .eq("is_active", true)
        .gt("product_count", 0)
        .order("product_count", { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BrandCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCatalogManufacturers() {
  return useQuery({
    queryKey: ["catalog-manufacturers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manufacturers")
        .select("id, name, slug, product_count")
        .eq("is_active", true)
        .gt("product_count", 0)
        .order("product_count", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ManufacturerCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
