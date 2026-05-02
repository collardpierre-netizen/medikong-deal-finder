import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type PackSizeSource,
  packSizeSourceBadge,
  packSizeSourceLabel,
} from "@/lib/pack-size";

/**
 * Explique de manière transparente comment le pack vendeur (CERP, Febelco, …)
 * a été extrait du libellé brut, et l'impact que ça a sur le calcul de l'écart
 * de prix vs MediKong.
 *
 * Cf. mem://regles-metier/cerp-pack-suffix-convention pour la table des règles
 * (priorité 0 suffixe `/N`, priorité 0 bis nombre nu final, garde-fous unités).
 */
export interface PackSizeExplainerProps {
  /** Pack résolu (1 si rien détecté). */
  packSize: number;
  /** Source ayant gagné la cascade (offer_override, product, offer_title_heuristic, …). */
  source: PackSizeSource;
  /** Libellé brut chez le vendeur (ex: "FRESUBIN 2 KCAL FIBRE PECHE 4"). */
  rawTitle?: string | null;
  /** URL de l'offre externe, pour rappel quand source = offer_url_heuristic. */
  rawUrl?: string | null;
  /** Prix pack brut (HTVA) chez le vendeur, pour illustrer l'impact. */
  packPriceEur?: number | null;
  /** Prix MediKong unitaire HTVA pour calculer l'écart "avant" / "après". */
  mkUnitPriceEur?: number | null;
}

