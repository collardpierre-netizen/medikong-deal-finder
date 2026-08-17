import { fmtEurLabel } from "@/lib/format-currency";

export type SavingsSupplierRow = {
  supplier: string;
  analyses_count: number | null;
  total_source: number | null;
  total_savings: number | null;
  pct_of_total: number | null;
};

const SUPPLIER_LABELS: Record<string, string> = {
  febelco: "Febelco",
  cerp: "CERP",
  pharma_belgium: "Pharma Belgium",
  other: "Autre",
};

const label = (s: string) => SUPPLIER_LABELS[s] ?? s;

const COLORS = [
  "hsl(var(--savings-cat-1))",
  "hsl(var(--savings-cat-2))",
  "hsl(var(--savings-cat-3))",
  "hsl(var(--savings-cat-4))",
  "hsl(var(--savings-cat-5))",
  "hsl(var(--savings-cat-6))",
];

const R = 60;
const STROKE = 26;
const C = 2 * Math.PI * R;

/** Répartition des montants commandés par grossiste (mono vs multi-grossiste). */
export default function SavingsSupplierBreakdown({ rows }: { rows: SavingsSupplierRow[] }) {
  const total = rows.reduce((s, r) => s + Number(r.total_source ?? 0), 0);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune analyse disponible.</p>;
  }

  let offset = 0;
  const segments = rows.map((r, i) => {
    const share = total > 0 ? Number(r.total_source ?? 0) / total : 0;
    const seg = { r, color: COLORS[i % COLORS.length], dash: share * C, offset };
    offset += share * C;
    return seg;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold">Répartition par grossiste</h3>
        <p className="text-xs text-muted-foreground">
          {rows.length === 1 ? "Mono-grossiste" : `${rows.length} grossistes utilisés`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        {total > 0 && (
          <svg width={140} height={140} viewBox="0 0 160 160" role="img" aria-label="Répartition par grossiste">
            <g transform="rotate(-90 80 80)">
              {segments.map((s, i) => (
                <circle
                  key={i}
                  cx={80}
                  cy={80}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${s.dash} ${C - s.dash}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </g>
          </svg>
        )}
        <div className="overflow-x-auto flex-1 min-w-[280px]">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-3">Grossiste</th>
                <th className="py-2 pr-3 text-right">Analyses</th>
                <th className="py-2 pr-3 text-right">Montant cumulé</th>
                <th className="py-2 pr-3 text-right">% du total</th>
                <th className="py-2 pr-3 text-right">Économie cumulée</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s, i) => (
                <tr key={s.r.supplier} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">
                    <span
                      className="inline-block h-3 w-3 rounded-sm mr-2 align-middle"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {label(s.r.supplier)}
                  </td>
                  <td className="py-2 pr-3 text-right">{s.r.analyses_count ?? 0}</td>
                  <td className="py-2 pr-3 text-right">{fmtEurLabel(s.r.total_source)}</td>
                  <td className="py-2 pr-3 text-right">{Number(s.r.pct_of_total ?? 0).toFixed(1)} %</td>
                  <td className="py-2 pr-3 text-right">
                    <span className={Number(s.r.total_savings ?? 0) > 0 ? "text-emerald-600 font-semibold" : ""}>
                      {fmtEurLabel(s.r.total_savings)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
