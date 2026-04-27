import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { getLocalizedName } from "@/lib/localization";
import { applyHiddenCategoryFilter } from "@/lib/catalog-filters";
import { useCallback, useMemo } from "react";

const PRODUCT_SELECT_FIELDS = "id, slug, name, name_fr, name_nl, name_de, brand_name, brand_id, category_id, category_name, gtin, cnk_code, image_url, image_urls, short_description, is_promotion, promotion_label, best_price_excl_vat, best_price_incl_vat, offer_count, total_stock, is_in_stock, created_at";
const CATALOG_QUERY_TIMEOUT_MS = 8000;
const CATALOG_COUNT_TIMEOUT_MS = 4000;
const CATEGORY_COUNT_TIMEOUT_MS = 3000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message = "La requête a expiré."): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

/**
 * Returns the IDs of all inactive categories AND every descendant of an inactive
 * category — even if those descendants are individually marked active.
 *
 * Rationale: when an admin disables a parent (e.g. "Perfumes"), every child
 * (Eau De Parfum, Eau De Toilette, …) should cascade to hidden in the catalog
 * without requiring manual cleanup. We compute the cascade in JS from the full
 * categories tree so we keep a single round-trip and stay independent from RPC.
 */
async function fetchInactiveCategoryIds(): Promise<string[]> {
  const { data } = await supabase
    .from("categories")
    .select("id, parent_id, is_active");

  const all = (data || []) as Array<{ id: string; parent_id: string | null; is_active: boolean }>;

  // Build adjacency: parent -> children
  const childrenByParent = new Map<string, string[]>();
  for (const cat of all) {
    if (!cat.parent_id) continue;
    const list = childrenByParent.get(cat.parent_id);
    if (list) list.push(cat.id);
    else childrenByParent.set(cat.parent_id, [cat.id]);
  }

  const inactive = new Set<string>(all.filter((c) => !c.is_active).map((c) => c.id));

  // BFS from each inactive root to mark all descendants
  const queue: string[] = [...inactive];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const kids = childrenByParent.get(current);
    if (!kids) continue;
    for (const kid of kids) {
      if (!inactive.has(kid)) {
        inactive.add(kid);
        queue.push(kid);
      }
    }
  }

  return Array.from(inactive);
}

function applyCatalogProductFilters(
  query: any,
  filters: CatalogFilters,
  options: {
    categoryIds: string[] | null;
    resolvedBrandIds: string[] | null;
    manufacturerIds: string[] | null;
    effectiveSearch?: string;
    inactiveCategoryIds?: string[];
  }
) {
  let next = query;

  if (options.categoryIds?.length) next = next.in("category_id", options.categoryIds);
  if (options.resolvedBrandIds?.length) next = next.in("brand_id", options.resolvedBrandIds);
  if (options.manufacturerIds?.length) next = next.in("manufacturer_id", options.manufacturerIds);

  // Exclude products belonging to inactive categories (admin-disabled)
  if (options.inactiveCategoryIds?.length) {
    next = next.not("category_id", "in", `(${options.inactiveCategoryIds.join(",")})`);
  }

  if (filters.priceMin !== undefined) next = next.gte("best_price_excl_vat", filters.priceMin);
  if (filters.priceMax !== undefined) next = next.lte("best_price_excl_vat", filters.priceMax);
  if (filters.inStock) next = next.eq("is_in_stock", true);
  if (filters.hasOffers) next = next.gt("offer_count", 0);

  if (options.effectiveSearch) {
    const pattern = `%${options.effectiveSearch}%`;
    next = next.or(`name.ilike.${pattern},gtin.ilike.${pattern},cnk_code.ilike.${pattern},brand_name.ilike.${pattern}`);
  }

  return next;
}

function applyCatalogSort(query: any, sort: string) {
  switch (sort) {
    case "price_asc":
      return query.order("best_price_excl_vat", { ascending: true, nullsFirst: false });
    case "price_desc":
      return query.order("best_price_excl_vat", { ascending: false });
    case "name_asc":
      return query.order("name", { ascending: true });
    case "name_desc":
      return query.order("name", { ascending: false });
    case "newest":
      return query.order("created_at", { ascending: false });
    case "stock_desc":
      return query.order("total_stock", { ascending: false });
    default:
      return query.order("offer_count", { ascending: false });
  }
}

export interface CatalogFilters {
  category?: string;
  brands?: string[];
  manufacturers?: string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  hasOffers?: boolean;
  sort: string;
  page: number;
  perPage: number;
  search?: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  name_fr: string | null;
  brand_name: string | null;
  brand_id: string | null;
  category_id: string | null;
  category_name: string | null;
  gtin: string | null;
  cnk_code: string | null;
  image_url: string | null;
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
  name_fr: string | null;
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

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim();
}

