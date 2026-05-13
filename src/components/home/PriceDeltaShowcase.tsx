import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, ArrowRight, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
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

const LOCALE_MAP: Record<string, string> = {
  fr: "fr-BE",
  nl: "nl-BE",
  en: "en-GB",
  de: "de-DE",
};

const fmtFor = (lang: string) =>
  (n: number) =>
    new Intl.NumberFormat(LOCALE_MAP[lang] ?? "fr-BE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(n);

type Display =
  | {
      kind: "ok";
      variant: ShowcaseVariant; // "ok" (pinned) or "fallback" (auto top)
      productId: string;
      slug: string;
      name: string;
      brandName: string | null;
      imageUrl: string | null;
      minPrice: number;
      maxPrice: number;
      offerCount: number;
      deltaPct: number;
    }
  | {
      kind: "no_offers";
      variant: ShowcaseVariant; // "no_offers" | "single_offer"
      productId: string;
      slug: string;
      name: string;
      brandName: string | null;
      imageUrl: string | null;
      offerCount: number;
    };

export function PriceDeltaShowcase() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || "fr";
  const fmt = fmtFor(lang);
  const settings = useHomeShowcaseSettings();
  const pinnedId = settings.data?.pinned_product_id ?? null;
  const pinned = useFeaturedPriceDelta(pinnedId);
  // Fallback automatique uniquement si AUCUN produit n'est épinglé.
  const fallback = useTopPriceDeltas(pinnedId ? 0 : 1);

  // Compute display first, hooks must run unconditionally
  let display: Display | null = null;
  const ready =
    !settings.isLoading &&
    !(pinnedId && pinned.isLoading) &&
    !(!pinnedId && fallback.isLoading);

  if (ready) {
    if (pinnedId && pinned.data && pinned.data.status !== "ok") {
      const state = pinned.data;
      if (state.status !== "not_found") {
        display = {
          kind: "no_offers",
          variant: state.status, // "no_offers" | "single_offer"
          productId: state.product.id,
          slug: state.product.slug,
          name: state.product.name,
          brandName: state.product.brandName,
          imageUrl: state.product.imageUrl,
          offerCount: state.offerCount,
        };
      }
    } else {
      const featured: PriceDelta | undefined =
        pinned.data?.status === "ok" ? pinned.data.delta : fallback.data?.[0];
      if (featured) {
        display = {
          kind: "ok",
          variant: pinned.data?.status === "ok" ? "ok" : "fallback",
          productId: featured.productId,
          slug: featured.slug,
          name: featured.name,
          brandName: featured.brandName,
          imageUrl: featured.imageUrl,
          minPrice: featured.minPrice,
          maxPrice: featured.maxPrice,
          offerCount: featured.offerCount,
          deltaPct: featured.deltaPct,
        };
      }
    }
  }

  // Impression tracking (dédoublonnée par session, voir helper)
  useEffect(() => {
    if (!display) return;
    trackShowcaseImpression({
      productId: display.productId,
      productSlug: display.slug,
      variant: display.variant,
      deltaPct: display.kind === "ok" ? display.deltaPct : null,
      offerCount: display.offerCount,
    });
  }, [display?.productId, display?.variant]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!display) return null;

  if (display.kind === "no_offers") {
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
          {t("priceShowcase.badgeNoOffers")}
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-lg bg-mk-alt/40 flex items-center justify-center overflow-hidden border border-mk-line">
            {display.imageUrl ? (
              <img
                src={display.imageUrl}
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
            {display.brandName && (
              <p className="text-[10px] uppercase tracking-wide text-mk-sec font-semibold truncate">
                {display.brandName}
              </p>
            )}
            <p className="text-sm font-semibold text-mk-navy line-clamp-2">{display.name}</p>
            <p className="text-[11px] text-mk-sec mt-0.5">
              {display.offerCount === 0
                ? t("priceShowcase.noOffersDesc")
                : t("priceShowcase.singleOfferDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-mk-line gap-3">
          <p className="text-xs text-mk-sec leading-snug">
            {t("priceShowcase.alertCta")}
          </p>
          <Link
            to={`/produit/${display.slug}`}
            onClick={() =>
              trackShowcaseClick({
                productId: display.productId,
                productSlug: display.slug,
                variant: display.variant,
                offerCount: display.offerCount,
              })
            }
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-mk-blue hover:underline"
          >
            {t("priceShowcase.viewProduct")} <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </motion.aside>
    );
  }

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
          {display.imageUrl ? (
            <img
              src={display.imageUrl}
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
          {display.brandName && (
            <p className="text-[10px] uppercase tracking-wide text-mk-sec font-semibold truncate">
              {display.brandName}
            </p>
          )}
          <p className="text-sm font-semibold text-mk-navy line-clamp-2">{display.name}</p>
          <p className="text-[11px] text-mk-sec mt-0.5">
            {t("priceShowcase.competitors", { count: display.offerCount })}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-mk-sec line-through tabular-nums">
            {fmt(display.maxPrice)}
          </div>
          <div className="text-base md:text-lg font-bold text-mk-navy tabular-nums">
            {fmt(display.minPrice)}
          </div>
          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
            −{Math.round(display.deltaPct)}%
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-mk-line gap-3">
        <p className="text-xs text-mk-sec leading-snug">
          {t("priceShowcase.deltaCaption")}
        </p>
        <Link
          to={`/produit/${display.slug}`}
          onClick={() =>
            trackShowcaseClick({
              productId: display.productId,
              productSlug: display.slug,
              variant: display.variant,
              deltaPct: display.deltaPct,
              offerCount: display.offerCount,
            })
          }
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-mk-blue hover:underline"
        >
          {t("priceShowcase.viewComparison")} <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </motion.aside>
  );
}
