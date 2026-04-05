import { Heart, ShoppingCart, Package } from "lucide-react";
import { getProductImageSrc, MEDIKONG_PLACEHOLDER } from "@/lib/image-utils";
import { useNavigate, useLocation } from "react-router-dom";
import { formatPrice } from "@/data/mock";
import type { Product } from "@/hooks/useProducts";

interface Props {
  products: Product[];
}

export default function SearchGridView({ products }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = { state: { from: location.pathname + location.search } };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((p) => {
        const price = p.price;
        const pub = p.pub;
        const pct = p.pct;

        return (
          <div
            key={p.id}
            onClick={() => navigate(`/produit/${p.slug}`, fromState)}
            className="bg-card border border-border rounded-xl overflow-hidden relative cursor-pointer
                       hover:shadow-md transition-shadow group"
          >
            {/* Discount badge */}
            {pct > 0 && (
              <span className="absolute top-2 left-2 z-10 bg-destructive text-destructive-foreground
                             text-[10px] font-bold px-2 py-0.5 rounded">
                -{pct}%
              </span>
            )}

            {/* Image */}
            <div className="aspect-square bg-muted flex items-center justify-center p-4">
              <img
                  src={getProductImageSrc(p.imageUrls?.[0] || p.imageUrl)}
                  alt={p.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                  onError={e => { e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
                />
            </div>

            {/* Info */}
            <div className="p-3 space-y-1.5">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                {p.brand}
              </p>
              <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                {p.name}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-foreground">
                  {price.toFixed(2)} €
                </span>
                {pub > price && (
                  <span className="text-xs text-muted-foreground line-through">
                    {pub.toFixed(2)} €
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {p.sellers} vendeur{p.sellers !== 1 ? "s" : ""} · dès {price.toFixed(2)} €
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
