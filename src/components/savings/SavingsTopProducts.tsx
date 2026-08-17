import { useMemo, useState } from "react";
import { fmtEurLabel } from "@/lib/format-currency";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type SavingsTopProduct = {
  cnk: string | null;
  product_name: string | null;
  group_label: string | null;
  total_quantity: number | null;
  analyses_count: number | null;
  total_amount: number | null;
  total_savings: number | null;
  first_price: number | null;
  last_price: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  price_trend_pct: number | null;
  price_trend: "up" | "down" | "stable" | null;
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-BE") : "—");

function TrendBadge({ p }: { p: SavingsTopProduct }) {
  if (!p.price_trend) return <span className="text-xs text-muted-foreground">—</span>;
  const tooltip = `${fmtDate(p.first_seen_at)} : ${fmtEurLabel(p.first_price)} → ${fmtDate(p.last_seen_at)} : ${fmtEurLabel(p.last_price)}`;
  if (p.price_trend === "stable") {
    return (
      <Badge variant="secondary" title={tooltip} className="gap-1">
        <Minus className="h-3 w-3" /> stable
      </Badge>
    );
  }
  const up = p.price_trend === "up";
  return (
    <Badge variant={up ? "destructive" : "default"} title={tooltip} className="gap-1">
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {Number(p.price_trend_pct ?? 0).toFixed(1)} %
    </Badge>
  );
}

/**
 * Top produits agrégés sur toutes les analyses d'une pharmacie
 * (quantité cumulée, montant cumulé, économie cumulée, tendance de prix grossiste).
 */
export default function SavingsTopProducts({ rows }: { rows: SavingsTopProduct[] }) {
  const [category, setCategory] = useState<string>("all");
  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.group_label).filter(Boolean) as string[])),
    [rows],
  );
  const filtered = useMemo(() => {
    const base = category === "all" ? rows : rows.filter((r) => r.group_label === category);
    // Tri par défaut : plus grosse économie potentielle en premier.
    return [...base].sort((a, b) => Number(b.total_savings ?? 0) - Number(a.total_savings ?? 0));
  }, [rows, category]);
  const topOpportunities = new Set(
    filtered.filter((r) => Number(r.total_savings ?? 0) > 0).slice(0, 3).map((r, i) => `${r.cnk ?? "na"}-${i}`),
  );


  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun produit agrégé.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold">Produits les plus commandés</h3>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-8 px-2 rounded-md border border-input bg-background text-xs"
          aria-label="Filtrer par catégorie"
        >
          <option value="all">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-3">Produit</th>
              <th className="py-2 pr-3">CNK</th>
              <th className="py-2 pr-3">Catégorie</th>
              <th className="py-2 pr-3 text-right">Qté cumulée</th>
              <th className="py-2 pr-3 text-right">Analyses</th>
              <th className="py-2 pr-3 text-right">Montant cumulé</th>
              <th className="py-2 pr-3 text-right">Économie cumulée</th>
              <th className="py-2 pr-3">Tendance prix</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.cnk ?? "na"}-${i}`} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-2 pr-3 font-medium max-w-xs truncate" title={r.product_name ?? ""}>
                  {r.product_name ?? "—"}
                  {topOpportunities.has(`${r.cnk ?? "na"}-${i}`) && (
                    <Badge variant="default" className="ml-2 align-middle">Opportunité</Badge>
                  )}
                </td>

                <td className="py-2 pr-3 text-xs">{r.cnk ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{r.group_label ?? "—"}</td>
                <td className="py-2 pr-3 text-right">{Number(r.total_quantity ?? 0)}</td>
                <td className="py-2 pr-3 text-right">{r.analyses_count ?? 0}</td>
                <td className="py-2 pr-3 text-right">{fmtEurLabel(r.total_amount)}</td>
                <td className="py-2 pr-3 text-right">
                  <span className={Number(r.total_savings ?? 0) > 0 ? "text-emerald-600 font-semibold" : ""}>
                    {fmtEurLabel(r.total_savings)}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <TrendBadge p={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
