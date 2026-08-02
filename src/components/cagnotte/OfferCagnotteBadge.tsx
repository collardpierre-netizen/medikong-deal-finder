import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCagnotteSettings } from "@/hooks/useCagnotte";

/**
 * Badge inline discret sur une LIGNE D'OFFRE.
 * L'éligibilité est portée par l'offre (offers.cagnotte_eligible), pas par le produit :
 * un même produit peut avoir des offres éligibles et non éligibles.
 */
export function OfferCagnotteBadge({
  eligible,
  unitPriceExclVat,
  className = "",
}: {
  eligible?: boolean | null;
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
            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded cursor-default ${className}`}
            style={{ background: "rgba(244,185,66,0.15)", color: "#D89620" }}
          >
            🪙 +{pct}%
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {perUnit > 0
            ? `Cette offre vous rapporte ${perUnit.toFixed(2)} € de cagnotte par unité vendue.`
            : `Cette offre vous rapporte ${pct}% de cagnotte fidélité.`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
