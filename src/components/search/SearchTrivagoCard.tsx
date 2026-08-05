import { useState, useRef, useEffect } from "react";
import { ImageOff, Eye, Lock, Loader2 } from "lucide-react";
import { getProductImageSrc, MEDIKONG_PLACEHOLDER, isQogitaPlaceholder } from "@/lib/image-utils";
import { Heart, Check, ChevronDown, ChevronUp, Package, Truck, RotateCcw, ArrowRight, AlertCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProductOffers } from "@/hooks/useProducts";
import type { Product } from "@/hooks/useProducts";
import { useBestOfferForProduct } from "@/contexts/BestOffersContext";
import { OfferSkeletonRow } from "@/components/shared/OfferSkeletonRow";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalizedProductField } from "@/hooks/useLocalizedProductField";


interface Props {
  product: Product;
}

// Cache module-level : mémorise les productId déjà "prefetch". Deux buts :
//  1. Un même productId affiché dans plusieurs cartes ne déclenche qu'un seul
//     mount de useProductOffers (React Query dédoublonne déjà le fetch réseau,
//     mais on évite le state churn et les re-renders).
//  2. Après un unmount/remount (scroll virtuel, retour navigation), la carte
//     reste en mode "déjà prefetch" au lieu de repasser par le survol.
const prefetchedProductIds = new Set<string>();


