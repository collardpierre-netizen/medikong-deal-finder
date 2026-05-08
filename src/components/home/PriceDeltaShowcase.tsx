import { Link } from "react-router-dom";
import { Package, ArrowRight, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { useTopPriceDeltas, type PriceDelta } from "@/hooks/useTopPriceDeltas";

/**
 * Mini-encart "Exemple de comparaison live" affiché dans le hero de la home.
 *
 * Montre le SKU multi-vendeurs au plus gros écart de prix du jour
 * (calcul live via la vue `public_top_price_deltas`). Aucune promesse moyenne :
 * le pourcentage affiché est l'écart max/min réel sur le SKU mis en avant.
 *
 * Si la vue ne renvoie aucune ligne (catalogue trop pauvre), le composant
 * ne s'affiche pas et la home retombe sur ses CTAs classiques.
 */
function trackEvent(name: string, payload: Record<string, unknown>) {
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: name, ...payload });
  } catch {
    /* no-op */
  }
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

export function PriceDeltaShowcase() {
  const { data, isLoading } = useTopPriceDeltas(1);
  if (isLoading) return null;
  const featured: PriceDelta | undefined = data?.[0];
  if (!featured) return null;

  return (
    <motion.aside
      role="complementary"
      aria-label="Exemple de comparaison de prix entre fournisseurs"
      className="max-w-[640px] mx-auto mb-8 bg-white border border-mk-line rounded-xl p-4 md:p-5 text-left shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
    >
      <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-wider font-semibold text-mk-sec">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mk-blue/10 text-mk-blue">
          <TrendingDown size={12} aria-hidden="true" />
        </span>
        Exemple de comparaison live · données du jour
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-lg bg-mk-alt/40 flex items-center justify-center overflow-hidden border border-mk-line">
          {featured.imageUrl ? (
            <img
              src={featured.imageUrl}
              alt=""
              className="w-full h-full object-contain p-1"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : (
            <Package size={22} className="text-mk-sec/50" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {featured.brandName && (
            <p className="text-[10px] uppercase tracking-wide text-mk-sec font-semibold truncate">
              {featured.brandName}
            </p>
          )}
          <p className="text-sm font-semibold text-mk-navy line-clamp-2">
            {featured.name}
          </p>
          <p className="text-[11px] text-mk-sec mt-0.5">
            {featured.offerCount} fournisseurs en concurrence
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-mk-sec line-through tabular-nums">
            {fmt(featured.maxPrice)}
          </div>
          <div className="text-base md:text-lg font-bold text-mk-navy tabular-nums">
            {fmt(featured.minPrice)}
          </div>
          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
            −{Math.round(featured.deltaPct)}%
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-mk-line gap-3">
        <p className="text-xs text-mk-sec leading-snug">
          Écart entre vendeurs sur cette référence multi-fournisseurs.
        </p>
        <Link
          to={`/produits/${featured.slug}`}
          onClick={() =>
            trackEvent("home_price_delta_viewed", {
              productId: featured.productId,
              productSlug: featured.slug,
              deltaPct: featured.deltaPct,
            })
          }
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-mk-blue hover:underline"
        >
          Voir la comparaison <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </motion.aside>
  );
}
