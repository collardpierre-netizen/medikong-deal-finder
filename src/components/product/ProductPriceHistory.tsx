import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  type TooltipProps,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart as LineChartIcon,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

/**
 * Historique de prix marché (source: qogita_public) affiché sur la fiche produit.
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
const PRIMARY = "#1C58D9";
const EMERALD = "#059669";
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

function VariationPill({ label, pct }: { label: string; pct: number | null | undefined }) {
  const hasValue = pct != null && Number.isFinite(pct);
  const isFlat = hasValue && Math.abs(pct as number) < 0.05;
  const down = hasValue && !isFlat && (pct as number) < 0;
  const up = hasValue && !isFlat && (pct as number) > 0;

  const color = !hasValue || isFlat ? NEUTRAL : down ? EMERALD : CRIMSON;
  const bg = !hasValue || isFlat
    ? "rgba(100,116,139,0.08)"
    : down
    ? "rgba(5,150,105,0.10)"
    : "rgba(220,38,38,0.09)";
  const ring = !hasValue || isFlat
    ? "rgba(100,116,139,0.18)"
    : down
    ? "rgba(5,150,105,0.25)"
    : "rgba(220,38,38,0.22)";

  const Icon = !hasValue || isFlat ? Minus : down ? TrendingDown : TrendingUp;
  const sign = hasValue && !isFlat ? ((pct as number) > 0 ? "+" : "") : "";

  return (
    <div
      className="flex min-w-[64px] flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 transition-colors"
      style={{ background: bg, boxShadow: `inset 0 0 0 1px ${ring}` }}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="flex items-center gap-1 text-[13px] font-semibold tabular-nums leading-none"
        style={{ color }}
      >
        <Icon size={12} strokeWidth={2.5} aria-hidden />
        {hasValue ? `${sign}${(pct as number).toFixed(2)} %` : "—"}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "low" | "high" | "current";
}) {
  const color =
    tone === "low"
      ? EMERALD
      : tone === "high"
      ? CRIMSON
      : tone === "current"
      ? PRIMARY
      : NAVY;
  const Icon =
    tone === "low" ? ArrowDownRight : tone === "high" ? ArrowUpRight : null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="flex items-center gap-1 text-sm font-semibold tabular-nums"
        style={{ color }}
      >
        {Icon ? <Icon size={12} strokeWidth={2.5} aria-hidden /> : null}
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
      <LineChartIcon size={22} className="mx-auto mb-2 text-muted-foreground" aria-hidden />
      <p className="text-xs text-muted-foreground">
        Historique de prix bientôt disponible pour ce produit.
      </p>
    </div>
  );
}

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * High-contrast tooltip content: dark navy background, white text,
 * larger type, thicker border. Meets WCAG AAA on the primary reading.
 */
function HighContrastTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload as { date?: string; price?: number } | undefined;
  if (!row) return null;
  return (
    <div
      role="status"
      className="pointer-events-none rounded-lg border-2 px-3 py-2 text-left shadow-xl"
      style={{
        background: NAVY,
        borderColor: PRIMARY,
        color: "#FFFFFF",
        minWidth: 168,
      }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/70">
        {row.date ? formatLongDate(row.date) : ""}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: "#93C5FD", boxShadow: "0 0 0 2px rgba(255,255,255,0.15)" }}
          aria-hidden
        />
        <span className="text-[15px] font-semibold tabular-nums leading-none text-white">
          {formatEur(row.price)}
        </span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60">
        Prix marché HTVA
      </div>
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

  const chartData = useMemo(
    () =>
      (history || []).map((r) => ({
        date: r.price_date,
        label: formatShortDate(r.price_date),
        price: Number(r.price_eur),
      })),
    [history]
  );

  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const prices = chartData.map((d) => d.price).filter((n) => Number.isFinite(n));
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, n) => s + n, 0) / prices.length;
    const last = prices[prices.length - 1];
    return { min, max, avg, last };
  }, [chartData]);

  const isLoading = historyLoading || trendLoading;
  const hasHistory = !!history && history.length > 0;

  // Track mobile breakpoint to tune the chart density.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Keyboard navigation across data points.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);

  if (!enabled) return null;

  const onChartFocus = useCallback(() => {
    if (!chartData.length) return;
    setIsKeyboardActive(true);
    setFocusIndex((prev) => (prev == null ? chartData.length - 1 : prev));
  }, [chartData.length]);

  const onChartBlur = useCallback(() => {
    setIsKeyboardActive(false);
  }, []);

  const onChartKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!chartData.length) return;
      const last = chartData.length - 1;
      const cur = focusIndex ?? last;
      let next: number | null = cur;
      switch (e.key) {
        case "ArrowRight":
          next = Math.min(last, cur + 1);
          break;
        case "ArrowLeft":
          next = Math.max(0, cur - 1);
          break;
        case "PageUp":
          next = Math.min(last, cur + 7);
          break;
        case "PageDown":
          next = Math.max(0, cur - 7);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = last;
          break;
        case "Escape":
          (e.currentTarget as HTMLDivElement).blur();
          return;
        default:
          return;
      }
      e.preventDefault();
      setIsKeyboardActive(true);
      setFocusIndex(next);
    },
    [chartData.length, focusIndex]
  );

  const focusedPoint =
    focusIndex != null && chartData[focusIndex] ? chartData[focusIndex] : null;



  return (
    <section
      className="mb-6 overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card to-muted/20 shadow-sm sm:mb-8 sm:rounded-2xl"
      aria-labelledby="price-history-title"
    >
      {/* Header */}
      <header className="flex flex-col gap-2.5 border-b border-border/60 bg-card/60 px-3.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-5 sm:py-3.5">
        <div className="min-w-0">
          <h2
            id="price-history-title"
            className="flex items-center gap-2 text-[15px] font-bold tracking-tight sm:text-base"
            style={{ color: NAVY }}
          >
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg sm:h-7 sm:w-7"
              style={{ background: "rgba(28,88,217,0.10)", color: PRIMARY }}
            >
              <LineChartIcon size={14} aria-hidden />
            </span>
            <span className="truncate">Historique de prix marché</span>
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            <span>Prix public observé</span>
            <span className="mx-1">·</span>
            <span className="font-medium text-foreground/80">source&nbsp;: veille marché B2B</span>
            {productName ? (
              <span className="mt-0.5 line-clamp-1 sm:mt-0 sm:inline">
                <span className="mx-1 hidden sm:inline">·</span>
                <span className="sm:hidden">{productName}</span>
                <span className="hidden sm:inline">{productName}</span>
              </span>
            ) : null}
          </p>
        </div>
        {hasHistory && trend && (
          <div className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <div className="snap-start"><VariationPill label="J/J" pct={trend.change_1d_pct} /></div>
            <div className="snap-start"><VariationPill label="7 j" pct={trend.change_7d_pct} /></div>
            <div className="snap-start"><VariationPill label="30 j" pct={trend.change_30d_pct} /></div>
          </div>
        )}
      </header>

      {/* Stats strip */}
      {hasHistory && stats && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-border/60 px-3.5 py-2.5 sm:grid-cols-4 sm:gap-3 sm:px-5 sm:py-3">
          <Stat label="Dernier" value={formatEur(stats.last)} tone="current" />
          <Stat label="Moyen 120 j" value={formatEur(stats.avg)} />
          <Stat label="Plus bas" value={formatEur(stats.min)} tone="low" />
          <Stat label="Plus haut" value={formatEur(stats.max)} tone="high" />
        </div>
      )}

      {/* Chart */}
      <div className="px-1 py-2.5 sm:px-3 sm:py-3">
        {isLoading ? (
          <Skeleton className="h-48 w-full sm:h-56" />
        ) : !hasHistory ? (
          <div className="px-2 pb-2">
            <EmptyState />
          </div>
        ) : (
          <>
            {/* Screen-reader live region: announces the focused point */}
            <div
              ref={liveRef}
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {focusedPoint
                ? `${formatLongDate(focusedPoint.date)} — prix marché ${formatEur(
                    focusedPoint.price
                  )} hors TVA.`
                : ""}
            </div>

            {/* Keyboard-focused point readout: high-contrast card visible only during keyboard nav */}
            {isKeyboardActive && focusedPoint && (
              <div
                className="mx-2 mb-2 flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2 sm:mx-1"
                style={{ background: NAVY, borderColor: PRIMARY, color: "#FFFFFF" }}
                role="status"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    Point sélectionné
                  </div>
                  <div className="truncate text-[13px] font-semibold text-white">
                    {formatLongDate(focusedPoint.date)}
                  </div>
                </div>
                <div
                  className="rounded-md bg-white/10 px-2 py-1 text-[15px] font-semibold tabular-nums leading-none text-white"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}
                >
                  {formatEur(focusedPoint.price)}
                </div>
              </div>
            )}

            <div
              ref={chartWrapperRef}
              role="application"
              tabIndex={0}
              aria-label={`Graphique de l'historique de prix marché. ${chartData.length} points. Utilisez les flèches gauche et droite pour naviguer, Home et End pour début et fin, Échap pour quitter.`}
              onFocus={onChartFocus}
              onBlur={onChartBlur}
              onKeyDown={onChartKeyDown}
              className="relative h-48 w-full rounded-lg outline-none ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary sm:h-56"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: isMobile ? 8 : 14,
                    left: isMobile ? -8 : 0,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: isMobile ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    minTickGap={isMobile ? 40 : 28}
                    interval="preserveStartEnd"
                    tickMargin={4}
                  />
                  <YAxis
                    tick={{ fontSize: isMobile ? 9 : 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={isMobile ? 34 : 44}
                    tickCount={isMobile ? 4 : 6}
                    tickFormatter={(v) => `${Number(v).toFixed(0)}${isMobile ? "" : " €"}`}
                    domain={["auto", "auto"]}
                  />
                  {stats && !isMobile && (
                    <ReferenceLine
                      y={stats.avg}
                      stroke={NEUTRAL}
                      strokeDasharray="3 3"
                      strokeOpacity={0.5}
                      label={{
                        value: `moy. ${stats.avg.toFixed(2)} €`,
                        position: "insideTopRight",
                        fill: NEUTRAL,
                        fontSize: 10,
                      }}
                    />
                  )}
                  {stats && isMobile && (
                    <ReferenceLine
                      y={stats.avg}
                      stroke={NEUTRAL}
                      strokeDasharray="3 3"
                      strokeOpacity={0.4}
                    />
                  )}
                  {/* Vertical marker driven by keyboard focus */}
                  {isKeyboardActive && focusedPoint && (
                    <ReferenceLine
                      x={focusedPoint.label}
                      stroke={PRIMARY}
                      strokeWidth={2}
                      strokeOpacity={0.85}
                      ifOverflow="extendDomain"
                    />
                  )}
                  <Tooltip
                    cursor={{ stroke: PRIMARY, strokeOpacity: 0.35, strokeWidth: 1.5 }}
                    wrapperStyle={{ outline: "none" }}
                    content={<HighContrastTooltip />}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="none"
                    fill="url(#priceGradient)"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={PRIMARY}
                    strokeWidth={isMobile ? 1.75 : 2}
                    dot={false}
                    activeDot={{
                      r: isMobile ? 4 : 5,
                      fill: PRIMARY,
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Keyboard hints (visible on focus for sighted keyboard users) */}
            <p
              className="mt-1 px-2 text-[10px] text-muted-foreground sm:px-1"
              aria-hidden
            >
              Astuce clavier&nbsp;: focalisez le graphique, puis utilisez ← → pour naviguer, Début/Fin pour les bornes.
            </p>
          </>
        )}
      </div>
    </section>
  );
}


export default ProductPriceHistory;