/** Détecte la règle qui a probablement matché pour informer l'utilisateur. */
function detectMatchedRule(
  source: PackSizeSource,
  rawTitle?: string | null
): { code: string; description: string } {
  if (source !== "offer_title_heuristic" && source !== "name_heuristic") {
    return {
      code: "—",
      description: "Pack défini directement (override ou fiche produit), pas de regex.",
    };
  }
  const t = (rawTitle ?? "").trim();
  if (!t) return { code: "?", description: "Libellé brut indisponible." };

  // Règle 0 — suffixe "/N"
  if (/(?:^|\s)\/\s*\d{1,3}\b\s*$/.test(t)) {
    return {
      code: "Règle 0 — suffixe /N",
      description: 'Convention CERP type "/4" en fin de libellé.',
    };
  }
  // Règle 0 bis — nombre nu final (avec garde-fous unités)
  const trailing = t.match(/(?:^|\s)([A-Za-zÀ-ÿ./]+)\s+(\d{1,3})\s*$/);
  if (trailing) {
    const prev = trailing[1].toLowerCase().replace(/\.$/, "");
    const isUnit = /^(mg|ml|g|kg|cl|l|kcal|cc|oz|mcg|µg|ug|ui|iu|mm|cm|m|%)$/.test(prev);
    if (!isUnit) {
      return {
        code: "Règle 0 bis — nombre nu final",
        description: 'Convention CERP type "... PECHE 4" en fin de libellé (token précédent non-unité).',
      };
    }
  }
  // Règle 1 — N x Q unité
  if (/\b\d{1,3}\s*[x×]\s*\d+(?:[.,]\d+)?\s*(ml|cl|l|g|mg|kg|cc)\b/i.test(t)) {
    return {
      code: "Règle 1 — N×Q unité",
      description: 'Format "4 x 200 ml" : on prend le premier nombre comme pack.',
    };
  }
  // Règle 2 — forme galénique
  if (/\b\d{1,4}\s*(caps?|capsules?|cps|comprim[eé]s?|cpr?|g[eé]lules?|sachets?|sticks?|ampoules?|doses?)\b/i.test(t)) {
    return {
      code: "Règle 2 — forme galénique",
      description: 'Format "30 caps", "20 sachets", … : nombre de doses dans la boîte.',
    };
  }
  // Règle 3 — boîte/pack/lot de N
  if (/\b(?:bo[iî]te|pack|lot|paquet|box|set)\s*(?:de|d['’]|of)\s*\d{1,4}\b/i.test(t)) {
    return {
      code: "Règle 3 — Pack de N",
      description: 'Format "Boîte de 30", "Pack de 4", … explicite.',
    };
  }
  return {
    code: "?",
    description: "Aucune règle n'a matché — fallback à 1 unité par défaut.",
  };
}

function fmtEur(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PackSizeExplainer({
  packSize,
  source,
  rawTitle,
  rawUrl,
  packPriceEur,
  mkUnitPriceEur,
}: PackSizeExplainerProps) {
  const badge = packSizeSourceBadge(source);
  const rule = detectMatchedRule(source, rawTitle);
  const sourceLabel = packSizeSourceLabel(source);

  // Démonstration de l'impact : écart MK avec et sans normalisation pack.
  const hasImpact =
    packSize > 1 &&
    typeof packPriceEur === "number" &&
    packPriceEur > 0 &&
    typeof mkUnitPriceEur === "number" &&
    mkUnitPriceEur > 0;

  let unitPrice = 0;
  let deltaWithPct = 0;
  let deltaWithoutPct = 0;
  if (hasImpact) {
    unitPrice = (packPriceEur as number) / packSize;
    deltaWithPct = ((unitPrice - (mkUnitPriceEur as number)) / (mkUnitPriceEur as number)) * 100;
    deltaWithoutPct =
      (((packPriceEur as number) - (mkUnitPriceEur as number)) / (mkUnitPriceEur as number)) * 100;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border leading-none cursor-help hover:opacity-80 transition ${badge.className}`}
          title="Cliquer pour voir le détail de la détection du pack"
          aria-label={`Source du conditionnement : ${sourceLabel}. Cliquer pour le détail.`}
        >
          {badge.code}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] text-[12px] p-3 space-y-2.5" align="end" side="bottom">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-primary mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <div className="font-semibold text-foreground">Conditionnement détecté : ×{packSize}</div>
            <div className="text-[11px] text-muted-foreground">{sourceLabel}</div>
          </div>
        </div>

        {rawTitle && (
          <div className="rounded border border-border bg-muted/40 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
              Libellé brut
            </div>
            <div className="font-mono text-[11px] text-foreground break-words">{rawTitle}</div>
          </div>
        )}

        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Règle déclenchée
          </div>
          <div className="text-[11px] text-foreground">
            <span className="font-semibold">{rule.code}</span> — {rule.description}
          </div>
        </div>

        {rawUrl && source === "offer_url_heuristic" && (
          <div className="text-[10px] text-muted-foreground break-all">
            URL analysée : <span className="font-mono">{rawUrl}</span>
          </div>
        )}

        {hasImpact && (
          <div className="rounded border border-border bg-background px-2 py-1.5 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Impact sur l'écart vs MediKong
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Prix pack brut</span>
              <span className="font-mono tabular-nums">{fmtEur(packPriceEur as number)} €</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">÷ pack ×{packSize} = unitaire</span>
              <span className="font-mono tabular-nums font-semibold">{fmtEur(unitPrice)} €</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Prix MK unitaire</span>
              <span className="font-mono tabular-nums">{fmtEur(mkUnitPriceEur as number)} €</span>
            </div>
            <div className="border-t border-border pt-1 mt-1 space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-emerald-700">Écart corrigé (utilisé)</span>
                <span
                  className={`font-mono tabular-nums font-bold ${
                    deltaWithPct < 0 ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {deltaWithPct >= 0 ? "+" : ""}
                  {deltaWithPct.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Sans normalisation pack</span>
                <span className="font-mono tabular-nums line-through">
                  {deltaWithoutPct >= 0 ? "+" : ""}
                  {deltaWithoutPct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground italic pt-0.5">
              Sans la division par {packSize}, l'écart serait calculé sur le prix de la caisse
              entière → faussement défavorable au vendeur externe.
            </div>
          </div>
        )}

        {packSize === 1 && (
          <div className="text-[10px] text-muted-foreground italic">
            Pack à 1 par défaut : aucun multi-conditionnement détecté dans le libellé.
            Si le vendeur livre en réalité un carton, demander à l'admin de saisir un{" "}
            <code className="font-mono">pack_size_override</code> sur l'offre.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
