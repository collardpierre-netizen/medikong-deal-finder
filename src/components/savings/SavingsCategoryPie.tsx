import { fmtEurLabel } from "@/lib/format-currency";

export type SavingsCategoryRow = {
  group_label: string;
  lines_count: number;
  total_amount: number | null;
  pct_of_basket: number | null;
  matched_lines: number | null;
  catalog_match_rate: number | null;
  total_savings?: number | null;
};

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

/**
 * Camembert (donut SVG inline) de ventilation du panier par catégorie de produit.
 * Basé sur 100 % des lignes lues, pas seulement les lignes matchées.
 */
export default function SavingsCategoryPie({
  rows,
  title = "Ventilation par type de produit",
  compact = false,
}: {
  rows: SavingsCategoryRow[];
  title?: string;
  compact?: boolean;
}) {
  const total = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  if (rows.length === 0 || total <= 0) {
    return <p className="text-sm text-muted-foreground">Ventilation par catégorie indisponible.</p>;
  }

  let offset = 0;
  const segments = rows.map((r, i) => {
    const share = Number(r.total_amount ?? 0) / total;
    const seg = { r, color: COLORS[i % COLORS.length], dash: share * C, offset };
    offset += share * C;
    return seg;
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap items-center gap-6">
        <svg
          width={compact ? 130 : 160}
          height={compact ? 130 : 160}
          viewBox="0 0 160 160"
          role="img"
          aria-label={title}
        >
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
        <ul className="space-y-1.5 text-sm">
          {segments.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="font-medium">{s.r.group_label}</span>
              <span className="text-muted-foreground">
                {Number(s.r.pct_of_basket ?? 0).toFixed(1)} % · {fmtEurLabel(s.r.total_amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-3">Catégorie</th>
              <th className="py-2 pr-3 text-right">Lignes</th>
              <th className="py-2 pr-3 text-right">Montant</th>
              <th className="py-2 pr-3 text-right">% du panier</th>
              <th className="py-2 pr-3 text-right">Correspondance catalogue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.group_label} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{r.group_label}</td>
                <td className="py-2 pr-3 text-right">{r.lines_count}</td>
                <td className="py-2 pr-3 text-right">{fmtEurLabel(r.total_amount)}</td>
                <td className="py-2 pr-3 text-right">{Number(r.pct_of_basket ?? 0).toFixed(1)} %</td>
                <td className="py-2 pr-3 text-right">
                  <span
                    className={
                      Number(r.catalog_match_rate ?? 0) > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"
                    }
                  >
                    {Number(r.catalog_match_rate ?? 0).toFixed(1)} %
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({r.matched_lines ?? 0}/{r.lines_count})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Ventilation calculée sur 100 % des lignes lues. Le taux de correspondance catalogue est donné par catégorie : les
        médicaments sur ordonnance ne sont pas encore commercialisés par MediKong.
      </p>
    </div>
  );
}
