import { useMemo, useState } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart, Legend,
} from "recharts";
import { CalendarClock } from "lucide-react";
import { fmtEur } from "@/lib/format-currency";

type Period = "day" | "week" | "month";

interface OrderLike {
  created_at: string;
  total_incl_vat?: number | string | null;
  status?: string | null;
  is_forecast?: boolean | null;
  was_forecast?: boolean | null;
  forecast_created_at?: string | null;
  forecast_snapshot?: { total_incl_vat?: number | string | null; created_at?: string | null } | null;
}

interface Props {
  title: string;
  orders: OrderLike[];
  includeForecast?: boolean;
  onIncludeForecastChange?: (v: boolean) => void;
}

const EXCLUDED_STATUSES = new Set(["cancelled", "refused", "rejected"]);

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function buildBuckets(period: Period): { key: string; label: string; date: Date }[] {
  const now = new Date();
  const buckets: { key: string; label: string; date: Date }[] = [];

  if (period === "day") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("fr-BE", { day: "2-digit", month: "short" }),
        date: d,
      });
    }
  } else if (period === "week") {
    for (let i = 11; i >= 0; i--) {
      const d = startOfWeek(now);
      d.setDate(d.getDate() - i * 7);
      buckets.push({
        key: `w-${d.toISOString().slice(0, 10)}`,
        label: d.toLocaleDateString("fr-BE", { day: "2-digit", month: "short" }),
        date: d,
      });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-BE", { month: "short", year: "2-digit" }),
        date: d,
      });
    }
  }
  return buckets;
}

function bucketKeyFor(date: Date, period: Period): string {
  if (period === "day") return date.toISOString().slice(0, 10);
  if (period === "week") {
    const s = startOfWeek(date);
    return `w-${s.toISOString().slice(0, 10)}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const formatEuro = (v: number) => {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(1)}k`;
  return `€${Math.round(v)}`;
};

const fmtFull = (v: number) => `€${fmtEur(v)}`;

export default function GmvEvolutionChart({ title, orders, includeForecast: includeForecastProp, onIncludeForecastChange }: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [includeForecastLocal, setIncludeForecastLocal] = useState(false);
  const includeForecast = includeForecastProp ?? includeForecastLocal;
  const setIncludeForecast = (v: boolean) => {
    if (onIncludeForecastChange) onIncludeForecastChange(v);
    else setIncludeForecastLocal(v);
  };

  const forecastCount = useMemo(
    () => orders.filter(o => o.is_forecast || o.was_forecast).length,
    [orders],
  );

  const data = useMemo(() => {
    const buckets = buildBuckets(period);
    const map = new Map(buckets.map(b => [b.key, { ...b, gmv: 0, forecast: 0 }]));
    for (const o of orders) {
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = bucketKeyFor(d, period);
      const row = map.get(key);
      if (!row) continue;

      // Prévisionnel : on s'appuie sur was_forecast (inclut converties / annulées) et la valeur figée du snapshot.
      // Date du bucket = date d'origine prévisionnelle si dispo, sinon created_at.
      const isHistoricallyForecast = !!(o.is_forecast || o.was_forecast);
      if (isHistoricallyForecast) {
        const forecastDateStr = o.forecast_created_at || (o.forecast_snapshot?.created_at as string | undefined) || o.created_at;
        const fd = new Date(forecastDateStr);
        const fKey = Number.isNaN(fd.getTime()) ? key : bucketKeyFor(fd, period);
        const fRow = map.get(fKey);
        const snap = Number(o.forecast_snapshot?.total_incl_vat);
        const fAmount = Number.isFinite(snap) && snap > 0 ? snap : (Number(o.total_incl_vat) || 0);
        if (fRow) fRow.forecast += fAmount;
      }

      // GMV réelle : exclut commandes en statut annulé et exclut les prévisionnelles actives (sauf si toggle inclure)
      if (o.status && EXCLUDED_STATUSES.has(o.status)) continue;
      if (o.is_forecast && !includeForecast) continue;
      const amount = Number(o.total_incl_vat) || 0;
      row.gmv += amount;
    }
    let cum = 0;
    return Array.from(map.values()).map(r => {
      cum += r.gmv;
      return { ...r, cumulative: cum };
    });
  }, [orders, period, includeForecast]);

  const total = data.reduce((s, r) => s + r.gmv, 0);
  const totalForecast = data.reduce((s, r) => s + r.forecast, 0);
  const hasData = total > 0 || totalForecast > 0;

  const periods: { key: Period; label: string }[] = [
    { key: "day", label: "Jour" },
    { key: "week", label: "Semaine" },
    { key: "month", label: "Mois" },
  ];

  return (
    <div className="p-5 rounded-[10px] animate-fade-in" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>{title}</h3>
        <div className="flex items-center gap-2">
          <label
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer select-none transition-colors"
            style={{
              backgroundColor: includeForecast ? "#EDE9FE" : "#fff",
              color: includeForecast ? "#6D28D9" : "#616B7C",
              border: `1px solid ${includeForecast ? "#DDD6FE" : "#E2E8F0"}`,
            }}
            title="Inclure les commandes prévisionnelles (tag « Prévisionnel »)"
          >
            <input
              type="checkbox"
              className="accent-violet-600"
              checked={includeForecast}
              onChange={(e) => setIncludeForecast(e.target.checked)}
            />
            <CalendarClock size={12} />
            Prévisionnel{forecastCount ? ` (${forecastCount})` : ""}
          </label>
          <div className="inline-flex rounded-md p-0.5" style={{ backgroundColor: "#F1F5F9" }}>
            {periods.map(p => {
              const active = p.key === period;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-[5px] transition-all duration-200"
                  style={{
                    backgroundColor: active ? "#fff" : "transparent",
                    color: active ? "#1B5BDA" : "#616B7C",
                    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hasData ? (
        <div key={`${period}-${includeForecast}`} className="animate-fade-in">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gmvLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1B5BDA" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#1B5BDA" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#8B95A5" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#8B95A5" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatEuro}
                width={56}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#10B981" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatEuro}
                width={56}
              />
              <Tooltip
                formatter={(value: number, name: string) => [fmtFull(Number(value)), name]}
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                cursor={{ stroke: "#1B5BDA", strokeDasharray: "3 3", strokeOpacity: 0.4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="plainline"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="gmv"
                name="GMV période"
                stroke="url(#gmvLineGrad)"
                strokeWidth={2.5}
                dot={{ r: 3, stroke: "#1B5BDA", strokeWidth: 2, fill: "#fff" }}
                activeDot={{ r: 5, stroke: "#1B5BDA", strokeWidth: 2, fill: "#fff" }}
                isAnimationActive
                animationDuration={650}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="forecast"
                name="Prévisionnel"
                stroke="#7C3AED"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 2.5, stroke: "#7C3AED", strokeWidth: 2, fill: "#fff" }}
                activeDot={{ r: 4, stroke: "#7C3AED", strokeWidth: 2, fill: "#fff" }}
                isAnimationActive
                animationDuration={650}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                name="GMV cumulée"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4, stroke: "#10B981", strokeWidth: 2, fill: "#fff" }}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[240px] text-[12px]" style={{ color: "#8B95A5" }}>
          Aucune donnée GMV sur cette période
        </div>
      )}
    </div>
  );
}
