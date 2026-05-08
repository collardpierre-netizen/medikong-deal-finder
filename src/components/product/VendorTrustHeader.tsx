import { Shield, MapPin, Clock, Truck, Star, Package, Info, BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VendorTrust } from "@/hooks/useVendorTrust";

const COUNTRY_LABELS: Record<string, string> = {
  BE: "Belgique",
  NL: "Pays-Bas",
  FR: "France",
  DE: "Allemagne",
  LU: "Luxembourg",
  IT: "Italie",
  ES: "Espagne",
};

function countryName(iso: string | null) {
  if (!iso) return "l'UE";
  return COUNTRY_LABELS[iso.toUpperCase()] ?? iso.toUpperCase();
}

function formatJoined(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-BE", { month: "2-digit", year: "numeric" });
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")}k`;
  return n.toLocaleString("fr-BE");
}

interface Props {
  trust: VendorTrust;
  /** "compact" : bandeau réduit (1 ligne nom + chips) ; "full" : avec en-tête + tooltip identifiant */
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Affiche le nom (ou identifiant anonymisé) d'un vendeur + une rangée de chips
 * de confiance (KYC, origine, ancienneté, livraison, avis, volume).
 * Règles :
 *  - On ne montre un signal que si la donnée est statistiquement valable.
 *  - On ne montre jamais de signal négatif.
 *  - Pas de signaux bidons : un nouveau vendeur sans historique n'affiche que KYC + origine + ancienneté.
 */
export function VendorTrustHeader({ trust, variant = "full", className = "" }: Props) {
  const isAnonymous = trust.displayMode === "anonymous";
  const displayName = isAnonymous
    ? `Fournisseur ${trust.publicIdentifier}`
    : trust.companyName ?? `Fournisseur ${trust.publicIdentifier}`;

  const chips: React.ReactNode[] = [];

  if (trust.isFaggVerified) {
    chips.push(
      <Chip key="fagg" tone="success" icon={BadgeCheck} label="Vérifié FAGG" tooltip="Licence AFMPS approuvée par MediKong" />
    );
  } else if (trust.isKycVerified) {
    chips.push(
      <Chip key="kyc" tone="primary" icon={Shield} label="Vérifié MediKong" tooltip="KYC validé par MediKong" />
    );
  }

  if (trust.shipsFromCountry) {
    chips.push(
      <Chip
        key="origin"
        tone="muted"
        icon={MapPin}
        label={`Expédie depuis ${countryName(trust.shipsFromCountry)}`}
      />
    );
  }

  if (trust.monthsActive >= 1) {
    chips.push(
      <Chip
        key="seniority"
        tone="muted"
        icon={Clock}
        label={`Sur MediKong depuis ${formatJoined(trust.joinedAt)}`}
      />
    );
  }

  if (trust.onTimePct90d !== null && trust.orders90dCount >= 10) {
    chips.push(
      <Chip
        key="ontime"
        tone="success"
        icon={Truck}
        label={`${trust.onTimePct90d} % livraisons dans les délais`}
        tooltip={`Sur ${trust.orders90dCount} commandes des 90 derniers jours`}
      />
    );
  }

  if (trust.avgScore !== null && trust.ratingsCount >= 5) {
    chips.push(
      <Chip
        key="rating"
        tone="amber"
        icon={Star}
        label={`${trust.avgScore.toFixed(1)} / 5 (${trust.ratingsCount} avis)`}
      />
    );
  }

  if (trust.totalOrders >= 50) {
    chips.push(
      <Chip
        key="volume"
        tone="muted"
        icon={Package}
        label={`${formatCount(trust.totalOrders)} commandes traitées`}
      />
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-bold text-sm text-foreground">{displayName}</span>
        {isAnonymous && variant === "full" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Pourquoi un identifiant ?"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/60 rounded px-1.5 py-0.5 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Identifiant vendeur <Info size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-xs">
              <span className="block font-semibold mb-1">Pourquoi un identifiant&nbsp;?</span>
              Pour préserver les meilleurs prix, certains vendeurs choisissent de rester
              anonymes sur la marketplace. Tous sont vérifiés par MediKong avant
              publication.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {chips.length > 0 && <div className="flex items-center gap-1.5 flex-wrap">{chips}</div>}
    </div>
  );
}

/* ── Chip ─────────────────────────────────────────── */

type Tone = "success" | "primary" | "amber" | "muted";
const TONE_CLASSES: Record<Tone, string> = {
  success: "text-green-700 bg-green-50 border border-green-100",
  primary: "text-primary bg-primary/10 border border-primary/15",
  amber: "text-amber-700 bg-amber-50 border border-amber-100",
  muted: "text-muted-foreground bg-muted/60 border border-border",
};

function Chip({
  tone,
  icon: Icon,
  label,
  tooltip,
}: {
  tone: Tone;
  icon: typeof Shield;
  label: string;
  tooltip?: string;
}) {
  const node = (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${TONE_CLASSES[tone]} ${tooltip ? "cursor-help" : ""}`}
    >
      <Icon size={11} />
      {label}
    </span>
  );
  if (!tooltip) return node;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
