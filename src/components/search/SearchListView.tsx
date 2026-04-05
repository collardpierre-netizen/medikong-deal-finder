import { Package, ShoppingCart } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { MEDIKONG_PLACEHOLDER, isQogitaPlaceholder } from "@/lib/image-utils";
import type { Product } from "@/hooks/useProducts";

interface Props {
  products: Product[];
}

export default function SearchListView({ products }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = { state: { from: location.pathname + location.search } };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[48px_1fr_100px_100px_120px_80px_80px_100px] gap-3 px-4 py-2.5
                      bg-muted text-xs font-semibold text-muted-foreground border-b border-border">
        <span />
        <span>Produit</span>
        <span>CNK</span>
        <span>Marque</span>
        <span>Prix HTVA</span>
        <span>Offres</span>
        <span>Stock</span>
        <span>Action</span>
      </div>

      {products.map((p) => {
        const price = p.price;
        const pct = p.pct;

        return (
          <div
            key={p.id}
            onClick={() => navigate(`/produit/${p.slug}`, fromState)}
            className="grid grid-cols-[48px_1fr] md:grid-cols-[48px_1fr_100px_100px_120px_80px_80px_100px]
                       gap-3 px-4 py-3 border-b border-border last:border-b-0
                       hover:bg-muted/50 cursor-pointer transition-colors items-center"
          >
            {/* Thumb */}
            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center shrink-0">
              <img src={p.imageUrls?.[0] || p.imageUrl || "/medikong-placeholder.png"} alt={p.name} className="w-full h-full object-contain p-1" loading="lazy"
                   referrerPolicy="no-referrer"
                   onError={e => { e.currentTarget.src = "/medikong-placeholder.png"; }} />
            </div>

            {/* Name */}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground md:hidden">{p.brand} · {price.toFixed(2)} €</p>
            </div>

            {/* CNK */}
            <span className="hidden md:block text-xs text-muted-foreground">{p.cnk || "—"}</span>

            {/* Brand */}
            <span className="hidden md:block text-xs text-muted-foreground">{p.brand}</span>

            {/* Price */}
            <div className="hidden md:block">
              <p className="text-sm font-bold text-foreground">{price.toFixed(2)} €</p>
              {pct > 0 && (
                <span className="text-[10px] font-semibold text-mk-green">-{pct}%</span>
              )}
            </div>

            {/* Offers */}
            <span className="hidden md:block text-xs font-semibold text-foreground text-center">
              {p.sellers}
            </span>

            {/* Stock */}
            <span className="hidden md:block">
              {p.stock ? (
                <span className="text-[11px] text-mk-green font-medium">En stock</span>
              ) : (
                <span className="text-[11px] text-destructive font-medium">Rupture</span>
              )}
            </span>

            {/* Action */}
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/produit/${p.slug}`, fromState); }}
              className="hidden md:flex items-center justify-center gap-1 px-3 py-1.5
                         bg-primary text-primary-foreground text-[11px] font-bold rounded-md"
            >
              <ShoppingCart size={12} /> Voir
            </button>
          </div>
        );
      })}
    </div>
  );
}
