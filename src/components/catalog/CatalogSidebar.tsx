import { useState, useMemo } from "react";
import { ChevronLeft, X, Search } from "lucide-react";
import { useCountry } from "@/contexts/CountryContext";
import { useCatalogCategories, useCatalogBrands, useCatalogManufacturers, type CatalogFilters } from "@/hooks/useCatalog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  filters: CatalogFilters;
  setFilter: (key: string, value: any) => void;
  clearAll: () => void;
}

export function CatalogSidebar({ filters, setFilter, clearAll }: Props) {
  const { currentCountry } = useCountry();
  const { data: categories = [] } = useCatalogCategories();
  const { data: brands = [] } = useCatalogBrands(filters.category);
  const { data: manufacturers = [] } = useCatalogManufacturers();

  const [brandSearch, setBrandSearch] = useState("");
  const [mfSearch, setMfSearch] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllMf, setShowAllMf] = useState(false);
  const [priceMin, setPriceMin] = useState(filters.priceMin?.toString() || "");
  const [priceMax, setPriceMax] = useState(filters.priceMax?.toString() || "");

  const filteredBrands = useMemo(() => {
    let list = brands;
    if (brandSearch) list = list.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()));
    return showAllBrands ? list : list.slice(0, 15);
  }, [brands, brandSearch, showAllBrands]);

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
    if (!filters.category) return categories;
    if (selectedCategory) {
      // Show children of selected if it has children, else show siblings
      const children = categories.flatMap(c => c.children || []).length > 0
        ? (selectedCategory as any).children || []
        : [];
      if (children.length > 0) return children;
      // Show siblings
      if (parentCategory) return parentCategory.children || [];
    }
    return categories;
  }, [filters.category, selectedCategory, parentCategory, categories]);

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

  const hasFilters = filters.category || (filters.brands && filters.brands.length > 0) || (filters.manufacturers && filters.manufacturers.length > 0) || filters.priceMin !== undefined || filters.priceMax !== undefined || filters.inStock;

  return (
    <div className="space-y-6">
      {/* Clear all */}
      {hasFilters && (
        <button onClick={clearAll} className="text-sm text-mk-blue hover:underline flex items-center gap-1">
          <X size={14} /> Effacer tous les filtres
        </button>
      )}

      {/* Delivery preferences */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Livraison</h4>
        <p className="text-sm text-foreground">
          {currentCountry?.flag_emoji} {currentCountry?.name || "Belgique"}
        </p>
      </div>

      {/* Categories — collapsible with max-height scroll */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Catégorie</h4>
        {filters.category && (
          <button
            onClick={() => {
              if (parentCategory) setFilter("category", parentCategory.slug);
              else setFilter("category", undefined);
            }}
            className="text-sm text-mk-blue hover:underline flex items-center gap-1 mb-2"
          >
            <ChevronLeft size={14} />
            {parentCategory ? parentCategory.name : "Toutes les catégories"}
          </button>
        )}
        <div className="relative">
          <div className="max-h-[220px] overflow-y-auto pr-2">
            <div className="space-y-0.5">
              {displayCategories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setFilter("category", cat.slug)}
                  className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                    filters.category === cat.slug
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {cat.name}
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
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Marque</h4>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une marque..."
            value={brandSearch}
            onChange={e => setBrandSearch(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
        <ScrollArea className="max-h-[280px]">
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
        </ScrollArea>
        {brands.length > 15 && !showAllBrands && (
          <button onClick={() => setShowAllBrands(true)} className="text-xs text-mk-blue hover:underline mt-1">
            Voir plus ({brands.length - 15})
          </button>
        )}
      </div>

      {/* Price */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Prix</h4>
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
            { label: "Tous", value: undefined },
            { label: "En stock uniquement", value: true },
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

      {/* Manufacturers */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fabricant</h4>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={mfSearch}
            onChange={e => setMfSearch(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
        <ScrollArea className="max-h-[200px]">
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
        </ScrollArea>
        {manufacturers.length > 10 && !showAllMf && (
          <button onClick={() => setShowAllMf(true)} className="text-xs text-mk-blue hover:underline mt-1">
            Voir plus ({manufacturers.length - 10})
          </button>
        )}
      </div>
    </div>
  );
}
