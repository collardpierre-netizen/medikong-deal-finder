import { useState } from "react";
import { getProductImageSrc, MEDIKONG_PLACEHOLDER } from "@/lib/image-utils";
import { Heart, Check, ChevronDown, ChevronUp, Package, Truck, RotateCcw, ArrowRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProductOffers } from "@/hooks/useProducts";
import type { Product } from "@/hooks/useProducts";

interface Props {
  product: Product;
}

export default function SearchTrivagoCard({ product: p }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = { state: { from: location.pathname + location.search } };
  const [showMore, setShowMore] = useState(false);
  const { data: offers = [] } = useProductOffers(p.id);

  const bestOffer = offers[0];
  const otherOffers = offers.slice(1);
  const visibleOffers = otherOffers.slice(0, 2);
  const hiddenOffers = otherOffers.slice(2);

  const price = bestOffer?.unitPriceEur || p.price;
  const pct = p.pct;

  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-border">
      {/* Main 3-zone row */}
      <div className="flex flex-col md:flex-row">
        {/* ZONE 1 — Image */}
        <div
          onClick={() => navigate(`/produit/${p.slug}`, fromState)}
          className="w-full md:w-[190px] bg-white flex items-center justify-center relative shrink-0 cursor-pointer
                     aspect-square md:aspect-auto min-h-[170px] border-b md:border-b-0 md:border-r border-border"
        >
          {pct > 0 && (
            <span className="absolute top-2.5 left-2.5 bg-destructive text-destructive-foreground
                           text-[10px] font-bold px-2 py-0.5 rounded z-10">
              -{pct}%
            </span>
          )}
          <button className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/80 backdrop-blur flex items-center justify-center hover:bg-white transition-colors z-10 border border-border/50">
            <Heart size={14} className="text-muted-foreground" />
          </button>
          <img src={getProductImageSrc(p.imageUrls?.[0] || p.imageUrl)} alt={p.name} className="w-full h-full object-contain p-4"
               loading="lazy" referrerPolicy="no-referrer"
               onError={e => { e.currentTarget.src = MEDIKONG_PLACEHOLDER; }} />
        </div>

        {/* ZONE 2 — Product info */}
        <div
          onClick={() => navigate(`/produit/${p.slug}`, fromState)}
          className="flex-1 p-4 flex flex-col justify-center cursor-pointer"
        >
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            {p.brand}
          </p>
          <p className="text-[15px] font-bold text-foreground mt-1.5 line-clamp-2 leading-snug">{p.name}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground flex-wrap">
            {p.ean && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">EAN {p.ean}</span>}
            {p.cnk && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">CNK {p.cnk}</span>}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {p.stock && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                En stock
              </span>
            )}
            {p.mk && (
              <span className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-semibold border border-primary/20">
                MediKong
              </span>
            )}
            <span className="text-[11px] text-muted-foreground font-medium">
              {offers.length || p.sellers} offre{(offers.length || p.sellers) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ZONE 3 — Best deal panel — high contrast like Trivago */}
        <div className="w-full md:w-[250px] shrink-0 border-t md:border-t-0 md:border-l border-border
                       bg-emerald-50 p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800">
              {bestOffer?.sellerName || "Meilleur prix"}
            </p>
            {bestOffer && (
              <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                <Check size={10} className="text-emerald-500" />
                Réservez au meilleur prix
              </p>
            )}
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-foreground tracking-tight">{price.toFixed(2)}&nbsp;€</span>
            {pct > 0 && (
              <span className="ml-2 text-xs font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">-{pct}%</span>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">HTVA</p>
            {bestOffer && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Truck size={10} /> {bestOffer.deliveryDays}j</span>
                <span className="flex items-center gap-1"><RotateCcw size={10} /> Retour 30j</span>
              </div>
            )}
            <button
              onClick={() => navigate(`/produit/${p.slug}`, fromState)}
              className="w-full mt-3 py-2.5 text-white text-[13px] font-bold rounded-lg
                        transition-all bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center gap-2 shadow-sm"
            >
              Voir l'offre <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Secondary offers */}
      {otherOffers.length > 0 && (
        <div className="border-t border-border bg-muted/30">
          {visibleOffers.map((offer) => (
            <div key={offer.id} className="flex items-center justify-between px-5 py-2.5 border-b border-border/60 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{offer.sellerName}</span>
                {offer.isVerified && (
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                    <Check size={10} /> Vérifié
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {price > 0 && offer.unitPriceEur > price && (
                  <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                    +{(offer.unitPriceEur - price).toFixed(2)}&nbsp;€ (+{((offer.unitPriceEur - price) / price * 100).toFixed(1)}%)
                  </span>
                )}
                <span className="text-sm font-bold text-foreground">{offer.unitPriceEur.toFixed(2)} €</span>
                <button
                  onClick={() => navigate(`/produit/${p.slug}`, fromState)}
                  className="px-3.5 py-1 border border-border text-foreground text-[11px] font-semibold
                            rounded-md hover:bg-muted transition-colors"
                >
                  Voir
                </button>
              </div>
            </div>
          ))}

          {hiddenOffers.length > 0 && (
            <div className="px-5 py-2">
              <button
                onClick={() => setShowMore(!showMore)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground
                          hover:text-foreground transition-colors"
              >
                {showMore ? "Moins d'offres" : `+ ${hiddenOffers.length} autre${hiddenOffers.length > 1 ? "s" : ""} offre${hiddenOffers.length > 1 ? "s" : ""}`}
                {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showMore && (
                <div className="mt-1">
                  {hiddenOffers.map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between py-2 border-t border-border/60">
                      <span className="text-sm text-foreground">{offer.sellerName}</span>
                      <div className="flex items-center gap-3">
                        {price > 0 && offer.unitPriceEur > price && (
                          <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                            +{(offer.unitPriceEur - price).toFixed(2)}&nbsp;€ (+{((offer.unitPriceEur - price) / price * 100).toFixed(1)}%)
                          </span>
                        )}
                        <span className="text-sm font-bold text-foreground">{offer.unitPriceEur.toFixed(2)} €</span>
                        <button
                          onClick={() => navigate(`/produit/${p.slug}`)}
                          className="px-3.5 py-1 border border-border text-foreground text-[11px] font-semibold
                                    rounded-md hover:bg-muted transition-colors"
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
