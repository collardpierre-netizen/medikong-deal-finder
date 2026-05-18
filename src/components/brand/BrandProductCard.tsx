import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, Minus, Plus, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useCountry } from "@/contexts/CountryContext";
import { formatPrice } from "@/data/mock";
import { getLocalizedName } from "@/lib/localization";
import {
  MEDIKONG_PLACEHOLDER,
  getProductImageSrc,
  isQogitaPlaceholder,
} from "@/lib/image-utils";
import { PvpEconomyBadge } from "@/components/product/PvpEconomyBadge";

/**
 * Données minimales attendues par la carte produit utilisée sur la fiche
 * marque. Compatible avec `CatalogProduct` mais volontairement narrow pour
 * pouvoir être alimentée par d'autres sources (ex. bestsellers d'une marque).
 */
export interface BrandProductCardItem {
  id: string;
  slug: string;
  name: string;
  name_fr?: string | null;
  name_nl?: string | null;
  name_de?: string | null;
  brand_name?: string | null;
  gtin?: string | null;
  cnk_code?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  short_description?: string | null;
  is_promotion?: boolean | null;
  promotion_label?: string | null;
  best_price_excl_vat?: number | null;
  best_price_incl_vat?: number | null;
  offer_count?: number | null;
  total_stock?: number | null;
  is_in_stock?: boolean | null;
  /** Délai de livraison moyen indicatif en jours (facultatif). */
  avg_delivery_days?: number | null;
}

interface Props {
  product: BrandProductCardItem;
  index?: number;
  /** Affiche le bandeau marque (utile en page de test, masqué sur fiche marque). */
  showBrand?: boolean;
}

function ProductImg({ product, className = "" }: { product: BrandProductCardItem; className?: string }) {
  const src = getProductImageSrc(product.image_urls?.[0] || product.image_url);
  if (src !== MEDIKONG_PLACEHOLDER) {
    return (
      <div className={`bg-muted rounded-lg overflow-hidden ${className}`}>
        <img
          src={src}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain p-2"
          onLoad={(e) => {
            if (isQogitaPlaceholder(e.currentTarget)) e.currentTarget.src = MEDIKONG_PLACEHOLDER;
          }}
          onError={(e) => {
            e.currentTarget.src = MEDIKONG_PLACEHOLDER;
          }}
        />
      </div>
    );
  }
  return (
    <div className={`bg-muted rounded-lg overflow-hidden ${className}`}>
      <img src={MEDIKONG_PLACEHOLDER} alt="Produit" className="w-full h-full object-contain p-4" />
    </div>
  );
}

function StockLine({ product }: { product: BrandProductCardItem }) {
  const { t } = useTranslation();
  const stock = Number(product.total_stock ?? 0);
  if (product.is_in_stock && stock > 10) {
    return <span className="text-xs text-mk-green font-medium">● {t("catalog.inStock")}</span>;
  }
  if (product.is_in_stock && stock > 0) {
    return (
      <span className="text-xs text-mk-amber font-medium">
        ● {t("catalog.limitedStock", { count: stock })}
      </span>
    );
  }
  return <span className="text-xs text-destructive font-medium">● {t("catalog.outOfStock")}</span>;
}

/**
 * BrandProductCard — variante de carte produit dédiée à la fiche marque.
 *
 * Différences vs `CatalogProductCard` :
 *   - Le nom de marque est masqué par défaut (on est déjà sur la fiche marque).
 *   - EAN + CNK affichés explicitement (les pros recherchent ces ID).
 *   - Délai moyen affiché si fourni (préfixé `~` pour signaler la moyenne).
 *   - Intègre `PvpEconomyBadge` inline (cascade officielle → vendeur).
 *   - Gating prix identique : non connecté → CTA onboarding, connecté non vérifié → message d'attente.
 */
