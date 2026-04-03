import { Layout } from "@/components/layout/Layout";
import { Link, useSearchParams } from "react-router-dom";
import {
  Package, ChevronRight, Search, X, Home, Filter, Eye
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { HoverCard } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useVisibleCategories } from "@/hooks/useVisibleCategories";
import { HoverCard } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

interface CategoryItem {
  id: string;
  name: string;
  name_fr: string | null;
  slug: string;
  icon: string | null;
  image_url: string | null;
  parent_id: string | null;
  productCount: number;
  childCount: number;
}

export default function CategoriesPage() {
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const parentSlug = searchParams.get("parent") || null;

  const { data: allCategories = [], isLoading } = useQuery({
    queryKey: ["categories-page-hierarchy"],
    queryFn: async () => {
      const { data: cats, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, slug, icon, image_url, parent_id")
        .eq("is_active", true)
        .order("display_order")
        .order("name");
      if (error) throw error;

      const { data: rpcData } = await supabase.rpc(
        "count_products_per_category" as any
      );

      const countMap = new Map<string, number>();
      if (rpcData && Array.isArray(rpcData)) {
        for (const row of rpcData) {
          countMap.set(row.category_id, Number(row.product_count));
        }
      }

      // Count children per category
      const childCountMap = new Map<string, number>();
      for (const c of cats || []) {
        if (c.parent_id) {
          childCountMap.set(c.parent_id, (childCountMap.get(c.parent_id) || 0) + 1);
        }
      }

      return (cats || []).map(c => ({
        ...c,
        productCount: countMap.get(c.id) || 0,
        childCount: childCountMap.get(c.id) || 0,
      })) as CategoryItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Find current parent category
  const currentParent = parentSlug
    ? allCategories.find(c => c.slug === parentSlug)
    : null;

  // Build breadcrumb chain
  const breadcrumbChain = useMemo(() => {
    if (!currentParent) return [];
    const chain: CategoryItem[] = [];
    let current: CategoryItem | undefined = currentParent;
    while (current) {
      chain.unshift(current);
      current = current.parent_id
        ? allCategories.find(c => c.id === current!.parent_id)
        : undefined;
    }
    return chain;
  }, [currentParent, allCategories]);

  // Get categories to display at current level
  const currentLevelCategories = useMemo(() => {
    let cats: CategoryItem[];
    if (currentParent) {
      cats = allCategories.filter(c => c.parent_id === currentParent.id);
    } else {
      cats = allCategories.filter(c => !c.parent_id);
    }

    const visibleCats = currentParent
      ? cats
      : cats.filter(c => c.productCount > 0 || c.childCount > 0);

    return visibleCats.sort((a, b) => {
      if (b.childCount !== a.childCount) return b.childCount - a.childCount;
      if (b.productCount !== a.productCount) return b.productCount - a.productCount;
      return displayName(a).localeCompare(displayName(b), "fr", { sensitivity: "base" });
    });
  }, [allCategories, currentParent]);

  const filtered = useMemo(() => {
    if (!search.trim()) return currentLevelCategories;
    const q = search.trim().toLowerCase();
    return currentLevelCategories.filter(c =>
      (c.name_fr || c.name).toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [currentLevelCategories, search]);

  function displayName(c: CategoryItem) {
    return c.name_fr || c.name;
  }

  const handleCategoryClick = (cat: CategoryItem) => {
    // If has children, navigate to show children
    if (cat.childCount > 0) {
      setSearch("");
      setSearchParams({ parent: cat.slug }, { replace: true });
      return;
    }
    // Otherwise, link to catalogue
    return `/categorie/${cat.slug}`;
  };

  const pageTitle = currentParent
    ? displayName(currentParent)
    : "Toutes les catégories";

  return (
    <Layout
      title={`${pageTitle} | MediKong`}
      description="Parcourez toutes les catégories de produits disponibles sur MediKong."
    >
      <section className="py-12 md:py-20">
        <div className="mk-container">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
            <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Home size={14} />
              Accueil
            </Link>
            <ChevronRight size={14} className="shrink-0" />
            {breadcrumbChain.length === 0 ? (
              <span className="text-foreground font-medium">Catégories</span>
            ) : (
              <>
                <button
                  onClick={() => setSearchParams({}, { replace: true })}
                  className="hover:text-foreground transition-colors"
                >
                  Catégories
                </button>
                {breadcrumbChain.map((bc, i) => (
                  <span key={bc.id} className="flex items-center gap-1.5">
                    <ChevronRight size={14} className="shrink-0" />
                    {i === breadcrumbChain.length - 1 ? (
                      <span className="text-foreground font-medium">{displayName(bc)}</span>
                    ) : (
                      <button
                        onClick={() => setSearchParams({ parent: bc.slug }, { replace: true })}
                        className="hover:text-foreground transition-colors"
                      >
                        {displayName(bc)}
                      </button>
                    )}
                  </span>
                ))}
              </>
            )}
          </nav>

          <motion.h1
            className="text-3xl md:text-4xl font-bold text-mk-navy mb-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={pageTitle}
          >
            {pageTitle}
          </motion.h1>
          <motion.p
            className="text-base text-muted-foreground mb-6 max-w-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {filtered.length} {currentParent ? "sous-catégories" : "catégories"} disponibles.
          </motion.p>

          {/* Search bar */}
          <motion.div
            className="relative mb-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une catégorie…"
              className="w-full md:w-96 h-10 pl-10 pr-10 rounded-lg border border-mk-line bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mk-blue/30 focus:border-mk-blue transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            )}
            {search && (
              <p className="text-xs text-muted-foreground mt-1.5">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</p>
            )}
          </motion.div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>{search ? `Aucune catégorie trouvée pour « ${search} »` : "Aucune catégorie disponible pour le moment."}</p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.3 }}
            >
              {filtered.map(cat => {
                const hasChildren = cat.childCount > 0;
                const content = (
                  <div className="flex flex-col items-center text-center p-8 gap-4 h-full min-h-[180px] justify-center relative">
                    <div className="w-16 h-16 rounded-2xl bg-mk-alt flex items-center justify-center shrink-0">
                      {cat.image_url ? (
                        <img src={cat.image_url} alt="" className="w-8 h-8 object-contain" />
                      ) : (
                        <Package size={28} className="text-mk-blue" />
                      )}
                    </div>
                    <div className="min-h-[48px] flex flex-col justify-center">
                      <h2 className="text-lg font-bold text-mk-navy mb-1 line-clamp-2">{displayName(cat)}</h2>
                      <p className="text-sm text-muted-foreground">
                        {cat.productCount.toLocaleString("fr-FR")} produits
                        {hasChildren && ` · ${cat.childCount} sous-cat.`}
                      </p>
                    </div>
                    {hasChildren && (
                      <ChevronRight size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    )}
                  </div>
                );

                return (
                  <motion.div
                    key={cat.slug}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <HoverCard className="border border-mk-line rounded-xl bg-white h-full">
                      {hasChildren ? (
                        <button
                          onClick={() => {
                            setSearch("");
                            setSearchParams({ parent: cat.slug }, { replace: true });
                          }}
                          className="w-full text-left"
                        >
                          {content}
                        </button>
                      ) : (
                        <Link to={`/categorie/${cat.slug}`} className="block">
                          {content}
                        </Link>
                      )}
                    </HoverCard>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </section>
    </Layout>
  );
}
