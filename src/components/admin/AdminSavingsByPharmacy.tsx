import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import SavingsCategoryPie, { type SavingsCategoryRow } from "@/components/savings/SavingsCategoryPie";
import SavingsTopProducts, { type SavingsTopProduct } from "@/components/savings/SavingsTopProducts";
import SavingsMonthlyChart, { type SavingsMonthlyRow } from "@/components/savings/SavingsMonthlyChart";
import SavingsSupplierBreakdown, { type SavingsSupplierRow } from "@/components/savings/SavingsSupplierBreakdown";




type Row = {
  group_key: string;
  pharmacy_name: string | null;
  emails: string[] | null;
  analyses_count: number;
  total_savings: number | null;
  last_analysis_at: string | null;
  commercial_status: string | null;
};

const STATUSES: { value: string; label: string }[] = [
  { value: "to_contact", label: "À contacter" },
  { value: "contacted", label: "Contacté" },
  { value: "converted", label: "Converti" },
  { value: "lost", label: "Sans suite" },
];

const fmtEur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n));

export default function AdminSavingsByPharmacy() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [details, setDetails] = useState<
    Record<
      string,
      {
        cats: SavingsCategoryRow[];
        top: SavingsTopProduct[];
        monthly: SavingsMonthlyRow[];
        suppliers: SavingsSupplierRow[];
      }
    >
  >({});
  const [globalMonthly, setGlobalMonthly] = useState<SavingsMonthlyRow[] | null>(null);
  const [globalSuppliers, setGlobalSuppliers] = useState<SavingsSupplierRow[] | null>(null);

  async function toggle(groupKey: string) {
    if (openKey === groupKey) {
      setOpenKey(null);
      return;
    }
    setOpenKey(groupKey);
    if (details[groupKey]) return;
    const [{ data: cats }, { data: top }, { data: monthly }, { data: suppliers }] = await Promise.all([
      (supabase as any).rpc("savings_pharmacy_category_breakdown", { _group_key: groupKey }),
      (supabase as any).rpc("savings_top_products", { _group_key: groupKey, _limit: 30 }),
      (supabase as any).rpc("savings_monthly_breakdown", { _group_key: groupKey, _months: 12 }),
      (supabase as any).rpc("savings_supplier_breakdown", { _group_key: groupKey }),
    ]);
    setDetails((prev) => ({
      ...prev,
      [groupKey]: {
        cats: (cats as SavingsCategoryRow[]) ?? [],
        top: (top as SavingsTopProduct[]) ?? [],
        monthly: (monthly as SavingsMonthlyRow[]) ?? [],
        suppliers: (suppliers as SavingsSupplierRow[]) ?? [],
      },
    }));
  }



  async function load() {
    setLoading(true);
    const [{ data, error }, { data: monthly }, { data: suppliers }] = await Promise.all([
      (supabase as any).rpc("admin_savings_by_pharmacy"),
      (supabase as any).rpc("savings_monthly_breakdown", { _group_key: null, _months: 12 }),
      (supabase as any).rpc("savings_supplier_breakdown", { _group_key: null }),
    ]);
    if (error) toast.error("Chargement impossible");
    setRows((data as Row[]) ?? []);
    setGlobalMonthly((monthly as SavingsMonthlyRow[]) ?? []);
    setGlobalSuppliers((suppliers as SavingsSupplierRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);


  async function setStatus(groupKey: string, status: string) {
    setSaving(groupKey);
    const { error } = await (supabase as any).rpc("admin_set_savings_commercial_status", {
      _group_key: groupKey,
      _status: status,
    });
    setSaving(null);
    if (error) {
      toast.error("Mise à jour impossible");
      return;
    }
    setRows((prev) => prev.map((r) => (r.group_key === groupKey ? { ...r, commercial_status: status } : r)));
    toast.success("Statut commercial mis à jour");
  }

  return (
    <div className="space-y-6">
      {!loading && (globalMonthly?.length || globalSuppliers?.length) ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventilation temporelle (toutes pharmacies)</CardTitle>
            </CardHeader>
            <CardContent>
              <SavingsMonthlyChart rows={globalMonthly ?? []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grossistes (toutes pharmacies)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <SavingsSupplierBreakdown rows={globalSuppliers ?? []} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">

        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Par pharmacie ({rows.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Actualiser
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucune analyse.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-3" />
                <th className="py-2 pr-3">Pharmacie</th>
                <th className="py-2 pr-3">Email(s)</th>
                <th className="py-2 pr-3 text-right">Analyses</th>
                <th className="py-2 pr-3 text-right">Économie cumulée</th>
                <th className="py-2 pr-3">Dernière analyse</th>
                <th className="py-2 pr-3">Statut commercial</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <>
                  <tr key={r.group_key} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-1">
                      <button
                        type="button"
                        onClick={() => toggle(r.group_key)}
                        aria-label={openKey === r.group_key ? "Masquer le détail" : "Voir le détail"}
                        className="p-1 rounded hover:bg-muted"
                      >
                        {openKey === r.group_key ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {r.pharmacy_name ? (
                        <span className="block max-w-[220px] truncate" title={r.pharmacy_name}>
                          {r.pharmacy_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">— (email)</span>
                      )}
                    </td>

                    <td className="py-2 pr-3 text-xs">{(r.emails ?? []).join(", ") || "—"}</td>
                    <td className="py-2 pr-3 text-right">{r.analyses_count}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={Number(r.total_savings ?? 0) > 0 ? "text-emerald-600 font-semibold" : ""}>
                        {fmtEur(r.total_savings)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.last_analysis_at ? new Date(r.last_analysis_at).toLocaleString("fr-BE") : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={r.commercial_status ?? "to_contact"}
                        disabled={saving === r.group_key}
                        onChange={(e) => setStatus(r.group_key, e.target.value)}
                        className="h-8 px-2 rounded-md border border-input bg-background text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {openKey === r.group_key && (
                    <tr key={`${r.group_key}-detail`} className="border-b bg-muted/20">
                      <td colSpan={7} className="p-4 space-y-6">
                        {details[r.group_key] ? (
                          <>
                            <SavingsMonthlyChart
                              rows={details[r.group_key].monthly}
                              title="Montant commandé par mois (12 derniers mois)"
                            />
                            <SavingsSupplierBreakdown rows={details[r.group_key].suppliers} />
                            <SavingsCategoryPie
                              rows={details[r.group_key].cats}
                              title="Ventilation cumulée par type de produit"
                            />
                            <SavingsTopProducts rows={details[r.group_key].top} />
                          </>
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
    </div>
  );

}
