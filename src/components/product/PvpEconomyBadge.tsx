import { Info, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useResolvedPvp, computeResaleMargin } from "@/hooks/useResolvedPvp";
import { Card, CardContent } from "@/components/ui/card";
import { formatUpdatedAtFull } from "@/lib/format-date";

interface PvpEconomyBadgeProps {
  productId: string;
  buyerPriceTtc: number; // prix TTC payé par l'acheteur (€)
  buyerPriceHtva?: number; // facultatif, pour le bloc complet
  countryCode?: string;
  variant?: "inline" | "card";
}

/**
 * Affiche le gain potentiel de revente vs. PVP officiel/conseillé.
 * - variant="inline" : petit badge pour cards catalogue
 * - variant="card" : bloc complet pour fiche produit
 *
 * Réservé aux acheteurs vérifiés : le composant parent doit déjà gérer cette condition
 * (le PVP TTC en lui-même n'est pas confidentiel, mais la marge l'est car elle révèle le prix d'achat).
 */
export function PvpEconomyBadge({
  productId,
  buyerPriceTtc,
  buyerPriceHtva,
  countryCode = "BE",
  variant = "inline",
}: PvpEconomyBadgeProps) {
  const { data: pvp } = useResolvedPvp(productId, countryCode);

  if (!pvp) return null;
  const margin = computeResaleMargin(pvp.pvpTtc, buyerPriceTtc);
  if (!margin || margin.marginAmount <= 0) return null;

  if (variant === "inline") {
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

  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-emerald-700" />
          <h3 className="text-sm font-semibold text-emerald-900">Économie / Marge potentielle</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-emerald-700/70" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Calcul indicatif basé sur le prix public conseillé. Source : {pvp.sourceLabel}.
                  {pvp.updatedAt && <> Mis à jour le {formatUpdatedAtFull(pvp.updatedAt)}.</>}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">PVP TTC</div>
            <div className="font-semibold">{pvp.pvpTtc.toFixed(2)} €</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Votre prix TTC</div>
            <div className="font-semibold">{buyerPriceTtc.toFixed(2)} €</div>
            {buyerPriceHtva != null && (
              <div className="text-[11px] text-muted-foreground">soit {buyerPriceHtva.toFixed(2)} € HTVA</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Marge</div>
            <div className="font-semibold text-emerald-700">
              +{margin.marginAmount.toFixed(2)} €
            </div>
            <div className="text-[11px] text-emerald-700/80">{margin.marginPct.toFixed(1)}%</div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{pvp.sourceLabel}</p>
      </CardContent>
    </Card>
  );
}
