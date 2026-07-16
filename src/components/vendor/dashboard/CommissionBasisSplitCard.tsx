import { VCard } from "@/components/vendor/ui/VCard";
import { useMoneyFormat } from "@/lib/money-format";
import { TrendingUp, Percent, HelpCircle } from "lucide-react";

interface Props {
  tradingCents: number;
  marketplaceCents: number;
  otherCents: number;
  loading?: boolean;
}

/**
 * Split de la commission MediKong par nature :
 * - Trading (basis=margin) : 100% de la marge PV−PA
 * - Marketplace (basis=ca) : % du CA HTVA
 * - Autre / non renseigné
 */
export default function CommissionBasisSplitCard({
  tradingCents,
  marketplaceCents,
  otherCents,
  loading,
}: Props) {
  const { formatMoney } = useMoneyFormat();
  const total = tradingCents + marketplaceCents + otherCents;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  const rows = [
    {
      key: "trading",
      label: "Commission trading",
      sub: "100% marge (PV − PA)",
      value: tradingCents,
      icon: <TrendingUp size={14} className="text-white" />,
      color: "#7C3AED",
    },
    {
      key: "marketplace",
      label: "Commission marketplace",
      sub: "% du CA HTVA (classique)",
      value: marketplaceCents,
      icon: <Percent size={14} className="text-white" />,
      color: "#F59E0B",
    },
    {
      key: "other",
      label: "Autres / non catégorisées",
      sub: "base non renseignée",
      value: otherCents,
      icon: <HelpCircle size={14} className="text-white" />,
      color: "#94A3B8",
    },
  ];

  return (
    <VCard>
      <div className="mb-3">
        <h3 className="text-[13px] font-bold text-[#1D2530]">
          Répartition de la commission MediKong
        </h3>
        <p className="text-[11px] text-[#8B95A5]">
          Trading (100% marge) vs Marketplace (% du CA)
        </p>
      </div>

      {loading ? (
        <div className="h-20 w-full animate-pulse bg-[#F1F5F9] rounded" />
      ) : total === 0 ? (
        <div className="text-[12px] text-[#8B95A5] py-4">
          Aucune commission facturée sur la période.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: r.color }}
              >
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#1D2530] truncate">
                    {r.label}
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-[#1D2530]">
                    {formatMoney(r.value / 100, { fractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct(r.value)}%`, backgroundColor: r.color }}
                    />
                  </div>
                  <span className="text-[10.5px] tabular-nums text-[#8B95A5] w-10 text-right">
                    {pct(r.value).toFixed(0)}%
                  </span>
                </div>
                <div className="text-[10.5px] text-[#8B95A5] mt-0.5">{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </VCard>
  );
}
