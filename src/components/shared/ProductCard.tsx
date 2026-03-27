import { Bell, Plus, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { type Product, formatPrice } from "@/data/mock";
import { useState } from "react";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [qty, setQty] = useState(1);

  return (
    <div
      className="border border-mk-line rounded-lg p-4 hover:shadow-md transition-shadow animate-fadeInUp"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative mb-3">
        <span className="absolute top-2 left-2 bg-mk-red text-white text-[11px] font-bold px-2 py-0.5 rounded">
          {product.pct}%
        </span>
        <button className="absolute top-2 right-2 w-7 h-7 rounded-full border border-mk-line bg-white flex items-center justify-center hover:border-mk-blue">
          <Bell size={13} className="text-mk-sec" />
        </button>
        <Link to={`/produit/${product.slug}`}>
          <div className="aspect-square bg-mk-alt rounded-lg flex items-center justify-center">
            <span className="text-mk-ter text-xs">Image produit</span>
          </div>
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
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2 py-1.5 text-mk-sec hover:text-mk-text">
            <Minus size={14} />
          </button>
          <span className="px-2 text-sm font-medium">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="px-2 py-1.5 text-mk-sec hover:text-mk-text">
            <Plus size={14} />
          </button>
        </div>
        <button className="flex-1 bg-mk-blue text-white text-sm font-semibold py-1.5 rounded-md hover:opacity-90 transition-opacity">
          Ajouter
        </button>
      </div>
    </div>
  );
}
