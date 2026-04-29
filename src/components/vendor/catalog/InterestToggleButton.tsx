import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useVendorCatalogInterests, type InterestTarget } from "@/hooks/useVendorCatalogInterests";

interface InterestToggleButtonProps {
  target: InterestTarget;
  size?: "sm" | "icon";
  className?: string;
}

/**
 * Bouton étoile pour suivre/désuivre une marque, un fabricant ou une catégorie.
 * Quand suivi, le vendeur reçoit automatiquement les notifications déclenchées par
 * les triggers DB sur activation marque/produit.
 */
export function InterestToggleButton({ target, size = "icon", className }: InterestToggleButtonProps) {
  const { isFollowing, toggle, isPending, isLoading } = useVendorCatalogInterests();
  const following = !!isFollowing(target);
  const labelMap = { brand: "cette marque", manufacturer: "ce fabricant", category: "cette catégorie" };
  const tooltip = following
    ? `Retirer ${labelMap[target.kind]} de ma veille`
    : `Suivre ${labelMap[target.kind]} (notifications nouveautés)`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={following ? "default" : "outline"}
            size={size === "icon" ? "icon" : "sm"}
            disabled={isPending || isLoading}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggle(target);
            }}
            aria-pressed={following}
            aria-label={tooltip}
            className={cn(
              size === "icon" ? "h-7 w-7" : "h-7 px-2 gap-1",
              following && "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200",
              className,
            )}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Star className={cn("h-3.5 w-3.5", following && "fill-current")} />
            )}
            {size !== "icon" && <span className="text-xs">{following ? "Suivi" : "Suivre"}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
