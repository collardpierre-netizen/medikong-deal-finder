import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { VCard } from "@/components/vendor/ui/VCard";
import { useMoneyFormat } from "@/lib/money-format";

interface Props {
  data: Array<{ day: number; date: string; revenueCents: number }>;
  loading?: boolean;
}

/**
 * Courbe du CA HTVA quotidien du mois en cours.
 * Utilise les cents renvoyés par useVendorMonthlyDashboard.
 */
export default function RevenueTrendCard({ data, loading }: Props) {
  const { formatMoney } = useMoneyFormat();
  const series = data.map((d) => ({ ...d, revenueEur: d.revenueCents / 100 }));
  const total = series.reduce((s, d) => s + d.revenueEur, 0);
  const today = new Date().getDate();
  const cumulativeToday = series
    .filter((d) => d.day <= today)
    .reduce((s, d) => s + d.revenueEur, 0);

  return (
    <VCard className="h-full">
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <h3 className="text-[13px] font-bold text-[#1D2530]">CA en cours (HTVA)</h3>
          <p className="text-[11px] text-[#8B95A5]">
            Cumulé au {today.toString().padStart(2, "0")} —{" "}
            <span className="font-semibold text-[#1D2530]">
              {formatMoney(cumulativeToday, { fractionDigits: 0 })}
            </span>
          </p>
        </div>
        <span className="text-[11px] text-[#8B95A5]">
          Mois : {formatMoney(total, { fractionDigits: 0 })}
        </span>
      </div>
      <div className="h-[220px] mt-2">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-[#F1F5F9] rounded" />
        ) : total === 0 ? (
          <div className="h-full flex items-center justify-center text-[12px] text-[#8B95A5]">
            Aucune vente enregistrée ce mois.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1B5BDA" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1B5BDA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "#8B95A5" }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#8B95A5" }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
                tickFormatter={(v) => `${Math.round(v)}`}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
                labelFormatter={(day) => `Jour ${day}`}
                formatter={(v: number) => [formatMoney(v, { fractionDigits: 0 }), "CA HTVA"]}
              />
              <Area
                type="monotone"
                dataKey="revenueEur"
                stroke="#1B5BDA"
                strokeWidth={2}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </VCard>
  );
}
