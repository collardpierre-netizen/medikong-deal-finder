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
  className = "",
}: {
  eligible?: boolean | null;
  nbEligibleOffers?: number | null;
  nbTotalOffers?: number | null;
  className?: string;
}) {
  const { data: settings } = useCagnotteSettings();
  if (!eligible) return null;


  const pct = Math.round((settings?.rate ?? 0.02) * 100);

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
            🪙 +{pct}%
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {nbTotalOffers && nbEligibleOffers != null && nbEligibleOffers < nbTotalOffers
            ? `${nbEligibleOffers} offre(s) sur ${nbTotalOffers} vous font gagner ${pct}% de cagnotte fidélité.`
            : `Ce produit vous fait gagner ${pct}% de cagnotte fidélité.`}
        </TooltipContent>

      </Tooltip>
    </TooltipProvider>
  );
}
