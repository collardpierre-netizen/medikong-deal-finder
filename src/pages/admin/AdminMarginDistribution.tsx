import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Target, Layers } from "lucide-react";

type MarginStats = {
  total_active_qogita: number;
  stale_pending: number;
  fresh_with_margin: number;
  avg_margin: number;
  median_margin: number;
  min_margin: number;
  max_margin: number;
  stddev_margin: number;
  exact_25_count: number;
  exact_25_pct: number;
  buckets: Record<string, number>;
};

const BUCKET_LABELS: Array<[keyof MarginStats["buckets"], string]> = [
  ["lt_10", "< 10 %"],
  ["10_15", "10 – 15 %"],
  ["15_20", "15 – 20 %"],
  ["20_25", "20 – 25 %"],
  ["eq_25", "= 25 %"],
  ["25_30", "25 – 30 %"],
  ["30_40", "30 – 40 %"],
  ["gt_40", "> 40 %"],
];

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  color = "#1C58D9",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + "14" }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">{label}</p>
        <p className="text-[22px] font-bold text-[#1D2530] leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-[#8B95A5] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminMarginDistribution() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-margin-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_offer_margin_distribution");
      if (error) throw error;
      return data as unknown as MarginStats;
    },
    staleTime: 60_000,
  });

  const maxBucket = data
    ? Math.max(...BUCKET_LABELS.map(([k]) => data.buckets[k as string] ?? 0), 1)
    : 1;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1D2530]">Distribution des marges appliquées</h1>
          <p className="text-sm text-[#616B7C] mt-1">
            Offres Qogita actives — marge commerciale appliquée (`applied_margin_percentage`).
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 rounded-lg bg-[#1C58D9] text-white text-sm font-medium disabled:opacity-60"
        >
          {isFetching ? "Rafraîchissement…" : "Rafraîchir"}
        </button>
      </div>

      {isLoading && <p className="text-sm text-[#616B7C]">Chargement…</p>}
      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          Erreur : {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icon={TrendingUp}
              label="Moyenne"
              value={`${data.avg_margin?.toFixed?.(2) ?? data.avg_margin} %`}
              sub={`Écart-type ${data.stddev_margin} pts`}
            />
            <Kpi
              icon={Layers}
              label="Médiane"
              value={`${data.median_margin?.toFixed?.(2) ?? data.median_margin} %`}
              sub={`Min ${data.min_margin} % · Max ${data.max_margin} %`}
              color="#059669"
            />
            <Kpi
              icon={Target}
              label="Offres à exactement 25 %"
              value={`${data.exact_25_pct} %`}
              sub={`${fmtNum(data.exact_25_count)} / ${fmtNum(data.fresh_with_margin)} offres fraîches`}
              color="#7C3AED"
            />
            <Kpi
              icon={AlertTriangle}
              label="Offres price_stale en attente"
              value={fmtNum(data.stale_pending)}
              sub={`Sur ${fmtNum(data.total_active_qogita)} offres actives`}
              color="#EF4343"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition par tranche de marge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {BUCKET_LABELS.map(([key, label]) => {
                  const n = data.buckets[key as string] ?? 0;
                  const pct = data.fresh_with_margin > 0 ? (n / data.fresh_with_margin) * 100 : 0;
                  const width = (n / maxBucket) * 100;
                  const isTarget = key === "eq_25";
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-24 text-[13px] text-[#1D2530] font-medium shrink-0">
                        {label}
                      </div>
                      <div className="flex-1 h-6 bg-[#F1F5F9] rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${width}%`,
                            backgroundColor: isTarget ? "#7C3AED" : "#1C58D9",
                          }}
                        />
                      </div>
                      <div className="w-40 text-right text-[12px] text-[#616B7C] tabular-nums">
                        <span className="font-semibold text-[#1D2530]">{fmtNum(n)}</span>{" "}
                        · {pct.toFixed(1)} %
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#8B95A5] mt-4">
                Base : {fmtNum(data.fresh_with_margin)} offres Qogita actives et non-stale avec une
                marge renseignée.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
