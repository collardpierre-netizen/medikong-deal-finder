import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ExternalLink, ScanLine } from "lucide-react";

type Sim = {
  id: string;
  email: string | null;
  pharmacy_name: string | null;
  source_supplier: string | null;
  source_file_type: string | null;
  total_lines: number | null;
  matched_lines: number | null;
  match_rate: number | null;
  source_total_excl_vat: number | null;
  medikong_total_excl_vat: number | null;
  savings_amount: number | null;
  savings_pct: number | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
};

const fmtEur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n));
const fmtPct = (n: number | null) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);

export default function AdminSavingsOcr() {
  const [rows, setRows] = useState<Sim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "failed" | "pending">("all");

  async function load() {
    setLoading(true);
    let q = (supabase as any)
      .from("savings_simulations")
      .select(
        "id,email,pharmacy_name,source_supplier,source_file_type,total_lines,matched_lines,match_rate,source_total_excl_vat,medikong_total_excl_vat,savings_amount,savings_pct,status,error_message,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data as Sim[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-7xl">
      <Helmet>
        <title>OCR — Calcul d'économies | MediKong Admin</title>
      </Helmet>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ScanLine className="h-7 w-7" />
            OCR — Calcul d'économies
          </h1>
          <p className="text-muted-foreground mt-1">
            Historique des analyses OCR de commandes uploadées sur <code>/economies</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">Tous les statuts</option>
            <option value="completed">Terminés</option>
            <option value="pending">En cours</option>
            <option value="failed">Échecs</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Actualiser
          </Button>
          <Button asChild size="sm">
            <Link to="/economies" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Ouvrir /economies
            </Link>
          </Button>
        </div>
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
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune analyse trouvée.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Pharmacie</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3 text-right">Lignes</th>
                  <th className="py-2 pr-3 text-right">Match</th>
                  <th className="py-2 pr-3 text-right">Total source</th>
                  <th className="py-2 pr-3 text-right">Total MK</th>
                  <th className="py-2 pr-3 text-right">Économies</th>
                  <th className="py-2 pr-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("fr-BE")}</td>
                    <td className="py-2 pr-3">{r.email ?? "—"}</td>
                    <td className="py-2 pr-3">{r.pharmacy_name ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs">{r.source_supplier ?? "—"}</span>
                      {r.source_file_type && (
                        <span className="ml-1 text-[10px] text-muted-foreground uppercase">{r.source_file_type}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {r.matched_lines ?? 0}/{r.total_lines ?? 0}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmtPct(r.match_rate)}</td>
                    <td className="py-2 pr-3 text-right">{fmtEur(r.source_total_excl_vat)}</td>
                    <td className="py-2 pr-3 text-right">{fmtEur(r.medikong_total_excl_vat)}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={Number(r.savings_amount ?? 0) > 0 ? "text-emerald-600 font-semibold" : ""}>
                        {fmtEur(r.savings_amount)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{fmtPct(r.savings_pct)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"
                        }
                      >
                        {r.status ?? "—"}
                      </Badge>
                      {r.error_message && (
                        <p className="text-[10px] text-destructive mt-1 max-w-xs truncate" title={r.error_message}>
                          {r.error_message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
