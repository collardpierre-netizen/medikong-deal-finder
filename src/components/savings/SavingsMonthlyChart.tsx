import { useMemo } from "react";
import { fmtEurLabel } from "@/lib/format-currency";

export type SavingsMonthlyRow = {
  month_start: string;
  analyses_count: number | null;
  total_source: number | null;
  total_medikong: number | null;
  total_savings: number | null;
  days: { day: string; analyses: number; total_source: number; total_savings: number }[] | null;
};

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-BE", { month: "short", year: "2-digit" });

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("fr-BE");

/**
 * Ventilation temporelle : montant commandé par mois (12 derniers mois glissants).
 * Le détail jour par jour est disponible en info-bulle au survol d'un mois.
 */
export default function SavingsMonthlyChart({
  rows,
  title = "Montant commandé par mois",
}: {
  rows: SavingsMonthlyRow[];
  title?: string;
}) {
  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => Number(r.total_source ?? 0))),
    [rows],
  );
  const totalSource = rows.reduce((s, r) => s + Number(r.total_source ?? 0), 0);
  const totalSavings = rows.reduce((s, r) => s + Number(r.total_savings ?? 0), 0);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée mensuelle sur la période.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">
          Total {fmtEurLabel(totalSource)} · économie potentielle {fmtEurLabel(totalSavings)}
        </p>
      </div>

      <div className="flex items-end gap-2 h-40 overflow-x-auto pb-1">
        {rows.map((r) => {
          const h = Math.round((Number(r.total_source ?? 0) / max) * 100);
          const tooltip = [
            `${monthLabel(r.month_start)} — ${fmtEurLabel(r.total_source)} (${r.analyses_count ?? 0} analyse(s))`,
            ...(r.days ?? []).map(
              (d) => `${dayLabel(d.day)} : ${fmtEurLabel(d.total_source)} (${d.analyses} analyse(s))`,
            ),
          ].join("\n");
          return (
            <div
              key={r.month_start}
              className="flex flex-col items-center justify-end gap-1 min-w-[42px] flex-1 h-full"
              title={tooltip}
            >
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {Number(r.total_source ?? 0) > 0 ? Math.round(Number(r.total_source)) : ""}
              </span>
              <div
                className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors"
                style={{ height: `${Math.max(h, Number(r.total_source ?? 0) > 0 ? 3 : 0)}%` }}
                role="img"
                aria-label={`${monthLabel(r.month_start)} : ${fmtEurLabel(r.total_source)}`}
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {monthLabel(r.month_start)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Survolez un mois pour voir le détail jour par jour.
      </p>
    </div>
  );
}
