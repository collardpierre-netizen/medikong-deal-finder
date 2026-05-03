import { useEffect, useRef } from "react";
import { Info, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useResolvedPvp, computeResaleMargin } from "@/hooks/useResolvedPvp";
import { useProductVatRate } from "@/hooks/useProductVatRate";
import { Card, CardContent } from "@/components/ui/card";
import { formatUpdatedAtFull } from "@/lib/format-date";
import { supabase } from "@/integrations/supabase/client";

interface PvpEconomyBadgeProps {
  productId: string;
  offerId?: string | null;
  buyerPriceTtc: number; // prix TTC payé par l'acheteur (€)
  buyerPriceHtva?: number; // facultatif, pour le bloc complet
  countryCode?: string;
  variant?: "inline" | "card";
}

const SOURCE_BADGE: Record<string, { short: string; bg: string; fg: string; ring: string }> = {
  apb:          { short: "APB",          bg: "bg-blue-50",    fg: "text-blue-800",    ring: "ring-blue-600/20" },
  pmr:          { short: "PMR",          bg: "bg-blue-50",    fg: "text-blue-800",    ring: "ring-blue-600/20" },
  manufacturer: { short: "Fabricant",    bg: "bg-indigo-50",  fg: "text-indigo-800",  ring: "ring-indigo-600/20" },
  distributor:  { short: "Distributeur", bg: "bg-indigo-50",  fg: "text-indigo-800",  ring: "ring-indigo-600/20" },
  manual:       { short: "Conseillé",    bg: "bg-slate-50",   fg: "text-slate-700",   ring: "ring-slate-600/20" },
};

/**
 * Bloc "Économie / Marge potentielle" sur la fiche produit.
 *
 * Variant "card" : affiche TOUJOURS le bloc dès qu'un PVP existe
 * (PVP TTC, badge source APB/PMR/…, prix d'achat HTVA + TTC, marge HT et TTC).
 * Couleur dynamique : vert si marge positive, rouge si négative, neutre si nulle.
 *
 * Variant "inline" : badge compact pour les cards catalogue (n'apparaît que si marge > 0).
 *
 * Réservé aux acheteurs vérifiés (le composant parent gère cette condition).
 */
