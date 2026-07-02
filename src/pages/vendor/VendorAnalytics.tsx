import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { VCard } from "@/components/vendor/ui/VCard";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useVendorSalesBreakdowns, type VendorAnalyticsPeriod } from "@/hooks/useVendorSalesBreakdowns";
import { fmtEur } from "@/lib/format-currency";

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <Info size={28} className="mb-2" style={{ color: "#8B95A5" }} />
    <p className="text-[13px]" style={{ color: "#8B95A5" }}>{message}</p>
  </div>
);

const ChartSkeleton = ({ slow }: { slow: boolean }) => (
  <div className="py-4" role="status" aria-live="polite" aria-busy="true">
    <div className="mx-auto rounded-full animate-pulse bg-[#E2E8F0]" style={{ width: 180, height: 180 }} />
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-3 w-20 rounded animate-pulse bg-[#E2E8F0]" />
      ))}
    </div>
    {slow && (
      <p className="mt-3 text-center text-[11px]" style={{ color: "#B45309" }}>
        Le chargement prend plus de temps que prévu…
      </p>
    )}
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center" role="alert">
    <AlertTriangle size={28} className="mb-2" style={{ color: "#DC2626" }} />
    <p className="text-[13px] mb-3" style={{ color: "#991B1B" }}>{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[6px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
      style={{ color: "#1D2530" }}
    >
      <RefreshCw size={12} /> Réessayer
    </button>
  </div>
);


const PERIOD_OPTIONS: { value: VendorAnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "ytd", label: "Année en cours" },
  { value: "all", label: "Tout" },
];

export default function VendorAnalytics() {
  const { data: vendor } = useCurrentVendor();
  const [period, setPeriod] = useState<VendorAnalyticsPeriod>("30d");
  const { categoryBreakdown, customerTypeBreakdown, isLoading, isFetching, error, refetch } =
    useVendorSalesBreakdowns(vendor?.id, period);

  // Slow-load hint: after 4s of loading/fetching, flag as "prend trop de temps"
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isLoading && !isFetching) {
      setSlow(false);
      return;
    }
    setSlow(false);
    const t = window.setTimeout(() => setSlow(true), 4000);
    return () => window.clearTimeout(t);
  }, [isLoading, isFetching, period]);

  const errorMessage = error ? (error.message || "Erreur lors du chargement des données.") : null;

  const totalClients = customerTypeBreakdown.reduce((s, r) => s + r.value, 0);
  const retail = customerTypeBreakdown.find((r) => r.name === "Retail");
  const retailCount = retail?.value || 0;
  const retailPct = totalClients > 0 ? ((retailCount / totalClients) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1D2530]">Analytics</h1>
          <p className="text-[13px] text-[#616B7C] mt-0.5">Répartition de votre CA et de votre portefeuille clients</p>
        </div>
        <div className="inline-flex rounded-[8px] border border-[#E2E8F0] bg-white p-0.5" role="tablist" aria-label="Période">
          {PERIOD_OPTIONS.map((opt) => {
            const active = opt.value === period;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(opt.value)}
                className="px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors"
                style={{
                  backgroundColor: active ? "#1B5BDA" : "transparent",
                  color: active ? "#fff" : "#616B7C",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Catégories vendues */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-1" style={{ color: "#1D2530" }}>Catégories vendues</h3>
          <p className="text-[11px] mb-4" style={{ color: "#8B95A5" }}>
            Répartition CA TTC par catégorie parent (commandes en cours + prévisionnelles)
          </p>
          {errorMessage ? (
            <ErrorState message={errorMessage} onRetry={() => { void refetch(); }} />
          ) : isLoading ? (
            <ChartSkeleton slow={slow} />
          ) : categoryBreakdown.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(e: any) => `${e.name} (${((e.percent || 0) * 100).toFixed(1)}%)`}
                    labelLine={false}
                  >
                    {categoryBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: any) => `${fmtEur(Number(v))} EUR`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="Aucune ligne de commande avec catégorie résolue" />
          )}
        </div>

        {/* Clients par typologie */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-1" style={{ color: "#1D2530" }}>Clients par typologie</h3>
          <p className="text-[11px] mb-4" style={{ color: "#8B95A5" }}>
            Répartition de vos commandes par typologie d'acheteur
          </p>
          {totalClients > 0 && (
            <div className="mb-4 rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FDBA74" }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#F97316" }} />
                <span className="text-[13px] font-semibold" style={{ color: "#7C2D12" }}>Retail</span>
              </div>
              <div className="text-right">
                <span className="text-[16px] font-bold" style={{ color: "#C2410C" }}>{retailCount}</span>
                <span className="text-[12px] ml-1 font-medium" style={{ color: "#9A3412" }}>({retailPct}%)</span>
              </div>
            </div>
          )}
          {errorMessage ? (
            <ErrorState message={errorMessage} onRetry={() => { void refetch(); }} />
          ) : isLoading ? (
            <ChartSkeleton slow={slow} />
          ) : customerTypeBreakdown.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={customerTypeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={(e: any) => `${e.name} ${(e.percent * 100).toFixed(1)}%`}
                  >
                    {customerTypeBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(v: any, n: any) => {
                      const pct = totalClients > 0 ? ((Number(v) / totalClients) * 100).toFixed(1) : "0";
                      return [`${v} commande${Number(v) > 1 ? "s" : ""} (${pct}%)`, n];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="Aucune commande enregistrée" />
          )}
        </div>
      </div>

      {!isLoading && categoryBreakdown.length === 0 && customerTypeBreakdown.length === 0 && (
        <VCard>
          <p className="text-[13px] text-[#8B95A5] text-center py-4">
            Ces graphiques s'alimenteront automatiquement dès vos premières commandes.
          </p>
        </VCard>
      )}
    </div>
  );
}
