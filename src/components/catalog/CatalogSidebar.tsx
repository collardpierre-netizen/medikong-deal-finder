import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, X, Search, Filter, Eye } from "lucide-react";
import { useCountry } from "@/contexts/CountryContext";
import { useCatalogCategories, useCatalogBrands, useCatalogManufacturers, useBrandSearch, type CatalogFilters } from "@/hooks/useCatalog";
import { useVisibleCategories } from "@/hooks/useVisibleCategories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { cleanCategoryLabel } from "@/lib/category-label";

interface Props {
  filters: CatalogFilters;
  setFilter: (key: string, value: any) => void;
  clearAll: () => void;
  resultCategoryIds?: string[];
}

export function CatalogSidebar({ filters, setFilter, clearAll, resultCategoryIds }: Props) {
  const { t } = useTranslation();
  const { currentCountry } = useCountry();
  const { data: categories = [] } = useCatalogCategories();
  const { data: brands = [] } = useCatalogBrands(filters.category);
  const { data: manufacturers = [] } = useCatalogManufacturers();
  const { visibleCategoryIds, isFiltered: professionFiltered, professionType } = useVisibleCategories();
  const [showAllCats, setShowAllCats] = useState(false);

  const [brandSearch, setBrandSearch] = useState("");
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const [mfSearch, setMfSearch] = useState("");
  const [mfDropdownOpen, setMfDropdownOpen] = useState(false);
  const mfDropdownRef = useRef<HTMLDivElement>(null);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllMf, setShowAllMf] = useState(false);
  const [priceMin, setPriceMin] = useState(filters.priceMin?.toString() || "");
  const [priceMax, setPriceMax] = useState(filters.priceMax?.toString() || "");

  const { data: serverBrands } = useBrandSearch(brandSearch);

  // Merge local brands with server search results to cover brands beyond the 500 limit
  const mergedBrands = useMemo(() => {
    if (!serverBrands || serverBrands.length === 0) return brands;
    const localIds = new Set(brands.map(b => b.id));
    const extras = serverBrands.filter(b => !localIds.has(b.id));
    return [...brands, ...extras];
  }, [brands, serverBrands]);

  // Auto-suggest: matching brands for dropdown – show up to 20, prioritise prefix matches
  const brandSuggestions = useMemo(() => {
    if (!brandSearch) return [];
    const q = brandSearch.toLowerCase();
    return mergedBrands
      .filter(b => b.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aExact = a.name.toLowerCase() === q;
        const bExact = b.name.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        const aStarts = a.name.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return b.product_count - a.product_count;
      })
      .slice(0, 20);
  }, [mergedBrands, brandSearch]);

  const mfSuggestions = useMemo(() => {
    if (!mfSearch) return [];
    return manufacturers.filter(m => m.name.toLowerCase().includes(mfSearch.toLowerCase())).slice(0, 8);
  }, [manufacturers, mfSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false);
      }
      if (mfDropdownRef.current && !mfDropdownRef.current.contains(e.target as Node)) {
        setMfDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredBrands = useMemo(() => {
    let list = mergedBrands;
    if (brandSearch) list = list.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()));
    return showAllBrands ? list : list.slice(0, 15);
  }, [mergedBrands, brandSearch, showAllBrands]);

  const filteredMf = useMemo(() => {
    let list = manufacturers;
    if (mfSearch) list = list.filter(m => m.name.toLowerCase().includes(mfSearch.toLowerCase()));
    return showAllMf ? list : list.slice(0, 10);
  }, [manufacturers, mfSearch, showAllMf]);

  const selectedCategory = useMemo(() => {
    if (!filters.category) return null;
    for (const cat of categories) {
      if (cat.slug === filters.category) return cat;
      for (const child of cat.children || []) {
        if (child.slug === filters.category) return child;
      }
    }
    return null;
  }, [filters.category, categories]);

  const parentCategory = useMemo(() => {
    if (!selectedCategory?.parent_id) return null;
    return categories.find(c => c.id === selectedCategory.parent_id) || null;
  }, [selectedCategory, categories]);

  const displayCategories = useMemo(() => {
    let cats: any[];
    if (!filters.category) {
      cats = categories;
    } else if (selectedCategory) {
      const children = categories.flatMap(c => c.children || []).length > 0
        ? (selectedCategory as any).children || []
        : [];
      if (children.length > 0) cats = children;
      else if (parentCategory) cats = parentCategory.children || [];
      else cats = categories;
    } else {
      cats = categories;
    }
    // Only filter categories by results when a search/brand filter is active (not on default view)
    if (resultCategoryIds && resultCategoryIds.length > 0 && !filters.category && (filters.search || (filters.brands && filters.brands.length > 0))) {
      // Build a set of all ancestor IDs for result categories
      const allCats = categories.flatMap(c => [c, ...(c.children || [])]);
      const ancestorIds = new Set<string>();
      for (const id of resultCategoryIds) {
        ancestorIds.add(id);
        const cat = allCats.find((c: any) => c.id === id);
        if (cat?.parent_id) {
          ancestorIds.add(cat.parent_id);
          const parent = allCats.find((c: any) => c.id === cat.parent_id);
          if (parent?.parent_id) ancestorIds.add(parent.parent_id);
        }
      }
      cats = cats.filter((cat: any) => {
        const childIds = (cat.children || []).map((c: any) => c.id);
        return ancestorIds.has(cat.id) || childIds.some((id: string) => ancestorIds.has(id));
      });
    }
    // Apply profession-type filter at root level
    if (!showAllCats && professionFiltered && visibleCategoryIds && !filters.category) {
      const visSet = new Set(visibleCategoryIds);
      // Keep L1 categories that are in the set or have children in the set
      const allFlat = categories.flatMap(c => [c, ...(c.children || [])]);
      const parentIdsOfVisible = new Set<string>();
      for (const id of visibleCategoryIds) {
        const cat = allFlat.find((c: any) => c.id === id);
        if (cat?.parent_id) parentIdsOfVisible.add(cat.parent_id);
      }
      cats = cats.filter((cat: any) => visSet.has(cat.id) || parentIdsOfVisible.has(cat.id));
    }
    return cats;
  }, [filters.category, filters.search, filters.brands, selectedCategory, parentCategory, categories, resultCategoryIds, showAllCats, professionFiltered, visibleCategoryIds]);

  const toggleBrand = (slug: string) => {
    const current = filters.brands || [];
    const next = current.includes(slug) ? current.filter(b => b !== slug) : [...current, slug];
    setFilter("brand", next);
  };

  const toggleMf = (slug: string) => {
    const current = filters.manufacturers || [];
    const next = current.includes(slug) ? current.filter(m => m !== slug) : [...current, slug];
    setFilter("manufacturer", next);
  };

  const applyPrice = () => {
    setFilter("price_min", priceMin ? Number(priceMin) : undefined);
    setFilter("price_max", priceMax ? Number(priceMax) : undefined);
  };

  const hasFilters = filters.category || (filters.brands && filters.brands.length > 0) || (filters.manufacturers && filters.manufacturers.length > 0) || filters.priceMin !== undefined || filters.priceMax !== undefined || filters.inStock || filters.hasOffers;

  return (
    <div className="space-y-6">
      {/* Clear all */}
      {hasFilters && (
         <button onClick={clearAll} className="text-sm text-mk-blue hover:underline flex items-center gap-1">
           <X size={14} /> {t("catalog.clearAll")}
        </button>
      )}

      {/* Delivery preferences */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Livraison</h4>
        <p className="text-sm text-foreground">
          {currentCountry?.flag_emoji} {currentCountry?.name || "Belgique"}
        </p>
      </div>

      {/* Profession filter indicator */}
      {professionFiltered && professionType && !filters.category && (
        <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Filter size={12} className="text-primary" />
            <span className="text-xs font-semibold text-primary">{professionType.name}</span>
          </div>
          <button
            onClick={() => setShowAllCats(!showAllCats)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {showAllCats ? <><Filter size={10} /> Filtrer par profil</> : <><Eye size={10} /> Voir tout</>}
          </button>
        </div>
      )}

      {/* Categories — collapsible with max-height scroll */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("catalog.categories")}</h4>
        {filters.category && (
          <button
            onClick={() => {
              if (parentCategory) setFilter("category", parentCategory.slug);
              else setFilter("category", undefined);
            }}
            className="text-sm text-mk-blue hover:underline flex items-center gap-1 mb-2"
          >
             <ChevronLeft size={14} />
             {parentCategory ? parentCategory.name : t("catalog.categories")}
          </button>
        )}
        <div className="relative">
          <div className="max-h-[220px] overflow-y-auto pr-2">
            <div className="space-y-0.5">
              {displayCategories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setFilter("category", cat.slug)}
                  className={`flex w-full items-center justify-between text-sm py-1.5 px-2 rounded transition-colors ${
                    filters.category === cat.slug
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{cat.name}</span>
                  {cat.product_count > 0 && (
                    <span className="text-xs text-muted-foreground">({cat.product_count.toLocaleString("fr-FR")})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          {displayCategories.length > 8 && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent" />
          )}
        </div>
      </div>

      {/* Brands */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("catalog.brands")}</h4>
        <div className="relative mb-2" ref={brandDropdownRef}>
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("catalog.searchBrands")}
            value={brandSearch}
            onChange={e => { setBrandSearch(e.target.value); setBrandDropdownOpen(true); }}
            onFocus={() => { if (brandSearch.length > 0) setBrandDropdownOpen(true); }}
            className="pl-7 h-8 text-sm"
          />
          {brandDropdownOpen && brandSearch.length >= 1 && brandSuggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
              {brandSuggestions.map(b => {
                const isSelected = filters.brands?.includes(b.slug) || false;
                return (
                  <button
                    key={b.id}
                    onClick={() => { toggleBrand(b.slug); setBrandSearch(""); setBrandDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center justify-between ${isSelected ? "bg-primary/5 font-medium" : ""}`}
                  >
                    <span className="truncate">{b.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">({b.product_count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected brand chips */}
        {(filters.brands || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {(filters.brands || []).map(slug => {
              const brand = brands.find(b => b.slug === slug);
              return brand ? (
                <span key={slug} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {brand.name}
                  <button onClick={() => toggleBrand(slug)} className="hover:text-destructive"><X size={12} /></button>
                </span>
              ) : null;
            })}
          </div>
        )}

        <div className="max-h-[220px] overflow-y-auto pr-1">
          <div className="space-y-1">
            {filteredBrands.map(b => (
              <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5 hover:bg-muted px-1 rounded">
                <input
                  type="checkbox"
                  checked={filters.brands?.includes(b.slug) || false}
                  onChange={() => toggleBrand(b.slug)}
                  className="rounded border-border"
                />
                <span className="flex-1 truncate text-foreground">{b.name}</span>
                <span className="text-xs text-muted-foreground">({b.product_count})</span>
              </label>
            ))}
          </div>
        </div>
        {brands.length > 15 && !showAllBrands && (
           <button onClick={() => setShowAllBrands(true)} className="text-xs text-mk-blue hover:underline mt-1">
             {t("catalog.showMore")} ({brands.length - 15})
          </button>
        )}
      </div>

      {/* Price */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("catalog.priceRange")}</h4>
        <div className="flex gap-2 items-center">
          <Input placeholder="Min €" value={priceMin} onChange={e => setPriceMin(e.target.value)} className="h-8 text-sm" type="number" />
          <Input placeholder="Max €" value={priceMax} onChange={e => setPriceMax(e.target.value)} className="h-8 text-sm" type="number" />
          <Button size="sm" variant="outline" onClick={applyPrice} className="h-8 text-xs shrink-0">OK</Button>
        </div>
      </div>

      {/* Availability */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Disponibilité</h4>
        <div className="space-y-1.5">
           {[
             { label: t("common.viewAll"), value: undefined },
             { label: t("catalog.inStockOnly"), value: true },
          ].map(opt => (
            <label key={String(opt.value)} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="stock"
                checked={filters.inStock === opt.value}
                onChange={() => setFilter("stock", opt.value ? "1" : undefined)}
                className="border-border"
              />
              <span className="text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Has offers filter */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Offres</h4>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!filters.hasOffers}
            onChange={() => setFilter("has_offers", filters.hasOffers ? undefined : "1")}
            className="rounded border-border"
          />
          <span className="text-foreground">Avec offres actives uniquement</span>
        </label>
      </div>

      {/* Manufacturers */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("catalog.manufacturers")}</h4>
        <div className="relative mb-2" ref={mfDropdownRef}>
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("catalog.searchManufacturers")}
            value={mfSearch}
            onChange={e => { setMfSearch(e.target.value); setMfDropdownOpen(true); }}
            onFocus={() => { if (mfSearch.length > 0) setMfDropdownOpen(true); }}
            className="pl-7 h-8 text-sm"
          />
          {mfDropdownOpen && mfSearch.length >= 1 && mfSuggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
              {mfSuggestions.map(m => {
                const isSelected = filters.manufacturers?.includes(m.slug) || false;
                return (
                  <button
                    key={m.id}
                    onClick={() => { toggleMf(m.slug); setMfSearch(""); setMfDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center justify-between ${isSelected ? "bg-primary/5 font-medium" : ""}`}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">({m.product_count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected manufacturer chips */}
        {(filters.manufacturers || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {(filters.manufacturers || []).map(slug => {
              const mf = manufacturers.find(m => m.slug === slug);
              return mf ? (
                <span key={slug} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {mf.name}
                  <button onClick={() => toggleMf(slug)} className="hover:text-destructive"><X size={12} /></button>
                </span>
              ) : null;
            })}
          </div>
        )}

        <div className="max-h-[220px] overflow-y-auto pr-1">
          <div className="space-y-1">
            {filteredMf.map(m => (
              <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5 hover:bg-muted px-1 rounded">
                <input
                  type="checkbox"
                  checked={filters.manufacturers?.includes(m.slug) || false}
                  onChange={() => toggleMf(m.slug)}
                  className="rounded border-border"
                />
                <span className="flex-1 truncate text-foreground">{m.name}</span>
                <span className="text-xs text-muted-foreground">({m.product_count})</span>
              </label>
            ))}
          </div>
        </div>
        {manufacturers.length > 10 && !showAllMf && (
           <button onClick={() => setShowAllMf(true)} className="text-xs text-mk-blue hover:underline mt-1">
             {t("catalog.showMore")} ({manufacturers.length - 10})
          </button>
        )}
      </div>
    </div>
  );
}
