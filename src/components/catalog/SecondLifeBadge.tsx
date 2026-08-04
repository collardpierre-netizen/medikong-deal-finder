import { RefreshCw } from "lucide-react";
import { useSecondLife } from "@/hooks/useRestockAvailability";

function formatEur(n: number) {
  return n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Économie estimée = prix neuf HTVA MediKong − prix seconde vie le plus bas.
 * Renvoie null si l'un des deux prix manque ou si la seconde vie n'est pas
 * moins chère (aucun intérêt à afficher une « économie » négative).
 */
export function estimateSecondLifeSaving(newPriceHt?: number | null, secondLifeMinHt?: number | null) {
  if (!newPriceHt || newPriceHt <= 0 || secondLifeMinHt == null) return null;
  const saving = newPriceHt - secondLifeMinHt;
  return saving > 0 ? saving : null;
}

/**
 * Label « seconde vie » à la Coolblue/Fnac (« Aussi en occasion dès X € ») :
 * un liseré discret sous le prix neuf, qui renvoie vers l'univers ReStock.
 */
export function SecondLifeBadge({
  gtin,
  cnk,
  newPriceHt,
  variant = "line",
  className = "",
}: {
  gtin?: string | null;
  cnk?: string | null;
  /** Prix neuf HTVA MediKong, pour calculer l'économie estimée. */
  newPriceHt?: number | null;
  variant?: "line" | "corner";
  className?: string;
}) {
  const info = useSecondLife(gtin, cnk);
  if (!info || info.count === 0) return null;

  const min = info.minPriceHt;
  const max = info.maxPriceHt;
  const saving = estimateSecondLifeSaving(newPriceHt, min);

  if (variant === "corner") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-emerald-600/95 px-1.5 py-0.5 text-[10px] font-bold text-white ${className}`}
        title="Ce produit existe aussi en seconde vie (lot courte péremption / emballage abîmé)"
      >
        <RefreshCw size={10} /> Seconde vie
      </span>
    );
  }

  const rangeLabel =
    min == null
      ? null
      : max != null && max > min
        ? `${formatEur(min)} – ${formatEur(max)} € HTVA`
        : `${formatEur(min)} € HTVA`;

  return (
    <div
      className={`rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 ${className}`}
      title="Lots ReStock : courte péremption ou emballage abîmé, vendus séparément du catalogue neuf"
    >
      <div className="flex items-center gap-1.5">
        <RefreshCw size={11} className="shrink-0" />
        <span className="truncate">
          Aussi en <strong>seconde vie</strong>
          {info.bestGrade ? <span className="text-emerald-700/80 dark:text-emerald-400/80"> · grade {info.bestGrade}</span> : null}
        </span>
      </div>
      {rangeLabel ? (
        <div className="mt-0.5 pl-[17px] leading-tight">
          {rangeLabel}
          {saving != null ? (
            <>
              {" · "}
              <strong>−{formatEur(saving)} €</strong> vs neuf
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
