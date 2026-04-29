import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Info, ExternalLink } from "lucide-react";

/**
 * Audit TVA — Offres externes
 * Vérifie que la conversion TTC→HTVA s'appuie sur le vat_rate de la catégorie
 * du produit. Signale les offres orphelines :
 *  - catégorie sans vat_rate (fallback 21% appliqué)
 *  - produit sans catégorie
 *  - vat_rate hors plage attendue (≠ 6 / 21)
 */
const FALLBACK_VAT = 21;
const EXPECTED_RATES = [6, 21];

export default function AdminExternalVatAudit() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-external-vat-audit"],
    queryFn: async () => {
      const { data: offers, error } = await supabase
        .from("external_offers")
        .select(`
          id, unit_price, product_url, updated_at,
          external_vendors:external_vendor_id ( id, name ),
          products:product_id (
            id, name, gtin, cnk_code,
            categories:category_id ( id, name, vat_rate )
          )
        `)
        .eq("is_active", true)
        .limit(5000);
      if (error) throw error;
      return offers || [];
    },
  });

  const rows = useMemo(() => {
    return (data || []).map((eo: any) => {
      const cat = eo.products?.categories;
      const rawRate = cat?.vat_rate != null ? Number(cat.vat_rate) : null;
      const usedRate = rawRate != null ? rawRate : FALLBACK_VAT;
      const ttc = Number(eo.unit_price) || 0;
      const htva = ttc > 0 ? Math.round((ttc / (1 + usedRate / 100)) * 100) / 100 : 0;

      let status: "ok" | "fallback" | "missing_category" | "unexpected_rate" = "ok";
      if (!eo.products) status = "missing_category";
      else if (!cat) status = "missing_category";
      else if (rawRate == null) status = "fallback";
      else if (!EXPECTED_RATES.includes(rawRate)) status = "unexpected_rate";

      return {
        id: eo.id,
        vendorName: eo.external_vendors?.name || "—",
        productName: eo.products?.name || "(produit supprimé)",
        productId: eo.products?.id,
        gtin: eo.products?.gtin || eo.products?.cnk_code || "—",
        categoryName: cat?.name || "—",
        rawRate,
        usedRate,
        ttc,
        htva,
        productUrl: eo.product_url,
        status,
      };
    });
  }, [data]);

  const stats = useMemo(() => {
    const total = rows.length;
    const fallback = rows.filter(r => r.status === "fallback").length;
    const missing = rows.filter(r => r.status === "missing_category").length;
    const unexpected = rows.filter(r => r.status === "unexpected_rate").length;
    const ok = total - fallback - missing - unexpected;
    return { total, fallback, missing, unexpected, ok };
  }, [rows]);

  // Anomalies en tête (fallback + missing + unexpected)
  const sortedRows = useMemo(() => {
    const order: Record<string, number> = { missing_category: 0, fallback: 1, unexpected_rate: 2, ok: 3 };
    return [...rows].sort((a, b) => order[a.status] - order[b.status]);
  }, [rows]);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <AdminTopBar title="Audit TVA — Offres externes" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total offres actives</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-emerald-700">Conformes</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold text-emerald-700">{stats.ok}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-amber-700">Fallback 21% (vat_rate manquant)</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold text-amber-700">{stats.fallback}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-red-700">Sans catégorie / inattendu</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold text-red-700">{stats.missing + stats.unexpected}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Les prix relevés sur les sites externes sont en <strong>TTC</strong>. Le HTVA affiché côté fiche produit
              est calculé via <code>ttc / (1 + vat_rate / 100)</code> en utilisant le <code>vat_rate</code> de la catégorie
              du produit. Si la catégorie n'a pas de <code>vat_rate</code>, un fallback de <strong>{FALLBACK_VAT}%</strong> est appliqué.
              Les taux attendus en Belgique sont <strong>6%</strong> (médicaments) ou <strong>21%</strong> (OTC/parapharmacie).
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
          ) : sortedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune offre externe active.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Statut</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Vendeur</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">vat_rate</TableHead>
                    <TableHead className="text-right">Taux utilisé</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                    <TableHead className="text-right">HTVA</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.slice(0, 500).map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.status === "ok" && <Badge variant="outline" className="border-emerald-300 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>}
                        {r.status === "fallback" && <Badge variant="outline" className="border-amber-300 text-amber-700"><AlertTriangle className="w-3 h-3 mr-1" />Fallback</Badge>}
                        {r.status === "missing_category" && <Badge variant="outline" className="border-red-300 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Sans cat.</Badge>}
                        {r.status === "unexpected_rate" && <Badge variant="outline" className="border-orange-300 text-orange-700"><AlertTriangle className="w-3 h-3 mr-1" />Hors plage</Badge>}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate" title={r.productName}>
                        <div className="font-medium text-sm truncate">{r.productName}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">{r.gtin}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.vendorName}</TableCell>
                      <TableCell className="text-sm">{r.categoryName}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {r.rawRate != null ? `${r.rawRate}%` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {r.usedRate}% {r.rawRate == null && <span className="text-amber-600 text-[10px]">(fallback)</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{r.ttc.toFixed(2)} €</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{r.htva.toFixed(2)} €</TableCell>
                      <TableCell>
                        {r.productId && (
                          <Link to={`/admin/categories`} title="Gérer les catégories" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {sortedRows.length > 500 && (
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Affichage limité aux 500 premières lignes (anomalies en tête).
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
