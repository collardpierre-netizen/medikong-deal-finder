import { Layout } from "@/components/layout/Layout";
import { usePromoProducts, usePromoCount, usePromotionCampaigns, usePromoCategories, usePromoBrands } from "@/hooks/usePromotions";
import { Tag, TrendingDown, Truck, Calendar, Zap, Timer, Filter, X, SlidersHorizontal, ArrowUpDown, Search, Package } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ProductImage } from "@/components/shared/ProductCard";
import { formatPrice } from "@/data/mock";
import { motion } from "framer-motion";
import { isValidProductImage, MEDIKONG_PLACEHOLDER } from "@/lib/image-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

function FlashCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState(() => calcRemaining(endsAt));

  function calcRemaining(end: string) {
    const diff = Math.max(0, new Date(end).getTime() - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, expired: diff <= 0 };
  }

  useEffect(() => {
    const t = setInterval(() => setRemaining(calcRemaining(endsAt)), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  if (remaining.expired) return <span className="text-xs text-destructive font-medium">Expiré</span>;

  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      <Timer size={12} className="text-destructive" />
      <span className="text-destructive font-semibold">
        {String(remaining.h).padStart(2, "0")}:{String(remaining.m).padStart(2, "0")}:{String(remaining.s).padStart(2, "0")}
      </span>
    </div>
  );
}

function PromoProductCard({ product, index, flashDeal }: { product: any; index: number; flashDeal?: any }) {
  const discount = flashDeal
    ? Math.round((1 - flashDeal.discount_price_incl_vat / flashDeal.original_price_incl_vat) * 100)
    : Math.round(product.discount_percentage || 0);

  const currentPrice = flashDeal
    ? flashDeal.discount_price_incl_vat
    : product.best_price_excl_vat || 0;

  const originalPrice = flashDeal
    ? flashDeal.original_price_incl_vat
    : product.reference_price || product.best_price_incl_vat || 0;

  const imgSrc = (() => {
    const urls = Array.isArray(product.image_urls) ? product.image_urls.filter(isValidProductImage) : [];
    if (urls.length > 0) return urls[0];
    if (isValidProductImage(product.image_url)) return product.image_url;
    return MEDIKONG_PLACEHOLDER;
  })();

  const brandSlug = product.brands?.slug || undefined;

  return (
    <motion.div
      className="border border-border rounded-lg p-3 relative"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      whileHover={{ y: -4, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12)" }}
    >
      {discount > 0 && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-destructive">
            -{discount}%
          </span>
          {flashDeal && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-amber-500 flex items-center gap-0.5">
              <Zap size={10} /> FLASH
            </span>
          )}
        </div>
      )}

      <Link to={`/produit/${product.slug}`}>
        <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
          <img src={imgSrc} alt={product.name} loading="lazy" className="w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.src = MEDIKONG_PLACEHOLDER; }} />
        </div>
      </Link>

      {product.brand_name && (
        brandSlug ? (
          <Link to={`/marque/${brandSlug}`} className="text-[11px] text-muted-foreground hover:text-primary hover:underline block mb-0.5">{product.brand_name}</Link>
        ) : (
          <p className="text-[11px] text-muted-foreground mb-0.5">{product.brand_name}</p>
        )
      )}

      <Link to={`/produit/${product.slug}`}>
        <h3 className="text-xs font-medium text-foreground leading-snug mb-2 line-clamp-2">{product.name}</h3>
      </Link>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-base font-bold text-primary">{formatPrice(currentPrice)} €</span>
        {originalPrice > currentPrice && (
          <span className="text-xs text-muted-foreground line-through">{formatPrice(originalPrice)} €</span>
        )}
      </div>

      {flashDeal && <FlashCountdown endsAt={flashDeal.ends_at} />}

      {product.offer_count > 0 && (
        <p className="text-[11px] text-emerald-600 mt-1">{product.offer_count} vendeur{product.offer_count > 1 ? "s" : ""}</p>
      )}
    </motion.div>
  );
}

