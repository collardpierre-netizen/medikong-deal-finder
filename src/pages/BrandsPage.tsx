import { Layout } from "@/components/layout/Layout";
import { UniversePills } from "@/components/layout/UniversePills";
import { Link } from "react-router-dom";
import { useState, useMemo, useRef, useEffect } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X } from "lucide-react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface BrandItem {
  id: string;
  name: string;
  slug: string;
  product_count: number;
}

export default function BrandsPage() {
  const [activeLetter, setActiveLetter] = useState("A");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search input (250 ms) avant de lancer la requête serveur.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch only brands with products (638 rows — fast)
  const { data: brands = [], isLoading } = useQuery<BrandItem[]>({
    queryKey: ["brands-page-active"],
    queryFn: async () => {
      // Supabase caps at 1000 rows per request — paginate to fetch all
      const PAGE_SIZE = 1000;
      let all: BrandItem[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("brands")
          .select("id, name, slug, product_count")
          .eq("is_active", true)
          .gt("product_count", 0)
          .order("name")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        all = all.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        page++;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Group by first letter
  const grouped = useMemo(() => {
    const map: Record<string, BrandItem[]> = {};
    brands.forEach(b => {
      const letter = (b.name?.[0] || "?").toUpperCase();
      (map[letter] = map[letter] || []).push(b);
    });
    return map;
  }, [brands]);

  // Search server-side (ilike sur name + slug), débouncée, min 2 caractères.
  // Évite de filtrer en mémoire un cache potentiellement >1000 lignes et
  // permet de matcher des marques absentes du cache.
  const searchActive = debouncedSearch.length >= 2;
  const { data: serverSearchResults, isFetching: isSearching } = useQuery<BrandItem[]>({
    queryKey: ["brands-page-search", debouncedSearch],
    enabled: searchActive,
    queryFn: async () => {
      // Échappe les wildcards utilisateurs pour éviter qu'ils ne changent
      // le sens du LIKE côté Postgres.
      const escaped = debouncedSearch.replace(/[\\%_,]/g, "\\$&");
      const pattern = `%${escaped}%`;
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, product_count")
        .eq("is_active", true)
        .gt("product_count", 0)
        .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
        .order("name")
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });
  const searchResults: BrandItem[] | null = searchActive ? (serverSearchResults || []) : null;

  // Available letters
  const availableLetters = useMemo(() => new Set(Object.keys(grouped)), [grouped]);

  // Auto-select first available letter
  useEffect(() => {
    if (!availableLetters.has(activeLetter) && availableLetters.size > 0) {
      setActiveLetter([...availableLetters].sort()[0]);
    }
  }, [availableLetters, activeLetter]);

  const totalProducts = useMemo(() => brands.reduce((s, b) => s + (b.product_count || 0), 0), [brands]);

  // Group search results by letter for display
  const searchGrouped = useMemo(() => {
    if (!searchResults) return null;
    const map: Record<string, BrandItem[]> = {};
    searchResults.forEach(b => {
      const letter = (b.name?.[0] || "?").toUpperCase();
      (map[letter] = map[letter] || []).push(b);
    });
    return map;
  }, [searchResults]);

  return (
    <Layout>
      <PageTransition>
        <UniversePills />
        <div className="mk-container py-6 md:py-8">
          <h1 className="text-2xl md:text-[28px] font-bold text-foreground mb-1">Toutes nos marques</h1>
          <p className="text-sm text-muted-foreground mb-4">
            {brands.length} marques avec offres actives · {totalProducts.toLocaleString("de-DE")}+ produits
          </p>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une marque…"
              className="w-full md:w-96 h-10 pl-10 pr-10 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            )}
            {search && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {!searchActive
                  ? "Tapez au moins 2 caractères…"
                  : isSearching
                    ? "Recherche…"
                    : `${searchResults?.length || 0} résultat${(searchResults?.length || 0) !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>

          {/* Letter anchors — hidden when searching, disabled while loading/searching */}
          {!search && (
            <div
              className="flex gap-1.5 mb-8 flex-wrap"
              aria-busy={isLoading || isSearching}
            >
              {LETTERS.map(l => {
                const available = availableLetters.has(l);
                const isActive = l === activeLetter;
                const lockedByLoading = isLoading || isSearching;
                const isDisabled = !available || lockedByLoading;
                return (
                  <button
                    key={l}
                    onClick={() => {
                      if (available && !lockedByLoading) {
                        setActiveLetter(l);
                        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-foreground text-background"
                        : available
                          ? "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          : "text-muted-foreground/30 cursor-default"
                    } ${lockedByLoading ? "opacity-50 cursor-wait pointer-events-none" : ""}`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          )}


          {/* Brand list */}
          <div ref={listRef}>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i}>
                    <Skeleton className="h-7 w-12 mb-3" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(j => <Skeleton key={j} className="h-5 w-36" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults !== null ? (
              // Search mode: skeletons while pending, then grouped results
              isSearching ? (
                <div className="space-y-4" aria-busy="true" aria-live="polite">
                  {[1, 2, 3].map(i => (
                    <div key={i}>
                      <Skeleton className="h-7 w-12 mb-3" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[1, 2, 3, 4, 5, 6].map(j => <Skeleton key={j} className="h-5 w-36" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                  <Search className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-base font-medium text-foreground mb-1">
                    Aucune marque trouvée
                  </p>
                  <p className="text-sm mb-4">
                    Aucun résultat pour «&nbsp;{search}&nbsp;». Vérifiez l'orthographe ou essayez un autre mot-clé.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <X size={14} />
                    Effacer la recherche
                  </button>
                </div>

              ) : (
                Object.entries(searchGrouped || {}).sort().map(([letter, list]) => (
                  <div key={letter} className="mb-6">
                    <h2 className="text-lg font-bold text-foreground pb-1.5 border-b border-border mb-3">{letter}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {list.map(b => (
                        <Link key={b.slug} to={`/marque/${b.slug}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                          {b.name} <span className="text-muted-foreground font-normal">({b.product_count})</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              )

            ) : (
              // Letter mode: show only selected letter
              <div>
                <h2 className="text-xl font-bold text-foreground pb-2 border-b border-border mb-4">{activeLetter}</h2>
                {(grouped[activeLetter] || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Aucune marque pour cette lettre.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(grouped[activeLetter] || []).map(b => (
                      <Link key={b.slug} to={`/marque/${b.slug}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors py-0.5">
                        {b.name} <span className="text-muted-foreground font-normal">({b.product_count})</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
