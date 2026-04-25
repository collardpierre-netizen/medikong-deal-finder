import { Layout } from "@/components/layout/Layout";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/hooks/useCart";
import {
  Store, MapPin, Phone, Mail, Shield, Clock,
  Star, Package, Truck, Grid, List,
  CheckCircle2, Building2, Search, X, Plus, Minus, ShoppingCart, Eye,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { getVendorPublicName, resolveVendorVisibility } from "@/lib/vendor-display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCountry } from "@/contexts/CountryContext";
import VendorDelegatesPublic from "@/components/vendor/VendorDelegatesPublic";
import VendorDelegateDetailDialog from "@/components/vendor/VendorDelegateDetailDialog";
import VendorProductQuickView from "@/components/vendor/VendorProductQuickView";

/* ───── helpers ───── */
function slugify(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface VendorFilters {
  brands: string[];
  categories: string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  search: string;
}

const EMPTY_FILTERS: VendorFilters = { brands: [], categories: [], search: "" };

import { MEDIKONG_PLACEHOLDER, isValidProductImage, isQogitaPlaceholder } from "@/lib/image-utils";

/* ───── Vendor-specific product card (grid) ───── */
function VendorProductCard({ product: p, index, addToCart, openDrawer, onQuickView }: { product: any; index: number; addToCart: any; openDrawer: () => void; onQuickView: (p: any) => void }) {
  const [qty, setQty] = useState(1);
  const maxQty = p.stockQty || 999;
  const handleAdd = () => {
    addToCart.mutate({
      offerId: p.offerId,
      productId: p.id,
      quantity: qty,
      maxQuantity: maxQty,
      vendorId: p.vendorId,
      priceExclVat: p.price,
      priceInclVat: p.priceInclVat,
      deliveryDays: p.deliveryDays,
      productData: { id: p.id, name: p.name, brand: p.brand, slug: p.slug, price: p.price, imageUrl: p.imageUrl },
    });
    openDrawer();
    setQty(1);
  };
  const imgSrc = isValidProductImage(p.imageUrl) ? p.imageUrl : MEDIKONG_PLACEHOLDER;
  return (
    <motion.div
      className="border border-border rounded-lg p-3"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      whileHover={{ y: -3, boxShadow: "0 6px 20px -6px rgba(0,0,0,0.1)" }}
    >
      <Link to={`/produit/${p.slug}`} className="block mb-2">
        <div className="aspect-square rounded-lg bg-muted overflow-hidden">
          <img src={imgSrc} alt={p.name} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain p-2"
            onLoad={(e) => { if (isQogitaPlaceholder(e.currentTarget)) e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
            onError={(e) => { e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
          />
        </div>
      </Link>
      {p.brand && <p className="text-[11px] text-muted-foreground mb-0.5">{p.brand}</p>}
      <Link to={`/produit/${p.slug}`}>
        <h3 className="text-[13px] font-medium text-foreground leading-snug mb-2 line-clamp-2">{p.name}</h3>
      </Link>
      <p className="text-base font-bold text-foreground mb-0.5">{p.price.toFixed(2)} € <span className="text-[10px] font-normal text-muted-foreground">HTVA</span></p>
      <div className="flex items-center gap-1.5 mt-2">
        <div className="flex items-center border border-border rounded">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Minus size={13} /></button>
          <span className="px-1.5 text-xs font-medium tabular-nums">{qty}</span>
          <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Plus size={13} /></button>
        </div>
        <motion.button
          onClick={handleAdd}
          disabled={!p.stock}
          className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded disabled:opacity-40"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
        >
          Ajouter
        </motion.button>
        <button
          type="button"
          onClick={() => onQuickView(p)}
          title="Aperçu rapide"
          className="p-1.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary"
        >
          <Eye size={13} />
        </button>
      </div>
    </motion.div>
  );
}

/* ───── Vendor-specific product row (list) ───── */
function VendorProductListRow({ product: p, addToCart, openDrawer, onQuickView }: { product: any; addToCart: any; openDrawer: () => void; onQuickView: (p: any) => void }) {
  const [qty, setQty] = useState(1);
  const maxQty = p.stockQty || 999;
  const handleAdd = () => {
    addToCart.mutate({
      offerId: p.offerId,
      productId: p.id,
      quantity: qty,
      maxQuantity: maxQty,
      vendorId: p.vendorId,
      priceExclVat: p.price,
      priceInclVat: p.priceInclVat,
      deliveryDays: p.deliveryDays,
      productData: { id: p.id, name: p.name, brand: p.brand, slug: p.slug, price: p.price, imageUrl: p.imageUrl },
    });
    openDrawer();
    setQty(1);
  };
  const imgSrc = isValidProductImage(p.imageUrl) ? p.imageUrl : MEDIKONG_PLACEHOLDER;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors">
      <Link to={`/produit/${p.slug}`} className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
        <img src={imgSrc} alt="" className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.src = MEDIKONG_PLACEHOLDER; }} />
      </Link>
      <Link to={`/produit/${p.slug}`} className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{p.brand}</p>
        <p className="text-[13px] font-medium text-foreground truncate">{p.name}</p>
      </Link>
      <div className="text-right shrink-0">
        <p className="text-[13px] font-bold text-foreground">{p.price.toFixed(2)} €</p>
        <p className="text-[10px] text-muted-foreground">HTVA</p>
      </div>
      <span className={`w-2 h-2 rounded-full shrink-0 ${p.stock ? "bg-emerald-500" : "bg-destructive"}`} />
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center border border-border rounded">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-1 py-0.5 text-muted-foreground"><Minus size={12} /></button>
          <span className="px-1 text-[11px] font-medium tabular-nums">{qty}</span>
          <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="px-1 py-0.5 text-muted-foreground"><Plus size={12} /></button>
        </div>
        <button
          onClick={handleAdd}
          disabled={!p.stock}
          className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40"
        >
          <ShoppingCart size={14} />
        </button>
        <button
          type="button"
          onClick={() => onQuickView(p)}
          title="Aperçu rapide"
          className="p-1.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary"
        >
          <Eye size={12} />
        </button>
      </div>
    </div>
  );
}

export default function VendorPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<"grid" | "list">("grid");
  const initialBrand = searchParams.get("brand");
  const [filters, setFilters] = useState<VendorFilters>({
    ...EMPTY_FILTERS,
    brands: initialBrand ? [initialBrand] : [],
  });
  const { currentCountry } = useCountry();
  const { items: cartItems, addToCart, openDrawer } = useCart();
  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);
  const [delegateDialogOpen, setDelegateDialogOpen] = useState(false);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-public", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").eq("slug", slug!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch visibility rules for this vendor
  const { data: visRules = [] } = useQuery({
    queryKey: ["vendor-visibility-rules-public", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendor_visibility_rules" as any).select("*").eq("vendor_id", vendor!.id);
      return (data || []) as any[];
    },
    enabled: !!vendor?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch ALL vendor offers (paginated past 1000 limit)
  const { data: offers = [] } = useQuery({
    queryKey: ["vendor-offers-public", vendor?.id],
    queryFn: async () => {
      const PAGE = 1000;
      let all: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE;
        const { data } = await supabase
          .from("offers")
          .select("*, products(id, slug, name, brand_name, brand_id, image_urls, category_name, category_id, brands(slug))")
          .eq("vendor_id", vendor!.id)
          .eq("is_active", true)
          .range(from, from + PAGE - 1);
        all = all.concat(data || []);
        hasMore = (data?.length || 0) === PAGE;
        page++;
      }
      return all;
    },
    enabled: !!vendor?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Map to display products
  const vendorProducts = useMemo(() => offers
    .filter((o: any) => o.products)
    .map((o: any) => {
      const p = o.products;
      const price = Number(o.price_excl_vat) || 0;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand_name || "",
        brandSlug: p.brands?.slug || slugify(p.brand_name || ""),
        price,
        pub: price,
        image: p.image_urls?.[0],
        imageUrl: p.image_urls?.[0],
        imageUrls: p.image_urls || [],
        stock: o.stock_quantity > 0,
        stockQty: Number(o.stock_quantity || 0),
        sellers: 1,
        mk: false,
        categoryName: p.category_name || "",
        categorySlug: p.category_name ? slugify(p.category_name) : "",
        offerId: o.id as string,
        vendorId: o.vendor_id as string,
        priceInclVat: Number(o.price_incl_vat) || 0,
        deliveryDays: o.delivery_days ?? o.estimated_delivery_days ?? null,
      };
    }), [offers]);

  // Extract unique brands & categories with counts
  const { brands, categories } = useMemo(() => {
    const bMap = new Map<string, { name: string; slug: string; count: number }>();
    const cMap = new Map<string, { name: string; slug: string; count: number }>();
    for (const p of vendorProducts) {
      if (p.brand) {
        const s = p.brandSlug;
        const existing = bMap.get(s);
        bMap.set(s, { name: p.brand, slug: s, count: (existing?.count || 0) + 1 });
      }
      if (p.categoryName) {
        const s = p.categorySlug;
        const existing = cMap.get(s);
        cMap.set(s, { name: p.categoryName, slug: s, count: (existing?.count || 0) + 1 });
      }
    }
    return {
      brands: Array.from(bMap.values()).sort((a, b) => b.count - a.count),
      categories: Array.from(cMap.values()).sort((a, b) => b.count - a.count),
    };
  }, [vendorProducts]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    let list = vendorProducts;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    if (filters.brands.length > 0) list = list.filter(p => filters.brands.includes(p.brandSlug));
    if (filters.categories.length > 0) list = list.filter(p => filters.categories.includes(p.categorySlug));
    if (filters.priceMin != null) list = list.filter(p => p.price >= filters.priceMin!);
    if (filters.priceMax != null) list = list.filter(p => p.price <= filters.priceMax!);
    if (filters.inStock) list = list.filter(p => p.stock);
    return list;
  }, [vendorProducts, filters]);

  const hasFilters = filters.brands.length > 0 || filters.categories.length > 0 || filters.priceMin != null || filters.priceMax != null || filters.inStock || filters.search.length > 0;

  // Compute vendor MOV and cart progress
  const vendorMov = useMemo(() => {
    if (!offers.length) return 0;
    // Check both mov and mov_amount columns (mov is the legacy field, mov_amount the newer one)
    const movValues = offers.map((o: any) => Number(o.mov_amount || o.mov || 0)).filter((v: number) => v > 0);
    return movValues.length ? Math.max(...movValues) : 0;
  }, [offers]);

  const vendorCartTotal = useMemo(() => {
    if (!vendor) return 0;
    return cartItems
      .filter(ci => ci.vendor_id === vendor.id)
      .reduce((sum, ci) => sum + (ci.price_excl_vat || 0) * ci.quantity, 0);
  }, [cartItems, vendor]);

  const showReal = vendor ? resolveVendorVisibility(
    { ...vendor, id: vendor.id },
    visRules,
    { country: String(currentCountry) }
  ) : false;
  const vendorName = vendor ? getVendorPublicName(vendor, showReal) : "Fournisseur";

  if (isLoading) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-accent rounded mx-auto" />
            <div className="h-4 w-64 bg-accent rounded mx-auto" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!vendor) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <Store size={48} className="mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Vendeur introuvable</h1>
          <p className="text-muted-foreground mb-6">Ce profil vendeur n'existe pas ou n'est pas public.</p>
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </div>
      </Layout>
    );
  }

  const stats = [
    { icon: Package, label: "Produits", value: vendorProducts.length || "–" },
    { icon: Star, label: "Note", value: vendor.rating ? `${Number(vendor.rating).toFixed(1)}/5` : "–" },
    { icon: Truck, label: "Ventes", value: vendor.total_sales || "–" },
    { icon: Clock, label: "Membre depuis", value: new Date(vendor.created_at).getFullYear().toString() },
  ];

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="border-b border-border" style={{ background: "linear-gradient(180deg, hsl(var(--accent)), hsl(var(--background)))" }}>
          <div className="mk-container py-8 md:py-10">
            <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl border border-border bg-background shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                {vendor.logo_url && showReal ? (
                  <img src={vendor.logo_url} alt={vendorName} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-xl font-bold text-primary">{vendorName[0]}</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl md:text-2xl font-bold text-foreground">{vendorName}</h1>
                  {vendor.is_verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Vérifié
                    </span>
                  )}
                </div>
                {showReal && vendor.description && <p className="text-sm text-muted-foreground mb-2 max-w-[600px]">{vendor.description}</p>}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {vendor.city && showReal && <span className="flex items-center gap-1"><MapPin size={12} /> {vendor.city}, {vendor.country_code}</span>}
                  <span className="flex items-center gap-1"><Package size={12} /> {vendorProducts.length} produits</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="bg-accent/50 border-y border-border py-3 overflow-x-auto">
        <div className="mk-container flex justify-center gap-6 md:gap-10 min-w-max">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Icon size={14} className="text-primary" />
                <span className="text-base font-bold text-foreground">{value}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        <div className="flex gap-7">
          {/* ───── Sidebar with filters ───── */}
          <aside className="hidden lg:block w-[240px] shrink-0 space-y-5">
            {/* Délégué commercial (acheteurs vérifiés) */}
            <VendorDelegatesPublic vendorId={vendor.id} />
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setDelegateDialogOpen(true)}
            >
              <Eye size={12} className="mr-1.5" />
              Voir délégué
            </Button>

            {/* Delivery */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Livraison</h4>
              <p className="text-sm text-foreground">{currentCountry?.flag_emoji} {currentCountry?.name || "Belgique"}</p>
            </div>

            {/* Clear all */}
            {hasFilters && (
              <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-sm text-primary hover:underline flex items-center gap-1">
                <X size={14} /> Effacer les filtres
              </button>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <VendorFilterSection title="Catégorie" items={categories} selected={filters.categories}
                toggle={(slug) => setFilters(f => ({
                  ...f,
                  categories: f.categories.includes(slug) ? f.categories.filter(c => c !== slug) : [...f.categories, slug],
                }))} />
            )}

            {/* Brands */}
            {brands.length > 0 && (
              <VendorFilterSection title="Marque" items={brands} selected={filters.brands}
                toggle={(slug) => setFilters(f => ({
                  ...f,
                  brands: f.brands.includes(slug) ? f.brands.filter(b => b !== slug) : [...f.brands, slug],
                }))} />
            )}

            {/* Price */}
            <VendorPriceFilter
              priceMin={filters.priceMin}
              priceMax={filters.priceMax}
              onChange={(min, max) => setFilters(f => ({ ...f, priceMin: min, priceMax: max }))}
            />

            {/* Availability */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Disponibilité</h4>
              <div className="space-y-1.5">
                {[
                  { label: "Tous", value: undefined as boolean | undefined },
                  { label: "En stock uniquement", value: true as boolean | undefined },
                ].map(opt => (
                  <label key={String(opt.value)} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="vendor-stock" checked={filters.inStock === opt.value} onChange={() => setFilters(f => ({ ...f, inStock: opt.value }))} className="border-border" />
                    <span className="text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Guarantees */}
            {vendor.is_verified && (
              <div className="border border-border rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Shield size={14} /> Garanties</h3>
                <div className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 size={12} /> Vendeur vérifié</div>
                {vendor.vat_number && <div className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 size={12} /> TVA enregistrée</div>}
              </div>
            )}
          </aside>

          {/* ───── Product grid ───── */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Package size={18} /> Catalogue
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredProducts.length}{filteredProducts.length !== vendorProducts.length ? ` / ${vendorProducts.length}` : ""})
                </span>
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={filters.search}
                    onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    className="pl-8 h-8 text-sm w-[180px]"
                  />
                </div>
                <div className="flex border border-border rounded-lg overflow-hidden">
                  {([["grid", Grid], ["list", List]] as const).map(([v, Icon]) => (
                    <button key={v} onClick={() => setView(v)} className={`p-2 transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {hasFilters && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {filters.brands.map(s => {
                  const b = brands.find(x => x.slug === s);
                  return b ? (
                    <span key={s} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {b.name} <button onClick={() => setFilters(f => ({ ...f, brands: f.brands.filter(x => x !== s) }))}><X size={12} /></button>
                    </span>
                  ) : null;
                })}
                {filters.categories.map(s => {
                  const c = categories.find(x => x.slug === s);
                  return c ? (
                    <span key={s} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {c.name} <button onClick={() => setFilters(f => ({ ...f, categories: f.categories.filter(x => x !== s) }))}><X size={12} /></button>
                    </span>
                  ) : null;
                })}
                {filters.inStock && (
                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    En stock <button onClick={() => setFilters(f => ({ ...f, inStock: undefined }))}><X size={12} /></button>
                  </span>
                )}
              </div>
            )}

            {filteredProducts.length > 0 ? (
              view === "grid" ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProducts.map((p: any, i: number) => (
                    <VendorProductCard key={p.id} product={p} index={i} addToCart={addToCart} openDrawer={openDrawer} onQuickView={setQuickViewProduct} />
                  ))}
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {filteredProducts.map((p: any) => (
                    <VendorProductListRow key={p.id} product={p} addToCart={addToCart} openDrawer={openDrawer} onQuickView={setQuickViewProduct} />
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Package size={40} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {hasFilters ? "Aucun produit ne correspond à vos filtres" : "Aucun produit disponible pour le moment"}
                </p>
                {hasFilters && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-sm text-primary hover:underline mt-2">
                    Effacer les filtres
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky MOV progress bar ── */}
      <AnimatePresence>
        {vendorCartTotal > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm shadow-lg"
          >
            <div className="mk-container py-3">
              <div className="flex items-center gap-4">
                <Package size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-foreground">
                      Panier {vendorName} : <span className="font-bold">{vendorCartTotal.toFixed(2)} €</span> HTVA
                    </span>
                     {vendorMov > 0 ? (
                       <span className="text-[11px]">
                         {vendorCartTotal >= vendorMov
                           ? <span className="text-emerald-600 font-semibold">✓ MOV atteint ({vendorMov.toFixed(0)} €)</span>
                           : <span className="font-medium" style={{ color: "#F59E0B" }}>
                               Encore <span className="font-bold">{(vendorMov - vendorCartTotal).toFixed(2)} €</span> pour le MOV de {vendorMov.toFixed(0)} €
                             </span>
                         }
                       </span>
                     ) : (
                       <span className="text-[11px] text-emerald-600 font-semibold">✓ Pas de minimum de commande</span>
                     )}
                  </div>
                  {vendorMov > 0 && (
                    <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                       <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: vendorCartTotal >= vendorMov ? "#16A34A" : "#F59E0B" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((vendorCartTotal / vendorMov) * 100, 100)}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  )}
                </div>
                <Link
                  to="/panier"
                  className="shrink-0 bg-primary text-primary-foreground text-[12px] font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Voir le panier →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QuickView produit (popup) — montre détails + délégué dédié */}
      <VendorProductQuickView
        product={
          quickViewProduct
            ? {
                id: quickViewProduct.id,
                name: quickViewProduct.name,
                slug: quickViewProduct.slug,
                brand: quickViewProduct.brand,
                imageUrl: quickViewProduct.imageUrl,
                price: quickViewProduct.price,
                priceInclVat: quickViewProduct.priceInclVat,
                stock: quickViewProduct.stock,
                stockQty: quickViewProduct.stockQty,
                deliveryDays: quickViewProduct.deliveryDays,
                description: quickViewProduct.description,
                gtin: quickViewProduct.gtin,
                vendorId: quickViewProduct.vendorId || vendor?.id,
                vendorName: getVendorPublicName(vendor),
                vendorSlug: vendor?.slug,
              }
            : null
        }
        open={!!quickViewProduct}
        onOpenChange={(o) => !o && setQuickViewProduct(null)}
      />
    </Layout>
  );
}

/* ───── Filter sub-components ───── */

function VendorFilterSection({ title, items, selected, toggle }: {
  title: string;
  items: { name: string; slug: string; count: number }[];
  selected: string[];
  toggle: (slug: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    let list = items;
    if (search) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return showAll ? list : list.slice(0, 10);
  }, [items, search, showAll]);

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      {items.length > 5 && (
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={`Rechercher...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-8 text-sm" />
        </div>
      )}
      <ScrollArea className="max-h-[220px]">
        <div className="space-y-1">
          {filtered.map(item => (
            <label key={item.slug} className="flex items-center gap-2 text-sm cursor-pointer py-0.5 hover:bg-muted px-1 rounded">
              <input type="checkbox" checked={selected.includes(item.slug)} onChange={() => toggle(item.slug)} className="rounded border-border" />
              <span className="flex-1 truncate text-foreground">{item.name}</span>
              <span className="text-xs text-muted-foreground">({item.count})</span>
            </label>
          ))}
        </div>
      </ScrollArea>
      {items.length > 10 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:underline mt-1">
          Voir plus ({items.length - 10})
        </button>
      )}
    </div>
  );
}

function VendorPriceFilter({ priceMin, priceMax, onChange }: {
  priceMin?: number;
  priceMax?: number;
  onChange: (min?: number, max?: number) => void;
}) {
  const [min, setMin] = useState(priceMin?.toString() || "");
  const [max, setMax] = useState(priceMax?.toString() || "");

  const apply = () => {
    onChange(min ? Number(min) : undefined, max ? Number(max) : undefined);
  };

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Prix</h4>
      <div className="flex gap-2 items-center">
        <Input placeholder="Min €" value={min} onChange={e => setMin(e.target.value)} className="h-8 text-sm" type="number" />
        <Input placeholder="Max €" value={max} onChange={e => setMax(e.target.value)} className="h-8 text-sm" type="number" />
        <Button size="sm" variant="outline" onClick={apply} className="h-8 text-xs shrink-0">OK</Button>
      </div>
    </div>
  );
}
