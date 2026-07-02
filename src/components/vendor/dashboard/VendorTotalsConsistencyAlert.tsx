import { AlertTriangle } from "lucide-react";
import { useMoneyFormat } from "@/lib/money-format";
import type { ConsistencyReport } from "@/lib/vendor-gmv-consistency";

interface Props {
  report: ConsistencyReport;
}

/**
 * Bannière d'erreur affichée uniquement si `checkVendorTotalsConsistency`
 * détecte au moins un écart entre les totaux CA/GMV du dashboard mensuel et
 * ceux de la carte de réconciliation. Silencieuse tant que tout concorde.
 */
export default function VendorTotalsConsistencyAlert({ report }: Props) {
  const { formatMoney } = useMoneyFormat();
  if (report.ok || report.issues.length === 0) return null;
  const fmt = (c: number) => formatMoney(c / 100, { fractionDigits: 2 });

  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[12px] text-[#7F1D1D]"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#B91C1C]" />
        <div className="space-y-1.5">
          <div className="font-semibold text-[#7F1D1D]">
            Incohérence détectée entre les totaux CA / GMV
          </div>
          <p className="text-[11px] leading-relaxed text-[#991B1B]">
            Les KPI mensuels et la carte de réconciliation devraient renvoyer
            exactement les mêmes chiffres (même source, mêmes filtres). Un écart
            dépassant la tolérance ({report.toleranceCents} c.) suggère un
            filtre manquant, un cache périmé ou une régression de la RPC
            <code className="mx-1">get_vendor_gmv_progress</code>. Merci de
            recharger la page ; si l'écart persiste, contactez le support en
            copiant les détails ci-dessous.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            {report.issues.map((issue) => (
              <li key={issue.code}>
                <span className="font-medium">{issue.message}</span>{" "}
                <span className="text-[#7F1D1D]">
                  {"deltaCents" in issue.details
                    ? `(écart ${fmt(issue.details.deltaCents)})`
                    : `(${issue.details.monthlyCount} vs ${issue.details.reconciliationCount})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
