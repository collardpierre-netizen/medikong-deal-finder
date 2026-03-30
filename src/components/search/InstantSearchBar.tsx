import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Package, Tag, FolderOpen, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { federatedSearch, isMeilisearchConfigured } from "@/lib/meilisearch";
import type { FederatedResults } from "@/lib/meilisearch";

interface InstantSearchBarProps {
  className?: string;
  placeholder?: string;
  variant?: "navbar" | "hero";
}

export function InstantSearchBar({ className = "", placeholder, variant = "navbar" }: InstantSearchBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FederatedResults>({ products: [], brands: [], categories: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [configured, setConfigured] = useState(true); // optimistic
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    isMeilisearchConfigured().then(setConfigured);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ products: [], brands: [], categories: [] });
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await federatedSearch(q);
      setResults(res);
      const hasAny = res.products.length > 0 || res.brands.length > 0 || res.categories.length > 0;
      setIsOpen(hasAny || q.trim().length > 0);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 150);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/recherche?q=${encodeURIComponent(query)}` : `/recherche`);
    setIsOpen(false);
  };

  const allItems = [
    ...results.products.map((p) => ({ type: "product" as const, item: p })),
    ...results.brands.map((b) => ({ type: "brand" as const, item: b })),
    ...results.categories.map((c) => ({ type: "category" as const, item: c })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const sel = allItems[selectedIndex];
      if (sel.type === "product") navigate(`/produit/${(sel.item as any).slug}`);
      else if (sel.type === "brand") navigate(`/marques/${(sel.item as any).slug}`);
      else navigate(`/categorie/${(sel.item as any).slug}`);
      setIsOpen(false);
      setQuery("");
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasResults = results.products.length > 0 || results.brands.length > 0 || results.categories.length > 0;

  const isHero = variant === "hero";
  const inputClasses = isHero
    ? "w-full pl-11 pr-10 py-3.5 rounded-xl text-sm bg-white text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-md"
    : "w-full pl-9 pr-8 py-2 rounded-md text-sm bg-white text-foreground placeholder:text-muted-foreground border-0 focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={isHero ? 18 : 16} />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => hasResults && setIsOpen(true)}
            placeholder={placeholder || t("common.searchPlaceholder")}
            className={inputClasses}
            autoComplete="off"
            role="combobox"
            aria-expanded={isOpen}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" size={16} />
          )}
          {!isLoading && query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults({ products: [], brands: [], categories: [] }); setIsOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </form>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-border z-[60] max-h-[420px] overflow-y-auto"
        >
          {/* Search all link */}
          <button
            onClick={() => { navigate(`/recherche?q=${encodeURIComponent(query)}`); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-accent/50 border-b border-border"
          >
            <Search size={14} />
            <span>Rechercher « <strong>{query}</strong> »</span>
          </button>

          {/* Products */}
          {results.products.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Produits
              </div>
              {results.products.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { navigate(`/produit/${p.slug}`); setIsOpen(false); setQuery(""); }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent/50 transition-colors ${selectedIndex === i ? "bg-accent/50" : ""}`}
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-8 h-8 rounded object-contain bg-muted/20 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted/20 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      {p.brand_name && <span>{p.brand_name}</span>}
                      {p.best_price_excl_vat > 0 && (
                        <span className="font-semibold text-primary">€{p.best_price_excl_vat.toFixed(2)}</span>
                      )}
                      {p.offer_count > 0 && <span>{p.offer_count} offre{p.offer_count > 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Brands */}
          {results.brands.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Marques
              </div>
              {results.brands.map((b, i) => {
                const idx = results.products.length + i;
                return (
                  <button
                    key={b.id}
                    onClick={() => { navigate(`/marques/${b.slug}`); setIsOpen(false); setQuery(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent/50 transition-colors ${selectedIndex === idx ? "bg-accent/50" : ""}`}
                  >
                    {b.logo_url ? (
                      <img src={b.logo_url} alt="" className="w-8 h-8 rounded object-contain bg-muted/20 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted/20 flex items-center justify-center shrink-0">
                        <Tag size={14} className="text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-foreground">{b.name}</div>
                      {b.product_count > 0 && (
                        <div className="text-[11px] text-muted-foreground">{b.product_count} produits</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Categories */}
          {results.categories.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Catégories
              </div>
              {results.categories.map((c, i) => {
                const idx = results.products.length + results.brands.length + i;
                return (
                  <button
                    key={c.id}
                    onClick={() => { navigate(`/categorie/${c.slug}`); setIsOpen(false); setQuery(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-accent/50 transition-colors ${selectedIndex === idx ? "bg-accent/50" : ""}`}
                  >
                    <div className="w-8 h-8 rounded bg-muted/20 flex items-center justify-center shrink-0">
                      <FolderOpen size={14} className="text-muted-foreground" />
                    </div>
                    <div className="text-sm font-medium text-foreground">{c.name}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {!hasResults && query.trim() && !isLoading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {query} »
            </div>
          )}
        </div>
      )}
    </div>
  );
}
