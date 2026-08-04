import { RefreshCw } from "lucide-react";
import { useSecondLife } from "@/hooks/useRestockAvailability";

function formatEur(n: number) {
  return n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Label « seconde vie » à la Coolblue/Fnac (« Aussi en occasion dès X € ») :
 * un liseré discret sous le prix neuf, qui renvoie vers l'univers ReStock.
 */
export function SecondLifeBadge({
  gtin,
  cnk,
  variant = "line",
  className = "",
}: {
  gtin?: string | null;
  cnk?: string | null;
  variant?: "line" | "corner";
  className?: string;
}) {
  const info = useSecondLife(gtin, cnk);
  if (!info || info.count === 0) return null;

  const price = info.minPriceHt;

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

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 ${className}`}
      title="Lots ReStock : courte péremption ou emballage abîmé, vendus séparément du catalogue neuf"
    >
      <RefreshCw size={11} className="shrink-0" />
      <span className="truncate">
        Aussi en <strong>seconde vie</strong>
        {price != null ? <> dès <strong>{formatEur(price)} €</strong> HTVA</> : null}
        {info.bestGrade ? <span className="text-emerald-700/80 dark:text-emerald-400/80"> · grade {info.bestGrade}</span> : null}
      </span>
    </div>
  );
}
