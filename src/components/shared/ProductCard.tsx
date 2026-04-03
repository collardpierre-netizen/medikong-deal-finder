import { Bell, Plus, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { type Product, formatPrice, productColors, productIconMap } from "@/data/mock";
import { useState } from "react";
import { Package } from "lucide-react";
import { motion } from "framer-motion";

const MEDIKONG_PLACEHOLDER = "/medikong-placeholder.png";

function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url || url.trim() === "") return false;
  if (/no.?image/i.test(url)) return false;
  return true;
}

function getProductImages(product: Product): string[] {
  if (product.imageUrls && product.imageUrls.length > 0) {
    const valid = product.imageUrls.filter(isValidImageUrl);
    if (valid.length > 0) return valid;
  }
  if (isValidImageUrl(product.imageUrl)) return [product.imageUrl!];
  return [MEDIKONG_PLACEHOLDER];
}

function getFallbackImage(): string {
  return MEDIKONG_PLACEHOLDER;
}

export function ProductImage({ product, className = "", selectedIndex = 0 }: { product: Product; className?: string; selectedIndex?: number }) {
  const images = getProductImages(product);
  const imgSrc = images[selectedIndex] || images[0];

  return (
    <div className={`aspect-square rounded-lg relative overflow-hidden bg-muted ${className}`}>
      <img
        src={imgSrc}
        alt={product.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain p-2"
        onError={(e) => {
          if (e.currentTarget.src !== window.location.origin + MEDIKONG_PLACEHOLDER) {
            e.currentTarget.src = MEDIKONG_PLACEHOLDER;
          }
        }}
      />
    </div>
  );
}

export function ProductImageSmall({ product }: { product: Product }) {
  const images = getProductImages(product);
  return (
    <div className="w-12 h-12 rounded overflow-hidden bg-muted">
      <img
        src={images[0]}
        alt={product.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain"
        onError={(e) => {
          if (e.currentTarget.src !== window.location.origin + MEDIKONG_PLACEHOLDER) {
            e.currentTarget.src = MEDIKONG_PLACEHOLDER;
          }
        }}
      />
    </div>
  );
}

export { getProductImages, getFallbackImage };

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [qty, setQty] = useState(1);

  return (
    <motion.div
      className="border border-mk-line rounded-lg p-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -4, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12)" }}
    >
      <div className="relative mb-3">
        {/* Discount badge masqué — à réactiver quand basé sur un vrai prix de référence */}
        <button className="absolute top-2 right-2 w-7 h-7 rounded-full border border-mk-line bg-white flex items-center justify-center hover:border-mk-blue z-10 transition-colors" aria-label="Alerte prix">
          <Bell size={13} className="text-mk-sec" />
        </button>
        <Link to={`/produit/${product.slug}`}>
          <ProductImage product={product} />
        </Link>
      </div>
      <Link to={`/produit/${product.slug}`}>
        <p className="text-xs text-mk-sec mb-0.5">{product.brand}</p>
        <h3 className="text-sm font-medium text-mk-text leading-snug mb-2 line-clamp-2">{product.name}</h3>
      </Link>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-bold text-mk-navy">{formatPrice(product.price)} EUR</span>
        <span className="text-xs text-mk-ter line-through">{formatPrice(product.pub)} EUR</span>
      </div>
      <p className="text-xs text-mk-green mb-3">{product.sellers} vendeur{product.sellers > 1 ? "s" : ""} {product.mk && "· MediKong"}</p>
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-mk-line rounded-md">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2 py-1.5 text-mk-sec hover:text-mk-text" aria-label="Diminuer quantité">
            <Minus size={14} />
          </button>
          <span className="px-2 text-sm font-medium">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="px-2 py-1.5 text-mk-sec hover:text-mk-text" aria-label="Augmenter quantité">
            <Plus size={14} />
          </button>
        </div>
        <motion.button
          className="flex-1 bg-mk-blue text-white text-sm font-semibold py-1.5 rounded-md"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Ajouter
        </motion.button>
      </div>
    </motion.div>
  );
}
