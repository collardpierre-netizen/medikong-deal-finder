import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, ArrowRight, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { useTopPriceDeltas, type PriceDelta } from "@/hooks/useTopPriceDeltas";
import { useFeaturedPriceDelta } from "@/hooks/useFeaturedPriceDelta";
import { useHomeShowcaseSettings } from "@/hooks/useHomeShowcaseSettings";
import {
  trackShowcaseImpression,
  trackShowcaseClick,
  type ShowcaseVariant,
} from "@/lib/home-showcase-tracking";

/**
 * Mini-encart "Exemple de comparaison live" affiché dans le hero de la home.
 * Mesure les impressions/clics via `home_showcase_events` + dataLayer GTM.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

export function PriceDeltaShowcase() {
  const settings = useHomeShowcaseSettings();
  const pinnedId = settings.data?.pinned_product_id ?? null;
  const pinned = useFeaturedPriceDelta(pinnedId);
  // Fallback automatique uniquement si AUCUN produit n'est épinglé.
  // Si l'admin a épinglé un produit mais qu'il manque d'offres, on l'affiche
  // explicitement plutôt que de basculer en silence sur un autre SKU.
  const fallback = useTopPriceDeltas(pinnedId ? 0 : 1);

  if (settings.isLoading) return null;
  if (pinnedId && pinned.isLoading) return null;
  if (!pinnedId && fallback.isLoading) return null;

  // 1) Produit épinglé sans assez d'offres → message clair
  if (pinnedId && pinned.data && pinned.data.status !== "ok") {
    const state = pinned.data;
    if (state.status === "not_found") return null;
    const { product, offerCount } = state;
    return (
      <motion.aside
        role="complementary"
        aria-label="Produit mis en avant — pas encore d'offres"
        className="max-w-[640px] mx-auto mb-8 bg-white border border-mk-line rounded-xl p-4 md:p-5 text-left shadow-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-wider font-semibold text-mk-sec">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mk-alt text-mk-sec">
            <Package size={12} aria-hidden="true" />
          </span>
          Produit mis en avant · pas encore de comparaison
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-lg bg-mk-alt/40 flex items-center justify-center overflow-hidden border border-mk-line">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
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
            {product.brandName && (
              <p className="text-[10px] uppercase tracking-wide text-mk-sec font-semibold truncate">
                {product.brandName}
              </p>
            )}
            <p className="text-sm font-semibold text-mk-navy line-clamp-2">
              {product.name}
            </p>
            <p className="text-[11px] text-mk-sec mt-0.5">
              {offerCount === 0
                ? "Pas encore d'offres actives sur cette référence."
                : "1 seule offre active — comparaison disponible dès qu'un second vendeur se positionne."}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-mk-line gap-3">
          <p className="text-xs text-mk-sec leading-snug">
            Soyez alerté dès qu'un nouveau prix est publié.
          </p>
          <Link
            to={`/produit/${product.slug}`}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-mk-blue hover:underline"
          >
            Voir la fiche produit <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </motion.aside>
    );
  }

  // 2) Comparaison disponible (épinglé OU fallback top delta)
  const featured: PriceDelta | undefined =
    pinned.data?.status === "ok" ? pinned.data.delta : fallback.data?.[0];
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
          to={`/produit/${featured.slug}`}
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
