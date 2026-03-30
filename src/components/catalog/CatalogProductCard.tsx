import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Minus, Package } from "lucide-react";
import { motion } from "framer-motion";
import { formatPrice } from "@/data/mock";
import type { CatalogProduct } from "@/hooks/useCatalog";

interface Props {
  product: CatalogProduct;
  index?: number;
  view?: "grid" | "list";
}

function ProductImg({ product, className = "" }: { product: CatalogProduct; className?: string }) {
  const src = product.image_urls?.[0];
  if (src) {
    return (
      <div className={`bg-muted rounded-lg overflow-hidden ${className}`}>
        <img
          src={src}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
      </div>
    );
  }
  return (
    <div className={`bg-muted rounded-lg flex items-center justify-center ${className}`}>
      <Package size={32} className="text-muted-foreground" />
    </div>
  );
}

function StockBadge({ product }: { product: CatalogProduct }) {
  if (product.is_in_stock && product.total_stock > 10) {
    return <span className="text-xs text-mk-green font-medium">● En stock</span>;
  }
  if (product.is_in_stock && product.total_stock > 0) {
    return <span className="text-xs text-mk-amber font-medium">● Stock limité ({product.total_stock})</span>;
  }
  return <span className="text-xs text-destructive font-medium">● Rupture</span>;
}

export function CatalogProductCard({ product, index = 0, view = "grid" }: Props) {
  const [qty, setQty] = useState(1);
  const price = product.best_price_excl_vat || 0;
  const priceIncl = product.best_price_incl_vat || 0;

  if (view === "list") {
    return (
      <motion.div
        className="flex items-center gap-4 p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02, duration: 0.25 }}
      >
        <Link to={`/produit/${product.slug}`} className="shrink-0">
          <ProductImg product={product} className="w-[100px] h-[100px] aspect-square" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/produit/${product.slug}`}>
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
          <p className="text-lg font-bold text-primary">{formatPrice(price)} €</p>
          {priceIncl > price && (
            <p className="text-xs text-muted-foreground">{formatPrice(priceIncl)} € TTC</p>
          )}
          <p className="text-xs text-muted-foreground">{product.offer_count} offre{product.offer_count > 1 ? "s" : ""}</p>
          <div className="flex items-center gap-1 mt-2">
            <div className="flex items-center border border-border rounded-md">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Minus size={12} /></button>
              <span className="px-1.5 text-xs font-medium">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Plus size={12} /></button>
            </div>
            <button className="bg-primary text-primary-foreground text-xs font-semibold py-1.5 px-3 rounded-md hover:opacity-90 transition-opacity">
              Ajouter
            </button>
          </div>
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
        <Link to={`/produit/${product.slug}`}>
          <ProductImg product={product} className="aspect-square" />
        </Link>
      </div>
      <Link to={`/produit/${product.slug}`}>
        <p className="text-xs text-muted-foreground mb-0.5 truncate">{product.brand_name || "—"}</p>
        <h3 className="text-sm font-medium text-foreground leading-snug mb-1.5 line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
      </Link>
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
        <div className="flex items-center border border-border rounded-md">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Minus size={12} /></button>
          <span className="px-1.5 text-xs font-medium min-w-[1.5rem] text-center">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="px-1.5 py-1 text-muted-foreground hover:text-foreground"><Plus size={12} /></button>
        </div>
        <button className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded-md hover:opacity-90 transition-opacity">
          Ajouter
        </button>
      </div>
    </motion.div>
  );
}
