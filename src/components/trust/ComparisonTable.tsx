import type { ComparisonRow } from "@/data/trust-process-data";

export function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  return (
    <div className="w-full border border-mk-line rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F8FAFC]">
            <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Critère</th>
            <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-mk-blue bg-mk-blue/5">MediKong</th>
            <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Traditionnel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-mk-line">
              <td className="px-5 py-4 text-sm text-mk-navy font-medium">{row.criteria}</td>
              <td className={`px-5 py-4 text-sm font-semibold text-mk-navy ${row.medikongHighlight ? "bg-mk-blue/5" : ""}`}>
                <span className={row.medikong.startsWith("✓") ? "text-mk-green" : ""}>{row.medikong}</span>
              </td>
              <td className="px-5 py-4 text-sm text-muted-foreground">{row.traditional === "—" ? <span className="text-mk-line">—</span> : row.traditional}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
