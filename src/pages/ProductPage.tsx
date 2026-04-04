import { Layout } from "@/components/layout/Layout";
import { isValidProductImage, getProductImageSrc } from "@/lib/image-utils";
import { useProduct, useProductOffers, type Offer } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Copy, Sliders, ShoppingCart, Shield, Check, Truck, Minus, Plus,
  Heart, Tag, Package, ChevronRight, Home, Star, Info, Award, Globe, BarChart3, Calculator, TrendingDown, Bell, ExternalLink, Lock, ArrowRight, HelpCircle, ChevronDown
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFavorites, useRecentActivity } from "@/hooks/useFavorites";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { useProductPrice } from "@/hooks/useProductPriceLevel";
import { Helmet } from "react-helmet-async";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyMargin, formatPriceEur } from "@/lib/pricing";
import { useMarketPrices } from "@/hooks/useMarketPrices";

function formatEur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCount(n: number): string {
  return n.toLocaleString("de-DE");
}

/* ── % Discount Calculator Sub-component ── */
function MarginCalcPctMode({
  refPrixPublic, refPrixPharmacien, refPrixGrossiste, clientPrice, isTVAC, onPriceChange,
}: {
  refPrixPublic: number; refPrixPharmacien: number; refPrixGrossiste: number;
  clientPrice: number; isTVAC: boolean; onPriceChange: (price: number) => void;
}) {
  const [refType, setRefType] = useState<'public' | 'pharmacien' | 'grossiste'>('pharmacien');
  const [pct, setPct] = useState<string>("");

  const refMap = { public: refPrixPublic, pharmacien: refPrixPharmacien, grossiste: refPrixGrossiste };
  const refLabels = { public: "Prix public", pharmacien: "Prix pharmacien", grossiste: "Prix grossiste" };
  const refPrice = refMap[refType];
  const pctNum = parseFloat(pct.replace(",", ".")) || 0;
  const computedPrice = refPrice > 0 && pctNum > 0 ? refPrice * (1 - pctNum / 100) : 0;

  useEffect(() => {
    if (computedPrice > 0) onPriceChange(computedPrice);
  }, [computedPrice]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Prix de référence marché</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(refMap) as Array<keyof typeof refMap>).map((key) => (
            <button
              key={key}
              onClick={() => setRefType(key)}
              disabled={refMap[key] <= 0}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${refType === key ? 'bg-primary text-primary-foreground border-primary' : refMap[key] > 0 ? 'bg-background text-muted-foreground border-border hover:border-primary/50' : 'bg-muted text-muted-foreground/50 border-border cursor-not-allowed'}`}
            >
              {refLabels[key]} {refMap[key] > 0 ? `(${formatEur(refMap[key])} €)` : '(N/A)'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Votre % de remise</label>
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground">%</span>
            <input
              type="text"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="Ex: 12"
              className="flex-1 px-3 py-2.5 text-sm bg-background outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Votre prix estimé ({isTVAC ? "TVAC" : "HTVA"})</label>
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted">
            <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground">€</span>
            <span className="flex-1 px-3 py-2.5 text-sm font-semibold text-foreground">
              {computedPrice > 0 ? formatEur(computedPrice) : "—"}
            </span>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Prix MediKong ({isTVAC ? "TVAC" : "HTVA"})</label>
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted">
            <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground">€</span>
            <span className="flex-1 px-3 py-2.5 text-sm font-bold text-green-700">{formatEur(clientPrice)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Offer Row ─────────────────────────────────────────── */
function OfferRow({
  offer, productId, productName, productSlug, user, navigate, addToCart, isBest, delay = 0, isTVAC = false, categoryId, bestPrice,
}: {
  offer: Offer; productId: string; productName: string; productSlug: string;
  user: any; navigate: any; addToCart: any; isBest?: boolean; delay?: number; isTVAC?: boolean; categoryId?: string; bestPrice?: number;
}) {
  const maxQty = offer.stockQuantity > 0 ? offer.stockQuantity : 999;
  const step = offer.bundleSize > 1 ? offer.bundleSize : 1;
  const [qty, setQty] = useState(Math.min(maxQty, step));
  const discountTiers = offer.discountTiers || [];
  const hasTiers = discountTiers.length > 1;
  const tiers = (offer.priceTiers && offer.priceTiers.length > 0) ? offer.priceTiers : [];
  const hasLegacyTiers = tiers.length > 1;
  const offerPriceTiers = offer.offerPriceTiers || [];
  const hasOfferPriceTiers = offerPriceTiers.length > 1;
  const displayCode = offer.displayCode || offer.sellerId.slice(0, 6).toUpperCase();
  const displayPrice = isTVAC ? offer.unitPriceInclVat : offer.unitPriceEur;
  const priceLabel = isTVAC ? "TVAC" : "HTVA";

  const handleAdd = () => {
    if (!user) {
      toast.error("Connectez-vous pour ajouter des produits au panier", {
        action: { label: "Se connecter", onClick: () => navigate("/connexion") },
      });
      return;
    }
    addToCart.mutate({
      offerId: offer.id,
      productId,
      quantity: Math.min(qty, maxQty),
      maxQuantity: maxQty,
      vendorId: offer.sellerId,
      priceExclVat: offer.unitPriceEur,
      productData: { id: productId, name: productName, brand: "", slug: productSlug, price: offer.unitPriceEur },
      deliveryDays: offer.deliveryDays || null,
    });
  };

  return (
    <motion.div
      className="border-b border-border last:border-b-0 py-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {/* Status badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {offer.stockQuantity > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <Package size={12} /> En stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            Rupture
          </span>
        )}
        {offer.isVerified && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            <Check size={12} /> Fournisseur verifie
          </span>
        )}
        {offer.isTopSeller && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
            <Star size={12} /> Top Seller
          </span>
        )}
        {offer.isTraceable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full cursor-help">
                <Shield size={12} /> Traçable
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              Produit traçable : numéro de lot, date d'expiration et certificats disponibles pour garantir l'authenticité et la conformité.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Delta vs best */}
      {(() => {
        if (isBest || !bestPrice || bestPrice <= 0) return null;
        const delta = displayPrice - bestPrice;
        const deltaPct = ((displayPrice - bestPrice) / bestPrice * 100);
        if (delta <= 0) return null;
        return (
          <div className="mb-2 inline-flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full font-medium">
            <TrendingDown size={12} className="rotate-180" />
            +{formatEur(delta)}&nbsp;€ ({deltaPct.toFixed(1)}%) vs meilleure offre
          </div>
        );
      })()}

      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-[1.5fr_2fr_0.8fr_1.5fr] gap-3 items-start">
        <span className="font-bold text-sm text-foreground">{displayCode}</span>

        {/* Price + MOV merged column */}
        <div>
          {hasTiers ? (
            <div className="relative pl-4">
              <div className="absolute left-[3px] top-[7px] w-px border-l border-dashed border-muted-foreground/40" style={{ height: `calc(100% - 14px)` }} />
              {discountTiers
                .sort((a, b) => a.mov_amount - b.mov_amount)
                .map((tier, i) => {
                  const basePrice = discountTiers[0].unit_price;
                  const saving = i > 0 ? ((basePrice - tier.unit_price) / basePrice * 100).toFixed(1) : null;
                  return (
                    <div key={tier.id} className="grid grid-cols-[5.5rem_9rem_3rem] items-center gap-x-2 relative" style={{ marginTop: i > 0 ? 6 : 0 }}>
                      <div className="absolute left-[-14px] w-[7px] h-[7px] rounded-full bg-primary" />
                      <span className={`text-sm tabular-nums ${i === 0 ? "font-bold text-green-700" : "text-muted-foreground"}`}>
                        {formatEur(tier.unit_price)}&nbsp;€
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">MOV&nbsp;{formatEur(tier.mov_amount)}&nbsp;€</span>
                      <span className="text-xs text-green-600 font-medium tabular-nums text-right">{saving ? `-${saving}%` : ""}</span>
                    </div>
                  );
                })}
            </div>
          ) : hasOfferPriceTiers ? (
            <div className="relative pl-4">
              <div className="absolute left-[3px] top-[7px] w-px border-l border-dashed border-muted-foreground/40" style={{ height: `calc(100% - 14px)` }} />
              {offerPriceTiers
                .sort((a, b) => a.tier_index - b.tier_index)
                .map((tier, i) => {
                  const basePrice = offerPriceTiers[0].price_excl_vat;
                  const tierPrice = isTVAC ? tier.price_incl_vat : tier.price_excl_vat;
                  const saving = i > 0 ? ((basePrice - tier.price_excl_vat) / basePrice * 100).toFixed(1) : null;
                  return (
                    <div key={tier.id} className="grid grid-cols-[5.5rem_9rem_3rem] items-center gap-x-2 relative whitespace-nowrap" style={{ marginTop: i > 0 ? 4 : 0 }}>
                      <div className="absolute left-[-14px] w-[7px] h-[7px] rounded-full bg-primary" />
                      <span className={`text-sm tabular-nums ${i === 0 ? "font-bold text-green-700" : "text-muted-foreground"}`}>
                        {formatEur(tierPrice)}&nbsp;€
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">MOV&nbsp;{formatEur(tier.mov_threshold)}&nbsp;€</span>
                      <span className="text-xs text-green-600 font-medium tabular-nums text-right">{saving ? `-${saving}%` : ""}</span>
                    </div>
                  );
                })}
            </div>
          ) : hasLegacyTiers ? (
            <div className="relative pl-4">
              <div className="absolute left-[3px] top-[7px] w-px border-l border-dashed border-muted-foreground/40" style={{ height: `calc(100% - 14px)` }} />
              {tiers.map((tier: any, i: number) => (
                <div key={i} className="grid grid-cols-[5.5rem_9rem_3rem] items-center gap-x-2 relative" style={{ marginTop: i > 0 ? 6 : 0 }}>
                  <div className="absolute left-[-14px] w-[7px] h-[7px] rounded-full bg-primary" />
                  <span className={`text-sm tabular-nums ${i === 0 ? "font-bold text-green-700" : "text-muted-foreground"}`}>
                    {formatEur(tier.price || tier.minAmount)}&nbsp;€
                  </span>
                  {tier.minAmount ? (
                    <span className="text-xs text-muted-foreground tabular-nums">MOV&nbsp;{formatEur(tier.minAmount)}&nbsp;€</span>
                  ) : <span />}
                  <span />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-baseline gap-6">
              <span className="text-sm font-bold text-green-700 whitespace-nowrap">{formatEur(displayPrice)}&nbsp;€ <span className="text-[10px] font-normal text-muted-foreground">{priceLabel}</span></span>
              <span className="text-sm text-foreground whitespace-nowrap">{offer.movEur > 0 ? <>{formatEur(offer.movEur)}&nbsp;€</> : "—"}</span>
            </div>
          )}
        </div>
        <span className="text-sm text-foreground whitespace-nowrap">{offer.stockQuantity.toLocaleString("fr-FR")}</span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center border border-border rounded-md">
            <button onClick={() => setQty(Math.max(1, qty - step))} className="px-2.5 py-2 text-muted-foreground hover:text-foreground"><Minus size={14} /></button>
            <span className="px-3 py-2 text-sm font-medium min-w-[40px] text-center">{qty}</span>
            <button onClick={() => setQty(Math.min(maxQty, qty + step))} className="px-2.5 py-2 text-muted-foreground hover:text-foreground" disabled={qty >= maxQty}><Plus size={14} /></button>
          </div>
          <motion.button className="bg-primary text-primary-foreground p-2.5 rounded-md" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAdd}>
            <ShoppingCart size={16} />
          </motion.button>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">{displayCode}</span>
          <span className="text-base font-bold text-green-700">{formatEur(displayPrice)} € <span className="text-[10px] font-normal text-muted-foreground">{priceLabel}</span></span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {offer.movEur > 0 && <span>MOV {formatEur(offer.movEur)} €</span>}
          <span>Stock {offer.stockQuantity.toLocaleString("fr-FR")}</span>
          <span>Livraison ~{offer.deliveryDays}j</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md flex-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2.5 py-2 text-muted-foreground"><Minus size={14} /></button>
            <span className="px-3 py-2 text-sm font-medium text-center flex-1">{qty}</span>
            <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="px-2.5 py-2 text-muted-foreground" disabled={qty >= maxQty}><Plus size={14} /></button>
          </div>
          <motion.button className="bg-primary text-primary-foreground px-4 py-2.5 rounded-md text-sm font-medium flex items-center gap-2" whileTap={{ scale: 0.95 }} onClick={handleAdd}>
            <ShoppingCart size={14} /> Ajouter
          </motion.button>
        </div>
      </div>

      {/* Delivery estimate */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
        <Truck size={13} />
        <span>Livraison estimée : {offer.deliveryDays ? (offer.deliveryDays <= 7 ? `${offer.deliveryDays} jours` : `${Math.ceil(offer.deliveryDays / 7)} semaines`) : "5-10 jours ouvrables"}</span>
      </div>

      <VendorSuggestions
        vendorId={offer.sellerId}
        vendorSlug={offer.sellerSlug}
        vendorName={offer.sellerName}
        currentProductId={productId}
        categoryId={categoryId}
      />
    </motion.div>
  );
}

/* ── Vendor Suggestions (collapsible) ──────────────────── */
function VendorSuggestions({ vendorId, vendorSlug, vendorName, currentProductId, categoryId }: {
  vendorId: string; vendorSlug?: string; vendorName: string; currentProductId: string; categoryId?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["vendor-suggestions", vendorId, currentProductId, categoryId],
    enabled: open,
    queryFn: async () => {
      // Try same category first, fallback to any
      let query = supabase
        .from("offers")
        .select("product_id, products!inner(id, slug, name, brand_name, image_urls, best_price_excl_vat, offer_count)")
        .eq("vendor_id", vendorId)
        .eq("is_active", true)
        .neq("product_id", currentProductId)
        .order("products(offer_count)", { ascending: false })
        .limit(4);
      if (categoryId) query = query.eq("products.category_id", categoryId);
      const { data } = await query;
      if (data && data.length >= 2) return data;
      // Fallback without category filter
      const { data: fallback } = await supabase
        .from("offers")
        .select("product_id, products!inner(id, slug, name, brand_name, image_urls, best_price_excl_vat, offer_count)")
        .eq("vendor_id", vendorId)
        .eq("is_active", true)
        .neq("product_id", currentProductId)
        .order("products(offer_count)", { ascending: false })
        .limit(4);
      return fallback || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Deduplicate by product_id
  const unique = Array.from(new Map(suggestions.map((s: any) => [s.product_id, s])).values()).slice(0, 4) as any[];

  return (
    <div className="mt-2 border-t border-dashed border-border pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        Autres produits populaires de ce fournisseur
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Chargement…</div>
            ) : unique.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Aucun autre produit disponible</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {unique.map((s: any) => {
                  const p = s.products;
                  const validImg = Array.isArray(p.image_urls) ? p.image_urls.find((u: string) => isValidProductImage(u)) : null;
                  const img = validImg || getProductImageSrc(p.image_url);
                  return (
                    <Link key={p.id} to={`/produit/${p.slug}`} className="border border-border rounded-lg p-2 hover:shadow-sm transition-shadow group">
                      <img src={img} alt={p.name} className="w-full h-20 object-contain mb-1.5 rounded" onError={(e) => { (e.target as HTMLImageElement).src = "/medikong-placeholder.png"; }} />
                      <p className="text-[10px] text-muted-foreground">{p.brand_name}</p>
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">{p.name}</p>
                      {p.best_price_excl_vat > 0 && (
                        <p className="text-xs font-bold text-green-700 mt-1">{formatEur(Number(p.best_price_excl_vat))} €</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
            {vendorSlug && (
              <Link to={`/vendeur/${vendorSlug}`} className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline mt-3 mb-1">
                Voir tout le catalogue <ChevronRight size={14} />
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Watch List Dialog ─────────────────────────────────── */
function WatchListDialog({ product, user, bestPrice, isTVAC }: { product: any; user: any; bestPrice: number; isTVAC: boolean }) {
  const [open, setOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [minQty, setMinQty] = useState("1");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: existingAlert } = useQuery({
    queryKey: ["product-alert", product?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_alerts")
        .select("*")
        .eq("product_id", product.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!product?.id && !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tp = parseFloat(targetPrice.replace(",", ".")) || null;
      const mq = parseInt(minQty) || 1;
      const { error } = await supabase.from("product_alerts").upsert({
        user_id: user.id,
        product_id: product.id,
        target_price: tp,
        min_quantity: mq,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,product_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-alert", product.id] });
      toast.success("Alerte de prix creee !");
      setOpen(false);
    },
    onError: () => toast.error("Erreur lors de la creation de l'alerte"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_alerts").delete().eq("product_id", product.id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-alert", product.id] });
      toast.success("Alerte supprimee");
      setOpen(false);
    },
  });

  const handleOpen = () => {
    if (!user) {
      toast.error("Connectez-vous pour creer une alerte", {
        action: { label: "Se connecter", onClick: () => navigate("/connexion") },
      });
      return;
    }
    if (existingAlert) {
      setTargetPrice(existingAlert.target_price?.toString() || "");
      setMinQty(existingAlert.min_quantity?.toString() || "1");
    }
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-2 text-sm transition-colors ${existingAlert ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"}`}
      >
        <Bell size={16} className={existingAlert ? "fill-current" : ""} />
        {existingAlert ? "Alerte active" : "Creer une alerte de prix"}
      </button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alerte de prix</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-4 mb-4">
          {product.imageUrls?.[0] ? (
            <img src={product.imageUrls[0]} alt="" className="w-16 h-16 object-contain rounded border border-border" />
          ) : (
            <img src="/medikong-placeholder.png" alt="" className="w-16 h-16 object-contain rounded border border-border bg-muted p-1" />
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground line-clamp-2">{product.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Prix actuel : {formatEur(bestPrice)} € {isTVAC ? "TVAC" : "HTVA"}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Recevez une notification quand une offre correspond a vos criteres.</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Prix cible (EUR)</label>
            <Input
              type="text"
              placeholder="Prix maximum"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Le prix maximum que vous etes pret a payer.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Quantite minimum</label>
            <Input
              type="number"
              min="1"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">La quantite minimale requise pour etre notifie.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Vous recevrez un email quand une offre atteint votre prix cible et quantite minimum.
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-md font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {existingAlert ? "Mettre a jour" : "Confirmer l'alerte"}
          </button>
          {existingAlert && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-4 py-2.5 border border-destructive text-destructive rounded-md text-sm font-medium hover:bg-destructive/10 transition-colors"
            >
              Supprimer
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductPage() {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [movFilter, setMovFilter] = useState<number | null>(null);
  const [delayFilter, setDelayFilter] = useState<number | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [stickyQty, setStickyQty] = useState(1);
  const offerSectionRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { country } = useCountry();
  const { isTVAC } = usePriceDisplay();
  const { data: product, isLoading } = useProduct(slug);
  const { addToCart } = useCart();
  const { data: realOffers = [] } = useProductOffers(product?.id);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { trackActivity } = useRecentActivity();

  // Fetch brand (by id or fallback by name / brand_name)
  const brandLookupName = product?.brand;
  const { data: brandData } = useQuery({
    queryKey: ["brand-detail", product?.brandId, brandLookupName],
    queryFn: async () => {
      if (product?.brandId) {
        const { data } = await supabase.from("brands").select("id, name, slug").eq("id", product.brandId).single();
        if (data) return data;
      }
      if (brandLookupName) {
        const { data } = await supabase.from("brands").select("id, name, slug").eq("name", brandLookupName).maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!(product?.brandId || brandLookupName),
  });

  // Fetch category tree for breadcrumb
  const { data: categoryData } = useQuery({
    queryKey: ["product-category", product?.id],
    queryFn: async () => {
      const { data: prod } = await supabase.from("products").select("category_id, category_name").eq("id", product!.id).single();
      if (!prod?.category_id) return null;
      const { data: cat } = await supabase.from("categories").select("id, name, slug, parent_id").eq("id", prod.category_id).single();
      if (!cat) return null;
      let parent = null;
      if (cat.parent_id) {
        const { data: p } = await supabase.from("categories").select("id, name, slug").eq("id", cat.parent_id).single();
        parent = p;
      }
      return { category: cat, parent };
    },
    enabled: !!product?.id,
  });

  // Similar products
  const { data: similarProducts = [] } = useQuery({
    queryKey: ["similar-products", product?.id],
    queryFn: async () => {
      const filters: string[] = [];
      if (product!.brandId) filters.push(`brand_id.eq.${product!.brandId}`);
      const catId = categoryData?.category?.id;
      if (catId) filters.push(`category_id.eq.${catId}`);
      const orFilter = filters.length > 0 ? filters.join(",") : "id.neq.impossible";
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, best_price_excl_vat, image_urls, brand_name")
        .or(orFilter)
        .neq("id", product!.id)
        .eq("is_active", true)
        .gt("best_price_excl_vat", 0)
        .limit(12);
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Product details from DB
  const { data: productDetails } = useQuery({
    queryKey: ["product-details-full", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, brands(name, slug), categories(name, slug), manufacturers:manufacturer_id(name, slug)")
        .eq("id", product!.id)
        .single();
      return data;
    },
    enabled: !!product?.id,
  });

  // Market codes
  const { data: marketCodes = [] } = useQuery({
    queryKey: ["product-market-codes-display", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_market_codes")
        .select("code_value, verified, market_code_types(code, label, country_code, country_name)")
        .eq("product_id", product!.id);
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Track view
  useEffect(() => {
    if (product?.id && user) {
      trackActivity.mutate({ activityType: "view_product", productId: product.id });
    }
  }, [product?.id, user?.id]);

  // Sticky bar observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );
    if (offerSectionRef.current) observer.observe(offerSectionRef.current);
    return () => observer.disconnect();
  }, [product]);

  const handleCopy = () => {
    if (!product) return;
    navigator.clipboard.writeText(product.ean || product.gtin);
    setCopied(true);
    toast.success("GTIN copie !");
    setTimeout(() => setCopied(false), 1500);
  };

  // Filter offers
  const filteredOffers = realOffers.filter((o) => {
    if (movFilter && o.movEur > movFilter) return false;
    if (delayFilter && o.deliveryDays > delayFilter) return false;
    return true;
  });

  const bestOffer = filteredOffers[0];
  const otherOffers = filteredOffers.slice(1);
  const totalStock = filteredOffers.reduce((s, o) => s + o.stockQuantity, 0);

  // Price history query (must be before early returns)
  const { data: priceHistoryData = [] } = useQuery({
    queryKey: ["price-history", product?.id, country],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_history")
        .select("price_excl_vat, price_incl_vat, recorded_at")
        .eq("product_id", product!.id)
        .eq("country_code", country)
        .order("recorded_at", { ascending: true })
        .limit(180);
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Margin calculator state (must be before early returns)
  const [userPrice, setUserPrice] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [calcMode, setCalcMode] = useState<'manual' | 'pct'>('manual');

  // Load saved user price
  const { data: savedUserPrice } = useQuery({
    queryKey: ["user-price", product?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_prices")
        .select("my_purchase_price, supplier_name")
        .eq("user_id", user!.id)
        .eq("product_id", product!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!product?.id && !!user?.id,
  });

  useEffect(() => {
    if (savedUserPrice) {
      setUserPrice(savedUserPrice.my_purchase_price?.toString() || "");
      setSupplierName(savedUserPrice.supplier_name || "");
    }
  }, [savedUserPrice]);

  // Multi-level pricing (must be before early returns)
  const { levelCode, levelLabel, allPrices, hasCustomPrice } = useProductPrice(
    product?.id,
    product ? ((product as any).best_price_excl_vat ?? null) : null
  );

  // Market prices hook (must be before early returns)
  const { marketPriceItems, externalOfferItems: marketExternalItems, visMap: mpVisMap } = useMarketPrices(product?.id);

  // External offers from external_offers table (must be before early returns)
  const { data: externalOffers = [] } = useQuery({
    queryKey: ["external-offers-product", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_offers")
        .select("*, external_vendors(name, slug, website_url, logo_url, country_code)")
        .eq("product_id", product!.id)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Combined external offer items (from external_offers table)
  const externalOfferItems = externalOffers;


  if (isLoading) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center text-muted-foreground">Chargement du produit...</div>
      </Layout>
    );
  }
  if (!product) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center text-muted-foreground">Produit introuvable</div>
      </Layout>
    );
  }

  // Build images from real data only — no fallbacks, no Qogita placeholders
  const productImageUrls = product.imageUrls?.filter((u: string) => isValidProductImage(u)) || [];
  const images: string[] = productImageUrls.length > 0
    ? productImageUrls
    : isValidProductImage(product.imageUrl) ? [product.imageUrl!] : [];
  const hasImages = images.length > 0;
  const description = productDetails?.description || (productDetails as any)?.label || product.descriptionShort || "";

  const clientPrice = bestOffer ? (isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur) : 0;
  const userPriceNum = parseFloat(userPrice.replace(",", ".")) || 0;
  const savingsAbs = userPriceNum > 0 ? userPriceNum - clientPrice : 0;
  const savingsPct = userPriceNum > 0 ? ((savingsAbs / userPriceNum) * 100) : 0;

  // Specs table — only show rows with real data
  const FLAG_MAP: Record<string, string> = { BE: "🇧🇪", DE: "🇩🇪", FR: "🇫🇷", NL: "🇳🇱", IT: "🇮🇹", ES: "🇪🇸" };
  const manufacturerInfo = productDetails?.manufacturers as any;
  const specsRaw: [string, string | undefined | null, string?][] = [
    ["Marque", brandData?.name || product.brand, brandData?.slug ? `/marque/${brandData.slug}` : (product.brandSlug ? `/marque/${product.brandSlug}` : (product.brand ? `/marque/${product.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}` : undefined))],
    ["Fabricant", manufacturerInfo?.name, manufacturerInfo?.slug ? `/fabricant/${manufacturerInfo.slug}` : undefined],
    ["Categorie", categoryData?.category?.name || productDetails?.category_name],
    ["GTIN/EAN", product.gtin || product.ean],
    ["CNK", product.cnk],
    ["SKU", productDetails?.sku],
    ["Conditionnement", productDetails?.unit_quantity && productDetails.unit_quantity > 1 ? `${productDetails.unit_quantity} unites` : undefined],
    ["Poids", (productDetails as any)?.weight ? `${(productDetails as any).weight} ${(productDetails as any)?.weight_unit || "kg"}` : undefined],
    ["Dimensions", (productDetails as any)?.height && (productDetails as any)?.width && (productDetails as any)?.depth
      ? `${(productDetails as any).height} x ${(productDetails as any).width} x ${(productDetails as any).depth} ${(productDetails as any)?.dimension_unit || "cm"} (H x L x P)` : undefined],
    ["Pays d'origine", productDetails?.origin_country],
    // Market codes
    ...marketCodes.map((mc: any) => {
      const ct = mc.market_code_types;
      const flag = FLAG_MAP[ct?.country_code] || "";
      const label = `${ct?.label || ct?.code} (${flag}${ct?.country_code})`;
      const value = mc.code_value + (mc.verified ? " ✓" : "");
      return [label, value] as [string, string];
    }),
  ];
  const specs = specsRaw.filter(([, val]) => val && val !== "—" && val !== "null") as [string, string, string?][];

  return (
    <Layout>
      <Helmet>
        <title>{product.name} | MediKong</title>
        <meta name="description" content={`Achetez ${product.name} au meilleur prix B2B sur MediKong. GTIN: ${product.gtin || product.ean}`} />
      </Helmet>

      <PageTransition>
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mk-container py-3">
          <ol className="flex items-center gap-1.5 text-xs flex-wrap text-muted-foreground">
            <li className="inline-flex items-center">
              <Link to="/" className="inline-flex items-center gap-1 hover:text-primary transition-colors"><Home size={13} /> Accueil</Link>
            </li>
            {categoryData?.parent && (
              <li className="inline-flex items-center gap-1.5">
                <ChevronRight size={12} />
                <Link to={`/catalogue?category=${categoryData.parent.slug}`} className="hover:text-primary transition-colors">{categoryData.parent.name}</Link>
              </li>
            )}
            {categoryData?.category && (
              <li className="inline-flex items-center gap-1.5">
                <ChevronRight size={12} />
                <Link to={`/catalogue?category=${categoryData.category.slug}`} className="hover:text-primary transition-colors">{categoryData.category.name}</Link>
              </li>
            )}
            <li className="inline-flex items-center gap-1.5">
              <ChevronRight size={12} />
              <span className="font-semibold text-foreground truncate max-w-[200px]">{product.name}</span>
            </li>
          </ol>
        </nav>

        <div className="mk-container pb-24 md:pb-12">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">

            {/* ═══ LEFT COLUMN — Gallery ═══ */}
            <motion.div
              className="w-full md:w-[40%] md:sticky md:top-20 self-start"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex gap-3">
                {/* Thumbnail column */}
                {images.length > 1 && (
                  <div className="hidden md:flex flex-col gap-2 w-[60px] shrink-0">
                    {images.slice(0, 6).map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIdx(i)}
                        className={`w-[60px] h-[60px] border-2 rounded-lg overflow-hidden transition-all ${i === selectedImageIdx ? "border-primary shadow-sm" : "border-border hover:border-primary/50"}`}
                      >
                        <img src={img} alt={`Vue ${i + 1}`} className="w-full h-full object-contain bg-muted" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Main image */}
                <div className="flex-1">
                  <div className="aspect-square rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center">
                    {hasImages ? (
                      <img
                        src={images[selectedImageIdx] || images[0]}
                        alt={product.name}
                        className="w-full h-full object-contain p-4"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = "/medikong-placeholder.png";
                        }}
                      />
                    ) : (
                      <img src="/medikong-placeholder.png" alt="Image non disponible" className="w-full h-full object-contain p-8" />
                    )}
                  </div>

                  {/* Mobile thumbnails */}
                  {hasImages && images.length > 1 && (
                    <div className="flex md:hidden gap-2 mt-3 overflow-x-auto">
                      {images.slice(0, 6).map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImageIdx(i)}
                          className={`w-[48px] h-[48px] shrink-0 border-2 rounded-md overflow-hidden ${i === selectedImageIdx ? "border-primary" : "border-border"}`}
                        >
                          <img src={img} alt="" className="w-full h-full object-contain bg-muted" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Image disclaimer */}
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Info size={12} />
                Les photos sont a titre indicatif. Fiez-vous au GTIN.
              </p>

              {/* Favorite + Watch list */}
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                {user && (
                  <button
                    onClick={() => toggleFavorite.mutate(product.id)}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Heart size={16} className={isFavorite(product.id) ? "text-red-500 fill-current" : ""} />
                    {isFavorite(product.id) ? "Dans mes favoris" : "Ajouter aux favoris"}
                  </button>
                )}
                <WatchListDialog product={product} user={user} bestPrice={bestOffer ? (isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur) : 0} isTVAC={isTVAC} />
              </div>
            </motion.div>

            {/* ═══ RIGHT COLUMN — Product info + Offers ═══ */}
            <motion.div
              className="w-full md:w-[60%] min-w-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Brand */}
              {brandData ? (
                <div className="flex items-center gap-3 mb-1">
                  <Link to={`/marque/${brandData.slug}`} className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    <Tag size={13} /> {brandData.name}
                  </Link>
                  <Link to={`/marque/${brandData.slug}`} className="text-[11px] text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5">
                    Voir tous les produits <ChevronRight size={11} />
                  </Link>
                </div>
              ) : product.brand ? (
                <div className="flex items-center gap-3 mb-1">
                  <Link to={`/marque/${product.brandSlug || product.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`} className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    <Tag size={13} /> {product.brand}
                  </Link>
                  <Link to={`/marque/${product.brandSlug || product.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`} className="text-[11px] text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5">
                    Voir tous les produits <ChevronRight size={11} />
                  </Link>
                </div>
              ) : null}

              {/* Name */}
              <h1 className="text-xl md:text-2xl font-bold text-foreground mb-3 leading-tight">{product.name}</h1>

              {/* GTIN + Copy */}
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-xs text-muted-foreground">GTIN : {product.gtin || product.ean}</span>
                <button onClick={handleCopy} className="text-primary text-xs flex items-center gap-1 hover:underline">
                  <Copy size={12} /> {copied ? "Copie !" : "Copier"}
                </button>
              </div>

              {/* Tax note */}
              <p className="text-xs text-muted-foreground mb-2">Prix soumis a TVA selon votre pays.</p>

              {/* Price level badge */}
              {user && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 mb-4">
                  <Tag size={12} /> {levelLabel}
                </span>
              )}

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap mb-6">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
                  <Truck size={13} /> Livraison gratuite
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
                  <Shield size={13} /> Authenticite 100% garantie
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                  <Check size={13} /> Fournisseur verifie
                </span>
              </div>

              <div className="border-t border-border mb-6" />

              {/* ── Price gate for non-logged users ── */}
              {!user && (
                <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-6 mb-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Lock size={22} className="text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">Prix réservés aux professionnels</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Créez votre compte gratuit en 2 minutes pour accéder aux prix B2B exclusifs, {filteredOffers.length} offre{filteredOffers.length > 1 ? "s" : ""} disponible{filteredOffers.length > 1 ? "s" : ""} sur ce produit.
                  </p>
                  <Link to="/onboarding" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity text-sm">
                    Créer mon compte <ArrowRight size={16} />
                  </Link>
                  <p className="text-xs text-muted-foreground mt-3">Déjà un compte ? <Link to="/connexion" className="text-primary font-medium hover:underline">Connectez-vous</Link></p>
                </div>
              )}

              {/* ── Offers Tabs (only for logged users) ── */}
              {user && (
              <div ref={offerSectionRef}>
                <Tabs defaultValue="marketplace" className="mb-6">
                  <TabsList className="w-full grid grid-cols-3 mb-4">
                    <TabsTrigger value="marketplace" className="text-xs sm:text-sm gap-1.5">
                      <ShoppingCart size={14} className="hidden sm:inline" /> Marketplace MediKong <span className="ml-1 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredOffers.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="external" className="text-xs sm:text-sm gap-1.5">
                      <Globe size={14} className="hidden sm:inline" /> Offres externes <span className="ml-1 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{externalOfferItems.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="market" className="text-xs sm:text-sm gap-1.5">
                      <BarChart3 size={14} className="hidden sm:inline" /> Prix du marche <span className="ml-1 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{marketPriceItems.length}</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Tab: Marketplace MediKong ── */}
                  <TabsContent value="marketplace">
                    {/* Filters */}
                    <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Sliders size={14} className="text-foreground" />
                        <span className="text-sm font-bold text-foreground">Filtrer les offres</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">MOV maximum</label>
                          <select
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                            value={movFilter || ""}
                            onChange={(e) => setMovFilter(e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">Tous</option>
                            <option value="250">250 €</option>
                            <option value="500">500 €</option>
                            <option value="1000">1 000 €</option>
                            <option value="2500">2 500 €</option>
                            <option value="5000">5 000 €</option>
                            <option value="10000">10 000 €</option>
                          </select>
                          <p className="text-[11px] text-muted-foreground mt-1">Afficher uniquement les offres avec un MOV jusqu'a ce montant</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Delai de livraison max</label>
                          <select
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                            value={delayFilter || ""}
                            onChange={(e) => setDelayFilter(e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">Tous</option>
                            <option value="7">1 semaine</option>
                            <option value="14">2 semaines</option>
                            <option value="21">3 semaines</option>
                            <option value="30">1 mois</option>
                          </select>
                          <p className="text-[11px] text-muted-foreground mt-1">Afficher uniquement les offres livrees dans ce delai</p>
                        </div>
                      </div>
                    </div>

                    {/* Best Offer */}
                    {bestOffer ? (
                      <div className="border-2 border-emerald-300 bg-emerald-50/60 rounded-xl p-4 md:p-6 mb-4">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Award size={18} className="text-emerald-700" />
                            <h3 className="text-base md:text-lg font-bold text-emerald-800">Meilleure offre</h3>
                          </div>
                          <span className="text-sm text-emerald-700 font-medium">{formatCount(totalStock)} disponibles{filteredOffers.length > 1 ? ` auprès de ${filteredOffers.length} fournisseurs` : ""}</span>
                        </div>

                        <div className="hidden md:grid grid-cols-[1.5fr_2fr_0.8fr_1.5fr] gap-3 px-1 pb-3 text-xs font-semibold text-muted-foreground border-b border-border">
                          <span>Fournisseur</span>
                          <span>Prix unitaire / MOV</span>
                          <span>Stock</span>
                          <span className="text-right">Commander</span>
                        </div>

                        <OfferRow
                          offer={bestOffer}
                          productId={product.id}
                          productName={product.name}
                          productSlug={product.slug}
                          user={user}
                          navigate={navigate}
                          addToCart={addToCart}
                          isBest
                          isTVAC={isTVAC}
                          categoryId={categoryData?.category?.id}
                        />
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl p-8 text-center">
                        <img src="/medikong-placeholder.png" alt="" className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="text-muted-foreground font-medium">Ce produit est temporairement indisponible.</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                          Ajoutez-le à votre liste de suivi pour être notifié de sa disponibilité.
                        </p>
                        <button
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                          onClick={() => toast.info("Fonctionnalité bientôt disponible")}
                        >
                          <Heart size={16} />
                          M'alerter quand disponible
                        </button>
                      </div>
                    )}

                    {/* Other Offers */}
                    {otherOffers.length > 0 && (
                      <div className="border border-border rounded-xl p-4 md:p-6">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">
                              {otherOffers.length} autre{otherOffers.length > 1 ? "s" : ""} offre{otherOffers.length > 1 ? "s" : ""}
                            </h3>
                            <span className="text-xs text-muted-foreground">Trie par prix</span>
                          </div>
                          <span className="text-sm text-primary font-medium">
                            {formatCount(otherOffers.reduce((s, o) => s + o.stockQuantity, 0))} disponibles{otherOffers.length > 1 ? ` auprès de ${otherOffers.length} fournisseurs` : ""}
                          </span>
                        </div>

                        <div className="hidden md:grid grid-cols-[1.5fr_2fr_0.8fr_1.5fr] gap-3 px-1 pb-3 text-xs font-semibold text-muted-foreground border-b border-border">
                          <span>Fournisseur</span>
                          <span>Prix unitaire / MOV</span>
                          <span>Stock</span>
                          <span className="text-right">Commander</span>
                        </div>

                        {otherOffers.map((offer, i) => (
                          <OfferRow
                            key={offer.id}
                            offer={offer}
                            productId={product.id}
                            productName={product.name}
                            productSlug={product.slug}
                            user={user}
                            navigate={navigate}
                            addToCart={addToCart}
                            delay={i * 0.06}
                            isTVAC={isTVAC}
                            categoryId={categoryData?.category?.id}
                            bestPrice={bestOffer ? (isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur) : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Tab: Offres externes ── */}
                  <TabsContent value="external">
                    {externalOfferItems.length > 0 ? (
                      <div className="space-y-3">
                        {externalOfferItems.map((eo: any) => {
                          const vendor = eo.external_vendors;
                          const stockIcon = eo.stock_status === "in_stock" ? "🟢" : eo.stock_status === "limited" ? "🟡" : eo.stock_status === "out_of_stock" ? "🔴" : "⚪";
                          const stockLabel = eo.stock_status === "in_stock" ? "En stock" : eo.stock_status === "limited" ? "Stock limité" : eo.stock_status === "out_of_stock" ? "Rupture" : "Stock inconnu";

                          const handleClick = async () => {
                            // Track the lead
                            try {
                              await supabase.from("external_leads").insert({
                                external_offer_id: eo.id,
                                external_vendor_id: eo.external_vendor_id,
                                product_id: eo.product_id,
                                user_id: user?.id || null,
                                user_agent: navigator.userAgent,
                              });
                            } catch {}
                            // Open in new tab
                            window.open(eo.product_url, "_blank", "noopener,noreferrer");
                          };

                          return (
                            <div key={eo.id} className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                {vendor?.logo_url ? (
                                  <img src={vendor.logo_url} alt={vendor.name} className="w-10 h-10 rounded-lg object-contain border border-border" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                                    {vendor?.name?.charAt(0)?.toUpperCase() || "?"}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-foreground">{vendor?.name || "Vendeur externe"}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-muted-foreground">{stockIcon} {stockLabel}</span>
                                    {eo.delivery_days && <span className="text-xs text-muted-foreground">• {eo.delivery_days}j livraison</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                  <span className="text-lg font-bold text-green-700">{Number(eo.unit_price).toFixed(2)} €</span>
                                  {Number(eo.mov_amount || 0) > 0 && (
                                    <p className="text-[11px] text-muted-foreground">MOV {Number(eo.mov_amount).toFixed(0)} €</p>
                                  )}
                                </div>
                                {eo.product_url && (
                                  <button
                                    onClick={handleClick}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: "#F97316", color: "white" }}
                                  >
                                    Voir l'offre <ExternalLink size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl p-8 text-center">
                        <Globe size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                        <h3 className="text-base font-bold text-foreground mb-2">Offres externes</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                          Aucune offre externe disponible pour le moment.
                        </p>
                        <Link to="/devenir-vendeur" className="inline-block bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                          Devenir fournisseur
                        </Link>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Tab: Prix du marché ── */}
                  <TabsContent value="market">
                    {marketPriceItems.length > 0 ? (
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border">
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Source</th>
                              {mpVisMap.show_wholesale_price && <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Prix grossiste</th>}
                              {mpVisMap.show_pharmacist_price && <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Prix pharmacien</th>}
                              {mpVisMap.show_public_price && <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Prix public</th>}
                              {mpVisMap.show_tva && <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">TVA</th>}
                              {mpVisMap.show_supplier_name && <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Fournisseur</th>}
                              {bestOffer && <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">vs MediKong</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {marketPriceItems.map((mp: any, i: number) => {
                              const mkPrice = bestOffer ? (isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur) : 0;
                              const refPrice = mp.prix_pharmacien || mp.prix_grossiste || mp.prix_public || 0;
                              const deltaAbs = refPrice && mkPrice ? refPrice - mkPrice : 0;
                              const deltaPct = refPrice && mkPrice ? Math.round((deltaAbs / refPrice) * 100) : 0;
                              return (
                                <tr key={mp.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                                  <td className="py-3 px-4 font-medium text-foreground">{mp.market_price_sources?.name}</td>
                                  {mpVisMap.show_wholesale_price && <td className="text-right py-3 px-4 text-foreground">{mp.prix_grossiste ? `${formatEur(mp.prix_grossiste)} €` : "—"}</td>}
                                  {mpVisMap.show_pharmacist_price && <td className="text-right py-3 px-4 text-foreground">{mp.prix_pharmacien ? `${formatEur(mp.prix_pharmacien)} €` : "—"}</td>}
                                  {mpVisMap.show_public_price && <td className="text-right py-3 px-4 text-foreground">{mp.prix_public ? `${formatEur(mp.prix_public)} €` : "—"}</td>}
                                  {mpVisMap.show_tva && <td className="text-right py-3 px-4 text-muted-foreground">{mp.tva_rate ? `${(Number(mp.tva_rate) * 100).toFixed(0)}%` : "—"}</td>}
                                  {mpVisMap.show_supplier_name && <td className="py-3 px-4 text-muted-foreground">{mp.supplier_name || "—"}</td>}
                                  {bestOffer && (
                                    <td className="text-right py-3 px-4">
                                      {refPrice > 0 && mkPrice > 0 ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                          <span className={`text-xs font-bold ${deltaAbs > 0 ? "text-emerald-600" : deltaAbs < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                            {deltaAbs > 0 ? "−" : "+"}{formatEur(Math.abs(deltaAbs))} €
                                          </span>
                                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${deltaAbs > 0 ? "bg-emerald-100 text-emerald-700" : deltaAbs < 0 ? "bg-red-100 text-destructive" : "bg-muted text-muted-foreground"}`}>
                                            {deltaPct > 0 ? "−" : "+"}{Math.abs(deltaPct)}%
                                          </span>
                                        </div>
                                      ) : "—"}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl p-8 text-center">
                        <BarChart3 size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                        <h3 className="text-base font-bold text-foreground mb-2">Prix du marche</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Aucun prix de référence disponible pour ce produit.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
              )}

              {/* ── Description ── */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-foreground mb-3">Description du produit</h2>
                {description ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Description non disponible pour ce produit.</p>
                )}
              </div>

              {/* ── Product Details ── */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-foreground mb-3">Details du produit</h2>
                <div className="border border-border rounded-xl overflow-hidden">
                  {specs.map(([key, val, link], i) => (
                    <div key={key} className={`flex justify-between py-3 px-4 text-sm ${i % 2 === 0 ? "bg-muted/50" : ""}`}>
                      <span className="text-muted-foreground">{key}</span>
                      {link ? (
                        <Link to={link} className="text-primary font-medium text-right hover:underline">{val}</Link>
                      ) : (
                        <span className="text-foreground font-medium text-right">{val}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Price Level Comparison ── */}
              {user && allPrices.length > 1 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-foreground mb-3">Comparaison des prix par profil</h2>
                  <div className="border border-border rounded-xl overflow-hidden">
                    {allPrices.map((p: any, i: number) => {
                      const plCode = (p as any).price_levels?.code;
                      const plLabel = (p as any).price_levels?.label_fr || plCode;
                      const isUserLevel = plCode === levelCode;
                      return (
                        <div
                          key={p.price_level_id}
                          className={`flex justify-between py-3 px-4 text-sm ${isUserLevel ? "bg-primary/5 border-l-4 border-primary" : i % 2 === 0 ? "bg-muted/50" : ""}`}
                        >
                          <span className={isUserLevel ? "text-primary font-bold" : "text-muted-foreground"}>
                            {plLabel} {isUserLevel && "(votre profil)"}
                          </span>
                          <span className={`font-bold ${isUserLevel ? "text-primary" : "text-foreground"}`}>
                            {Number(p.price).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mb-8">
                <Accordion type="single" collapsible>
                  <AccordionItem value="guarantee" className="border border-border rounded-xl px-4">
                    <AccordionTrigger className="text-sm font-bold text-foreground hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-primary" />
                        Garantie satisfaction et remboursement
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
                      <p>Tous les produits vendus sur MediKong sont couverts par notre garantie satisfaction :</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Produits 100% authentiques et conformes</li>
                        <li>Remboursement integral si le produit ne correspond pas a la description</li>
                        <li>Retour gratuit sous 14 jours pour tout defaut de conformite</li>
                        <li>Service client disponible pour toute reclamation</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* ── Margin Calculator ── */}
              <div className="mb-8">
                <div className="border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator size={18} className="text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Calculateur de marge</h2>
                  </div>

                  {/* Mode selector: manual vs % */}
                  {(() => {
                    const mpForProduct = marketPriceItems.filter(mp => mp.product_id === product?.id);
                    const refPrixPublic = mpForProduct.reduce((best, mp) => mp.prix_public && mp.prix_public > 0 ? (best === 0 ? mp.prix_public : Math.min(best, mp.prix_public)) : best, 0);
                    const refPrixPharmacien = mpForProduct.reduce((best, mp) => mp.prix_pharmacien && mp.prix_pharmacien > 0 ? (best === 0 ? mp.prix_pharmacien : Math.min(best, mp.prix_pharmacien)) : best, 0);
                    const refPrixGrossiste = mpForProduct.reduce((best, mp) => mp.prix_grossiste && mp.prix_grossiste > 0 ? (best === 0 ? mp.prix_grossiste : Math.min(best, mp.prix_grossiste)) : best, 0);
                    const hasAnyRef = refPrixPublic > 0 || refPrixPharmacien > 0 || refPrixGrossiste > 0;

                    return (
                      <>
                        {hasAnyRef && (
                          <div className="mb-4">
                            <label className="text-xs text-muted-foreground mb-1.5 block">Mode de saisie</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { (window as any).__calcMode = 'manual'; setUserPrice(userPrice); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${!(window as any).__calcMode || (window as any).__calcMode === 'manual' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                              >
                                Prix manuel
                              </button>
                              <button
                                onClick={() => { (window as any).__calcMode = 'pct'; setUserPrice(""); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${(window as any).__calcMode === 'pct' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                              >
                                % remise vs prix marché
                              </button>
                            </div>
                          </div>
                        )}

                        {(!(window as any).__calcMode || (window as any).__calcMode === 'manual' || !hasAnyRef) ? (
                          /* Manual mode */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Votre prix d'achat actuel ({isTVAC ? "TVAC" : "HTVA"})</label>
                              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                                <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground">€</span>
                                <input
                                  type="text"
                                  value={userPrice}
                                  onChange={(e) => setUserPrice(e.target.value)}
                                  placeholder={clientPrice > 0 ? formatEur(clientPrice * 1.3) : "0,00"}
                                  className="flex-1 px-3 py-2.5 text-sm bg-background outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Prix MediKong ({isTVAC ? "TVAC" : "HTVA"})</label>
                              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted">
                                <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground">€</span>
                                <span className="flex-1 px-3 py-2.5 text-sm font-bold text-green-700">{formatEur(clientPrice)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Percentage mode */
                          <MarginCalcPctMode
                            refPrixPublic={refPrixPublic}
                            refPrixPharmacien={refPrixPharmacien}
                            refPrixGrossiste={refPrixGrossiste}
                            clientPrice={clientPrice}
                            isTVAC={isTVAC}
                            onPriceChange={(p) => setUserPrice(p.toFixed(2).replace(".", ","))}
                          />
                        )}
                      </>
                    );
                  })()}

                  {/* Supplier + Save */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Fournisseur actuel (optionnel)</label>
                      <div className="flex items-center border border-border rounded-lg overflow-hidden">
                        <input
                          type="text"
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          placeholder="Ex: Alliance Healthcare"
                          className="flex-1 px-3 py-2.5 text-sm bg-background outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={async () => {
                          if (!user) {
                            toast.error("Connectez-vous pour sauvegarder votre prix", {
                              action: { label: "Se connecter", onClick: () => navigate("/connexion") },
                            });
                            return;
                          }
                          const price = parseFloat(userPrice.replace(",", "."));
                          if (!price || price <= 0) { toast.error("Entrez un prix valide"); return; }
                          setSavingPrice(true);
                          const { error } = await supabase.from("user_prices").upsert({
                            user_id: user.id,
                            product_id: product.id,
                            my_purchase_price: price,
                            supplier_name: supplierName || null,
                            updated_at: new Date().toISOString(),
                          }, { onConflict: "user_id,product_id" });
                          setSavingPrice(false);
                          if (!error) {
                            toast.success("Prix sauvegarde ! Retrouvez-le dans Mes Prix.");
                            queryClient.invalidateQueries({ queryKey: ["user-price", product.id] });
                          } else {
                            toast.error("Erreur lors de la sauvegarde");
                          }
                        }}
                        disabled={savingPrice || !userPriceNum}
                        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Tag size={14} />
                        {savingPrice ? "Sauvegarde..." : savedUserPrice ? "Mettre a jour mon prix" : "Sauvegarder mon prix"}
                      </button>
                    </div>
                  </div>
                  {userPriceNum > 0 && savingsAbs > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3"
                    >
                      <TrendingDown size={20} className="text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-green-700">
                          Economie estimee : {formatEur(savingsAbs)} € ({savingsPct.toFixed(1)}%)
                        </p>
                        <p className="text-xs text-green-600">par unite en passant par MediKong</p>
                      </div>
                    </motion.div>
                  )}
                  {userPriceNum > 0 && savingsAbs <= 0 && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      Votre prix actuel est deja competitif ! MediKong vous offre neanmoins la garantie d'authenticite et la simplification logistique.
                    </div>
                  )}
                </div>
              </div>

              {/* ── Price History ── */}
              <div className="mb-8">
                <div className="border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Historique des prix</h2>
                  </div>
                  {priceHistoryData.length > 0 ? (
                    <div className="space-y-3">
                      {(() => {
                        const prices = priceHistoryData.map((h: any) => isTVAC ? Number(h.price_incl_vat || h.price_excl_vat * 1.21) : Number(h.price_excl_vat));
                        const min = Math.min(...prices);
                        const max = Math.max(...prices);
                        const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
                        const sorted = [...prices].sort((a, b) => a - b);
                        const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[["Min", min], ["Max", max], ["Median", median], ["Moyen", avg]].map(([label, value]) => (
                              <div key={label as string} className="bg-muted/50 rounded-lg p-3 text-center">
                                <p className="text-[11px] text-muted-foreground">{label as string}</p>
                                <p className="text-sm font-bold text-foreground">{formatEur(value as number)} €</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {/* Simple bar chart */}
                      <div className="flex items-end gap-1 h-24 mt-2">
                        {priceHistoryData.slice(-30).map((h: any, i: number) => {
                          const price = isTVAC ? Number(h.price_incl_vat || h.price_excl_vat * 1.21) : Number(h.price_excl_vat);
                          const allPrices = priceHistoryData.map((p: any) => Number(p.price_excl_vat));
                          const maxP = Math.max(...allPrices);
                          const minP = Math.min(...allPrices);
                          const range = maxP - minP || 1;
                          const heightPct = ((price - minP) / range) * 80 + 20;
                          return (
                            <div key={i} className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors" style={{ height: `${heightPct}%` }} title={`${formatEur(price)} € - ${new Date(h.recorded_at).toLocaleDateString("fr-FR")}`} />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <BarChart3 size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Historique des prix en cours de collecte. Disponible apres quelques synchronisations.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center mb-8">
                <h3 className="font-bold text-foreground mb-1">Vous proposez un meilleur prix ?</h3>
                <p className="text-sm text-muted-foreground mb-4">Vendez via MediKong et touchez 500+ pharmacies</p>
                <Link to="/inscription" className="inline-block bg-primary text-primary-foreground font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                  Devenir vendeur
                </Link>
              </div>
            </motion.div>
          </div>

          {/* ── Similar Products ── */}
          {similarProducts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-lg font-bold text-foreground mb-4">Produits similaires</h2>
              <div className="flex gap-3 overflow-x-auto pb-3">
                {similarProducts.map((p: any, i: number) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -4, boxShadow: "0 6px 20px -6px rgba(0,0,0,0.1)" }}
                  >
                    <Link to={`/produit/${p.slug}`} className="w-40 shrink-0 border border-border rounded-xl p-3 block bg-card hover:border-primary/30 transition-colors">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                        {p.image_urls?.[0] ? (
                          <img src={p.image_urls[0]} alt={p.name} className="w-full h-full object-contain p-2" loading="lazy" />
                        ) : (
                          <img src="/medikong-placeholder.png" alt="" className="w-full h-full object-contain p-4" />
                        )}
                      </div>
                      <p className="text-xs text-foreground truncate font-medium">{p.name}</p>
                      {p.brand_name && <p className="text-[11px] text-muted-foreground truncate">{p.brand_name}</p>}
                      {p.best_price_excl_vat > 0 && (
                        <p className="text-sm font-bold text-green-700 mt-1">{formatEur(applyMargin(Number(p.best_price_excl_vat)))} €</p>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageTransition>

      {/* ── Sticky Bottom Bar ── */}
      <AnimatePresence>
        {showStickyBar && bestOffer && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg"
          >
            <div className="mk-container py-2.5 sm:py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="hidden sm:flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{brandData?.name || product.brand || ""} · Meilleure offre</p>
                  </div>
                </div>
                <div className="sm:hidden min-w-0">
                  <p className="text-base font-bold text-green-700">{formatEur(isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur)} €</p>
                  <p className="text-[10px] text-muted-foreground truncate">{isTVAC ? "TVAC" : "HTVA"} · {brandData?.name || product.brand || ""}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-green-700">{formatEur(isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur)} €</p>
                    <p className="text-[11px] text-muted-foreground">{isTVAC ? "TVAC" : "HTVA"}</p>
                  </div>
                  <div className="flex items-center border border-border rounded-md bg-background">
                    <button onClick={() => setStickyQty(Math.max(1, stickyQty - 1))} className="px-2 py-1.5 text-muted-foreground"><Minus size={14} /></button>
                    <span className="px-2 text-sm font-medium">{stickyQty}</span>
                    <button onClick={() => setStickyQty(Math.min(bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : 999, stickyQty + 1))} className="px-2 py-1.5 text-muted-foreground" disabled={stickyQty >= (bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : 999)}><Plus size={14} /></button>
                  </div>
                  <button
                    className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-lg hover:opacity-90 transition-opacity"
                    onClick={() => {
                      if (!user) {
                        toast.error("Connectez-vous pour ajouter des produits au panier", {
                          action: { label: "Se connecter", onClick: () => navigate("/connexion") },
                        });
                        return;
                      }
                      addToCart.mutate({
                        offerId: bestOffer.id,
                        productId: product.id,
                        quantity: Math.min(stickyQty, bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : 999),
                        maxQuantity: bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : undefined,
                        vendorId: bestOffer.sellerId,
                        priceExclVat: bestOffer.unitPriceEur,
                        productData: { id: product.id, name: product.name, brand: product.brand || "", slug: product.slug, price: bestOffer.unitPriceEur },
                        deliveryDays: bestOffer.deliveryDays || null,
                      });
                      
                    }}
                  >
                    <ShoppingCart size={14} />
                    <span className="hidden sm:inline">Ajouter au panier</span>
                    <span className="sm:hidden">Ajouter</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