export default function SearchTrivagoCard({ product: p }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fromState = { state: { from: location.pathname + location.search } };
  const [showMore, setShowMore] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const displayName = useLocalizedProductField(p.id, p as any, "name", p.name);
  const displayShortDescription = useLocalizedProductField(p.id, p as any, "short_description", (p as any).descriptionShort);

  // ⚡ Best offer pré-chargé via le batch RPC (BestOffersProvider). Si la page ne
  // monte pas le provider, on retombe sur l'ancien `useProductOffers` immédiat.
  const { bestOffer: batchBest, hasContext, isLoading: batchLoading, isError: batchError } = useBestOfferForProduct(p.id);


  // Les "autres offres" restent en lazy : on ne déclenche `useProductOffers`
  // que quand l'utilisateur ouvre la liste (économise N-1 RPC par page).
  const [expanded, setExpanded] = useState(false);
  const [prefetch, setPrefetch] = useState(() => prefetchedProductIds.has(p.id));
  const triggerPrefetch = () => {
    if (prefetchedProductIds.has(p.id)) return; // dédoublonné : hover répété = no-op
    prefetchedProductIds.add(p.id);
    setPrefetch(true);
  };
  const {
    data: offersFull = [],
    isLoading: offersLoading,
    error: offersError,
    refetch: refetchOffers,
  } = useProductOffers(expanded || prefetch || !hasContext ? p.id : undefined);

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefetch || prefetchedProductIds.has(p.id)) return;
    if (!cardRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          prefetchedProductIds.add(p.id);
          setPrefetch(true);
          observer.disconnect();
        }
      });
    }, { threshold: 0 });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [prefetch, p.id]);

  // Best offer : on privilégie le batch (1 round-trip), sinon le fetch détaillé.
  const bestOffer = hasContext
    ? (batchBest
        ? {
            id: batchBest.offerId,
            sellerName: batchBest.sellerName,
            unitPriceEur: batchBest.unitPriceEur,
            deliveryDays: batchBest.deliveryDays ?? 0,
            isVerified: batchBest.isVerified,
            isExclusiveWinner: batchBest.isExclusiveWinner,
          } as any
        : undefined)
    : offersFull[0];

  const otherOffers = offersFull.slice(bestOffer && hasContext ? 0 : 1)
    .filter((o: any) => !bestOffer || o.id !== bestOffer.id);
  const visibleOffers = otherOffers.slice(0, 2);
  const hiddenOffers = otherOffers.slice(2);

  const price = bestOffer?.unitPriceEur || p.price;
  const pct = p.pct;
  const offerCount = hasContext ? (batchBest?.offerCount ?? 0) : offersFull.length;
  // Aucun vendeur n'a encore listé une offre active sur ce SKU dans le pays courant.
  const hasOffer = (offerCount > 0 || (p.sellers || 0) > 0) && price > 0;

  return (
    <div ref={cardRef} className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-border">
      {/* Main 3-zone row */}
      <div className="flex flex-col md:flex-row">
        {/* ZONE 1 — Image */}
        <div
          onClick={() => navigate(`/produit/${p.slug}`, fromState)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(`/produit/${p.slug}`, fromState);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Voir le produit ${displayName}`}
          className="group/img w-full md:w-[190px] bg-white flex items-center justify-center relative shrink-0 cursor-pointer
                     h-[180px] md:h-[220px] md:aspect-square border-b md:border-b-0 md:border-r border-border
                     outline-none transition-shadow
                     hover:shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.6)]
                     focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--primary))]
                     focus-visible:ring-2 focus-visible:ring-primary/40"
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
          {!imgLoaded && !imgError && (
            <div className="absolute inset-0 animate-pulse bg-muted/60" aria-hidden="true" />
          )}
          {imgError ? (
            <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <ImageOff size={28} strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-wider">Image indisponible</span>
            </div>
          ) : (
            <img
              src={getProductImageSrc(p.imageUrls?.[0] || p.imageUrl)}
              alt={displayName}
              className={`w-full h-full object-contain p-3 md:p-4 transition-all duration-300 ease-out group-hover/img:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={e => {
                if (isQogitaPlaceholder(e.currentTarget)) {
                  e.currentTarget.src = MEDIKONG_PLACEHOLDER;
                }
                setImgLoaded(true);
              }}
              onError={() => { setImgError(true); setImgLoaded(true); }}
            />
          )}
        </div>

        {/* ZONE 2 — Product info */}
        <div
          onClick={() => navigate(`/produit/${p.slug}`, fromState)}
          className="flex-1 p-4 flex flex-col justify-center cursor-pointer"
        >
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            {p.brand}
          </p>
          <p className="text-[15px] font-bold text-foreground mt-1.5 line-clamp-2 leading-snug">{displayName}</p>
          {displayShortDescription && (
            <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{displayShortDescription}</p>
          )}
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
            {(() => {
              const n = offerCount || p.sellers || 0;
              return n > 0 ? (
                <span className="text-[11px] text-muted-foreground font-medium">
                  {n} offre{n !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground font-medium italic">
                  Pas encore d'offre
                </span>
              );
            })()}
          </div>
        </div>

        {/* ZONE 3 — Best deal panel — high contrast like Trivago */}
        {(() => {
          // États dérivés pour l'affichage :
          //  - loading      : batch RPC en vol, aucune donnée encore
          //  - authRequired : batch en erreur (RLS/401) et visiteur non connecté
          const showLoading = hasContext && batchLoading && !batchBest;
          const showAuthGate = !user && hasContext && batchError && !batchBest;
          const panelBg = showLoading
            ? "bg-muted/40"
            : showAuthGate
              ? "bg-primary/5"
              : hasOffer
                ? "bg-emerald-50"
                : "bg-muted/40";
          return (
            <div className={`w-full md:w-[250px] shrink-0 border-t md:border-t-0 md:border-l border-border p-4 flex flex-col justify-between ${panelBg}`}>
              {showLoading ? (
                <div
                  className="flex-1 flex flex-col items-center justify-center text-center gap-2"
                  role="status"
                  aria-live="polite"
                  aria-label="Chargement des meilleures offres"
                >
                  <Loader2 size={20} className="text-muted-foreground animate-spin" aria-hidden="true" />
                  <p className="text-[11px] text-muted-foreground">Chargement des offres…</p>
                  <div className="w-full mt-1 space-y-1.5">
                    <div className="h-3 rounded bg-muted/70 animate-pulse" />
                    <div className="h-6 rounded bg-muted/70 animate-pulse w-2/3 mx-auto" />
                    <div className="h-8 rounded bg-muted/70 animate-pulse mt-2" />
                  </div>
                </div>
              ) : showAuthGate ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                  <Lock size={20} className="text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">Connexion requise</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Connectez-vous pour voir les prix et les meilleures offres des vendeurs vérifiés.
                  </p>
                  <button
                    onClick={() =>
                      navigate(`/connexion?redirect=${encodeURIComponent(location.pathname + location.search)}`)
                    }
                    className="mt-1 w-full py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-md hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    Se connecter <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => navigate(`/produit/${p.slug}`, fromState)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Voir le produit
                  </button>
                </div>
              ) : hasOffer ? (
                <>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-emerald-800">
                        {bestOffer?.sellerName || "Meilleur prix"}
                      </p>
                      {bestOffer?.isExclusiveWinner && (
                        <span
                          title="Vendeur exclusif sur ce produit"
                          className="text-[9px] font-bold uppercase tracking-wide text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded"
                        >
                          Exclusif
                        </span>
                      )}
                    </div>
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
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                  <Package size={20} className="text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">Pas encore d'offre</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Aucun fournisseur n'a listé ce produit pour le moment.
                  </p>
                  <button
                    onClick={() => navigate(`/produit/${p.slug}`, fromState)}
                    className="mt-1 px-3.5 py-2 border border-border text-foreground text-[12px] font-semibold rounded-md hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                  >
                    Voir le produit <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

      </div>

      {/* Secondary offers — lazy : on n'invoque useProductOffers qu'au clic */}
      {(() => {
        // Le compteur du batch (`batchBest.offerCount`) peut être sous-estimé (1 ou 0)
        // alors que la liste détaillée renvoie bien N autres vendeurs → on prend le max
        // des sources connues, et dès que les offres détaillées sont chargées elles
        // deviennent la vérité (plus de « + 0 autre offre » avec une liste pleine).
        const offersLoaded = offersFull.length > 0 && !offersLoading;
        const knownTotal = Math.max(offerCount, offersFull.length, p.sellers || 0);
        const extraCount = offersLoaded ? otherOffers.length : Math.max(0, knownTotal - 1);
        if (extraCount === 0 && otherOffers.length === 0) return null;

        return (
          <div className="border-t border-border bg-muted/30">
            {expanded && offersLoading && (
              <div>
                {Array.from({ length: Math.min(extraCount || 2, 4) }).map((_, i) => (
                  <OfferSkeletonRow key={`sk-${i}`} />
                ))}
              </div>
            )}
            {expanded && !offersLoading && offersError && (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-6 border-b border-border/60 text-center">
                <AlertCircle size={20} className="text-destructive" />
                <p className="text-sm font-medium text-destructive">
                  Impossible de charger les offres
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Une erreur est survenue lors de la récupération des autres vendeurs.
                </p>
                <button
                  onClick={() => refetchOffers()}
                  className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  <RotateCcw size={12} />
                  Réessayer
                </button>
              </div>
            )}
            {expanded && !offersLoading && visibleOffers.map((offer: any) => (
              <div
                key={offer.id}
                title={offer.isShowcaseDimmed ? "Offre atténuée : un vendeur bénéficie d'une mise en avant exclusive (showcase) sur ce produit." : undefined}
                className={`flex items-center justify-between px-5 py-2.5 border-b border-border/60 last:border-b-0 ${offer.isShowcaseDimmed ? "opacity-60 grayscale-[30%]" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{offer.sellerName}</span>
                  {offer.isShowcaseDimmed && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                      <Eye size={10} /> Showcase
                    </span>
                  )}
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
                    className="px-3.5 py-1 border border-border text-foreground text-[11px] font-semibold rounded-md hover:bg-muted transition-colors"
                  >
                    Voir
                  </button>
                </div>
              </div>
            ))}

            <div className="px-5 py-2">
              <button
                onClick={() => {
                  if (!expanded) setExpanded(true);
                  setShowMore(!showMore);
                }}
                onMouseEnter={triggerPrefetch}
                onFocus={triggerPrefetch}
                onTouchStart={triggerPrefetch}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded && showMore
                  ? "Moins d'offres"
                  : `+ ${extraCount} autre${extraCount > 1 ? "s" : ""} offre${extraCount > 1 ? "s" : ""}`}
                {expanded && showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expanded && showMore && offersLoading && (
                <div className="mt-1">
                  {Array.from({ length: Math.max(0, (offerCount - 1) - 2) }).map((_, i) => (
                    <OfferSkeletonRow key={`sk-hidden-${i}`} />
                  ))}
                </div>
              )}
              {expanded && showMore && !offersLoading && offersError && (
                <div className="flex flex-col items-center justify-center gap-2 px-5 py-4 border-t border-border/60 text-center">
                  <AlertCircle size={16} className="text-destructive" />
                  <p className="text-xs font-medium text-destructive">
                    Impossible de charger les offres complémentaires
                  </p>
                  <button
                    onClick={() => refetchOffers()}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <RotateCcw size={11} />
                    Réessayer
                  </button>
                </div>
              )}
              {expanded && showMore && !offersLoading && !offersError && (
                <div className="mt-1">
                  {hiddenOffers.map((offer: any) => (
                    <div
                      key={offer.id}
                      title={offer.isShowcaseDimmed ? "Offre atténuée : un vendeur bénéficie d'une mise en avant exclusive (showcase) sur ce produit." : undefined}
                      className={`flex items-center justify-between py-2 border-t border-border/60 ${offer.isShowcaseDimmed ? "opacity-60 grayscale-[30%]" : ""}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground">{offer.sellerName}</span>
                        {offer.isShowcaseDimmed && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            <Eye size={10} /> Showcase
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
                          className="px-3.5 py-1 border border-border text-foreground text-[11px] font-semibold rounded-md hover:bg-muted transition-colors"
                        >
                          Voir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
