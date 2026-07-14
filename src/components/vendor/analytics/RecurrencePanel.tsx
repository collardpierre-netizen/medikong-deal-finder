import { useVendorAnalyticsRecurrence, useVendorAnalyticsCohorts } from "@/hooks/useVendorAnalyticsRecurrence";
import type { AnalyticsPeriod } from "@/hooks/useVendorAnalytics";
import { Repeat, UserPlus, AlertTriangle, Timer } from "lucide-react";
import { AnalyticsExportButtons } from "@/components/vendor/analytics/AnalyticsExportButtons";
import { exportAnalyticsRows, exportAnalyticsMultiSheet } from "@/lib/analytics-export";

const card = "p-5 rounded-[10px] bg-white border border-[#E2E8F0]";

export function RecurrencePanel({ period }: { period: AnalyticsPeriod }) {
  const { data: r, isLoading } = useVendorAnalyticsRecurrence(period);
  const { data: cohorts } = useVendorAnalyticsCohorts(12);

  const newC = r?.new_customers ?? 0;
  const retC = r?.returning_customers ?? 0;
  const tot = r?.total_customers ?? 0;
  const retentionPct = tot > 0 ? Math.round((retC / tot) * 100) : 0;

  const kpiRows = r
    ? [
        {
          metric: "Nouveaux clients",
          valeur: newC,
          detail: `sur ${tot} actifs`,
        },
        {
          metric: "Clients récurrents",
          valeur: retC,
          detail: `${retentionPct}% du total`,
        },
        {
          metric: "Commandes / client (moyenne)",
          valeur: r.avg_orders_per_customer ?? 0,
          detail: `Ø ${r.avg_days_between_orders ?? 0} j entre commandes`,
        },
        {
          metric: "Risque de churn",
          valeur: r.churn_risk_count ?? 0,
          detail: "Aucune commande depuis 60 j",
        },
      ]
    : [];

  const cohortRows = (cohorts ?? []).map((c) => ({
    mois_acquisition: c.cohort_month,
    taille: c.cohort_size,
    actifs_m1: c.active_m1,
    taux_m1_pct: c.cohort_size ? Number(((c.active_m1 / c.cohort_size) * 100).toFixed(1)) : 0,
    actifs_m2: c.active_m2,
    taux_m2_pct: c.cohort_size ? Number(((c.active_m2 / c.cohort_size) * 100).toFixed(1)) : 0,
    actifs_m3: c.active_m3,
    taux_m3_pct: c.cohort_size ? Number(((c.active_m3 / c.cohort_size) * 100).toFixed(1)) : 0,
  }));

  const onCsv = () =>
    exportAnalyticsRows(cohortRows, `medikong-analytics-cohortes-${period}`, "csv", "Cohortes");
  const onXlsx = () =>
    exportAnalyticsMultiSheet(
      [
        { name: "KPIs", rows: kpiRows },
        { name: "Cohortes", rows: cohortRows },
      ],
      `medikong-analytics-recurrence-${period}`
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <AnalyticsExportButtons
          disabled={kpiRows.length === 0 && cohortRows.length === 0}
          onCsv={onCsv}
          onXlsx={onXlsx}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icon={<UserPlus size={16} />} label="Nouveaux clients" value={newC.toString()} sub={`sur ${tot} actifs`} />
        <Tile icon={<Repeat size={16} />} label="Clients récurrents" value={retC.toString()} sub={`${retentionPct}% du total`} />
        <Tile icon={<Timer size={16} />} label="Commandes / client" value={(r?.avg_orders_per_customer ?? 0).toString()} sub={`Ø ${r?.avg_days_between_orders ?? 0} j entre commandes`} />
        <Tile icon={<AlertTriangle size={16} />} label="Risque de churn" value={(r?.churn_risk_count ?? 0).toString()} sub="Aucune commande depuis 60 j" />
      </div>

      <div className={card}>
        <div className="text-[13px] font-semibold mb-3 text-[#1D2530]">Cohortes mensuelles — activité sur 3 mois</div>
        {isLoading && <div className="text-[12px] text-[#8B95A5]">Chargement…</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[#8B95A5] border-b border-[#E2E8F0]">
                <th className="py-2">Mois d'acquisition</th>
                <th>Taille</th>
                <th>M+1</th>
                <th>M+2</th>
                <th>M+3</th>
              </tr>
            </thead>
            <tbody>
              {(cohorts ?? []).map((c) => (
                <tr key={c.cohort_month} className="border-b border-[#F1F5F9]">
                  <td className="py-2 font-medium">{new Date(c.cohort_month).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}</td>
                  <td>{c.cohort_size}</td>
                  <td>{pct(c.active_m1, c.cohort_size)}</td>
                  <td>{pct(c.active_m2, c.cohort_size)}</td>
                  <td>{pct(c.active_m3, c.cohort_size)}</td>
                </tr>
              ))}
              {!cohorts?.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#8B95A5]">Pas encore de cohortes à afficher.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wide text-[#8B95A5] font-medium">{label}</span>
        <span className="text-[#8B95A5]">{icon}</span>
      </div>
      <div className="text-[22px] font-bold text-[#1D2530]">{value}</div>
      {sub && <div className="text-[11px] text-[#8B95A5] mt-1">{sub}</div>}
    </div>
  );
}

function pct(n: number, tot: number): string {
  if (!tot) return "—";
  return `${n} (${Math.round((n / tot) * 100)}%)`;
}
