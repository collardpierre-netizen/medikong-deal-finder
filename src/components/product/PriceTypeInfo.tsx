import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "react-router-dom";

export type PriceType =
  | "medikong"
  | "external"
  | "market"
  | "pvp"
  | "my-purchase"
  | "medikong-vs-mine";

type Def = {
  label: string;
  short: string;
  long: string;
};

const DEFS: Record<PriceType, Def> = {
  medikong: {
    label: "Marketplace MediKong",
    short:
      "Prix HTVA proposé par les vendeurs MediKong (grossistes / marques / distributeurs vérifiés).",
    long:
      "Prix HTVA fermes proposés par les vendeurs présents sur la marketplace MediKong (grossistes, marques, distributeurs vérifiés). C'est le prix que vous paierez réellement si vous commandez ici. Hors TVA, hors transport.",
  },
  external: {
    label: "Offres externes",
    short:
      "Prix HTVA agrégés depuis d'autres plateformes B2B / grossistes (veille concurrentielle).",
    long:
      "Prix HTVA observés sur d'autres plateformes B2B ou sites grossistes (veille concurrentielle agrégée). Indicatif uniquement : la commande s'effectue chez le vendeur externe, hors MediKong. Peut inclure ou non frais de port et conditions de pack.",
  },
  market: {
    label: "Prix marché",
    short:
      "Prix HTVA médian observé sur le marché B2B pour ce produit (référence d'achat professionnels).",
    long:
      "Médiane HTVA des prix observés chez les autres grossistes / plateformes B2B (veille concurrentielle agrégée). Sert de référence pour situer un prix d'achat professionnel habituel. Hors TVA, hors transport.",
  },
  pvp: {
    label: "PVP conseillé",
    short:
      "Prix Public TTC conseillé (APB / PMR ou indiqué par le fabricant).",
    long:
      "Prix Public de Vente conseillé, TVA incluse. Source : référentiel officiel (APB, PMR) ou indication du fabricant / distributeur officiel. C'est le prix généralement affiché en pharmacie pour le consommateur final.",
  },
  "my-purchase": {
    label: "Mon prix d'achat",
    short:
      "Prix HTVA que vous payez actuellement chez votre fournisseur habituel.",
    long:
      "Prix HTVA que vous avez encodé comme votre prix d'achat actuel chez votre fournisseur habituel. Sert de base à la comparaison avec le prix MediKong. Hors TVA, hors transport.",
  },
  "medikong-vs-mine": {
    label: "Prix MediKong",
    short:
      "Meilleur prix HTVA disponible sur MediKong pour ce produit (marge éventuelle déjà appliquée).",
    long:
      "Meilleur prix HTVA actuellement disponible sur la marketplace MediKong pour ce produit. La marge éventuelle de votre paramétrage est déjà appliquée. C'est ce prix qui est comparé à votre prix d'achat actuel pour calculer l'économie potentielle.",
  },
};

interface PriceTypeInfoProps {
  type: PriceType;
  /** Render the label next to the icon (default false = icon only). */
  showLabel?: boolean;
  className?: string;
}

export function PriceTypeInfo({
  type,
  showLabel = false,
  className = "",
}: PriceTypeInfoProps) {
  const def = DEFS[type];

  return (
    <TooltipProvider delayDuration={150}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`En savoir plus sur : ${def.label}`}
                className={`inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded ${className}`}
              >
                {showLabel && (
                  <span className="text-xs font-medium">{def.label}</span>
                )}
                <Info size={14} aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {def.short}
          </TooltipContent>
        </Tooltip>
        <PopoverContent side="top" className="w-80 text-sm">
          <div className="space-y-2">
            <div className="font-bold text-foreground">{def.label}</div>
            <p className="text-muted-foreground leading-relaxed">{def.long}</p>
            <Link
              to="/aide/glossaire-prix"
              className="inline-block text-xs text-primary font-medium hover:underline pt-1"
            >
              Voir le glossaire complet →
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

export default PriceTypeInfo;
