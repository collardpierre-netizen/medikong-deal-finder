import { Layout } from "@/components/layout/Layout";
import { isValidProductImage, getProductImageSrc, MEDIKONG_PLACEHOLDER, isQogitaPlaceholder, getPreferredProductImageUrls } from "@/lib/image-utils";
import { useProduct, useProductOffers, type Offer } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  Copy, Sliders, ShoppingCart, Shield, Check, Truck, Minus, Plus,
  Heart, Tag, Package, ChevronRight, Home, Star, Info, Award, Globe, BarChart3, Calculator, TrendingDown, Bell, ExternalLink, Lock, ArrowRight, HelpCircle, ChevronDown, Store, Play, Pause, MapPin, Clock, RefreshCw
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFavorites, useRecentActivity } from "@/hooks/useFavorites";
import { useVendorTrust } from "@/hooks/useVendorTrust";
import { VendorTrustProvider, useVendorTrustForId } from "@/contexts/VendorTrustContext";
import { VendorTrustHeader, countryName, formatJoined } from "@/components/product/VendorTrustHeader";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { useProductVatRate, vatSourceLabel } from "@/hooks/useProductVatRate";
import { resolvePackSize, packSizeSourceLabel, packSizeSourceBadge } from "@/lib/pack-size";
import { PackSizeExplainer } from "@/components/product/PackSizeExplainer";
import { useProductPrice } from "@/hooks/useProductPriceLevel";
import { Helmet } from "react-helmet-async";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyMargin, formatPriceEur } from "@/lib/pricing";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { computeMarketDelta } from "@/lib/market-price-delta";
import { RestockSecondChance } from "@/components/product/RestockSecondChance";
import { MyEncodedPriceBanner } from "@/components/product/MyEncodedPriceBanner";
import { ExternalVendorLogo } from "@/components/product/ExternalVendorLogo";
import ProfileResolvedPriceBadge from "@/components/product/ProfileResolvedPriceBadge";
import { SafeBoundary } from "@/components/SafeBoundary";
import VendorDelegateCompact from "@/components/vendor/VendorDelegateCompact";
import { PvpEconomyBadge } from "@/components/product/PvpEconomyBadge";
import RfqRequestButton from "@/components/product/RfqRequestButton";
import { ProductDescription } from "@/components/product/ProductDescription";

// Helpers de formatage harmonisés (locale fr-BE, suffixes uniques).
// Cf. src/lib/price-format.ts pour la source de vérité.
import { formatAmount as formatEur, formatBasisLabel, priceFromUnit, type CompareBasis } from "@/lib/price-format";