function pickImplicitBrandMatch(query: string, brands: BrandCount[]) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  const exactMatch = brands.find((brand) => normalizeSearchText(brand.name) === normalizedQuery);
  if (exactMatch) return exactMatch;

  const prefixMatches = brands.filter((brand) => normalizeSearchText(brand.name).startsWith(normalizedQuery));
  if (prefixMatches.length === 1) return prefixMatches[0];

  return null;
}

function parseFiltersFromParams(params: URLSearchParams): CatalogFilters {
  return {
    category: params.get("category") || undefined,
    brands: params.get("brand") ? params.get("brand")!.split(",") : undefined,
    manufacturers: params.get("manufacturer") ? params.get("manufacturer")!.split(",") : undefined,
    priceMin: params.get("price_min") ? Number(params.get("price_min")) : undefined,
    priceMax: params.get("price_max") ? Number(params.get("price_max")) : undefined,
    inStock: params.get("stock") === "1" ? true : undefined,
    hasOffers: params.get("has_offers") === "1" ? true : undefined,
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
      const [categoryIds, explicitBrandIds, mfIds, inactiveCategoryIds] = await Promise.all([
        filters.category
          ? supabase.from("categories").select("id").eq("slug", filters.category).maybeSingle().then(({ data: cat }) => {
              if (!cat) return null;
              return supabase.from("categories").select("id").eq("parent_id", cat.id).then(({ data: children }) =>
                [cat.id, ...(children || []).map(c => c.id)]
              );
            })
          : Promise.resolve(null),
        filters.brands && filters.brands.length > 0
          ? supabase.from("brands").select("id").in("slug", filters.brands).then(({ data }) => data?.map(b => b.id) || null)
          : Promise.resolve(null),
        filters.manufacturers && filters.manufacturers.length > 0
          ? supabase.from("manufacturers").select("id").in("slug", filters.manufacturers).then(({ data }) => data?.map(m => m.id) || null)
          : Promise.resolve(null),
        fetchInactiveCategoryIds(),
      ]);

      let resolvedBrandIds = explicitBrandIds;
      let effectiveSearch = filters.search?.trim() || undefined;

      if (effectiveSearch && !resolvedBrandIds?.length && !categoryIds && !mfIds?.length) {
        const { data: brandMatches } = await supabase
          .from("brands")
          .select("id, name, slug, product_count")
          .eq("is_active", true)
          .ilike("name", `%${effectiveSearch}%`)
          .order("product_count", { ascending: false })
          .limit(10);

        const implicitBrand = pickImplicitBrandMatch(effectiveSearch, (brandMatches || []) as BrandCount[]);
        if (implicitBrand) {
          resolvedBrandIds = [implicitBrand.id];
          effectiveSearch = undefined;
        }
      }

      const hasFilters = !!(
        effectiveSearch ||
        resolvedBrandIds?.length ||
        categoryIds ||
        mfIds?.length ||
        filters.inStock ||
        filters.hasOffers ||
        filters.priceMin !== undefined ||
        filters.priceMax !== undefined
      );

      const offset = (filters.page - 1) * filters.perPage;
      const isDefaultCatalogueView = !effectiveSearch && !resolvedBrandIds?.length && !categoryIds && !mfIds?.length && !filters.inStock && !filters.hasOffers && filters.priceMin === undefined && filters.priceMax === undefined;
      const filterContext = {
        categoryIds,
        resolvedBrandIds,
        manufacturerIds: mfIds,
        effectiveSearch,
        inactiveCategoryIds,
      };

      const buildProductQuery = () =>
        applyCatalogProductFilters(
          applyHiddenCategoryFilter(
            supabase.from("products").select(PRODUCT_SELECT_FIELDS).eq("is_active", true)
          ),
          filters,
          filterContext
        );

      const buildCountQuery = () =>
        applyCatalogProductFilters(
          // Use exact count when no heavy filters are applied so the catalogue header
          // shows the real total (~348k). Switch to estimated when filters narrow
          // the result set, for performance on combined OR/IN clauses.
          applyHiddenCategoryFilter(
            supabase.from("products").select("id", { count: hasFilters ? "estimated" : "exact" }).eq("is_active", true)
          ),
          filters,
          filterContext
        );

      const countPromise = withTimeout(
        (async () => await buildCountQuery().range(0, 0))(),
        CATALOG_COUNT_TIMEOUT_MS,
        "Le comptage des produits est trop lent."
      ).catch(() => null);

      if (filters.sort === "relevance" && isDefaultCatalogueView && filters.page <= 2) {
        try {
          const { data: featured } = await withTimeout(
            (async () =>
              await supabase
                .from("cms_featured_categories")
                .select("category_id")
                .eq("is_active", true)
                .order("sort_order", { ascending: true }))(),
            CATEGORY_COUNT_TIMEOUT_MS,
            "Le chargement des catégories vedettes est trop lent."
          );

          if (featured && featured.length > 0) {
            const featuredIds = new Set(featured.map((f) => f.category_id));
            const featuredOrder = featured.map((f) => f.category_id);
            const fetchSize = Math.max(filters.perPage * 2, 48);
            const boostedQuery = applyCatalogSort(buildProductQuery(), filters.sort);
            const { data: rawData, error: rawError } = await withTimeout(
              (async () => await boostedQuery.range(0, fetchSize - 1))(),
              CATALOG_QUERY_TIMEOUT_MS,
              "Le chargement du catalogue est trop lent."
            );
            if (rawError) throw rawError;

            const boosted = [...(rawData || [])].sort((a: any, b: any) => {
              const aFeatured = featuredIds.has(a.category_id);
              const bFeatured = featuredIds.has(b.category_id);
              if (aFeatured && !bFeatured) return -1;
              if (!aFeatured && bFeatured) return 1;
              if (aFeatured && bFeatured) {
                return featuredOrder.indexOf(a.category_id) - featuredOrder.indexOf(b.category_id);
              }
              return 0;
            });

            const countResult = await countPromise;

            return {
              products: boosted.slice(offset, offset + filters.perPage) as CatalogProduct[],
              total: countResult?.count ?? boosted.length,
            };
          }
        } catch {
          // Fallback to normal paginated query
        }
      }

      const query = applyCatalogSort(buildProductQuery(), filters.sort);
      const { data, error } = await withTimeout(
        (async () => await query.range(offset, offset + filters.perPage - 1))(),
        CATALOG_QUERY_TIMEOUT_MS,
        "Le chargement du catalogue est trop lent."
      );
      if (error) throw error;

      const countResult = await countPromise;
      const total = countResult?.count ?? (data?.length === filters.perPage ? offset + data.length + 1 : offset + (data?.length || 0));

      return { products: (data || []) as CatalogProduct[], total };
    },
    placeholderData: (previousData) => previousData,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: ["catalog-categories"],
    queryFn: async () => {
      const [catResult, countResult] = await Promise.all([
        (async () =>
          await supabase
            .from("categories")
            .select("id, name, name_fr, name_nl, name_de, slug, parent_id")
            .eq("is_active", true)
            .order("display_order", { ascending: true }))(),
        withTimeout(
          (async () => await supabase.rpc("count_products_per_category"))(),
          CATEGORY_COUNT_TIMEOUT_MS,
          "Le comptage des catégories est trop lent."
        ).catch(() => null),
      ]);

      if (catResult.error) throw catResult.error;

      const countMap = new Map<string, number>();
      if (countResult?.data) {
        for (const row of countResult.data as any[]) {
          countMap.set(row.category_id, Number(row.product_count));
        }
      }

      const all = (catResult.data || []).map((c: any) => ({
        ...c,
        name: getLocalizedName(c),
        product_count: countMap.get(c.id) || 0,
      }));

      // Build full tree: L1 > L2 > L3, sorted alphabetically
      const roots = all.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      return roots.map(r => {
        const l2Children = all.filter(c => c.parent_id === r.id).sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(l2 => {
          const l3Children = all.filter(c => c.parent_id === l2.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
          const l2Total = l2.product_count + l3Children.reduce((s, c) => s + c.product_count, 0);
          return { ...l2, product_count: l2Total, children: l3Children };
        });
        const totalCount = r.product_count + l2Children.reduce((s, c) => s + c.product_count, 0);
        return { ...r, product_count: totalCount, children: l2Children };
      }) as CategoryNode[];
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
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
        .limit(500);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BrandCount[];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Server-side brand search — returns brands matching a text query */
export function useBrandSearch(search: string) {
  const trimmed = search.trim();
  return useQuery({
    queryKey: ["brand-search", trimmed],
    queryFn: async () => {
      if (!trimmed) return [] as BrandCount[];
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, product_count")
        .eq("is_active", true)
        .ilike("name", `%${trimmed}%`)
        .order("product_count", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as BrandCount[];
    },
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
    retry: false,
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
    retry: false,
  });
}