export function PvpEconomyBadge({
  productId,
  offerId,
  buyerPriceTtc,
  buyerPriceHtva,
  countryCode = "BE",
  variant = "inline",
}: PvpEconomyBadgeProps) {
  const { data: pvp } = useResolvedPvp(productId, countryCode);
  const { data: vatInfo } = useProductVatRate(productId);
  const vatRate = vatInfo?.vat_rate ?? 21;

  if (!pvp) return null;
  const margin = computeResaleMargin(pvp.pvpTtc, buyerPriceTtc);

  // Variant inline : ancien comportement, n'affiche que si marge positive
  if (variant === "inline") {
    if (!margin || margin.marginAmount <= 0) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <TrendingUp className="h-3 w-3" />
              Marge {margin.marginPct.toFixed(0)}%
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">{pvp.sourceLabel}</p>
            <p className="text-xs">
              PVP TTC : <strong>{pvp.pvpTtc.toFixed(2)} €</strong>
              <br />
              Votre prix TTC : <strong>{buyerPriceTtc.toFixed(2)} €</strong>
              <br />
              Marge potentielle : <strong>{margin.marginAmount.toFixed(2)} €</strong> ({margin.marginPct.toFixed(1)}%)
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Variant card : TOUJOURS affiché tant qu'un PVP existe
  const pvpHt = pvp.pvpTtc / (1 + vatRate / 100);
  const marginHtAmount = buyerPriceHtva != null ? pvpHt - buyerPriceHtva : null;
  const marginHtPct = marginHtAmount != null && pvpHt > 0 ? (marginHtAmount / pvpHt) * 100 : null;

  const isPositive = (margin?.marginAmount ?? 0) > 0;
  const isNegative = (margin?.marginAmount ?? 0) < 0;
  const isZero = margin?.marginAmount === 0;

  const palette = isPositive
    ? { border: "border-emerald-200", bg: "bg-emerald-50/50", title: "text-emerald-900", icon: "text-emerald-700", marginFg: "text-emerald-700", marginBg: "text-emerald-700/80", Icon: TrendingUp }
    : isNegative
    ? { border: "border-rose-200", bg: "bg-rose-50/50", title: "text-rose-900", icon: "text-rose-700", marginFg: "text-rose-700", marginBg: "text-rose-700/80", Icon: TrendingDown }
    : { border: "border-slate-200", bg: "bg-slate-50/50", title: "text-slate-900", icon: "text-slate-600", marginFg: "text-slate-700", marginBg: "text-slate-600", Icon: Minus };

  const sourceBadge = SOURCE_BADGE[pvp.source] ?? SOURCE_BADGE.manual;
  const Icon = palette.Icon;

  return (
    <Card className={`${palette.border} ${palette.bg}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Icon className={`h-4 w-4 ${palette.icon}`} />
          <h3 className={`text-sm font-semibold ${palette.title}`}>Économie / Marge potentielle</h3>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${sourceBadge.bg} ${sourceBadge.fg} ${sourceBadge.ring}`}
            title={pvp.sourceLabel}
          >
            Source {sourceBadge.short}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className={`h-3.5 w-3.5 ${palette.icon}/70`} />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Calcul indicatif basé sur le prix public conseillé. Source : {pvp.sourceLabel}.
                  {pvp.updatedAt && <> Mis à jour le {formatUpdatedAtFull(pvp.updatedAt)}.</>}
                  <br />
                  TVA appliquée : {vatRate}%.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Grid principale */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          {/* PVP TTC conseillé */}
          <div>
            <div className="text-xs text-muted-foreground">PVP TTC conseillé</div>
            <div className="font-semibold tabular-nums">{pvp.pvpTtc.toFixed(2)} €</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">soit {pvpHt.toFixed(2)} € HT</div>
          </div>

          {/* Mon prix d'achat */}
          <div>
            <div className="text-xs text-muted-foreground">Mon prix d'achat</div>
            {buyerPriceHtva != null ? (
              <>
                <div className="font-semibold tabular-nums">{buyerPriceHtva.toFixed(2)} € HTVA</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">soit {buyerPriceTtc.toFixed(2)} € TTC</div>
              </>
            ) : (
              <>
                <div className="font-semibold tabular-nums">{buyerPriceTtc.toFixed(2)} € TTC</div>
                <div className="text-[11px] text-muted-foreground">HTVA non disponible</div>
              </>
            )}
          </div>

          {/* Marge potentielle */}
          <div>
            <div className="text-xs text-muted-foreground">Marge potentielle</div>
            {margin ? (
              <>
                <div className={`font-semibold tabular-nums ${palette.marginFg}`}>
                  {margin.marginAmount >= 0 ? "+" : ""}
                  {margin.marginAmount.toFixed(2)} €
                </div>
                <div className={`text-[11px] tabular-nums ${palette.marginBg}`}>
                  {margin.marginPct >= 0 ? "+" : ""}
                  {margin.marginPct.toFixed(1)}% TTC
                </div>
                {marginHtAmount != null && marginHtPct != null && (
                  <div className={`text-[11px] tabular-nums ${palette.marginBg}`}>
                    ({marginHtAmount >= 0 ? "+" : ""}
                    {marginHtAmount.toFixed(2)} € · {marginHtPct.toFixed(1)}% HT)
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Indisponible</div>
            )}
          </div>
        </div>

        {/* Hint si marge négative ou nulle */}
        {(isNegative || isZero) && (
          <p className={`mt-3 text-[11px] ${palette.marginBg}`}>
            {isNegative
              ? "⚠ Votre prix d'achat est supérieur au PVP conseillé : revente non rentable au prix public."
              : "Votre prix d'achat est aligné sur le PVP conseillé : aucune marge à la revente publique."}
          </p>
        )}

        <p className="mt-2 text-[11px] text-muted-foreground">{pvp.sourceLabel}</p>
      </CardContent>
    </Card>
  );
}