function formatCount(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("de-DE");
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

import { formatUpdatedAt, formatUpdatedAtFull } from "@/lib/format-date";
import { SHIPPING_COPY, FAST_SHIPPING_MAX_DAYS } from "@/config/copy";

/** @deprecated use formatUpdatedAt from @/lib/format-date */
function formatRelative(iso?: string | null): string | null {
  return formatUpdatedAt(iso);
}


/* ── Offer Row ─────────────────────────────────────────── */
function OfferRow({
  offer, productId, productName, productSlug, productImageUrl, user, navigate, addToCart, isBest, delay = 0, isTVAC = false, categoryId, bestPrice, discountPercentage = 0,
  compareBasis = 'pack', packSize: packSizeProp,
}: {
  offer: Offer; productId: string; productName: string; productSlug: string; productImageUrl?: string;
  user: any; navigate: any; addToCart: any; isBest?: boolean; delay?: number; isTVAC?: boolean; categoryId?: string; bestPrice?: number; discountPercentage?: number;
  compareBasis?: 'pack' | 'unit' | 'hundred'; packSize?: number;
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
  // sellerName already encapsulates the anonymization rules (real name vs "Fournisseur XXXXXX")
  const sellerLabel = offer.sellerName || `Fournisseur ${displayCode}`;
  // ⚠️ `offers.price_excl_vat` (offer.unitPriceEur) est le prix de l'unité de vente
  // côté vendeur = prix du PACK. On dérive donc le vrai €/u en divisant par le packSize.
  const packSize = Math.max(1, packSizeProp ?? 1);
  const basePackPrice = isTVAC ? offer.unitPriceInclVat : offer.unitPriceEur;
  const baseUnitPrice = packSize > 0 ? basePackPrice / packSize : basePackPrice;
  const displayPrice = priceFromUnit(baseUnitPrice, compareBasis as CompareBasis, packSize);
  const basisSuffix = ` ${formatBasisLabel(compareBasis as CompareBasis, { packSize, withPackSize: true })}`;
  const priceLabel = isTVAC ? "TVAC" : "HTVA";
  // Trust signals (FAGG verified, ratings, etc.) are injected via VendorTrustContext
  // — hooks must be called at the top level, never inside an IIFE/callback.
  const vendorTrust = useVendorTrustForId(offer.sellerId);

  const handleAdd = () => {
    if (!user) {
      toast.error("Connectez-vous pour ajouter des produits au panier", {
        action: { label: "Se connecter", onClick: () => navigate("/connexion") },
      });
      return;
    }
    const appliedQty = Math.min(qty, maxQty);
    const appliedTotal = appliedQty * basePackPrice;
    addToCart.mutate({
      offerId: offer.id,
      productId,
      quantity: appliedQty,
      maxQuantity: maxQty,
      vendorId: offer.sellerId,
      priceExclVat: offer.unitPriceEur,
      productData: { id: productId, name: productName, brand: "", slug: productSlug, price: offer.unitPriceEur, imageUrl: productImageUrl },
      deliveryDays: offer.deliveryDays || null,
    });
    toast.success("Ajouté au panier", {
      description: `${productName} — ${appliedQty} × ${formatEur(basePackPrice)} € = ${formatEur(appliedTotal)} € ${priceLabel}`,
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
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {offer.stockQuantity > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <Package size={12} /> En stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            <Package size={12} /> Rupture
          </span>
        )}
        {discountPercentage > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
            <Tag size={12} /> Promo -{Number(discountPercentage).toFixed(0)}%
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
        {offer.deliveryDays != null && offer.deliveryDays > 0 && offer.deliveryDays <= FAST_SHIPPING_MAX_DAYS && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
            <Truck size={12} /> {SHIPPING_COPY.fastBadge.fr}
          </span>
        )}
      </div>

      {/* Mise à jour, origine, ancienneté & livraison sont regroupées dans la ligne méta du bas. */}


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
      <div className="hidden md:grid grid-cols-[minmax(180px,1.4fr)_minmax(200px,1.8fr)_64px_240px] gap-3 items-start">
        <div className="flex flex-col gap-1.5">
          {(() => {
            if (vendorTrust) {
              return <VendorTrustHeader trust={vendorTrust} variant="full" />;
            }
            return (
              <span className="font-bold text-sm text-foreground inline-flex items-center gap-1.5">
                {sellerLabel}
                {offer.vendorNote && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Note du fournisseur" className="inline-flex items-center justify-center text-primary hover:text-primary/80 cursor-help">
                        <Info size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-xs whitespace-pre-line">
                      <span className="block font-semibold mb-1">Note du fournisseur</span>
                      {offer.vendorNote}
                    </TooltipContent>
                  </Tooltip>
                )}
              </span>
            );
          })()}
          {offer.sellerSlug && (
            <Link
              to={`/vendeur/${offer.sellerSlug}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline w-fit"
              title={`Voir la boutique de ${sellerLabel}`}
            >
              <Store size={11} /> Voir la boutique
            </Link>
          )}
          {/* Carton + €/unité dérivé */}
          {offer.cartonSizeOverride && offer.cartonSizeOverride > 0 && (() => {
            const carton = offer.cartonSizeOverride;
            const pack = packSize > 0 ? packSize : 1;
            const unitsPerCarton = carton * pack;
            const cartonPrice = basePackPrice * carton;
            const unitPrice = cartonPrice / unitsPerCarton;
            return (
              <span className="text-[11px] text-muted-foreground">
                Carton de <strong>{carton}</strong> ({unitsPerCarton} u.) · {cartonPrice.toFixed(2)} € · <strong>{unitPrice.toFixed(unitPrice < 1 ? 4 : 3)} €/u.</strong>
              </span>
            );
          })()}
          {/* Langues du packaging */}
          {offer.packagingLanguages && offer.packagingLanguages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 flex-wrap cursor-help">
                  <Globe size={11} className="text-muted-foreground" />
                  {offer.packagingLanguages.map(code => (
                    <span key={code} className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-muted text-foreground/80">
                      {code}
                    </span>
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                <span className="block font-semibold mb-1">Langues présentes sur le packaging</span>
                Vérifiez la conformité réglementaire pour votre pays de revente.
              </TooltipContent>
            </Tooltip>
          )}
        </div>

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
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
                <TrendingDown size={12} className="text-green-600" />
                Prix dégressifs selon le montant commandé
              </div>
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
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {tier.mov_threshold > 0 ? <>≥ MOV&nbsp;{formatEur(tier.mov_threshold)}&nbsp;€</> : "Prix de base"}
                        </span>
                        <span className="text-xs text-green-600 font-medium tabular-nums text-right">{saving ? `-${saving}%` : ""}</span>
                      </div>
                    );
                  })}
              </div>
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
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-6">
                <span className="text-sm font-bold text-green-700 whitespace-nowrap">
                  {formatEur(displayPrice)}&nbsp;€
                  <span className="text-[10px] font-normal text-muted-foreground">{basisSuffix} · {priceLabel}</span>
                </span>
                <span className="text-sm text-foreground whitespace-nowrap">{offer.movEur > 0 ? <>{formatEur(offer.movEur)}&nbsp;€</> : "—"}</span>
              </div>
              {compareBasis !== 'unit' && packSize > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  Prix unitaire : {formatEur(baseUnitPrice)}&nbsp;€ /u. · pack de {packSize}
                </span>
              )}
              <ProfileResolvedPriceBadge
                offerId={offer.id}
                basePrice={offer.unitPriceEur}
                isTVAC={isTVAC}
                vatRate={offer.unitPriceEur > 0 ? Math.round((offer.unitPriceInclVat / offer.unitPriceEur - 1) * 100) : 21}
              />
            </div>
          )}
        </div>
        <span className="text-sm text-foreground whitespace-nowrap">{offer.stockQuantity.toLocaleString("fr-FR")}</span>

        {/* Actions */}
        <div className="flex flex-col items-stretch gap-1.5 w-[240px] justify-self-end">
          <div className="grid grid-cols-[106px_minmax(0,1fr)] items-stretch gap-2 w-full">
            <div
              className="flex items-center justify-between border border-border rounded-md h-9 w-[106px] overflow-hidden bg-background"
              role="group"
              aria-label={`Quantité — par lots de ${step}`}
            >
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(step, q - step))}
                className="w-8 h-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-l-md disabled:opacity-40"
                disabled={qty <= step}
                aria-label={`Diminuer la quantité de ${step}`}
                title={`Retirer ${step}`}
              >
                <Minus size={14} aria-hidden />
              </button>
              <span
                className="flex-1 px-1 text-sm font-medium min-w-0 text-center tabular-nums"
                aria-live="polite"
                aria-atomic="true"
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + step))}
                className="w-8 h-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-r-md disabled:opacity-40"
                disabled={qty >= maxQty}
                aria-label={`Augmenter la quantité de ${step}`}
                title={`Ajouter ${step}`}
              >
                <Plus size={14} aria-hidden />
              </button>
            </div>
            <button
              type="button"
              className="bg-primary text-primary-foreground px-2.5 h-9 rounded-md text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-primary/90 active:bg-primary/80 transition-colors w-full min-w-0"
              onClick={handleAdd}
              title={`Ajouter ${Math.min(qty, maxQty)} × ${formatEur(basePackPrice)} € au panier`}
              aria-label={`Ajouter ${Math.min(qty, maxQty)} unité(s) au panier — total ${formatEur(Math.min(qty, maxQty) * basePackPrice)} € ${priceLabel}`}
            >
              <ShoppingCart size={14} aria-hidden className="shrink-0" />
              <span className="hidden lg:inline shrink-0">Ajouter</span>
              <span className="hidden lg:inline opacity-60 shrink-0">·</span>
              <span className="tabular-nums min-w-0 truncate" aria-live="polite">
                {formatEur(Math.min(qty, maxQty) * basePackPrice)}&nbsp;€
              </span>
            </button>
          </div>
          {step > 1 && (
            <span className="text-[11px] text-muted-foreground tabular-nums text-right" title={`Quantité minimum de commande : ${step}. Toute quantité doit être un multiple de ${step}.`}>
              Lots de {step}
            </span>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm">{sellerLabel}</span>
            {offer.sellerSlug && (
              <Link
                to={`/vendeur/${offer.sellerSlug}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline w-fit"
              >
                <Store size={11} /> Voir la boutique
              </Link>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-base font-bold text-green-700">{formatEur(displayPrice)} € <span className="text-[10px] font-normal text-muted-foreground">{basisSuffix} · {priceLabel}</span></span>
            <ProfileResolvedPriceBadge
              offerId={offer.id}
              basePrice={offer.unitPriceEur}
              isTVAC={isTVAC}
              vatRate={offer.unitPriceEur > 0 ? Math.round((offer.unitPriceInclVat / offer.unitPriceEur - 1) * 100) : 21}
            />
          </div>
        </div>

        {/* Mobile: degressive price tiers */}
        {hasOfferPriceTiers && (
          <div className="rounded-md border border-border bg-muted/30 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
              <TrendingDown size={12} className="text-green-600" />
              Prix dégressifs selon le montant commandé
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {offerPriceTiers
                .sort((a, b) => a.tier_index - b.tier_index)
                .map((tier, i) => {
                  const basePrice = offerPriceTiers[0].price_excl_vat;
                  const tierPrice = isTVAC ? tier.price_incl_vat : tier.price_excl_vat;
                  const saving = i > 0 ? ((basePrice - tier.price_excl_vat) / basePrice * 100).toFixed(1) : null;
                  return (
                    <div key={tier.id} className="flex flex-col items-start gap-0.5 rounded-sm bg-background px-2 py-1.5 border border-border/60">
                      <span className={`text-[12px] tabular-nums leading-tight ${i === 0 ? "font-bold text-green-700" : "font-semibold text-foreground"}`}>
                        {formatEur(tierPrice)}&nbsp;€
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums leading-tight">
                        {tier.mov_threshold > 0 ? <>≥ {formatEur(tier.mov_threshold)}&nbsp;€</> : "Base"}
                      </span>
                      {saving && (
                        <span className="text-[10px] text-green-600 font-medium tabular-nums leading-tight">-{saving}%</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {!hasOfferPriceTiers && offer.movEur > 0 && <span>MOV {formatEur(offer.movEur)} €</span>}
          <span>Stock {offer.stockQuantity.toLocaleString("fr-FR")}</span>
          <span>Livraison ~{offer.deliveryDays}j</span>
          {step > 1 && (
            <span className="font-medium text-foreground" title={`Quantité minimum de commande : ${step}. Toute quantité doit être un multiple de ${step}.`}>
              Lots de {step}
            </span>
          )}
        </div>
        <div className="grid grid-cols-[112px_minmax(0,1fr)] items-stretch gap-2 w-full min-w-0">
          <div
            className="flex items-center justify-between border border-border rounded-md shrink-0 h-10 w-[112px] overflow-hidden bg-background"
            role="group"
            aria-label={`Quantité — par lots de ${step}`}
          >
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(step, q - step))}
              className="w-9 h-full inline-flex items-center justify-center text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-l-md disabled:opacity-40"
              disabled={qty <= step}
              aria-label={`Diminuer la quantité de ${step}`}
              title={`Retirer ${step}`}
            >
              <Minus size={14} aria-hidden />
            </button>
            <span
              className="flex-1 px-1 text-sm font-medium text-center min-w-0 tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + step))}
              className="w-9 h-full inline-flex items-center justify-center text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-r-md disabled:opacity-40"
              disabled={qty >= maxQty}
              aria-label={`Augmenter la quantité de ${step}`}
              title={`Ajouter ${step}`}
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className="bg-primary text-primary-foreground px-2.5 h-10 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-primary/90 active:bg-primary/80 transition-colors w-full min-w-0"
            onClick={handleAdd}
            title={`Ajouter ${Math.min(qty, maxQty)} × ${formatEur(basePackPrice)} € au panier`}
            aria-label={`Ajouter ${Math.min(qty, maxQty)} unité(s) au panier — total ${formatEur(Math.min(qty, maxQty) * basePackPrice)} € ${priceLabel}`}
          >
            <ShoppingCart size={14} aria-hidden className="shrink-0" />
            <span className="hidden min-[390px]:inline shrink-0">Ajouter</span>
            <span className="hidden min-[390px]:inline opacity-60 shrink-0">·</span>
            <span className="tabular-nums min-w-0 truncate" aria-live="polite">
              {formatEur(Math.min(qty, maxQty) * basePackPrice)}&nbsp;€
            </span>
          </button>
        </div>
      </div>

      {/* Ligne méta consolidée — bas de carte */}
      {(() => {
        const items: { key: string; icon: typeof Truck; label: string; title?: string }[] = [];

        if (vendorTrust?.shipsFromCountry) {
          items.push({
            key: "origin",
            icon: MapPin,
            label: `Expédié depuis ${countryName(vendorTrust.shipsFromCountry)}`,
          });
        }

        if (vendorTrust && vendorTrust.monthsActive >= 1) {
          items.push({
            key: "seniority",
            icon: Clock,
            label: `Sur MediKong depuis ${formatJoined(vendorTrust.joinedAt)}`,
          });
        }

        if (offer.deliveryDays) {
          const dl = offer.deliveryDays <= 7
            ? `${offer.deliveryDays} j`
            : `${Math.ceil(offer.deliveryDays / 7)} sem`;
          items.push({ key: "delivery", icon: Truck, label: `Livraison ~${dl}` });
        }

        const iso = offer.updatedAt || offer.syncedAt;
        const rel = formatUpdatedAt(iso);
        if (rel) {
          const full = formatUpdatedAtFull(iso) || rel;
          items.push({
            key: "updated",
            icon: RefreshCw,
            label: `Maj ${rel}`,
            title: `Dernière mise à jour : ${full}`,
          });
        }

        if (items.length === 0) return null;
        return (
          <ul className="mt-3 flex flex-col items-start gap-1 text-[11px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
            {items.map((it, i) => {
              const Icon = it.icon;
              return (
                <li
                  key={it.key}
                  className="inline-flex max-w-full items-center gap-1 whitespace-nowrap"
                  title={it.title}
                >
                  {i > 0 && (
                    <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">·</span>
                  )}
                  <Icon size={11} className="shrink-0" />
                  <span className="truncate">{it.label}</span>
                </li>
              );
            })}
          </ul>
        );
      })()}

      {offer.sellerId && (
        <VendorSuggestions
          vendorId={offer.sellerId}
          vendorSlug={offer.sellerSlug}
          vendorName={offer.sellerName}
          currentProductId={productId}
          categoryId={categoryId}
        />
      )}

      {offer.sellerId && (
        <div className="mt-3">
          <VendorDelegateCompact vendorId={offer.sellerId} />
        </div>
      )}
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
                      <img src={img} alt={p.name} className="w-full h-20 object-contain mb-1.5 rounded" onLoad={(e) => { if (isQogitaPlaceholder(e.currentTarget)) e.currentTarget.src = MEDIKONG_PLACEHOLDER; }} onError={(e) => { (e.target as HTMLImageElement).src = MEDIKONG_PLACEHOLDER; }} />
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
  const [isGalleryHover, setIsGalleryHover] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [movFilter, setMovFilter] = useState<number | null>(null);
  const [delayFilter, setDelayFilter] = useState<number | null>(null);
  const [faggOnly, setFaggOnly] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [stickyQty, setStickyQty] = useState(1);
  // Base de comparaison pour les offres externes : ramène toutes les offres
  // au même conditionnement pour comparer "des pommes à des pommes".
  // Défaut: 'pack' = prix exactement tel qu'importé chez le vendeur (le plus fidèle).
  // Les offres marketplace sont encodées à l'unité ; les relevés externes/marché restent affichés par pack par défaut.
  const [offerCompareBasis, setOfferCompareBasis] = useState<'pack' | 'unit' | 'hundred'>('unit');
  const [externalCompareBasis, setExternalCompareBasis] = useState<'pack' | 'unit' | 'hundred'>('pack');
  const offerSectionRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { slug } = useParams();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { user, isVerifiedBuyer, verificationLoading } = useAuth();
  const { country, currentCountry } = useCountry();
  const { isTVAC } = usePriceDisplay();
  const { data: product, isLoading } = useProduct(slug);
  const { data: resolvedVat } = useProductVatRate(product?.id, country || "BE");
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
      const { data: cat } = await supabase.from("categories").select("id, name, slug, parent_id, vat_rate").eq("id", prod.category_id).single();
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
        .select("id, name, slug, best_price_excl_vat, image_urls, image_url, brand_name")
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
    // Historique récent (Trivago-like) : anonyme + connecté, localStorage.
    if (product?.id && product?.slug && product?.name) {
      // Le produit expose imageUrls/imageUrl (camelCase). On prend la 1re image
      // valide (filtre placeholders Qogita) puis on la passe par getProductImageSrc
      // pour que la card homepage affiche exactement la même photo que la fiche.
      const candidates: string[] = Array.isArray(product.imageUrls) ? product.imageUrls : [];
      const firstValid =
        candidates.find((u: string) => isValidProductImage(u)) ??
        (isValidProductImage(product.imageUrl) ? product.imageUrl! : null);
      const resolvedImage = firstValid ? getProductImageSrc(firstValid) : null;
      import("@/hooks/useRecentSearches").then(({ pushRecentProduct }) => {
        pushRecentProduct({
          id: product.id,
          slug: product.slug,
          name: product.name,
          image: resolvedImage,
        });
      });
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

  // Trust signals
  const vendorIdsForTrust = Array.from(new Set(realOffers.map((o) => o.sellerId).filter(Boolean) as string[]));
  const { data: trustMap = {} } = useVendorTrust(vendorIdsForTrust);

  // Filter offers
  const filteredOffers = realOffers.filter((o) => {
    if (movFilter && o.movEur > movFilter) return false;
    if (delayFilter && o.deliveryDays > delayFilter) return false;
    if (faggOnly && !trustMap[o.sellerId]?.isFaggVerified) return false;
    return true;
  });

  const bestOffer = filteredOffers[0];
  // Dédoublonnage : un vendeur ne doit apparaître qu'une seule fois.
  // On garde l'offre déjà sélectionnée comme "meilleure" et on filtre toutes
  // les autres lignes du même vendeur (paliers, entrepôts, doublons d'import).
  const otherOffers = filteredOffers.slice(1).filter(
    (o) => !bestOffer || (o.sellerId && bestOffer.sellerId && o.sellerId !== bestOffer.sellerId)
  );
  // Idem pour le total stock / nombre de fournisseurs : on compte les vendeurs uniques.
  const uniqueVendorIds = new Set(filteredOffers.map((o) => o.sellerId).filter(Boolean));
  const uniqueVendorCount = uniqueVendorIds.size || filteredOffers.length;
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
  const [priceSavedPopup, setPriceSavedPopup] = useState(false);

  // Load saved user price from user_price_watches (same table as "Mes prix" in account)
  const { data: savedUserPrice } = useQuery({
    queryKey: ["user-price", product?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_price_watches")
        .select("user_price_excl_vat, notes")
        .eq("user_id", user!.id)
        .eq("product_id", product!.id)
        .maybeSingle();
      if (!data) return null;
      return { my_purchase_price: data.user_price_excl_vat, supplier_name: data.notes };
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

  // Compute gallery images BEFORE the useEffect — must run unconditionally on every render
  // (Rules of Hooks: do not place useEffect after early returns)
  const _rawImages: string[] = getPreferredProductImageUrls([
    ...(product?.imageUrls || []),
    product?.imageUrl,
  ]);
  const _galleryLen = Math.min(_rawImages.length, 6);

  // Auto-rotate gallery photos every 3s when more than 1 image, paused on hover
  useEffect(() => {
    if (!autoplayEnabled || isGalleryHover || _galleryLen <= 1) return;
    const id = window.setInterval(() => {
      setSelectedImageIdx((i) => (i + 1) % _galleryLen);
    }, 3000);
    return () => window.clearInterval(id);
  }, [autoplayEnabled, isGalleryHover, _galleryLen]);

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
  // (Reuses _rawImages computed above the early returns to keep hooks order stable)
  const images: string[] = _rawImages.map((u) => getProductImageSrc(u));
  const hasImages = images.length > 0;
  const galleryImages = images.slice(0, 6);

  const description = productDetails?.description || (productDetails as any)?.label || product.descriptionShort || "";

  const bestOfferPack = resolvePackSize({
    offerOverride: bestOffer?.packSizeOverride,
    productPackSize: (product as any)?.pack_size,
    productName: product.name,
  });
  const bestOfferPackSize = bestOfferPack.packSize || 1;
  // ⚠️ En base, `offers.price_excl_vat` est le prix de l'unité de vente côté vendeur
  // = prix du PACK (ex. 8,39 € pour un pack ×4 à 2,0975 €/u). On dérive donc l'unitaire.
  const bestOfferPackPrice = bestOffer ? (isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur) : 0;
  const bestOfferUnitPrice = bestOfferPackSize > 0 ? bestOfferPackPrice / bestOfferPackSize : bestOfferPackPrice;
  const bestOfferDisplayPrice = priceFromUnit(bestOfferUnitPrice, offerCompareBasis as CompareBasis, bestOfferPackSize);
  const clientPrice = bestOfferUnitPrice;
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
        {/* Back to results + Breadcrumb */}
        <div className="mk-container pt-3 pb-1 flex items-center gap-3">
          {(() => {
            const from = (routeLocation.state as any)?.from;
            if (from && (from.startsWith("/catalogue") || from.startsWith("/recherche"))) {
              return (
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                >
                  <ChevronRight size={12} className="rotate-180" />
                  Retour aux résultats
                </button>
              );
            }
            return null;
          })()}
        </div>
        <nav aria-label="Fil d'Ariane" className="mk-container pb-3">
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
              <div
                className="flex gap-3"
                onMouseEnter={() => setIsGalleryHover(true)}
                onMouseLeave={() => setIsGalleryHover(false)}
              >
                {/* Thumbnail column */}
                {images.length > 1 && (
                  <div className="hidden md:flex flex-col gap-2 w-[60px] shrink-0">
                    {galleryImages.map((img, i) => (
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
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center">
                    {hasImages ? (
                      <img
                        src={images[selectedImageIdx] || images[0]}
                        alt={product.name}
                        className="w-full h-full object-contain p-4 transition-opacity duration-300"
                        referrerPolicy="no-referrer"
                        onLoad={(e) => { if (isQogitaPlaceholder(e.currentTarget)) e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
                        onError={(e) => {
                          e.currentTarget.src = MEDIKONG_PLACEHOLDER;
                        }}
                      />
                    ) : (
                      <img src="/medikong-placeholder.png" alt="Image non disponible" className="w-full h-full object-contain p-8" />
                    )}

                    {/* Autoplay control + counter */}
                    {galleryImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAutoplayEnabled((v) => !v)}
                          aria-label={autoplayEnabled ? "Mettre en pause le diaporama" : "Lancer le diaporama"}
                          className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/80 backdrop-blur border border-border text-foreground hover:bg-background transition-colors"
                        >
                          {autoplayEnabled && !isGalleryHover ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-background/80 backdrop-blur border border-border text-muted-foreground">
                          {selectedImageIdx + 1} / {galleryImages.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Mobile thumbnails */}
                  {hasImages && images.length > 1 && (
                    <div className="flex md:hidden gap-2 mt-3 overflow-x-auto">
                      {galleryImages.map((img, i) => (
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
              {user && (isVerifiedBuyer || verificationLoading) && (
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

              {/* ── Pending verification gate ── */}
              {user && !isVerifiedBuyer && !verificationLoading && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                    <Info size={22} className="text-amber-600" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">Compte en attente de validation</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Les prix et les offres seront visibles après validation de votre profil par notre équipe.
                  </p>
                  <p className="text-xs text-muted-foreground">Cela prend généralement moins de 24h.</p>
                </div>
              )}

              {/* ── Bloc Économie / Marge potentielle (PVP officiel) ── */}
              {user && isVerifiedBuyer && bestOffer && (
                <div className="mb-6">
                  <PvpEconomyBadge
                    productId={product.id}
                    offerId={(bestOffer as any).id ?? (bestOffer as any).offerId ?? null}
                    buyerPriceTtc={Number(bestOffer.unitPriceInclVat) || Number(bestOffer.unitPriceEur) * 1.21}
                    buyerPriceHtva={Number(bestOffer.unitPriceEur)}
                    countryCode={(product as any).pvp_country_code || "BE"}
                    variant="card"
                  />
                </div>
              )}

              {/* ── Offers Tabs (only for verified buyers) ── */}
              {user && (isVerifiedBuyer || verificationLoading) && (
              <div ref={offerSectionRef}>
                <Tabs defaultValue="marketplace" className="mb-6">
                  <TabsList className="w-full grid grid-cols-3 mb-4">
                    <TabsTrigger value="marketplace" className="text-xs sm:text-sm gap-1.5">
                      <ShoppingCart size={14} className="hidden sm:inline" /> Marketplace MediKong <span className="ml-1 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{uniqueVendorCount}</span>
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
                    <VendorTrustProvider trustMap={trustMap}>
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
                      <label className="mt-3 flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={faggOnly}
                          onChange={(e) => setFaggOnly(e.target.checked)}
                          className="rounded border-border"
                        />
                        Vendeurs vérifiés FAGG uniquement
                      </label>
                    </div>

                    {/* My encoded price banner — visible only if user has an encoded price for this product */}
                    <MyEncodedPriceBanner
                      productId={product.id}
                      bestPriceExclVat={bestOffer?.unitPriceEur ?? 0}
                      bestPriceInclVat={bestOffer?.unitPriceInclVat ?? 0}
                      isTVAC={isTVAC}
                      canOrder={!!bestOffer && bestOffer.stockQuantity > 0}
                      onAddToCart={() => {
                        if (!bestOffer) return;
                        if (!user) {
                          toast.error("Connectez-vous pour commander", {
                            action: { label: "Se connecter", onClick: () => navigate("/connexion") },
                          });
                          return;
                        }
                        const step = bestOffer.bundleSize > 1 ? bestOffer.bundleSize : 1;
                        const qty = Math.min(bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : step, step);
                        addToCart.mutate({
                          offerId: bestOffer.id,
                          productId: product.id,
                          quantity: qty,
                          maxQuantity: bestOffer.stockQuantity || 999,
                          vendorId: bestOffer.sellerId,
                          priceExclVat: bestOffer.unitPriceEur,
                          productData: { id: product.id, name: product.name, brand: brandData?.name || product.brand || "", slug: product.slug, price: bestOffer.unitPriceEur, imageUrl: product.imageUrls?.[0] || product.imageUrl || undefined },
                          deliveryDays: bestOffer.deliveryDays || null,
                        });
                      }}
                    />

                    {/* RFQ + base de comparaison (€/pack · €/u. · €/100u.) */}
                    {(() => {
                      const _mkPack = resolvePackSize({
                        offerOverride: (bestOffer as any)?.packSizeOverride,
                        productPackSize: (product as any)?.pack_size,
                        productName: product.name,
                      });
                      const showBasisToggle = !!bestOffer && _mkPack.packSize > 1;
                      return (
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                          {showBasisToggle ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <BarChart3 size={14} />
                                <span>Comparer sur la base&nbsp;:</span>
                              </div>
                              <ToggleGroup
                                type="single"
                                value={offerCompareBasis}
                                onValueChange={(v) => v && setOfferCompareBasis(v as 'pack' | 'unit' | 'hundred')}
                                className="bg-muted/40 rounded-lg p-0.5"
                                size="sm"
                              >
                                <ToggleGroupItem value="unit" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/unité</ToggleGroupItem>
                                <ToggleGroupItem value="pack" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/pack</ToggleGroupItem>
                                <ToggleGroupItem value="hundred" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/100 u.</ToggleGroupItem>
                              </ToggleGroup>
                            </div>
                          ) : <div />}
                          <RfqRequestButton
                            productId={product.id}
                            brandId={brandData?.id || product.brandId || null}
                            productName={product.name}
                            brandName={brandData?.name || product.brand || null}
                          />
                        </div>
                      );
                    })()}

                    {/* Best Offer */}
                    {bestOffer ? (
                      <div className="border-2 border-emerald-300 bg-emerald-50/60 rounded-xl p-4 md:p-6 mb-4">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Award size={18} className="text-emerald-700" />
                            <h3 className="text-base md:text-lg font-bold text-emerald-800">Meilleure offre</h3>
                          </div>
                          <span className="text-sm text-emerald-700 font-medium">{formatCount(totalStock)} disponibles{uniqueVendorCount > 1 ? ` auprès de ${uniqueVendorCount} fournisseurs` : ""}</span>
                        </div>

                        <div className="hidden md:grid grid-cols-[minmax(180px,1.4fr)_minmax(200px,1.8fr)_64px_240px] gap-3 px-1 pb-3 text-xs font-semibold text-muted-foreground border-b border-border">
                          <span>Fournisseur</span>
                          <span>
                            Prix {offerCompareBasis === 'pack' ? '/ pack' : offerCompareBasis === 'unit' ? '/ unité' : '/ 100 u.'} · MOV
                          </span>
                          <span>Stock</span>
                          <span className="text-right">Commander</span>
                        </div>

                        <SafeBoundary label={`l'offre de ${bestOffer.sellerName || "ce fournisseur"}`}>
                          <OfferRow
                            offer={bestOffer}
                            productId={product.id}
                            productName={product.name}
                            productSlug={product.slug}
                            productImageUrl={product.imageUrls?.[0] || product.imageUrl || undefined}
                            user={user}
                            navigate={navigate}
                            addToCart={addToCart}
                            isBest
                            isTVAC={isTVAC}
                            categoryId={categoryData?.category?.id}
                            discountPercentage={Number((product as any)?.discount_percentage) || 0}
                            compareBasis={offerCompareBasis}
                            packSize={resolvePackSize({
                              offerOverride: (bestOffer as any)?.packSizeOverride,
                              productPackSize: (product as any)?.pack_size,
                              productName: product.name,
                            }).packSize}
                          />
                        </SafeBoundary>
                      </div>
                    ) : (
                      <div
                        className="border border-amber-200 bg-amber-50/60 rounded-xl p-8 text-center"
                        role="status"
                        data-testid="no-offers-for-country"
                      >
                        <img src="/medikong-placeholder.png" alt="" className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="text-amber-900 font-semibold">
                          Aucune offre disponible pour ce pays
                          {currentCountry?.flag_emoji ? ` ${currentCountry.flag_emoji}` : ""}
                          {currentCountry?.name ? ` (${currentCountry.name})` : country ? ` (${country})` : ""}
                        </p>
                        <p className="text-sm text-amber-800/80 mt-1">
                          Ce produit n'est pas encore référencé par un vendeur dans votre pays.
                          Essayez de changer de pays dans le sélecteur en haut à droite, ou ajoutez-le à votre liste de suivi
                          pour être notifié dès qu'une offre est publiée.
                        </p>
                        <button
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-amber-300 bg-white rounded-lg text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors"
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
                            <span className="text-xs text-muted-foreground">Tri par prix</span>
                          </div>
                          <span className="text-sm text-primary font-medium">
                            {formatCount(otherOffers.reduce((s, o) => s + o.stockQuantity, 0))} disponibles{otherOffers.length > 1 ? ` auprès de ${otherOffers.length} fournisseurs` : ""}
                          </span>
                        </div>

                        <div className="hidden md:grid grid-cols-[minmax(180px,1.4fr)_minmax(200px,1.8fr)_64px_240px] gap-3 px-1 pb-3 text-xs font-semibold text-muted-foreground border-b border-border">
                          <span>Fournisseur</span>
                          <span>Prix {offerCompareBasis === 'pack' ? '/ pack' : offerCompareBasis === 'unit' ? '/ unité' : '/ 100 u.'} · MOV</span>
                          <span>Stock</span>
                          <span className="text-right">Commander</span>
                        </div>

                        {otherOffers.map((offer, i) => (
                          <SafeBoundary
                            key={offer.id}
                            label={`l'offre de ${offer.sellerName || "ce fournisseur"}`}
                          >
                            <OfferRow
                              offer={offer}
                              productId={product.id}
                              productName={product.name}
                              productSlug={product.slug}
                              productImageUrl={product.imageUrls?.[0] || product.imageUrl || undefined}
                              user={user}
                              navigate={navigate}
                              addToCart={addToCart}
                              delay={i * 0.06}
                              isTVAC={isTVAC}
                              categoryId={categoryData?.category?.id}
                              bestPrice={bestOffer ? bestOfferDisplayPrice : undefined}
                              discountPercentage={Number((product as any)?.discount_percentage) || 0}
                              compareBasis={offerCompareBasis}
                              packSize={resolvePackSize({
                                offerOverride: (offer as any)?.packSizeOverride,
                                productPackSize: (product as any)?.pack_size,
                                productName: product.name,
                              }).packSize}
                            />
                          </SafeBoundary>
                        ))}
                      </div>
                    )}
                    </VendorTrustProvider>
                  </TabsContent>

                  {/* ── Tab: Offres externes ── */}
                  {/* Note: les prix relevés chez les vendeurs externes (e-commerce B2B) sont TTC.
                      On dérive le HTVA via le taux de TVA de la catégorie (fallback 21%). */}
                  <TabsContent value="external">
                    {externalOfferItems.length > 0 ? (
                      <div className="space-y-3">
                        {/* Sélecteur de base de comparaison : permet de ramener toutes les offres
                            externes (vendues en pack de 4, 24, 46…) sur la même unité de référence. */}
                        <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <BarChart3 size={14} />
                            <span>Comparer sur la base&nbsp;:</span>
                          </div>
                          <ToggleGroup
                            type="single"
                            value={externalCompareBasis}
                            onValueChange={(v) => v && setExternalCompareBasis(v as 'pack' | 'unit' | 'hundred')}
                            size="sm"
                            variant="outline"
                            className="gap-0.5"
                          >
                            <ToggleGroupItem value="pack" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/pack</ToggleGroupItem>
                            <ToggleGroupItem value="unit" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/unité</ToggleGroupItem>
                            <ToggleGroupItem value="hundred" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/100&nbsp;u.</ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                        {[...externalOfferItems]
                          .map((eo: any) => {
                            const _pack = resolvePackSize({
                              offerOverride: eo.pack_size_override,
                              productPackSize: (product as any)?.pack_size,
                              productName: product?.name,
                              offerTitle: eo.raw_title ?? eo.notes,
                              offerUrl: eo.product_url,
                            });
                            const _ttc = Number(eo.unit_price) || 0;
                            const _vat = Number(resolvedVat?.vat_rate ?? (categoryData?.category as any)?.vat_rate ?? 21);
                            const _ht = _ttc ? _ttc / (1 + _vat / 100) : 0;
                            const _basePrice = isTVAC ? _ttc : _ht;
                            const perUnit = _pack.packSize > 0 ? _basePrice / _pack.packSize : _basePrice;
                            const sortKey =
                              externalCompareBasis === 'pack' ? _basePrice :
                              externalCompareBasis === 'hundred' ? perUnit * 100 :
                              perUnit;
                            return { eo, sortKey };
                          })
                          .sort((a, b) => (a.sortKey || Infinity) - (b.sortKey || Infinity))
                          .map(({ eo }: any) => {
                          const vendor = eo.external_vendors;
                          const stockIcon = eo.stock_status === "in_stock" ? "🟢" : eo.stock_status === "limited" ? "🟡" : eo.stock_status === "out_of_stock" ? "🔴" : "⚪";
                          const stockLabel = eo.stock_status === "in_stock" ? "En stock" : eo.stock_status === "limited" ? "Stock limité" : eo.stock_status === "out_of_stock" ? "Rupture" : "Stock inconnu";

                          // Prix source = TTC (relevés sur sites e-commerce). On dérive le HTVA.
                          // Taux TVA résolu via priorité : override produit → CNK → catégorie → fallback 21%.
                          const tvaRate = Number(resolvedVat?.vat_rate ?? (categoryData?.category as any)?.vat_rate ?? 21);
                          const tvaSource = resolvedVat?.source ?? "category";
                          const priceTTC = Number(eo.unit_price) || 0;
                          const priceHTVA = priceTTC ? Math.round((priceTTC / (1 + tvaRate / 100)) * 100) / 100 : 0;
                          const displayPrice = isTVAC ? priceTTC : priceHTVA;
                          const secondaryPrice = isTVAC ? priceHTVA : priceTTC;
                          const priceLabel = isTVAC ? "TVAC" : "HTVA";
                          const secondaryLabel = isTVAC ? "HTVA" : "TVAC";

                          // Conditionnement : combien d'unités contient le pack vendu ?
                          // Priorité : override sur l'offre > pack du produit > extraction depuis le nom > 1.
                          const pack = resolvePackSize({
                            offerOverride: (eo as any).pack_size_override,
                            productPackSize: (product as any)?.pack_size,
                            productName: product?.name,
                            offerTitle: (eo as any).raw_title ?? (eo as any).notes,
                            offerUrl: eo.product_url,
                          });
                          const showUnitPrice = pack.packSize > 1;
                          const unitDisplayPrice = showUnitPrice ? displayPrice / pack.packSize : 0;

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
                            } catch {
                              // Lead tracking is best-effort and must not block navigation.
                            }
                            // Open in new tab
                            window.open(eo.product_url, "_blank", "noopener,noreferrer");
                          };

                          return (
                            <div key={eo.id} className="border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <ExternalVendorLogo name={vendor?.name} logoUrl={vendor?.logo_url} size={40} />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-foreground">{vendor?.name || "Vendeur externe"}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs text-muted-foreground">{stockIcon} {stockLabel}</span>
                                    {eo.delivery_days && <span className="text-xs text-muted-foreground">• {eo.delivery_days}j livraison</span>}
                                    {(eo.updated_at || eo.created_at) && (
                                      <span
                                        className="text-[11px] text-muted-foreground"
                                        title={formatUpdatedAtFull(eo.updated_at || eo.created_at)}
                                      >
                                        • Dernier relevé : {eo.product_url ? (
                                          <a
                                            href={eo.product_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                                          >
                                            {formatUpdatedAt(eo.updated_at || eo.created_at)}
                                          </a>
                                        ) : (
                                          formatUpdatedAt(eo.updated_at || eo.created_at)
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                  {(() => {
                                    // Prix normalisé selon la base de comparaison choisie.
                                    const perUnit = pack.packSize > 0 ? displayPrice / pack.packSize : displayPrice;
                                    const headlinePrice =
                                      externalCompareBasis === 'pack' ? displayPrice :
                                      externalCompareBasis === 'hundred' ? perUnit * 100 :
                                      perUnit;
                                    // Suffixes harmonisés (cf. formatBasisLabel) : /pack[ de N], /u., /100 u.
                                    const headlineSuffix = formatBasisLabel(
                                      externalCompareBasis as CompareBasis,
                                      { packSize: pack.packSize, withPackSize: true }
                                    ).replace(/^€\//, '/');
                                    return (
                                      <>
                                        <div className="flex items-baseline justify-end gap-2">
                                          <span className="text-lg font-bold text-foreground tabular-nums">
                                            {formatEur(headlinePrice)} €
                                            <span className="text-[11px] font-medium text-muted-foreground ml-0.5">{headlineSuffix}</span>
                                          </span>
                                          <span
                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                              isTVAC
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            }`}
                                            title={isTVAC ? "Prix toutes taxes comprises (avec TVA)" : "Prix hors TVA (HT)"}
                                          >
                                            {priceLabel}
                                          </span>
                                        </div>
                                        {externalCompareBasis === 'pack' ? (
                                          <>
                                            {pack.packSize > 1 && (
                                              <p
                                                className="text-[11px] text-muted-foreground tabular-nums mt-0.5 flex items-center justify-end gap-1.5 flex-wrap"
                                                title={packSizeSourceLabel(pack.source)}
                                              >
                                                <span>soit {formatEur(perUnit)} €/unité · pack de {pack.packSize}</span>
                                                {(() => {
                                                  const badge = packSizeSourceBadge(pack.source);
                                                  return (
                                                    <span
                                                      className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border leading-none ${badge.className}`}
                                                      title={badge.title}
                                                    >
                                                      {badge.code}
                                                    </span>
                                                  );
                                                })()}
                                              </p>
                                            )}
                                            <p className="text-[11px] text-muted-foreground tabular-nums" title={`Source TVA : ${vatSourceLabel(tvaSource)}`}>
                                              soit {formatEur(secondaryPrice)} € {secondaryLabel} <span className="opacity-60">· TVA {tvaRate}%</span>
                                            </p>
                                          </>
                                        ) : (
                                          <>
                                            <p
                                              className="text-[11px] text-muted-foreground tabular-nums mt-0.5 flex items-center justify-end gap-1.5 flex-wrap"
                                              title={packSizeSourceLabel(pack.source)}
                                            >
                                              <span>
                                                Pack&nbsp;: {formatEur(displayPrice)} € {priceLabel}
                                                {pack.packSize > 1 && <> · pack de {pack.packSize}</>}
                                              </span>
                                              {(() => {
                                                const badge = packSizeSourceBadge(pack.source);
                                                return (
                                                  <span
                                                    className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border leading-none ${badge.className}`}
                                                    title={badge.title}
                                                  >
                                                    {badge.code}
                                                  </span>
                                                );
                                              })()}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground tabular-nums" title={`Source TVA : ${vatSourceLabel(tvaSource)}`}>
                                              soit {formatEur(secondaryPrice)} € {secondaryLabel} <span className="opacity-60">· TVA {tvaRate}%</span>
                                            </p>
                                          </>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {Number(eo.mov_amount || 0) > 0 && (
                                    <p className="text-[11px] text-muted-foreground">MOV {Number(eo.mov_amount).toFixed(0)} €</p>
                                  )}
                                </div>
                                {eo.product_url && (
                                  <button
                                    onClick={handleClick}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                                  >
                                    Voir l'offre <ExternalLink size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[11px] text-muted-foreground italic px-1">
                          ⓘ Prix relevés en TTC sur les sites des vendeurs externes. Le HTVA est calculé sur base du taux de TVA de la catégorie.
                        </p>
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
                      <div className="space-y-3">
                        {/* Même bascule de comparaison que pour les offres externes : on garde
                            les valeurs telles qu'importées (au pack) par défaut, et l'utilisateur
                            peut ramener à l'unité ou aux 100 unités d'un clic. */}
                        <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <BarChart3 size={14} />
                            <span>Comparer sur la base&nbsp;:</span>
                          </div>
                          <ToggleGroup
                            type="single"
                            value={externalCompareBasis}
                            onValueChange={(v) => v && setExternalCompareBasis(v as 'pack' | 'unit' | 'hundred')}
                            size="sm"
                            variant="outline"
                            className="gap-0.5"
                          >
                            <ToggleGroupItem value="pack" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/pack</ToggleGroupItem>
                            <ToggleGroupItem value="unit" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/unité</ToggleGroupItem>
                            <ToggleGroupItem value="hundred" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">€/100&nbsp;u.</ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                        {(() => {
                          const basisSuffix = formatBasisLabel(externalCompareBasis as CompareBasis).replace(/^€\//, '/');

                          // Récap prix MK : `offers.price_excl_vat` est le prix du PACK (unité de vente vendeur).
                          // -> mkPackPrice = valeur stockée, mkUnit = pack ÷ packSize.
                          const mkPack = resolvePackSize({
                            offerOverride: (bestOffer as any)?.packSizeOverride,
                            productPackSize: (product as any)?.pack_size,
                            productName: product.name,
                          });
                          const _mkPackSize = Math.max(1, mkPack.packSize || 1);
                          const mkPackPrice = bestOffer?.unitPriceEur ?? 0;
                          const mkUnit = mkPackPrice / _mkPackSize;
                          return (
                          <>
                          {bestOffer && (
                            <div id="mk-reference-pack" className="scroll-mt-24 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[12px] flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span className="font-semibold text-foreground">Référence MediKong&nbsp;:</span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-muted-foreground">Pack&nbsp;</span>
                                <span className="font-bold tabular-nums">×{mkPack.packSize}</span>
                                <PackSizeExplainer
                                  packSize={mkPack.packSize}
                                  source={mkPack.source}
                                  rawTitle={product.name}
                                />
                              </span>
                              {mkPack.packSize > 1 && (
                                <span className="text-muted-foreground">
                                  Pack calculé&nbsp;: <span className="font-bold text-foreground tabular-nums">{formatEur(mkPackPrice)} €</span>
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                Unitaire&nbsp;: <span className="font-bold text-foreground tabular-nums">{formatEur(mkUnit)} €/u.</span>
                              </span>
                              <span className="ml-auto text-[11px] text-muted-foreground italic">
                                Le % d'écart est invariant ; le montant € suit la base ({externalCompareBasis === 'pack' ? '€/pack' : externalCompareBasis === 'hundred' ? '€/100 u.' : '€/unité'}).
                              </span>
                            </div>
                          )}

                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border text-left">
                              <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                              <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Pack</th>
                              {mpVisMap.show_pharmacist_price && <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Pharmacien {basisSuffix}</th>}
                              {mpVisMap.show_wholesale_price !== false && <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Grossiste {basisSuffix}</th>}
                              {mpVisMap.show_public_price && <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Pub. HTVA {basisSuffix}</th>}
                              <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Pub. TTC {basisSuffix}</th>
                              <th className="px-1 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Stock</th>
                              <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href="#mk-reference-pack"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          document.getElementById('mk-reference-pack')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        className="inline-flex items-center gap-1 hover:text-foreground underline decoration-dotted underline-offset-2 cursor-help"
                                      >
                                        Écart MK <span aria-hidden className="text-[11px] leading-none">ⓘ</span>
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                                      <p className="font-semibold mb-1">Pourcentage invariant, montant adapté</p>
                                      <p>
                                        Le <strong>pourcentage d'écart</strong> compare le prix unitaire et reste identique quelle
                                        que soit la base affichée. Le <strong>montant en €</strong>, lui, suit la base sélectionnée
                                        (€/pack, €/u. ou €/100 u.).
                                      </p>
                                      <p className="mt-1 text-muted-foreground">
                                        Cliquez pour voir le pack et le prix unitaire MK utilisés.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </th>
                              <th className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Relevé</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {marketPriceItems.map((mp: any) => {
                              // ⚠️ `offers.price_excl_vat` (offer.unitPriceEur) = prix du PACK côté vendeur.
                              // Le vrai prix unitaire MK est donc pack ÷ packSize.
                              const mkHT = bestOffer ? bestOfferUnitPrice : 0;
                              const isOnline = mp.market_price_sources?.source_type === "online";
                              const tvaRate = Number(mp.tva_rate || 21);

                              // ⚠️ Conditionnement : les grossistes (CERP, Febelco) cotent souvent
                              // au pack vendeur (ex: "FRESUBIN PROT NRJ TROPI 4X200" → pack de 4).
                              // On résout le pack à partir du libellé brut puis de l'URL, et on
                              // divise tous les prix par ce pack pour comparer "des pommes à des pommes".
                              const mpPack = resolvePackSize({
                                offerOverride: null,
                                productPackSize: null,
                                productName: product?.name,
                                offerTitle: mp.product_name_source,
                                offerUrl: mp.product_url,
                              });
                              const packDiv = mpPack.packSize > 0 ? mpPack.packSize : 1;

                              // Valeurs unitaires (telles qu'utilisées pour l'écart MK).
                              const rawPharm = Number(mp.prix_pharmacien || 0) / packDiv;
                              const rawGrossiste = Number(mp.prix_grossiste || 0) / packDiv;
                              const rawPublic = Number(mp.prix_public || 0) / packDiv;

                              // Pharmacien HTVA: only for non-online sources
                              const pharmHT = isOnline ? 0 : rawPharm;
                              // Grossiste HTVA
                              const grossisteHT = rawGrossiste;

                              // Online sources: prices are TTC → derive HTVA
                              // Wholesaler sources (Febelco, CERP…): ALL prices are HTVA → derive TTC
                              let publicHTVA: number;
                              let publicTTC: number;
                              if (isOnline) {
                                publicTTC = rawPublic || rawPharm;
                                publicHTVA = publicTTC ? Math.round(publicTTC / (1 + tvaRate / 100) * 100) / 100 : 0;
                              } else {
                                publicHTVA = rawPublic;
                                publicTTC = publicHTVA ? Math.round(publicHTVA * (1 + tvaRate / 100) * 100) / 100 : 0;
                              }

                              // Écart MK : cascade pharmacien > grossiste > public HTVA.
                              // Cf. src/lib/market-price-delta.ts (testé unitairement).
                              const { deltaAbs, deltaPct, mkCheaper } = computeMarketDelta({
                                mkHT,
                                pharmHT,
                                grossisteHT,
                                publicHTVA,
                              });
                              // Badge pack désormais rendu via <PackSizeExplainer/> (popover détaillé).

                              // Multiplicateur d'affichage selon la base sélectionnée.
                              // Les valeurs ci-dessus sont à l'unité ; on multiplie pour pack ou /100u.
                              const mult =
                                externalCompareBasis === 'pack' ? packDiv :
                                externalCompareBasis === 'hundred' ? 100 :
                                1;
                              const dispPharm = pharmHT * mult;
                              const dispGrossiste = grossisteHT * mult;
                              const dispPublicHTVA = publicHTVA * mult;
                              const dispPublicTTC = publicTTC * mult;

                              return (
                                 <tr key={mp.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-2 py-2">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="font-medium text-foreground text-[12px] whitespace-nowrap">{mp.market_price_sources?.name}</span>
                                      {mp.product_url && (
                                        <a href={mp.product_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                                          <ExternalLink size={11} />
                                        </a>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-center text-[11px] whitespace-nowrap">
                                    {mpPack.packSize > 1 ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="font-semibold text-foreground tabular-nums">×{mpPack.packSize}</span>
                                        <PackSizeExplainer
                                          packSize={mpPack.packSize}
                                          source={mpPack.source}
                                          rawTitle={mp.product_name_source}
                                          rawUrl={mp.product_url}
                                          packPriceEur={Number(mp.prix_grossiste || mp.prix_pharmacien || mp.prix_public || 0)}
                                          mkUnitPriceEur={mkHT}
                                        />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="text-muted-foreground">×1</span>
                                        <PackSizeExplainer
                                          packSize={1}
                                          source={mpPack.source}
                                          rawTitle={mp.product_name_source}
                                          rawUrl={mp.product_url}
                                        />
                                      </span>
                                    )}
                                  </td>
                                  {mpVisMap.show_pharmacist_price && (
                                    <td className="px-2 py-2 text-right font-bold tabular-nums text-foreground text-[12px] whitespace-nowrap">
                                      {dispPharm ? `${formatEur(dispPharm)} €` : <span className="text-muted-foreground font-normal">—</span>}
                                    </td>
                                  )}
                                  {mpVisMap.show_wholesale_price !== false && (
                                    <td className="px-2 py-2 text-right font-bold tabular-nums text-foreground text-[12px] whitespace-nowrap">
                                      {dispGrossiste ? `${formatEur(dispGrossiste)} €` : <span className="text-muted-foreground font-normal">—</span>}
                                    </td>
                                  )}
                                  {mpVisMap.show_public_price && (
                                    <td className="px-2 py-2 text-right tabular-nums text-foreground text-[12px] whitespace-nowrap">
                                      {dispPublicHTVA ? `${formatEur(dispPublicHTVA)} €` : <span className="text-muted-foreground font-normal">—</span>}
                                    </td>
                                  )}
                                  <td className="px-2 py-2 text-right tabular-nums text-foreground text-[12px] whitespace-nowrap">
                                    {dispPublicTTC ? `${formatEur(dispPublicTTC)} €` : <span className="text-muted-foreground font-normal">—</span>}
                                  </td>
                                  <td className="px-1 py-2 text-center">
                                    {mp.stock_source ? (() => {
                                      const inStock = !mp.stock_source.toLowerCase().includes("rupture") && mp.stock_source !== "0";
                                      const qty = mp.stock_source.match(/\d+/)?.[0];
                                      return (
                                        <span className="inline-flex items-center gap-1 text-[11px]" title={mp.stock_source}>
                                          <span className={`w-2 h-2 rounded-full shrink-0 ${inStock ? "bg-emerald-500" : "bg-destructive"}`} />
                                          {qty && <span className="text-muted-foreground">({qty})</span>}
                                        </span>
                                      );
                                    })() : <span className="text-muted-foreground text-[11px]">—</span>}
                                  </td>
                                  <td className="px-2 py-2 text-right whitespace-nowrap">
                                    {deltaAbs !== null ? (
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className="inline-flex items-center gap-0.5">
                                          <span className={`font-bold tabular-nums text-[12px] ${mkCheaper ? "text-emerald-600" : "text-destructive"}`}>
                                            {mkCheaper ? "−" : "+"}{formatEur(Math.abs(deltaAbs) * mult)}&nbsp;€
                                          </span>
                                          <span className={`inline-flex rounded-full px-1 py-0.5 text-[9px] font-semibold leading-none ${mkCheaper ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-destructive"}`}>
                                            {mkCheaper ? "−" : "+"}{Math.abs(deltaPct!)}%
                                          </span>
                                        </span>
                                        {bestOffer && (() => {
                                          const mkPackForRow = resolvePackSize({
                                            offerOverride: (bestOffer as any)?.packSizeOverride,
                                            productPackSize: (product as any)?.pack_size,
                                            productName: product.name,
                                          });
                                          const mkBasis = priceFromUnit(mkHT, externalCompareBasis as CompareBasis, mkPackForRow.packSize);
                                          const mkBasisLabel = formatBasisLabel(externalCompareBasis as CompareBasis);
                                          return (
                                            <a
                                              href="#mk-reference-pack"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                document.getElementById('mk-reference-pack')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                              }}
                                              title="Référence MK utilisée pour ce calcul — cliquez pour voir le détail"
                                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground tabular-nums leading-none"
                                            >
                                              <span className="rounded border border-border bg-muted/40 px-1 py-0.5">Pack MK&nbsp;×{mkPackForRow.packSize}</span>
                                              <span className="rounded border border-border bg-muted/40 px-1 py-0.5">MK&nbsp;{formatEur(mkBasis)}&nbsp;{mkBasisLabel}</span>
                                            </a>
                                          );
                                        })()}
                                      </div>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                                    {mp.imported_at ? new Date(mp.imported_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                          </>
                          );
                        })()}
                        <p className="text-[11px] text-muted-foreground italic px-1">
                          ⓘ Le pourcentage d'écart est invariant ; le montant en euros suit la base choisie ({externalCompareBasis === 'pack' ? '€/pack' : externalCompareBasis === 'hundred' ? '€/100 u.' : '€/unité'}).
                        </p>
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

              {/* ── Deuxième Chance — ReStock ── */}
              <RestockSecondChance
                ean={product.ean || product.gtin}
                cnk={product.cnk}
                productName={product.name}
              />

              {/* ── Description ── */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-foreground mb-3">Description du produit</h2>
                <ProductDescription description={description} />
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
                                onClick={() => setCalcMode('manual')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${calcMode === 'manual' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                              >
                                Prix manuel
                              </button>
                              <button
                                onClick={() => { setCalcMode('pct'); setUserPrice(""); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${calcMode === 'pct' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                              >
                                % remise vs prix marché
                              </button>
                            </div>
                          </div>
                        )}

                        {(calcMode === 'manual' || !hasAnyRef) ? (
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
                          const { error } = await supabase.from("user_price_watches" as any).upsert({
                            user_id: user.id,
                            product_id: product.id,
                            user_price_excl_vat: price,
                            notes: supplierName || null,
                            updated_at: new Date().toISOString(),
                          }, { onConflict: "user_id,product_id" });
                          setSavingPrice(false);
                          if (!error) {
                            setPriceSavedPopup(true);
                            queryClient.invalidateQueries({ queryKey: ["user-price", product.id] });
                            queryClient.invalidateQueries({ queryKey: ["price_watches"] });
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
                        <img
                          src={getProductImageSrc(
                            Array.isArray(p.image_urls)
                              ? p.image_urls.find((url: string) => isValidProductImage(url)) || p.image_url
                              : p.image_url
                          )}
                          alt={p.name}
                          className="w-full h-full object-contain p-2"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onLoad={(e) => { if (isQogitaPlaceholder(e.currentTarget)) e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
                          onError={(e) => {
                            e.currentTarget.src = MEDIKONG_PLACEHOLDER;
                          }}
                        />
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
        {showStickyBar && bestOffer && isVerifiedBuyer && (
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
                  <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] sm:flex sm:items-center gap-2 sm:gap-3 shrink-0 min-w-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-green-700">{formatEur(isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur)} €</p>
                    <p className="text-[11px] text-muted-foreground">{isTVAC ? "TVAC" : "HTVA"}</p>
                  </div>
                  <div className="flex items-center justify-between border border-border rounded-md bg-background h-10 w-[106px] overflow-hidden shrink-0">
                    <button onClick={() => setStickyQty(Math.max(1, stickyQty - 1))} className="w-8 h-full inline-flex items-center justify-center text-muted-foreground"><Minus size={14} /></button>
                    <span className="flex-1 px-1 text-sm font-medium text-center tabular-nums min-w-0">{stickyQty}</span>
                    <button onClick={() => setStickyQty(Math.min(bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : 999, stickyQty + 1))} className="w-8 h-full inline-flex items-center justify-center text-muted-foreground" disabled={stickyQty >= (bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : 999)}><Plus size={14} /></button>
                  </div>
                  <button
                    className="bg-primary text-primary-foreground text-sm font-semibold px-3 h-10 rounded-md inline-flex items-center justify-center gap-2 shadow-lg hover:bg-primary/90 transition-colors min-w-0 overflow-hidden whitespace-nowrap"
                    onClick={() => {
                      if (!user) {
                        toast.error("Connectez-vous pour ajouter des produits au panier", {
                          action: { label: "Se connecter", onClick: () => navigate("/connexion") },
                        });
                        return;
                      }
                      const stickyMax = bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : 999;
                      const stickyAppliedQty = Math.min(stickyQty, stickyMax);
                      const stickyUnit = isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur;
                      const stickyTotal = stickyAppliedQty * stickyUnit;
                      addToCart.mutate({
                        offerId: bestOffer.id,
                        productId: product.id,
                        quantity: stickyAppliedQty,
                        maxQuantity: bestOffer.stockQuantity > 0 ? bestOffer.stockQuantity : undefined,
                        vendorId: bestOffer.sellerId,
                        priceExclVat: bestOffer.unitPriceEur,
                        productData: { id: product.id, name: product.name, brand: product.brand || "", slug: product.slug, price: bestOffer.unitPriceEur, imageUrl: product.imageUrls?.[0] || product.imageUrl || undefined },
                        deliveryDays: bestOffer.deliveryDays || null,
                      });
                      toast.success("Ajouté au panier", {
                        description: `${product.name} — ${stickyAppliedQty} × ${formatEur(stickyUnit)} € = ${formatEur(stickyTotal)} € ${isTVAC ? "TVAC" : "HTVA"}`,
                      });

                    }}
                  >
                    <ShoppingCart size={14} className="shrink-0" />
                    <span className="hidden sm:inline truncate">Ajouter au panier</span>
                    <span className="sm:hidden truncate">Ajouter</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Price saved popup */}
      <Dialog open={priceSavedPopup} onOpenChange={setPriceSavedPopup}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={32} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Prix sauvegardé !</h3>
              <p className="text-sm text-muted-foreground">
                Retrouvez-le dans votre espace <strong>Mon compte → Mes prix</strong> pour suivre vos économies.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setPriceSavedPopup(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Continuer
              </button>
              <button
                onClick={() => { setPriceSavedPopup(false); navigate("/compte"); }}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Voir mes prix
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
