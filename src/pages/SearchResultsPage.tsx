import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useSearchProducts, type SortOption } from "@/hooks/useSearchProducts";
import SearchResultsBar from "@/components/search/SearchResultsBar";
import SearchGridView from "@/components/search/SearchGridView";
import SearchListView from "@/components/search/SearchListView";
import SearchTrivagoView from "@/components/search/SearchTrivagoView";
import SearchFilterPills from "@/components/search/SearchFilterPills";
import { Loader2 } from "lucide-react";
import type { Product } from "@/hooks/useProducts";

export type ViewMode = "grid" | "list" | "trivago";

export interface SearchFilters {
  inStock: boolean;
  mkOnly: boolean;
  delivery48h: boolean;
  minRating: number | null;
}

const defaultFilters: SearchFilters = {
  inStock: false,
  mkOnly: false,
  delivery48h: false,
  minRating: null,
};

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortOption>("relevance");
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);

  const { data: rawProducts = [], isLoading } = useSearchProducts(query, sort);

  // Apply client-side filters
  const products = useMemo(() => {
    let result = rawProducts;
    if (filters.inStock) result = result.filter(p => p.stock);
    if (filters.mkOnly) result = result.filter(p => p.mk);
    return result;
  }, [rawProducts, filters]);

  // Derive vendor count (sellers)
  const vendorCount = useMemo(() => {
    const total = products.reduce((sum, p) => sum + (p.sellers || 0), 0);
    return Math.min(total, products.length); // rough approximation
  }, [products]);

  return (
    <Layout>
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
          {/* Query heading */}
          {query && (
            <h1 className="text-xl font-bold text-foreground">
              Résultats pour « {query} »
            </h1>
          )}

          {/* Filter pills */}
          <SearchFilterPills filters={filters} onChange={setFilters} />

          {/* Results bar with view toggle + sort */}
          <SearchResultsBar
            view={view}
            setView={setView}
            total={products.length}
            vendors={vendorCount}
            sortBy={sort}
            onSortChange={setSort}
          />

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">Aucun produit trouvé</p>
              <p className="text-muted-foreground text-sm mt-2">
                Essayez d'élargir votre recherche ou de modifier les filtres.
              </p>
            </div>
          ) : (
            <>
              {view === "grid" && <SearchGridView products={products} />}
              {view === "list" && <SearchListView products={products} />}
              {view === "trivago" && <SearchTrivagoView products={products} />}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
