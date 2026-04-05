import { useState } from "react";
import { getProductImageSrc, MEDIKONG_PLACEHOLDER, isQogitaPlaceholder } from "@/lib/image-utils";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Plus, Minus, Package, Loader2, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { formatPrice } from "@/data/mock";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getLocalizedName } from "@/lib/localization";
import type { CatalogProduct } from "@/hooks/useCatalog";

interface Props {
  product: CatalogProduct;
  index?: number;
  view?: "grid" | "list";
}

function ProductImg({ product, className = "" }: { product: CatalogProduct; className?: string }) {
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
          onLoad={e => { if (isQogitaPlaceholder(e.currentTarget)) e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
          onError={e => { e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
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

function StockBadge({ product }: { product: CatalogProduct }) {
  const { t } = useTranslation();
  if (product.is_in_stock && product.total_stock > 10) {
    return <span className="text-xs text-mk-green font-medium">● {t("catalog.inStock")}</span>;
  }
  if (product.is_in_stock && product.total_stock > 0) {
    return <span className="text-xs text-mk-amber font-medium">● {t("catalog.limitedStock", { count: product.total_stock })}</span>;
  }
  return <span className="text-xs text-destructive font-medium">● {t("catalog.outOfStock")}</span>;
}

export function CatalogProductCard({ product, index = 0, view = "grid" }: Props) {
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { country } = useCountry();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  const price = product.best_price_excl_vat || 0;
  const priceIncl = product.best_price_incl_vat || 0;
  const isLoggedIn = !!user;

  const handleAddToCart = async () => {
    // If multiple offers, open product page to let user choose
    if (product.offer_count > 1) {
      navigate(`/produit/${product.slug}`);
      return;
    }

    // Auth check
    if (!user) {
      toast.error("Connectez-vous pour ajouter des produits au panier", {
        action: { label: "Se connecter", onClick: () => navigate("/connexion") },
      });
      return;
    }

    // Single offer (or 0) — fetch the offer and add to cart
    if (product.offer_count === 0) return;

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
      disabled={adding || product.offer_count === 0}
      className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
    >
      {adding ? <Loader2 size={14} className="animate-spin" /> : null}
      {product.offer_count > 1 ? "Voir offres" : "Ajouter"}
    </button>
  );

  if (view === "list") {
    return (
      <motion.div
        className="flex items-center gap-4 p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02, duration: 0.25 }}
      >
        <Link to={`/produit/${product.slug}`} state={fromState} className="shrink-0">
          <ProductImg product={product} className="w-[100px] h-[100px] aspect-square" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/produit/${product.slug}`} state={fromState}>
            <p className="text-xs text-muted-foreground mb-0.5">{product.brand_name}</p>
            <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1">{product.name}</h3>
          </Link>
          {product.short_description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{product.short_description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">EAN: {product.gtin || "—"}</p>
          <StockBadge product={product} />
        </div>
        <div className="text-right shrink-0 space-y-1">
          {isLoggedIn ? (
            <>
              <p className="text-lg font-bold text-primary">{formatPrice(price)} €</p>
              {priceIncl > price && (
                <p className="text-xs text-muted-foreground">{formatPrice(priceIncl)} € TTC</p>
              )}
              <p className="text-xs text-muted-foreground">{product.offer_count} offre{product.offer_count > 1 ? "s" : ""}</p>
              <div className="flex items-center gap-1 mt-2">
                {product.offer_count <= 1 && (
                  <div className="flex items-center border border-border rounded-md">
                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Minus size={12} /></button>
                    <span className="px-1.5 text-xs font-medium">{qty}</span>
                    <button onClick={() => setQty(qty + 1)} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Plus size={12} /></button>
                  </div>
                )}
                {addButton}
              </div>
            </>
          ) : (
            <Link to="/onboarding" className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-md hover:opacity-90 transition-opacity">
              <Lock size={12} /> Voir les prix
            </Link>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="border border-border rounded-lg p-3 bg-card hover:shadow-lg transition-shadow"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <div className="relative mb-2">
        {product.is_promotion && (
          <span className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
            {product.promotion_label || "Promo"}
          </span>
        )}
        <Link to={`/produit/${product.slug}`} state={fromState}>
          <ProductImg product={product} className="aspect-square" />
        </Link>
      </div>
      <Link to={`/produit/${product.slug}`} state={fromState}>
        <p className="text-xs text-muted-foreground mb-0.5 truncate">{product.brand_name || "—"}</p>
        <h3 className="text-sm font-medium text-foreground leading-snug mb-1.5 line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
      </Link>
      {isLoggedIn ? (
        <>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-base font-bold text-primary">{formatPrice(price)} €</span>
            {priceIncl > price && (
              <span className="text-[11px] text-muted-foreground">{formatPrice(priceIncl)} € TTC</span>
            )}
          </div>
          <div className="flex items-center justify-between mb-2">
            <StockBadge product={product} />
            <span className="text-xs text-muted-foreground">{product.offer_count} offre{product.offer_count > 1 ? "s" : ""}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2 truncate">EAN: {product.gtin || "—"}</p>
          <div className="flex items-center gap-1.5">
            {product.offer_count <= 1 && (
              <div className="flex items-center border border-border rounded-md">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Minus size={12} /></button>
                <span className="px-1.5 text-xs font-medium min-w-[1.5rem] text-center">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Plus size={12} /></button>
              </div>
            )}
            {addButton}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <StockBadge product={product} />
            <span className="text-xs text-muted-foreground">{product.offer_count} offre{product.offer_count > 1 ? "s" : ""}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2 truncate">EAN: {product.gtin || "—"}</p>
          <Link to="/onboarding" className="w-full bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
            <Lock size={12} /> Voir les prix
          </Link>
        </>
      )}
    </motion.div>
  );
}
