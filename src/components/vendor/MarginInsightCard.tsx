import { TrendingUp, TrendingDown, Wallet, Receipt, Coins, Info } from "lucide-react";
import type { MarginBreakdown } from "@/lib/vendorMargin";
import { fmtEur, fmtPct, type CommissionModel } from "@/lib/vendorMargin";

interface Props {
  breakdown: MarginBreakdown;
  commissionModel: CommissionModel;
  /** Optional label override for the commission line */
  compact?: boolean;
}

/**
 * Affiche, côté vendeur, le breakdown :
 *  - Prix de vente HTVA
 *  - Prix d'achat HTVA (si renseigné)
 *  - Commission MediKong (% / €)
 *  - Net en poche
 *  - Marge nette (€ / %) si prix d'achat connu
 */
export function MarginInsightCard({ breakdown, commissionModel, compact = false }: Props) {
  const b = breakdown;
  const marginPositive = b.netMargin >= 0;
  const commissionLabel =
    commissionModel === "flat_percentage"
      ? "Commission MediKong"
      : commissionModel === "margin_split"
        ? "Commission MediKong (split de marge)"
        : "Commission MediKong (forfait/unité)";

  return (
    <div
      className={`rounded-lg border ${compact ? "p-2.5" : "p-3"}`}
      style={{ borderColor: "#E2E8F0", backgroundColor: "#FAFBFC" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Wallet size={14} style={{ color: "#1B5BDA" }} />
        <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
          Marge & commission
        </span>
        {!b.hasCost && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
          >
            <Info size={10} /> Renseignez le prix d'achat pour voir la marge nette
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] tabular-nums">
        <span style={{ color: "#616B7C" }}>Prix de vente HTVA</span>
        <span className="text-right font-medium" style={{ color: "#1D2530" }}>
          {fmtEur(b.sellPrice)}
        </span>

        {b.hasCost && (
          <>
            <span style={{ color: "#616B7C" }}>Prix d'achat HTVA</span>
            <span className="text-right font-medium" style={{ color: "#1D2530" }}>
              {fmtEur(b.purchasePrice)}
            </span>

            <span style={{ color: "#616B7C" }}>Marge brute</span>
            <span
              className="text-right font-medium"
              style={{ color: b.grossMargin >= 0 ? "#059669" : "#EF4343" }}
            >
              {fmtEur(b.grossMargin)} ({fmtPct(b.grossMarginPct)})
            </span>
          </>
        )}

        <span className="flex items-center gap-1" style={{ color: "#616B7C" }}>
          <Receipt size={11} /> {commissionLabel}
        </span>
        <span className="text-right font-medium" style={{ color: "#EF4343" }}>
          − {fmtEur(b.commission)}{" "}
          <span className="text-[10px]" style={{ color: "#8B95A5" }}>
            ({fmtPct(b.commissionPct)})
          </span>
        </span>

        <span className="flex items-center gap-1 font-semibold" style={{ color: "#1D2530" }}>
          <Coins size={11} style={{ color: "#1B5BDA" }} /> Net en poche
        </span>
        <span className="text-right font-bold" style={{ color: "#1B5BDA" }}>
          {fmtEur(b.netRevenue)}
        </span>

        {b.hasCost && (
          <>
            <span
              className="flex items-center gap-1 font-semibold"
              style={{ color: "#1D2530" }}
            >
              {marginPositive ? (
                <TrendingUp size={11} style={{ color: "#059669" }} />
              ) : (
                <TrendingDown size={11} style={{ color: "#EF4343" }} />
              )}
              Marge nette (après commission)
            </span>
            <span
              className="text-right font-bold"
              style={{ color: marginPositive ? "#059669" : "#EF4343" }}
            >
              {fmtEur(b.netMargin)}{" "}
              <span className="text-[10px]" style={{ color: "#8B95A5" }}>
                ({fmtPct(b.netMarginPct)})
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
