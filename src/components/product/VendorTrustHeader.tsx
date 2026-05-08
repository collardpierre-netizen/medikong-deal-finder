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

/** Convertit un code ISO 3166-1 alpha-2 en emoji drapeau régional. */
function countryFlag(iso: string | null): string | null {
  if (!iso || iso.length !== 2) return null;
  const cc = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

/** Initiales (max 2) à partir d'un libellé. */
function initialsOf(label: string): string {
  const parts = label.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + second).toUpperCase().slice(0, 2);
}

/** Couleur stable dérivée du nom (palette tokens-friendly). */
const AVATAR_PALETTE = [
  "bg-primary/10 text-primary",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
];
function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
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

  // Note : origine + rating sont désormais affichés inline dans la ligne d'identité,
  // on ne les répète pas en chip pour garder l'en-tête lisible.

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

  const flag = countryFlag(trust.shipsFromCountry);
  const originLabel = `Expédie depuis ${countryName(trust.shipsFromCountry)}`;
  const showRating = trust.avgScore !== null && trust.ratingsCount >= 5;
  const initials = initialsOf(displayName);
  const tone = avatarTone(trust.vendorId || displayName);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Identité — une seule ligne : avatar · nom · note · drapeau */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden="true"
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${tone}`}
        >
          {initials}
        </span>

        <span className="font-bold text-sm text-foreground truncate" title={displayName}>
          {displayName}
        </span>

        {showRating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 shrink-0 cursor-help">
                <Star size={11} className="fill-amber-500 text-amber-500" />
                {trust.avgScore!.toFixed(1)}
                <span className="text-muted-foreground font-normal">·{trust.ratingsCount}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {trust.avgScore!.toFixed(1)} / 5 sur {trust.ratingsCount} avis
            </TooltipContent>
          </Tooltip>
        )}

        {flag && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="text-base leading-none shrink-0 cursor-help"
                aria-label={originLabel}
                role="img"
              >
                {flag}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {originLabel}
            </TooltipContent>
          </Tooltip>
        )}

        {isAnonymous && variant === "full" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Pourquoi un identifiant ?"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/60 rounded px-1.5 py-0.5 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
              >
                ID <Info size={11} />
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
