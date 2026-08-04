import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCagnotteSettings } from "@/hooks/useCagnotte";

/**
 * Badge doré affiché dès qu'AU MOINS UNE offre du produit est éligible à la
 * cagnotte (source : `product_cagnotte_status.has_eligible_offer`, dérivé de
 * `offers.cagnotte_eligible`). `products.cagnotte_eligible` reste un fallback legacy.
 */
export function ProductCardCagnotteBadge({
  eligible,
  nbEligibleOffers,
  nbTotalOffers,
  unitPriceExclVat,
  className = "",
}: {
  eligible?: boolean | null;
  nbEligibleOffers?: number | null;
  nbTotalOffers?: number | null;
  /** Prix HTVA unitaire, pour exprimer la cagnotte en valeur (€). */
  unitPriceExclVat?: number | null;
  className?: string;
}) {
  const { data: settings } = useCagnotteSettings();
  if (!eligible) return null;


  const rate = settings?.rate ?? 0.02;
  const pct = Math.round(rate * 100);
  const perUnit = Number(unitPriceExclVat || 0) * rate;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-default ${className}`}
            style={{
              background: "rgba(244,185,66,0.15)",
              borderColor: "rgba(244,185,66,0.45)",
              color: "#8A5A00",
            }}
          >
            🪙 {perUnit > 0 ? `+${perUnit.toFixed(2)} €/u.` : `+${pct}%`}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {nbTotalOffers && nbEligibleOffers != null && nbEligibleOffers < nbTotalOffers
            ? `${nbEligibleOffers} offre(s) sur ${nbTotalOffers} vous font gagner ${perUnit > 0 ? `${perUnit.toFixed(2)} € de cagnotte par unité (${pct}% du prix HTVA)` : `${pct}% de cagnotte`}.`
            : `Ce produit vous fait gagner ${perUnit > 0 ? `${perUnit.toFixed(2)} € de cagnotte par unité achetée (${pct}% du prix HTVA)` : `${pct}% de cagnotte fidélité`}.`}
        </TooltipContent>

      </Tooltip>
    </TooltipProvider>
  );
}
