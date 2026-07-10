import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { VCard } from "@/components/vendor/ui/VCard";
import { useMoneyFormat } from "@/lib/money-format";

interface Props {
  data: Array<{
    day: number;
    date: string;
    revenueCents: number;
    commissionCents?: number;
    netMarginCents?: number;
  }>;
  loading?: boolean;
}

type ViewMode = "daily" | "cumulative";

const SERIES = [
  { key: "revenueEur", label: "CA HTVA", color: "#1B5BDA" },
  { key: "commissionEur", label: "Commission MediKong", color: "#F59E0B" },
  { key: "netMarginEur", label: "Marge nette", color: "#059669" },
] as const;

export default function RevenueTrendCard({ data, loading }: Props) {
  const { formatMoney } = useMoneyFormat();
  const [mode, setMode] = useState<ViewMode>("daily");
  const [visible, setVisible] = useState<Record<string, boolean>>({
    revenueEur: true,
    commissionEur: true,
    netMarginEur: true,
  });

  let accR = 0, accC = 0, accN = 0;
  const series = data.map((d) => {
    const r = (d.revenueCents ?? 0) / 100;
    const c = (d.commissionCents ?? 0) / 100;
    const n = (d.netMarginCents ?? 0) / 100;
    accR += r; accC += c; accN += n;
    return {
      day: d.day,
      date: d.date,
      revenueEur: mode === "cumulative" ? accR : r,
      commissionEur: mode === "cumulative" ? accC : c,
      netMarginEur: mode === "cumulative" ? accN : n,
    };
  });

  const totalRev = data.reduce((s, d) => s + (d.revenueCents ?? 0), 0) / 100;
  const totalComm = data.reduce((s, d) => s + (d.commissionCents ?? 0), 0) / 100;
  const totalNet = data.reduce((s, d) => s + (d.netMarginCents ?? 0), 0) / 100;

  return (
    <VCard className="h-full">
      <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
        <div>
          <h3 className="text-[13px] font-bold text-[#1D2530]">Pilotage financier — série journalière</h3>
          <p className="text-[11px] text-[#8B95A5]">
            CA {formatMoney(totalRev, { fractionDigits: 0 })} · Commission {formatMoney(totalComm, { fractionDigits: 0 })} · Net {formatMoney(totalNet, { fractionDigits: 0 })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["daily", "cumulative"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2 py-0.5 text-[10.5px] rounded-full font-semibold"
              style={{
                backgroundColor: mode === m ? "#1B5BDA" : "#F1F5F9",
                color: mode === m ? "#fff" : "#475569",
              }}
            >
              {m === "daily" ? "Journalier" : "Cumulé"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded border"
            style={{
              borderColor: visible[s.key] ? s.color : "#E2E8F0",
              color: visible[s.key] ? s.color : "#94A3B8",
              backgroundColor: visible[s.key] ? `${s.color}12` : "#fff",
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: visible[s.key] ? s.color : "#CBD5E1" }} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="h-[240px] mt-1">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-[#F1F5F9] rounded" />
        ) : totalRev === 0 ? (
          <div className="h-full flex items-center justify-center text-[12px] text-[#8B95A5]">
            Aucune vente enregistrée sur la période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1B5BDA" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#1B5BDA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8B95A5" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
              <YAxis tick={{ fontSize: 10, fill: "#8B95A5" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} tickFormatter={(v) => `${Math.round(v)}`} width={44} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                labelFormatter={(day) => `Jour ${day}`}
                formatter={(v: number, name: string) => [formatMoney(v, { fractionDigits: 0 }), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              {visible.revenueEur && (
                <Area type="monotone" name="CA HTVA" dataKey="revenueEur" stroke="#1B5BDA" strokeWidth={2} fill="url(#revenueGrad)" />
              )}
              {visible.commissionEur && (
                <Line type="monotone" name="Commission MK" dataKey="commissionEur" stroke="#F59E0B" strokeWidth={2} dot={false} />
              )}
              {visible.netMarginEur && (
                <Line type="monotone" name="Marge nette" dataKey="netMarginEur" stroke="#059669" strokeWidth={2} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </VCard>
  );
}
