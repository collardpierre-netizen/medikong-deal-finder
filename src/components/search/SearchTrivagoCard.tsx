import { useState } from "react";
import { Heart, Check, ChevronDown, ChevronUp, Package, Truck, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProductOffers } from "@/hooks/useProducts";
import type { Product } from "@/hooks/useProducts";

interface Props {
  product: Product;
}

export default function SearchTrivagoCard({ product: p }: Props) {
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const { data: offers = [] } = useProductOffers(p.id);

  const bestOffer = offers[0];
  const otherOffers = offers.slice(1);
  const visibleOffers = otherOffers.slice(0, 2);
  const hiddenOffers = otherOffers.slice(2);

  const price = bestOffer?.unitPriceEur || p.price;
  const pct = p.pct;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Main 3-zone row */}
      <div className="flex flex-col md:flex-row">
        {/* ZONE 1 — Image */}
        <div
          onClick={() => navigate(`/produit/${p.slug}`)}
          className="w-full md:w-[200px] bg-muted flex items-center justify-center relative shrink-0 cursor-pointer
                     aspect-square md:aspect-auto min-h-[180px]"
        >
          {pct > 0 && (
            <span className="absolute top-2.5 left-2.5 bg-destructive text-destructive-foreground
                           text-[10px] font-bold px-2 py-0.5 rounded z-10">
              -{pct}%
            </span>
          )}
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-4"
                 loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <Package size={48} className="text-muted-foreground" />
          )}
        </div>

        {/* ZONE 2 — Product info */}
        <div
          onClick={() => navigate(`/produit/${p.slug}`)}
          className="flex-1 p-4 flex flex-col justify-center border-t md:border-t-0 md:border-l md:border-r
                     border-border cursor-pointer"
        >
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
            {p.brand}
          </p>
          <p className="text-base font-bold text-foreground mt-1 line-clamp-2">{p.name}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
            {p.cnk && <span>CNK {p.cnk}</span>}
            {p.cnk && p.ean && <span>·</span>}
            {p.ean && <span>EAN {p.ean}</span>}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {p.stock && (
              <span className="text-[11px] px-2 py-0.5 bg-mk-deal text-mk-green rounded font-medium">
                En stock
              </span>
            )}
            {p.mk && (
              <span className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
                MediKong
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {offers.length || p.sellers} offre{(offers.length || p.sellers) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ZONE 3 — Best deal panel */}
        <div className="w-full md:w-[240px] p-4 flex flex-col justify-between border-t md:border-t-0
                       bg-muted/30 shrink-0">
          <div>
            <p className="text-xs text-muted-foreground font-medium">
              {bestOffer?.sellerName || "Meilleur prix"}
            </p>
            {bestOffer && (
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Truck size={10} /> {bestOffer.deliveryDays}j</span>
                <span className="flex items-center gap-1"><RotateCcw size={10} /> Retour 30j</span>
              </div>
            )}
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-foreground">{price.toFixed(2)} €</span>
              {pct > 0 && (
                <span className="text-[11px] font-bold text-mk-green">-{pct}%</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">HTVA</p>
            <button
              onClick={() => navigate(`/produit/${p.slug}`)}
              className="w-full mt-3 py-2 text-primary-foreground text-[13px] font-bold rounded-md
                        transition-colors bg-mk-green hover:bg-mk-green/90"
            >
              Voir l'offre
            </button>
          </div>
        </div>
      </div>

      {/* Other offers */}
      {otherOffers.length > 0 && (
        <div className="border-t border-border">
          {visibleOffers.map((offer) => (
            <div key={offer.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{offer.sellerName}</span>
                {offer.isVerified && (
                  <span className="flex items-center gap-0.5 text-[10px] text-mk-green">
                    <Check size={10} /> Vérifié
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-foreground">{offer.unitPriceEur.toFixed(2)} €</span>
                <button
                  onClick={() => navigate(`/produit/${p.slug}`)}
                  className="px-3.5 py-1 border border-primary text-primary text-[11px] font-bold
                            rounded-md hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Voir
                </button>
              </div>
            </div>
          ))}

          {hiddenOffers.length > 0 && (
            <div className="px-4 py-2">
              <button
                onClick={() => setShowMore(!showMore)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground
                          hover:text-foreground transition-colors"
              >
                {showMore ? "Moins d'offres" : `+ ${hiddenOffers.length} autre${hiddenOffers.length > 1 ? "s" : ""} offre${hiddenOffers.length > 1 ? "s" : ""}`}
                {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showMore && (
                <div className="mt-2 space-y-0">
                  {hiddenOffers.map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between py-2 border-t border-border">
                      <span className="text-sm text-foreground">{offer.sellerName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">{offer.unitPriceEur.toFixed(2)} €</span>
                        <button
                          onClick={() => navigate(`/produit/${p.slug}`)}
                          className="px-3.5 py-1 border border-primary text-primary text-[11px] font-bold
                                    rounded-md hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          Voir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
