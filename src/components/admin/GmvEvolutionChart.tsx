import { useMemo, useState } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, LineChart,
} from "recharts";

type Period = "day" | "week" | "month";

interface OrderLike {
  created_at: string;
  total_incl_vat?: number | string | null;
  status?: string | null;
}

interface Props {
  title: string;
  orders: OrderLike[];
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

export default function GmvEvolutionChart({ title, orders }: Props) {
  const [period, setPeriod] = useState<Period>("month");

  const data = useMemo(() => {
    const buckets = buildBuckets(period);
    const map = new Map(buckets.map(b => [b.key, { ...b, gmv: 0 }]));
    for (const o of orders) {
      if (o.status && EXCLUDED_STATUSES.has(o.status)) continue;
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = bucketKeyFor(d, period);
      const row = map.get(key);
      if (row) row.gmv += Number(o.total_incl_vat) || 0;
    }
    return Array.from(map.values());
  }, [orders, period]);

  const total = data.reduce((s, r) => s + r.gmv, 0);
  const hasData = total > 0;

  const periods: { key: Period; label: string }[] = [
    { key: "day", label: "Jour" },
    { key: "week", label: "Semaine" },
    { key: "month", label: "Mois" },
  ];

  return (
    <div className="p-5 rounded-[10px] animate-fade-in" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>{title}</h3>
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

      {hasData ? (
        <div key={period} className="animate-fade-in">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
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
                tick={{ fontSize: 11, fill: "#8B95A5" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatEuro}
                width={56}
              />
              <Tooltip
                formatter={(value: number) => [`€${Number(value).toLocaleString("fr-BE", { minimumFractionDigits: 2 })}`, "GMV"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                cursor={{ stroke: "#1B5BDA", strokeDasharray: "3 3", strokeOpacity: 0.4 }}
              />
              <Line
                type="monotone"
                dataKey="gmv"
                stroke="url(#gmvLineGrad)"
                strokeWidth={2.5}
                dot={{ r: 3, stroke: "#1B5BDA", strokeWidth: 2, fill: "#fff" }}
                activeDot={{ r: 5, stroke: "#1B5BDA", strokeWidth: 2, fill: "#fff" }}
                isAnimationActive
                animationDuration={650}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[220px] text-[12px]" style={{ color: "#8B95A5" }}>
          Aucune donnée GMV sur cette période
        </div>
      )}
    </div>
  );
}
