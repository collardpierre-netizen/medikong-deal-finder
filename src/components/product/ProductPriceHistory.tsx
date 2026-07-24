import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart as LineChartIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";

/**
 * Historique de prix marché (source: qogita_public) affiché sur la fiche produit.
 *
 * - Lit `qogita_price_history` filtré sur le GTIN (PK gtin+price_date : requête indexée).
 * - Lit la RPC `qogita_price_trends(gtin)` pour J/J, 7 j, 30 j.
 * - État vide discret si le produit n'est pas dans `tendances_index_basket`
 *   ou n'a pas encore d'historique — jamais d'erreur bloquante.
 * - Perf : deux queries parallèles, `staleTime` 10 min, skeleton pendant le fetch.
 */

interface Props {
  gtin: string | null | undefined;
  productName?: string;
}

interface HistoryRow {
  price_date: string;
  price_eur: number;
}

interface TrendRow {
  gtin: string;
  last_date: string | null;
  last_price: number | null;
  change_1d_pct: number | null;
  change_7d_pct: number | null;
  change_30d_pct: number | null;
}

const NAVY = "#1E293B";
const EMERALD = "#10B981";
const CRIMSON = "#DC2626";
const NEUTRAL = "#64748B";

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} €`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function VariationBadge({ label, pct }: { label: string; pct: number | null | undefined }) {
  const hasValue = pct != null && Number.isFinite(pct);
  const isFlat = hasValue && Math.abs(pct as number) < 0.05;
  // Pour un acheteur : baisse = bonne nouvelle (vert), hausse = rouge.
  const color = !hasValue || isFlat ? NEUTRAL : (pct as number) < 0 ? EMERALD : CRIMSON;
  const Icon = !hasValue || isFlat ? Minus : (pct as number) < 0 ? TrendingDown : TrendingUp;
  const sign = hasValue && !isFlat ? ((pct as number) > 0 ? "+" : "") : "";
  return (
    <div className="flex flex-col items-start gap-0.5 rounded-md border border-border bg-card px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color }}>
        <Icon size={12} aria-hidden />
        {hasValue ? `${sign}${(pct as number).toFixed(2)} %` : "—"}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
      <LineChartIcon size={20} className="mx-auto mb-2 text-muted-foreground" aria-hidden />
      <p className="text-xs text-muted-foreground">
        Historique de prix bientôt disponible pour ce produit.
      </p>
    </div>
  );
}

export function ProductPriceHistory({ gtin, productName }: Props) {
  const enabled = !!gtin;

  const { data: history, isLoading: historyLoading } = useQuery<HistoryRow[]>({
    queryKey: ["qogita-price-history", gtin],
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qogita_price_history")
        .select("price_date, price_eur")
        .eq("gtin", gtin!)
        .order("price_date", { ascending: true })
        .limit(120);
      if (error) throw error;
      return (data || []) as HistoryRow[];
    },
  });

  const { data: trend, isLoading: trendLoading } = useQuery<TrendRow | null>({
    queryKey: ["qogita-price-trend", gtin],
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("qogita_price_trends", { _gtin: gtin! });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as TrendRow | undefined) : (data as TrendRow | null);
      return row ?? null;
    },
  });

  if (!enabled) return null;

  const isLoading = historyLoading || trendLoading;
  const hasHistory = !!history && history.length > 0;

  const chartData = (history || []).map((r) => ({
    date: r.price_date,
    label: formatShortDate(r.price_date),
    price: Number(r.price_eur),
  }));

  return (
    <section
      className="mb-8 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="price-history-title"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2
            id="price-history-title"
            className="text-base font-bold text-foreground flex items-center gap-2"
            style={{ color: NAVY }}
          >
            <LineChartIcon size={16} aria-hidden />
            Historique de prix marché
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Prix public observé (source&nbsp;: Qogita)
            {productName ? ` · ${productName}` : ""}
          </p>
        </div>
        {hasHistory && trend && (
          <div className="flex flex-wrap gap-1.5">
            <VariationBadge label="J/J" pct={trend.change_1d_pct} />
            <VariationBadge label="7 j" pct={trend.change_7d_pct} />
            <VariationBadge label="30 j" pct={trend.change_30d_pct} />
          </div>
        )}
      </header>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !hasHistory ? (
        <EmptyState />
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={48}
                tickFormatter={(v) => `${Number(v).toFixed(2)}`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                }}
                labelFormatter={(_l, payload) => {
                  const raw = payload?.[0]?.payload?.date as string | undefined;
                  return raw
                    ? new Date(raw).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "";
                }}
                formatter={(v: number) => [formatEur(v), "Prix marché HTVA"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={NAVY}
                strokeWidth={2}
                dot={{ r: 2, fill: NAVY }}
                activeDot={{ r: 4, fill: EMERALD, stroke: NAVY, strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default ProductPriceHistory;
