import { Layout } from "@/components/layout/Layout";
import { usePromoProducts, usePromoCount, usePromotionCampaigns, usePromoCategories, usePromoBrands } from "@/hooks/usePromotions";
import { computeDisplayDiscount, displayReferencePrice } from "@/lib/discount-display";
import { Tag, TrendingDown, Truck, Calendar, Zap, Timer, Filter, X, SlidersHorizontal, ArrowUpDown, Search, Package, Info, Share2, Check } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ProductImage } from "@/components/shared/ProductCard";
import { formatPrice } from "@/data/mock";
import { motion } from "framer-motion";
import { isValidProductImage, MEDIKONG_PLACEHOLDER, pickProductImageUrl } from "@/lib/image-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCount } from "@/lib/formatCount";
import { toast } from "sonner";
import { useVendorLabels } from "@/hooks/useVendorLabels";

/** Mention légale affichée sur les promotions et ventes flash. */
const PROMO_DISCLAIMER =
  "Offres valables dans la limite des stocks disponibles et jusqu'à la date de fin indiquée sur chaque offre. Les délais de livraison affichés sont indicatifs et propres à chaque vendeur.";

function ShareOfferButton({ product, label }: { product: any; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!product?.slug) return null;

  const url = `${typeof window !== "undefined" ? window.location.origin : "https://medikong.pro"}/produit/${product.slug}`;
  const text = `${product.name}${product.brand_name ? ` — ${product.brand_name}` : ""} · Offre MediKong`;

  const onShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: product.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      toast.success("Lien copié — partagez-le par email ou message");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* partage annulé */
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label={`Partager l'offre ${product.name}`}
      title="Partager cette offre à un confrère"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
    >
      {copied ? <Check size={12} /> : <Share2 size={12} />}
      {label ?? (copied ? "Lien copié" : "Partager")}
    </button>
  );
}


function FlashCountdown({ endsAt, muted = false }: { endsAt: string; muted?: boolean }) {
  const [remaining, setRemaining] = useState(() => calcRemaining(endsAt));

  function calcRemaining(end: string) {
    const diff = Math.max(0, new Date(end).getTime() - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { d, h, m, s, totalHours: Math.floor(diff / 3600000), expired: diff <= 0 };
  }

  useEffect(() => {
    const t = setInterval(() => setRemaining(calcRemaining(endsAt)), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  if (remaining.expired) {
    return <span className={`text-xs font-medium ${muted ? "text-muted-foreground" : "text-destructive"}`}>Expiré</span>;
  }

  const two = (n: number) => String(n).padStart(2, "0");
  const label =
    remaining.d > 0
      ? `${remaining.d} j ${two(remaining.h)}:${two(remaining.m)}:${two(remaining.s)}`
      : `${two(remaining.h)}:${two(remaining.m)}:${two(remaining.s)}`;

  // Discret quand le stock est épuisé, ou quand il reste plus de 48 h
  const discreet = muted || remaining.totalHours >= 48;

  return (
    <div className={`flex items-center gap-1 text-xs font-mono ${discreet ? "text-muted-foreground" : ""}`}>
      <Timer size={12} className={discreet ? "text-muted-foreground" : "text-destructive"} />
      <span className={discreet ? "font-medium" : "text-destructive font-semibold"}>
        {remaining.d > 0 ? `Se termine dans ${label}` : label}
      </span>
    </div>
  );
}


function PromoProductCard({ product, index, flashDeal, vendorLabel }: { product: any; index: number; flashDeal?: any; vendorLabel?: string | null }) {
  const flashBase = flashDeal
    ? (flashDeal.public_price_incl_vat || flashDeal.original_price_incl_vat)
    : null;

  const flashRemaining = flashDeal && flashDeal.quantity_total != null
    ? Math.max(0, flashDeal.quantity_total - (flashDeal.quantity_sold ?? 0))
    : null;

  const discount = flashDeal
    ? Math.round((1 - flashDeal.discount_price_incl_vat / (flashBase || flashDeal.original_price_incl_vat)) * 100)
    : (computeDisplayDiscount({
        bestPriceInclVat: product.best_price_incl_vat,
        pvpTtcCents: product.pvp_ttc_cents,
      }) ?? 0);

  const currentPrice = flashDeal
    ? flashDeal.discount_price_incl_vat
    : product.best_price_excl_vat || 0;

  const originalPrice = flashDeal
    ? (flashBase || flashDeal.original_price_incl_vat)
    : displayReferencePrice({
        bestPriceInclVat: product.best_price_incl_vat,
        pvpTtcCents: product.pvp_ttc_cents,
      }) ?? product.best_price_incl_vat ?? 0;

  const imgSrc = pickProductImageUrl(product) ?? MEDIKONG_PLACEHOLDER;

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

      {flashDeal && originalPrice > currentPrice && (
        <p className="text-[11px] font-medium text-emerald-600 mb-1">
          Économie : {formatPrice(originalPrice - currentPrice)} € (-{discount}%) vs prix public
        </p>
      )}

      {flashDeal && <FlashCountdown endsAt={flashDeal.ends_at} />}

      {flashRemaining !== null && (
        <p className={`text-[11px] mt-1 font-medium ${flashRemaining === 0 ? "text-muted-foreground" : "text-amber-600"}`}>
          {flashRemaining === 0 ? "Épuisé" : `Quantité limitée : plus que ${flashRemaining} sur ${flashDeal.quantity_total}`}
        </p>
      )}

      {flashDeal && vendorLabel && (
        <p className="text-[11px] text-muted-foreground mt-1 truncate" title={vendorLabel}>
          Vendu par <span className="font-medium text-foreground">{vendorLabel}</span>
        </p>
      )}

      {product.offer_count > 0 && (
        <p className="text-[11px] text-emerald-600 mt-1">{product.offer_count} vendeur{product.offer_count > 1 ? "s" : ""}</p>
      )}

      {flashDeal && (
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          Dans la limite des stocks disponibles · valable jusqu'au{" "}
          {new Date(flashDeal.ends_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      )}

      <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
        <ShareOfferButton product={product} />
        <span className="text-[10px] text-muted-foreground">Offre partageable</span>
      </div>

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
  const flashVendorIds = useMemo(
    () => (data?.flashDeals || []).map((fd: any) => fd.vendor_id).filter(Boolean),
    [data?.flashDeals],
  );
  const { getLabelWithMode } = useVendorLabels(flashVendorIds);

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
        {/* Mention stocks & validité */}
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">{PROMO_DISCLAIMER}</p>
        </div>


        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Tag, value: `${formatCount(promoCount)} produits en promo`, color: "text-primary" },
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
                  <PromoProductCard
                    key={fd.id}
                    product={fd.product}
                    index={i}
                    flashDeal={fd}
                    vendorLabel={
                      fd.vendor_id
                        ? getLabelWithMode(fd.vendor_id, fd.vendor_display_mode || "inherit")
                        : null
                    }
                  />
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
