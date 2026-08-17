import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScanLine, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import SavingsCategoryPie, { type SavingsCategoryRow } from "@/components/savings/SavingsCategoryPie";
import SavingsTopProducts, { type SavingsTopProduct } from "@/components/savings/SavingsTopProducts";
import SavingsMonthlyChart, { type SavingsMonthlyRow } from "@/components/savings/SavingsMonthlyChart";
import SavingsSupplierBreakdown, { type SavingsSupplierRow } from "@/components/savings/SavingsSupplierBreakdown";


type Sim = {
  id: string;
  created_at: string;
  source_supplier: string | null;
  pharmacy_name: string | null;
  total_lines: number | null;
  matched_lines: number | null;
  total_lines_count: number | null;
  matched_lines_count: number | null;
  match_rate: number | null;
  catalog_match_rate: number | null;
  savings_amount: number | null;
  savings_pct: number | null;
  status: string | null;
};

const fmtEur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n));
const fmtPct = (n: number | null) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);
const catalogMatchPct = (r: Sim) =>
  r.catalog_match_rate != null ? Number(r.catalog_match_rate) : r.match_rate != null ? Number(r.match_rate) * 100 : null;

export default function MesAnalysesEconomiesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Sim[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, SavingsCategoryRow[]>>({});
  const [topProducts, setTopProducts] = useState<SavingsTopProduct[] | null>(null);
  const [months, setMonths] = useState(12);
  const [monthly, setMonthly] = useState<SavingsMonthlyRow[] | null>(null);
  const [suppliers, setSuppliers] = useState<SavingsSupplierRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: m }, { data: s }] = await Promise.all([
        (supabase as any).rpc("savings_monthly_breakdown", { _group_key: null, _months: months }),
        (supabase as any).rpc("savings_supplier_breakdown", { _group_key: null }),
      ]);
      setMonthly((m as SavingsMonthlyRow[]) ?? []);
      setSuppliers((s as SavingsSupplierRow[]) ?? []);
    })();
  }, [user, months]);

  useEffect(() => {
    if (!user) {

      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("savings_simulations")
        .select(
          "id,created_at,source_supplier,pharmacy_name,total_lines,matched_lines,total_lines_count,matched_lines_count,match_rate,catalog_match_rate,savings_amount,savings_pct,status",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      setRows((data as Sim[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  // Top produits agrégés : pertinent seulement dès 2 analyses
  useEffect(() => {
    if (rows.length < 2) {
      setTopProducts(null);
      return;
    }
    (async () => {
      const { data } = await (supabase as any).rpc("savings_top_products", { _group_key: null, _limit: 30 });
      setTopProducts((data as SavingsTopProduct[]) ?? []);
    })();
  }, [rows.length]);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!breakdowns[id]) {
      const { data } = await (supabase as any).rpc("savings_category_breakdown", { _simulation_id: id });
      setBreakdowns((prev) => ({ ...prev, [id]: (data as SavingsCategoryRow[]) ?? [] }));
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-6xl">
      <Helmet>
        <title>Mes analyses d'économies | MediKong</title>
        <meta name="description" content="Retrouvez l'historique de vos calculs d'économies MediKong : grossiste, lignes comparables, économie estimée." />
      </Helmet>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ScanLine className="h-7 w-7" />
            Mes analyses d'économies
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyses lancées depuis <code>/economies</code> avec votre adresse email.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/economies">
            <ExternalLink className="h-4 w-4 mr-2" /> Nouvelle analyse
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} analyse(s)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !user ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Connectez-vous pour retrouver vos analyses.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune analyse pour le moment.{" "}
              <Link to="/economies" className="underline">
                Lancer un calcul d'économies
              </Link>
              .
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3" />
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Grossiste</th>
                  <th className="py-2 pr-3">Pharmacie</th>
                  <th className="py-2 pr-3 text-right">Lignes comparables</th>
                  <th className="py-2 pr-3 text-right">Taux de correspondance</th>
                  <th className="py-2 pr-3 text-right">Économie estimée</th>
                  <th className="py-2 pr-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-1">
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          aria-label={openId === r.id ? "Masquer le détail" : "Voir la ventilation"}
                          className="p-1 rounded hover:bg-muted"
                        >
                          {openId === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("fr-BE")}</td>
                      <td className="py-2 pr-3">{r.source_supplier ?? "—"}</td>
                      <td className="py-2 pr-3">{r.pharmacy_name || "—"}</td>
                      <td className="py-2 pr-3 text-right">
                        {(r.matched_lines_count ?? r.matched_lines) ?? 0}/{(r.total_lines_count ?? r.total_lines) ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtPct(catalogMatchPct(r))}</td>
                      <td className="py-2 pr-3 text-right">
                        <span className={Number(r.savings_amount ?? 0) > 0 ? "text-emerald-600 font-semibold" : ""}>
                          {fmtEur(r.savings_amount)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">{fmtPct(r.savings_pct)}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={
                            r.status === "completed" || r.status === "done" || r.status === "sent"
                              ? "default"
                              : r.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {r.status ?? "—"}
                        </Badge>
                      </td>
                    </tr>
                    {openId === r.id && (
                      <tr key={`${r.id}-detail`} className="border-b bg-muted/20">
                        <td colSpan={8} className="p-4">
                          {breakdowns[r.id] ? (
                            <SavingsCategoryPie rows={breakdowns[r.id]} />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {rows.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vos produits récurrents</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {topProducts === null ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <SavingsTopProducts rows={topProducts} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
