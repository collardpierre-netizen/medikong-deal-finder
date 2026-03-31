import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import SearchTrivagoView from "@/components/search/SearchTrivagoView";
import type { CatalogViewMode } from "@/components/catalog/CatalogToolbar";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { ActiveFilters } from "@/components/catalog/ActiveFilters";
import { UniversePills } from "@/components/layout/UniversePills";
import { useCatalogFilters, useCatalogProducts } from "@/hooks/useCatalog";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function CataloguePage() {
  const { slug } = useParams();
  const { filters, setFilter, clearAll } = useCatalogFilters();
  
  // Sync route param slug to category filter
  useEffect(() => {
    if (slug && slug !== filters.category) {
      setFilter("category", slug);
    }
  }, [slug]);
  const { data, isLoading } = useCatalogProducts(filters);
  const products = data?.products || [];
  const total = data?.total || 0;
  const [view, setView] = useState<CatalogViewMode>("grid");
  const [mobileFilters, setMobileFilters] = useState(false);

  const title = filters.category
    ? filters.category.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Tous les produits";

  return (
    <Layout>
      <UniversePills />
      <div className="mk-container py-4">
        <Breadcrumbs />

        <div className="flex items-center justify-between mb-4 mt-2">
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{total.toLocaleString("fr-FR")} produits trouvés</p>
          </div>
          <button
            onClick={() => setMobileFilters(true)}
            className="lg:hidden flex items-center gap-1.5 border border-border text-sm px-3 py-1.5 rounded-md text-muted-foreground"
          >
            <SlidersHorizontal size={14} /> Filtrer
          </button>
        </div>

        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-[280px] shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-4 border-r border-border">
            <CatalogSidebar filters={filters} setFilter={setFilter} clearAll={clearAll} />
          </aside>

          {/* Mobile filter drawer */}
          <AnimatePresence>
            {mobileFilters && (
              <>
                <motion.div
                  className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobileFilters(false)}
                />
                <motion.div
                  className="fixed inset-y-0 left-0 w-[320px] max-w-[85vw] bg-background z-50 lg:hidden overflow-y-auto p-4"
                  initial={{ x: -320 }}
                  animate={{ x: 0 }}
                  exit={{ x: -320 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Filtres</h3>
                    <button onClick={() => setMobileFilters(false)} className="p-1 hover:bg-muted rounded">
                      <X size={20} />
                    </button>
                  </div>
                  <CatalogSidebar filters={filters} setFilter={setFilter} clearAll={clearAll} />
                  <button
                    onClick={() => setMobileFilters(false)}
                    className="mt-6 w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium"
                  >
                    Voir les résultats ({total})
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <ActiveFilters filters={filters} setFilter={setFilter} />
            <CatalogToolbar filters={filters} setFilter={setFilter} total={total} view={view} setView={setView} />

            <CatalogPagination page={filters.page} perPage={filters.perPage} total={total} onPageChange={p => setFilter("page", p)} />

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg text-muted-foreground">Aucun produit trouvé</p>
                <button onClick={clearAll} className="mt-3 text-sm text-primary hover:underline">
                  Effacer les filtres
                </button>
              </div>
            ) : view === "trivago" ? (
              <SearchTrivagoView products={products.map(p => ({
                id: p.id, slug: p.slug, name: p.name, brand: p.brand_name || "",
                gtin: p.gtin || "", cnk: p.cnk_code || "", ean: p.gtin || "",
                price: p.best_price_excl_vat || 0, pub: p.best_price_incl_vat || 0,
                pct: 0, sellers: p.offer_count || 0, rating: 0, reviews: 0,
                best: "", unit: "", stock: p.is_in_stock, mk: p.offer_count > 0,
                imageUrl: p.image_urls?.[0] || undefined,
                category: p.category_name || undefined,
              }))} />
            ) : (
              <div className={view === "grid"
                ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
                : "space-y-3"
              }>
                {products.map((p, i) => (
                  <CatalogProductCard key={p.id} product={p} index={i} view={view} />
                ))}
              </div>
            )}

            <CatalogPagination page={filters.page} perPage={filters.perPage} total={total} onPageChange={p => setFilter("page", p)} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
