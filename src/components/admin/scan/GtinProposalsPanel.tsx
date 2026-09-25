/**
 * Onglet « EAN à compléter » : propositions d'EAN retrouvés par le CNK.
 * Rien n'est écrit sur les produits avant validation admin (RPC admin_review_gtin_proposals).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sb = supabase as any;

export default function GtinProposalsPanel({ sourceId, rows, month }: {
  sourceId: string; month: string; rows: { cnk: string | null; ean: string | null }[];
}) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: proposals = [] } = useQuery({
    queryKey: ["admin-gtin-proposals"],
    queryFn: async () => {
      const { data } = await sb.from("product_gtin_proposals")
        .select("id, proposed_gtin, matched_cnk, created_at, proposal_source, packaging_level, units_per_pack, scan_event:scan_events(customer:customers(company_name)), product:products(name), source:market_price_sources(name)")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  const generate = async () => {
    const payload = rows.filter((r) => r.cnk && r.ean).map((r) => ({ cnk: r.cnk, ean: r.ean }));
    if (!sourceId || !payload.length) { toast.error("Choisissez un grossiste et un fichier avec CNK et EAN."); return; }
    setBusy(true);
    const { data, error } = await sb.rpc("admin_generate_gtin_proposals", { _source_id: sourceId, _rows: payload });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data} proposition(s) ajoutée(s)`);
    qc.invalidateQueries({ queryKey: ["admin-gtin-proposals"] });
  };

  const review = async (ids: string[], approve: boolean) => {
    if (!ids.length) return;
    setBusy(true);
    const { data, error } = await sb.rpc("admin_review_gtin_proposals", { _ids: ids, _approve: approve });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const out = (data ?? []) as { outcome: string }[];
    const c = (k: string) => out.filter((o) => o.outcome === k).length;
    toast.success(approve
      ? `${c("approved")} validé(s) · ${c("conflict")} refusé(s) (EAN déjà utilisé)`
      : `${c("rejected")} rejeté(s)`);
    setSel(new Set());
    qc.invalidateQueries({ queryKey: ["admin-gtin-proposals"] });
  };

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">EAN à compléter</h2>
          <p className="text-sm text-muted-foreground">Propositions issues des scans et des fichiers grossistes ({month}). Une validation ajoute l'EAN secondaire sans remplacer le GTIN de la fiche.</p>
        </div>
        <Button variant="outline" onClick={generate} disabled={busy || rows.length === 0}>Chercher dans ce fichier</Button>
      </div>
      {proposals.length === 0 ? <p className="text-sm text-muted-foreground">Aucune proposition en attente.</p> : (
        <>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => review([...sel], true)} disabled={busy || !sel.size}>Valider la sélection</Button>
            <Button size="sm" variant="outline" onClick={() => review(proposals.map((p: any) => p.id), true)} disabled={busy}>Tout valider</Button>
            <Button size="sm" variant="destructive" onClick={() => review([...sel], false)} disabled={busy || !sel.size}>Rejeter la sélection</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead /><TableHead>Produit</TableHead><TableHead>CNK</TableHead><TableHead>EAN proposé</TableHead><TableHead>Origine</TableHead><TableHead>Conditionnement</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {proposals.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell><Checkbox checked={sel.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                  <TableCell className="max-w-xs truncate">{p.product?.name ?? "—"}</TableCell>
                  <TableCell>{p.matched_cnk}</TableCell>
                  <TableCell className="font-mono">{p.proposed_gtin}</TableCell>
                  <TableCell>{p.proposal_source === "scan" ? `Scan · ${p.scan_event?.customer?.company_name ?? "Officine"}` : p.source?.name ?? "Import"}</TableCell>
                  <TableCell>{p.packaging_level === "unit" ? "Unité" : p.packaging_level === "pack" ? "Pack" : "Carton"} · {p.units_per_pack} unité(s)</TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleDateString("fr-BE")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
