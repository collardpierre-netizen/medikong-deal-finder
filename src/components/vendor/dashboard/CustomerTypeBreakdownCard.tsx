import { VCard } from "@/components/vendor/ui/VCard";
import { useMoneyFormat } from "@/lib/money-format";
import { CUSTOMER_TYPE_OPTIONS } from "@/pages/admin/AdminCustomers";
import type { CustomerTypeSlice } from "@/hooks/useVendorMonthlyDashboard";

interface Props {
  data: CustomerTypeSlice[];
  loading?: boolean;
}

const LABEL_BY_TYPE = Object.fromEntries(
  CUSTOMER_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);
const COLOR_BY_TYPE = Object.fromEntries(
  CUSTOMER_TYPE_OPTIONS.map((o) => [o.value, o.color]),
);

/**
 * Ventilation TTC par profil client sur le mois en cours.
 * Affichage sous forme de barres horizontales avec % de part de CA.
 */
export default function CustomerTypeBreakdownCard({ data, loading }: Props) {
  const { formatMoney } = useMoneyFormat();
  const total = data.reduce((s, d) => s + d.amountCents, 0);

  return (
    <VCard className="h-full">
      <div className="mb-3">
        <h3 className="text-[13px] font-bold text-[#1D2530]">Ventilation par profil</h3>
        <p className="text-[11px] text-[#8B95A5]">CA TTC du mois par typologie client</p>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 bg-[#F1F5F9] rounded animate-pulse" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="py-8 text-center text-[12px] text-[#8B95A5]">
          Aucune vente ce mois pour établir la ventilation.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {data.map((slice) => {
            const pct = total > 0 ? (slice.amountCents / total) * 100 : 0;
            const label = LABEL_BY_TYPE[slice.type] || slice.type;
            const color = COLOR_BY_TYPE[slice.type] || "#8B95A5";
            return (
              <li key={slice.type}>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="font-medium text-[#1D2530]">{label}</span>
                  <span className="tabular-nums text-[#616B7C]">
                    {formatMoney(slice.amountCents / 100, { fractionDigits: 0 })}{" "}
                    <span className="text-[10px] text-[#8B95A5]">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 bg-[#F1F5F9] rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </VCard>
  );
}
