import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const KIND: Record<string, string> = { unavailable: "Pas dispo", price: "Autre prix" };

export default function AdminScanFieldReports() {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: ["admin-field-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scan_field_reports" as never)
        .select("id, kind, price_excl_vat_cents, created_at, customer:customers(company_name, is_test), product:products(name), wholesaler:wholesaler_profiles(display_name)")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return ((data ?? []) as any[]).filter((r) => !r.customer?.is_test);
    },
  });
  const counts = useQuery({
    queryKey: ["admin-field-sentinel"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_field_report_sentinel_counts" as never);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const review = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("admin_review_field_report" as never, { _report_id: id, _approve: approve } as never);
    if (error) { console.error(error); toast.error(error.message); return; }
    toast.success(approve ? "Validé" : "Rejeté");
    qc.invalidateQueries({ queryKey: ["admin-field-reports"] });
    qc.invalidateQueries({ queryKey: ["admin-field-sentinel"] });
  };

  return (
    <div className="space-y-6">
      <AdminTopBar title="Signalements terrain" subtitle="Signalements en attente (comptes de test exclus)" />
      <Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Officine</TableHead><TableHead>Produit</TableHead>
          <TableHead>Grossiste</TableHead><TableHead>Type</TableHead><TableHead>Valeur HTVA</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {(pending.data ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell>{new Date(r.created_at).toLocaleString("fr-BE")}</TableCell>
              <TableCell>{r.customer?.company_name ?? "—"}</TableCell>
              <TableCell>{r.product?.name ?? "—"}</TableCell>
              <TableCell>{r.wholesaler?.display_name ?? "—"}</TableCell>
              <TableCell>{KIND[r.kind] ?? r.kind}</TableCell>
              <TableCell>{r.price_excl_vat_cents != null ? (r.price_excl_vat_cents / 100).toFixed(2).replace(".", ",") + " €" : "—"}</TableCell>
              <TableCell className="space-x-2 whitespace-nowrap">
                <Button size="sm" onClick={() => review(r.id, true)}>Valider</Button>
                <Button size="sm" variant="outline" onClick={() => review(r.id, false)}>Rejeter</Button>
              </TableCell>
            </TableRow>
          ))}
          {!pending.isLoading && (pending.data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-muted-foreground">Aucun signalement en attente.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      <div>
        <h2 className="font-semibold mb-2">Compteur Sentinelle (signalements validés)</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Officine</TableHead><TableHead>Validés</TableHead></TableRow></TableHeader>
          <TableBody>
            {(counts.data ?? []).map((c) => (
              <TableRow key={c.customer_id}><TableCell>{c.customer_name}</TableCell><TableCell>{c.validated_count}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
