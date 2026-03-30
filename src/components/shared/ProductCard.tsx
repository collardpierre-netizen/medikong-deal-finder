import { Bell, Plus, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { type Product, formatPrice, productColors, productIconMap } from "@/data/mock";
import { useState } from "react";
import { Package } from "lucide-react";
import { motion } from "framer-motion";

// Unsplash fallback images by keyword in product name / category
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&h=400&fit=crop", // medical gloves
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop", // medical supplies
  "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400&h=400&fit=crop", // bandages
  "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400&h=400&fit=crop", // sanitizer
  "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=400&fit=crop", // mask
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=400&fit=crop", // medical equipment
];

function getFallbackImage(product: Product): string {
  // Deterministic fallback based on product name hash
  const hash = product.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length];
}

function hasRealImages(product: Product): boolean {
  return !!(product.imageUrls && product.imageUrls.length > 0) || !!product.imageUrl;
}

function getProductImages(product: Product): string[] {
  if (product.imageUrls && product.imageUrls.length > 0) return product.imageUrls;
  if (product.imageUrl) return [product.imageUrl];
  return [getFallbackImage(product)];
}

export function ProductImage({ product, className = "", selectedIndex = 0 }: { product: Product; className?: string; selectedIndex?: number }) {
  const images = getProductImages(product);
  const imgSrc = images[selectedIndex] || images[0];
  const colorKey = product.color || "blue";
  const colors = productColors[colorKey] || productColors.blue;
  const IconComponent = product.iconName ? productIconMap[product.iconName] : Package;
  const FinalIcon = IconComponent || Package;

  // Show real image
  if (imgSrc) {
    return (
      <div className={`aspect-square rounded-lg relative overflow-hidden bg-muted ${className}`}>
        <img
          src={imgSrc}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-contain p-2"
          onError={(e) => {
            // On error, show the icon fallback
            const target = e.currentTarget;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              parent.style.backgroundColor = colors.bg;
              const fallback = document.createElement("div");
              fallback.className = "absolute inset-0 flex flex-col items-center justify-center gap-2";
              fallback.innerHTML = `<span class="text-[10px] font-bold tracking-wider uppercase opacity-60">${product.brand}</span>`;
              parent.appendChild(fallback);
            }
          }}
        />
      </div>
    );
  }

  // Icon fallback (should rarely happen now)
  return (
    <div
      className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-2 relative overflow-hidden ${className}`}
      style={{ backgroundColor: colors.bg }}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20" style={{ backgroundColor: colors.fg }} />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-10" style={{ backgroundColor: colors.fg }} />
      <FinalIcon size={36} style={{ color: colors.fg }} />
      <span className="text-[10px] font-bold tracking-wider uppercase opacity-60" style={{ color: colors.fg }}>{product.brand}</span>
    </div>
  );
}

export function ProductImageSmall({ product }: { product: Product }) {
  const images = getProductImages(product);
  if (images[0]) {
    return (
      <div className="w-12 h-12 rounded overflow-hidden bg-muted">
        <img src={images[0]} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
      </div>
    );
  }
  const colorKey = product.color || "blue";
  const colors = productColors[colorKey] || productColors.blue;
  const IconComponent = product.iconName ? productIconMap[product.iconName] : Package;
  const FinalIcon = IconComponent || Package;
  return (
    <div className="w-12 h-12 rounded flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
      <FinalIcon size={18} style={{ color: colors.fg }} />
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
        {product.pct > 0 && (
          <span className="absolute top-2 left-2 bg-mk-red text-white text-[11px] font-bold px-2 py-0.5 rounded z-10">
            {product.pct}%
          </span>
        )}
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