export function BrandProductCard({ product, index = 0, showBrand = false }: Props) {
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const { addToCart } = useCart();
  const { user, isVerifiedBuyer, verificationLoading } = useAuth();
  const { country } = useCountry();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const fromState = { from: location.pathname + location.search };
  const price = product.best_price_excl_vat || 0;
  const priceIncl = product.best_price_incl_vat || 0;
  const offerCount = Number(product.offer_count ?? 0);
  const isLoggedIn = !!user;
  const canSeePrices = isLoggedIn && (isVerifiedBuyer || verificationLoading);
  const displayName = getLocalizedName(product as any, i18n.language);

  const handleAddToCart = async () => {
    if (offerCount > 1) {
      navigate(`/produit/${product.slug}`);
      return;
    }
    if (!user) {
      toast.error(t("catalog.loginToAdd"), {
        action: { label: t("catalog.signIn"), onClick: () => navigate("/connexion") },
      });
      return;
    }
    if (!isVerifiedBuyer) {
      toast.error(t("catalog.pendingValidation", "Votre compte est en attente de validation"));
      return;
    }
    if (offerCount === 0) return;

    setAdding(true);
    try {
      const { data: offer } = await supabase
        .from("offers")
        .select("id, vendor_id, price_excl_vat, price_incl_vat, stock_quantity")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .eq("country_code", country)
        .order("price_excl_vat", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!offer) return;

      addToCart.mutate({
        offerId: offer.id,
        productId: product.id,
        quantity: Math.min(qty, Number(offer.stock_quantity) || qty),
        maxQuantity: Number(offer.stock_quantity) || undefined,
        vendorId: offer.vendor_id,
        priceExclVat: Number(offer.price_excl_vat),
        priceInclVat: Number(offer.price_incl_vat),
        productData: {
          id: product.id,
          name: product.name,
          brand: product.brand_name || "",
          slug: product.slug,
          price: Number(offer.price_excl_vat),
          imageUrl: product.image_urls?.[0] || product.image_url || undefined,
        },
      });
    } finally {
      setAdding(false);
      setQty(1);
    }
  };

  const addButton = (
    <button
      onClick={handleAddToCart}
      disabled={adding || offerCount === 0}
      className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
    >
      {adding ? <Loader2 size={14} className="animate-spin" /> : null}
      {offerCount > 1 ? t("catalog.viewOffers") : t("catalog.add")}
    </button>
  );

  const hasDelivery = product.avg_delivery_days != null && Number(product.avg_delivery_days) > 0;

  return (
    <motion.div
      className="border border-border rounded-lg p-3 bg-card hover:shadow-lg transition-shadow flex flex-col"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <div className="relative mb-2">
        {product.is_promotion && (
          <span className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
            {product.promotion_label || t("catalog.promo")}
          </span>
        )}
        <Link to={`/produit/${product.slug}`} state={fromState}>
          <ProductImg product={product} className="aspect-square" />
        </Link>
      </div>

      <Link to={`/produit/${product.slug}`} state={fromState} className="flex-1">
        {showBrand && product.brand_name && (
          <p className="text-xs text-muted-foreground mb-0.5 truncate">{product.brand_name}</p>
        )}
        <h3 className="text-sm font-medium text-foreground leading-snug mb-1.5 line-clamp-2 min-h-[2.5rem]">
          {displayName}
        </h3>
        <div className="text-[10px] text-muted-foreground space-y-0.5 mb-2">
          {product.gtin && <p className="truncate">EAN&nbsp;: {product.gtin}</p>}
          {product.cnk_code && <p className="truncate">CNK&nbsp;: {product.cnk_code}</p>}
        </div>
      </Link>

      {canSeePrices ? (
        <>
          {price > 0 ? (
            <>
              <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
                <span className="text-base font-bold text-primary">{formatPrice(price)} €</span>
                {priceIncl > price && (
                  <span className="text-[11px] text-muted-foreground">{formatPrice(priceIncl)} € TTC</span>
                )}
                <PvpEconomyBadge
                  productId={product.id}
                  buyerPriceTtc={priceIncl > 0 ? priceIncl : price * 1.21}
                  variant="inline"
                />
              </div>
              <div className="flex items-center justify-between mb-1 gap-2">
                <StockLine product={product} />
                <span className="text-xs text-muted-foreground">
                  {offerCount > 1
                    ? t("catalog.offersPlural", { count: offerCount })
                    : t("catalog.offers", { count: offerCount })}
                </span>
              </div>
              {hasDelivery && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
                  <Truck size={11} />
                  <span>~{Math.round(Number(product.avg_delivery_days))} j</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {offerCount <= 1 && (
                  <div className="flex items-center border border-border rounded-md">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="px-1.5 py-1 text-muted-foreground hover:text-foreground"
                      aria-label="Diminuer la quantité"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-1.5 text-xs font-medium min-w-[1.5rem] text-center">{qty}</span>
                    <button
                      onClick={() => setQty(qty + 1)}
                      className="px-1.5 py-1 text-muted-foreground hover:text-foreground"
                      aria-label="Augmenter la quantité"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
                {addButton}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              {t("catalog.noOfferYet", "Pas encore d'offre")}
            </p>
          )}
        </>
      ) : isLoggedIn ? (
        <div className="text-center py-2">
          <p className="text-xs text-warning font-medium">
            {t("catalog.pendingValidation", "Compte en attente de validation")}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {t("catalog.pendingValidationDesc", "Les prix seront visibles après validation")}
          </p>
        </div>
      ) : (
        <Link
          to="/onboarding"
          className="w-full bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
        >
          <Lock size={12} /> {t("catalog.seePrices")}
        </Link>
      )}
    </motion.div>
  );
}