/* ── Sidebar Filters ─────────────────────────── */
function PromoSidebar({
  categoryId, setCategoryId,
  brandId, setBrandId,
  inStockOnly, setInStockOnly,
  sortBy, setSortBy,
  onClearAll,
}: {
  categoryId?: string; setCategoryId: (v?: string) => void;
  brandId?: string; setBrandId: (v?: string) => void;
  inStockOnly: boolean; setInStockOnly: (v: boolean) => void;
  sortBy: string; setSortBy: (v: any) => void;
  onClearAll: () => void;
}) {
  const { data: categories = [] } = usePromoCategories();
  const { data: brands = [] } = usePromoBrands();
  const [catSearch, setCatSearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");

  const filteredCats = useMemo(() => {
    if (!catSearch) return categories.slice(0, 20);
    return categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).slice(0, 20);
  }, [categories, catSearch]);

  const filteredBrands = useMemo(() => {
    if (!brandSearch) return brands.slice(0, 20);
    return brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).slice(0, 20);
  }, [brands, brandSearch]);

  const hasFilters = !!(categoryId || brandId || inStockOnly);

  return (
    <aside className="w-full lg:w-[240px] shrink-0 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <SlidersHorizontal size={16} /> Filtres
        </div>
        {hasFilters && (
          <button onClick={onClearAll} className="text-xs text-destructive hover:underline flex items-center gap-1">
            <X size={12} /> Effacer
          </button>
        )}
      </div>

      {/* Sort */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Trier par</label>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="discount">% remise décroissant</SelectItem>
            <SelectItem value="price_asc">Prix croissant</SelectItem>
            <SelectItem value="price_desc">Prix décroissant</SelectItem>
            <SelectItem value="newest">Plus récents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* In stock */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="promo-stock"
          checked={inStockOnly}
          onCheckedChange={(v) => setInStockOnly(!!v)}
        />
        <label htmlFor="promo-stock" className="text-xs font-medium text-foreground cursor-pointer flex items-center gap-1.5">
          <Package size={12} className="text-muted-foreground" /> En stock uniquement
        </label>
      </div>

      {/* Category */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Catégorie</label>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={catSearch}
            onChange={e => setCatSearch(e.target.value)}
            placeholder="Rechercher..."
            className="h-8 text-xs pl-8"
          />
        </div>
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-0.5">
            {categoryId && (
              <button
                onClick={() => setCategoryId(undefined)}
                className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-muted rounded transition-colors"
              >
                ✕ Toutes les catégories
              </button>
            )}
            {filteredCats.map(c => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id === categoryId ? undefined : c.id)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors truncate ${
                  c.id === categoryId
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {c.name}
              </button>
            ))}
            {filteredCats.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">Aucune catégorie</p>}
          </div>
        </ScrollArea>
      </div>

      {/* Brand */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Marque</label>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={brandSearch}
            onChange={e => setBrandSearch(e.target.value)}
            placeholder="Rechercher..."
            className="h-8 text-xs pl-8"
          />
        </div>
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-0.5">
            {brandId && (
              <button
                onClick={() => setBrandId(undefined)}
                className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-muted rounded transition-colors"
              >
                ✕ Toutes les marques
              </button>
            )}
            {filteredBrands.map(b => (
              <button
                key={b.id}
                onClick={() => setBrandId(b.id === brandId ? undefined : b.id)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors truncate ${
                  b.id === brandId
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {b.name}
              </button>
            ))}
            {filteredBrands.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">Aucune marque</p>}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}

export default function PromotionsPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "20" | "40" | "flash">("all");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [brandId, setBrandId] = useState<string | undefined>();
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"discount" | "price_asc" | "price_desc" | "newest">("discount");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters: { key: "all" | "20" | "40" | "flash"; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "20", label: "-20% et plus" },
    { key: "40", label: "-40% et plus" },
    { key: "flash", label: "Flash (< 24h)" },
  ];

  const { data, isLoading } = usePromoProducts(activeFilter, { categoryId, brandId, inStockOnly, sortBy });
  const { data: promoCount = 0 } = usePromoCount();
  const { data: campaigns = [] } = usePromotionCampaigns();

  const upcomingCampaigns = campaigns.filter(c => c.is_active && new Date(c.starts_at) > new Date());

  const clearAllFilters = () => {
    setCategoryId(undefined);
    setBrandId(undefined);
    setInStockOnly(false);
    setSortBy("discount");
  };

  const activeFilterCount = [categoryId, brandId, inStockOnly].filter(Boolean).length;

  return (
    <Layout>
      {/* Hero */}
      <div className="py-8 md:py-10" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}>
        <div className="mk-container text-center">
          <h1 className="text-2xl md:text-[32px] font-bold text-primary-foreground mb-2">Promotions en cours</h1>
          <p className="text-sm text-primary-foreground/70 mb-4">Profitez des meilleures offres sur les fournitures médicales</p>
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Tag, value: `${promoCount} produits en promo`, color: "text-primary" },
            { icon: TrendingDown, value: "Jusqu'à -65%", color: "text-destructive" },
            { icon: Truck, value: "Livraison incluse", color: "text-emerald-600" },
          ].map(s => (
            <div key={s.value} className="border border-border rounded-lg p-4 flex items-center gap-3">
              <s.icon size={20} className={s.color} />
              <span className="text-sm font-semibold text-foreground">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Discount filters + mobile filter toggle */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                f.key === activeFilter
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.key === "flash" && <Zap size={12} className="inline mr-1" />}
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          {/* Mobile filter toggle */}
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-full text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Filter size={14} />
            Filtres
            {activeFilterCount > 0 && (
              <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">{activeFilterCount}</Badge>
            )}
          </button>
        </div>

        {/* Active filter badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categoryId && (
              <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setCategoryId(undefined)}>
                Catégorie sélectionnée <X size={10} />
              </Badge>
            )}
            {brandId && (
              <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setBrandId(undefined)}>
                Marque sélectionnée <X size={10} />
              </Badge>
            )}
            {inStockOnly && (
              <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setInStockOnly(false)}>
                En stock <X size={10} />
              </Badge>
            )}
          </div>
        )}

        {/* Layout: sidebar + grid */}
        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <PromoSidebar
              categoryId={categoryId} setCategoryId={setCategoryId}
              brandId={brandId} setBrandId={setBrandId}
              inStockOnly={inStockOnly} setInStockOnly={setInStockOnly}
              sortBy={sortBy} setSortBy={setSortBy}
              onClearAll={clearAllFilters}
            />
          </div>

          {/* Mobile sidebar overlay */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-background p-5 overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-foreground">Filtres</span>
                  <button onClick={() => setMobileFiltersOpen(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
                </div>
                <PromoSidebar
                  categoryId={categoryId} setCategoryId={(v) => { setCategoryId(v); }}
                  brandId={brandId} setBrandId={(v) => { setBrandId(v); }}
                  inStockOnly={inStockOnly} setInStockOnly={setInStockOnly}
                  sortBy={sortBy} setSortBy={setSortBy}
                  onClearAll={clearAllFilters}
                />
              </div>
            </div>
          )}

          {/* Products grid */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-10">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <Skeleton className="aspect-square rounded-lg mb-2" />
                    <Skeleton className="h-3 w-2/3 mb-1" />
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-5 w-1/3" />
                  </div>
                ))}
              </div>
            ) : activeFilter === "flash" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-10">
                {(data?.flashDeals || []).length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Zap size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-medium">Aucun flash deal actif pour le moment</p>
                    <p className="text-sm mt-1">Revenez bientôt !</p>
                  </div>
                )}
                {(data?.flashDeals || []).map((fd: any, i: number) => (
                  <PromoProductCard key={fd.id} product={fd.product} index={i} flashDeal={fd} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-10">
                {(data?.products || []).length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Tag size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-medium">Aucune promotion trouvée</p>
                    {activeFilterCount > 0 && (
                      <button onClick={clearAllFilters} className="text-sm text-primary hover:underline mt-2">Effacer les filtres</button>
                    )}
                  </div>
                )}
                {(data?.products || []).map((p: any, i: number) => (
                  <PromoProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming campaigns */}
        {upcomingCampaigns.length > 0 && (
          <div className="rounded-lg p-5 md:p-6 bg-amber-50 dark:bg-amber-950/20">
            <h2 className="text-lg font-bold text-foreground mb-4">Prochaines promotions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {upcomingCampaigns.map(c => (
                <div key={c.id} className="bg-background rounded-lg p-4 border border-border">
                  <h3 className="text-sm font-bold text-foreground mb-1">{c.name}</h3>
                  {c.description && <p className="text-xs text-muted-foreground mb-1">{c.description}</p>}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={12} />
                    {new Date(c.starts_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
