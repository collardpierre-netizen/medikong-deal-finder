import { useMemo } from "react";
import { fmtEur } from "@/lib/format-currency";

export type OrderLineLike = {
  quantity?: number | string | null;
  line_total_excl_vat?: number | string | null;
  unit_price_excl_vat?: number | string | null;
  manual_label?: string | null;
  product_id?: string | null;
  products?: { name?: string | null; cnk_code?: string | null; gtin?: string | null } | null;
  cnk_code?: string | null;
};

type AggRow = {
  key: string;
  cnk: string | null;
  name: string;
  quantity: number;
  totalHt: number;
};

function aggregate(lines: OrderLineLike[]): { rows: AggRow[]; totalHt: number; totalQty: number } {
  const map = new Map<string, AggRow>();
  let totalHt = 0;
  let totalQty = 0;
  for (const l of lines || []) {
    const qty = Number(l.quantity) || 0;
    const lineHt =
      Number(l.line_total_excl_vat) ||
      (Number(l.unit_price_excl_vat) || 0) * qty;
    const cnk = l.products?.cnk_code || (l as any).cnk_code || null;
    const name = l.manual_label || l.products?.name || "—";
    const key = l.product_id || cnk || `${name}::${l.products?.gtin || ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += qty;
      existing.totalHt += lineHt;
    } else {
      map.set(key, { key, cnk, name, quantity: qty, totalHt: lineHt });
    }
    totalHt += lineHt;
    totalQty += qty;
  }
  const rows = Array.from(map.values()).sort((a, b) => b.totalHt - a.totalHt);
  return { rows, totalHt, totalQty };
}

/** Réutilisable : recap agrégé par produit (KPI + top). */
export default function OrderProductsSummary({ lines }: { lines: OrderLineLike[] }) {
  const { rows, totalHt, totalQty } = useMemo(() => aggregate(lines), [lines]);

  if (!rows.length) return null;

  return (
    <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div
        className="px-4 py-3 text-white font-semibold text-sm"
        style={{ backgroundColor: "#1C58D9" }}
      >
        Synthèse des produits (agrégé)
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50/40 border-b" style={{ borderColor: "#E2E8F0" }}>
        <KpiCard label="Produits uniques" value={String(rows.length)} accent="#1C58D9" bg="#EFF6FF" />
        <KpiCard label="Quantité totale" value={String(totalQty)} accent="#15803D" bg="#F0FDF4" />
        <KpiCard label="Total HTVA" value={`${fmtEur(totalHt)} €`} accent="#B45309" bg="#FEF3C7" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "#F8FAFC" }}>
            <tr>
              <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500 w-10">#</th>
              <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">CNK</th>
              <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Produit</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Qté totale</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Total HTVA</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">% commande</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = totalHt > 0 ? (r.totalHt / totalHt) * 100 : 0;
              return (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{r.cnk || "—"}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.quantity}</td>
                  <td className="px-3 py-2 text-right">{fmtEur(r.totalHt)} €</td>
                  <td className="px-3 py-2 text-right text-slate-600">{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, bg }: { label: string; value: string; accent: string; bg: string }) {
  return (
    <div className="rounded-md border flex items-stretch overflow-hidden" style={{ borderColor: "#E2E8F0", backgroundColor: bg }}>
      <div style={{ width: 4, backgroundColor: accent }} />
      <div className="flex-1 px-4 py-3 text-center">
        <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}
