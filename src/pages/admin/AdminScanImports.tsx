/**
 * /admin/scan/imports — Import des prix pharmacien HTVA des grossistes (protégé).
 * Source + date du tarif obligatoires → mapping → résumé serveur (admin_preview_wholesaler_import)
 * → import (admin_start / admin_import_wholesaler_prices_v2 / admin_finish).
 * Tout prix écrasé est archivé ; « Annuler cet import » rétablit l'état d'avant.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, Download, Undo2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import GtinProposalsPanel from "@/components/admin/scan/GtinProposalsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sb = supabase as any;
const NONE = "__none__";
const BATCH = 1500;
const eur = (v: number) => `${Number(v).toFixed(2).replace(".", ",")} €`;
const frDate = (d: string) => new Date(d).toLocaleDateString("fr-BE");

type Report = { rows: number; matched: number; changed: number; inserted: number; unmatched: any[]; deltas: any[] };
type Preview = { rows: number; new: number; changed: number; avg_delta_pct: number | null; suppliers: Record<string, number>; mismatched_suppliers: Record<string, number> };

function guess(headers: string[], re: RegExp) {
  return headers.find((h) => re.test(h)) ?? NONE;
}

export default function AdminScanImports() {
  const qc = useQueryClient();
  const [sourceId, setSourceId] = useState<string>("");
  const [tariffDate, setTariffDate] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [map, setMap] = useState({ cnk: NONE, ean: NONE, price: NONE, name: NONE, supplier: NONE });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const { data: sources = [] } = useQuery({
    queryKey: ["admin-market-price-sources"],
    queryFn: async () => {
      const { data } = await sb.from("market_price_sources").select("id, name, is_test, is_active").order("name");
      return data ?? [];
    },
  });

  const { data: imports = [] } = useQuery({
    queryKey: ["admin-market-price-imports"],
    queryFn: async () => {
      const { data } = await sb.from("market_price_imports").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });
  const sourceName = (id: string) => sources.find((s: any) => s.id === id)?.name ?? "—";

  const onFile = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", raw: false });
    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
    const h = Object.keys(json[0] ?? {});
    setFileName(f.name); setHeaders(h); setRows(json); setReport(null); setPreview(null);
    setMap({
      cnk: guess(h, /cnk/i),
      ean: guess(h, /ean|gtin|barcode/i),
      price: guess(h, /pharm|prix|price|htva/i),
      name: guess(h, /nom|name|d[ée]signation|libell/i),
      supplier: guess(h, /fournisseur|supplier|grossiste|wholesaler/i),
    });
  };

  const mapped = useMemo(() => rows.map((r) => ({
    cnk: map.cnk !== NONE ? String(r[map.cnk] ?? "") : null,
    ean: map.ean !== NONE ? String(r[map.ean] ?? "") : null,
    price: map.price !== NONE ? String(r[map.price] ?? "") : null,
    name: map.name !== NONE ? String(r[map.name] ?? "") : null,
    supplier: map.supplier !== NONE ? String(r[map.supplier] ?? "") : null,
  })), [rows, map]);

  const ready = !!sourceId && !!tariffDate && rows.length > 0 && map.price !== NONE && (map.cnk !== NONE || map.ean !== NONE);
  const mismatch = preview ? Object.keys(preview.mismatched_suppliers ?? {}).length > 0 : false;
  const canImport = ready && !!preview && !mismatch;

  const resetPreview = () => { setPreview(null); setReport(null); };

  const runPreview = async () => {
    setBusy(true);
    try {
      const agg: Preview = { rows: 0, new: 0, changed: 0, avg_delta_pct: null, suppliers: {}, mismatched_suppliers: {} };
      let sumPct = 0, nPct = 0;
      for (let i = 0; i < mapped.length; i += BATCH) {
        const { data, error } = await sb.rpc("admin_preview_wholesaler_import", { _source_id: sourceId, _rows: mapped.slice(i, i + BATCH) });
        if (error) throw error;
        agg.rows += data.rows; agg.new += data.new; agg.changed += data.changed;
        if (data.avg_delta_pct != null) { sumPct += data.avg_delta_pct * data.changed; nPct += data.changed; }
        for (const [k, v] of Object.entries(data.suppliers ?? {})) agg.suppliers[k] = (agg.suppliers[k] ?? 0) + (v as number);
        for (const [k, v] of Object.entries(data.mismatched_suppliers ?? {})) agg.mismatched_suppliers[k] = (agg.mismatched_suppliers[k] ?? 0) + (v as number);
      }
      agg.avg_delta_pct = nPct > 0 ? Math.round((sumPct / nPct) * 10) / 10 : null;
      setPreview(agg);
    } catch (e: any) {
      toast.error(`Résumé impossible : ${e.message ?? e}`);
    } finally { setBusy(false); }
  };

  const runImport = async () => {
    setBusy(true); setProgress(0);
    const agg: Report = { rows: 0, matched: 0, changed: 0, inserted: 0, unmatched: [], deltas: [] };
    let importId: string | null = null;
    try {
      const { data: id, error: e0 } = await sb.rpc("admin_start_wholesaler_import", { _source_id: sourceId, _tariff_date: tariffDate, _file_name: fileName });
      if (e0) throw e0;
      importId = id;
      for (let i = 0; i < mapped.length; i += BATCH) {
        const { data, error } = await sb.rpc("admin_import_wholesaler_prices_v2", { _import_id: importId, _rows: mapped.slice(i, i + BATCH) });
        if (error) throw error;
        agg.rows += data.rows; agg.matched += data.matched; agg.changed += data.changed; agg.inserted += data.inserted;
        agg.unmatched.push(...(data.unmatched ?? [])); agg.deltas.push(...(data.deltas ?? []));
        setProgress(Math.min(100, Math.round(((i + BATCH) / mapped.length) * 100)));
      }
      await sb.rpc("admin_finish_wholesaler_import", { _import_id: importId });
      setReport(agg);
      toast.success(`Import terminé : ${agg.rows} lignes, ${agg.changed} prix modifiés (anciens archivés), ${agg.inserted} ajoutés`);
    } catch (e: any) {
      if (importId) await sb.rpc("admin_finish_wholesaler_import", { _import_id: importId });
      toast.error(`Import interrompu : ${e.message ?? e}. Les lignes déjà traitées peuvent être annulées ci-dessous.`);
      setReport(agg);
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["admin-market-price-imports"] });
    }
  };

  const revert = async (imp: any) => {
    if (!window.confirm(`Annuler l'import « ${imp.file_name ?? ""} » (${sourceName(imp.source_id)}, tarif du ${frDate(imp.tariff_date)}) et rétablir les prix d'avant ?`)) return;
    setBusy(true);
    const { data, error } = await sb.rpc("admin_revert_wholesaler_import", { _import_id: imp.id });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(`Import annulé : ${data.restored} prix rétablis, ${data.removed} lignes ajoutées retirées`);
    qc.invalidateQueries({ queryKey: ["admin-market-price-imports"] });
  };

  const deleteTestData = async () => {
    if (!window.confirm("Supprimer tous les prix de cette source de test ?")) return;
    setBusy(true);
    const [a, b] = await Promise.all([
      sb.from("market_price_history").delete().eq("source_id", sourceId),
      sb.from("market_prices").delete().eq("source_id", sourceId),
    ]);
    setBusy(false);
    if (a.error || b.error) toast.error((a.error ?? b.error).message);
    else toast.success("Données de test supprimées");
  };

  const exportUnmatched = () => {
    if (!report) return;
    const ws = XLSX.utils.json_to_sheet(report.unmatched);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Non rattachés");
    XLSX.writeFile(wb, `non-rattaches-${tariffDate}.xlsx`);
  };

  const colSelect = (key: keyof typeof map, label: string) => (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <Select value={map[key]} onValueChange={(v) => { setMap((m) => ({ ...m, [key]: v })); resetPreview(); }}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Aucune —</SelectItem>
          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <AdminTopBar title="Scan · Import des prix grossistes" subtitle="Prix pharmacien HTVA (Febelco, CERP, Phoenix…)" />

      <div className="grid gap-4 md:grid-cols-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">Source du tarif *</div>
          <Select value={sourceId} onValueChange={(v) => { setSourceId(v); resetPreview(); }}>
            <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>{sources.filter((s: any) => s.is_active).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">Date du tarif *</div>
          <Input type="date" value={tariffDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => { setTariffDate(e.target.value); resetPreview(); }} />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">Fichier CSV / XLSX</div>
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      </div>

      {headers.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Correspondance des colonnes</h2>
            <Badge variant="secondary">{rows.length} lignes · {fileName}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            {colSelect("cnk", "CNK")}
            {colSelect("ean", "EAN")}
            {colSelect("price", "Prix pharmacien HTVA")}
            {colSelect("name", "Libellé (optionnel)")}
            {colSelect("supplier", "Fournisseur (contrôle)")}
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>CNK</TableHead><TableHead>EAN</TableHead><TableHead>Prix HTVA</TableHead><TableHead>Libellé</TableHead><TableHead>Fournisseur</TableHead></TableRow></TableHeader>
            <TableBody>
              {mapped.slice(0, 10).map((r, i) => (
                <TableRow key={i}><TableCell>{r.cnk}</TableCell><TableCell>{r.ean}</TableCell><TableCell>{r.price}</TableCell><TableCell className="truncate max-w-xs">{r.name}</TableCell><TableCell>{r.supplier}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={runPreview} disabled={!ready || busy}>
              <Eye className="h-4 w-4 mr-2" />Voir le résumé
            </Button>
            {!ready && <span className="text-sm text-muted-foreground">Choisissez la source, la date du tarif, la colonne prix et au moins CNK ou EAN.</span>}
          </div>
        </div>
      )}

      {preview && (
        <div className={`rounded-xl border bg-card p-4 space-y-4 ${mismatch ? "border-destructive" : ""}`}>
          <h2 className="font-semibold">Résumé avant validation · {sourceName(sourceId)} · tarif du {frDate(tariffDate)}</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div><div className="text-2xl font-bold">{preview.rows}</div><div className="text-sm text-muted-foreground">Lignes avec prix</div></div>
            <div><div className="text-2xl font-bold">{preview.changed}</div><div className="text-sm text-muted-foreground">Prix qui vont changer (anciens archivés)</div></div>
            <div><div className="text-2xl font-bold">{preview.new}</div><div className="text-sm text-muted-foreground">Nouveaux prix</div></div>
            <div><div className="text-2xl font-bold">{preview.avg_delta_pct == null ? "—" : `${preview.avg_delta_pct > 0 ? "+" : ""}${String(preview.avg_delta_pct).replace(".", ",")} %`}</div><div className="text-sm text-muted-foreground">Écart moyen vs dernier import</div></div>
          </div>
          <div className="text-sm">
            <span className="font-medium">Colonne Fournisseur : </span>
            {map.supplier === NONE ? "non détectée" : Object.keys(preview.suppliers).length === 0 ? "présente mais vide" :
              Object.entries(preview.suppliers).map(([k, v]) => `${k} (${v})`).join(", ")}
          </div>
          {mismatch ? (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              Fichier refusé : la colonne Fournisseur indique {Object.entries(preview.mismatched_suppliers).map(([k, v]) => `« ${k} » (${v} lignes)`).join(", ")}, ce qui contredit la source « {sourceName(sourceId)} ».
            </div>
          ) : (
            <Button onClick={runImport} disabled={!canImport || busy}>
              <Upload className="h-4 w-4 mr-2" />{busy ? `Import… ${progress} %` : "Valider et importer"}
            </Button>
          )}
        </div>
      )}

      {report && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="font-semibold">Rapport</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div><div className="text-2xl font-bold">{report.rows}</div><div className="text-sm text-muted-foreground">Lignes importées</div></div>
            <div><div className="text-2xl font-bold">{report.matched}</div><div className="text-sm text-muted-foreground">Produits rattachés</div></div>
            <div><div className="text-2xl font-bold">{report.rows - report.matched}</div><div className="text-sm text-muted-foreground">Non rattachés</div></div>
            <div><div className="text-2xl font-bold">{report.deltas.length}</div><div className="text-sm text-muted-foreground">Écarts &gt; 15 % vs mois précédent</div></div>
          </div>
          {report.unmatched.length > 0 && (
            <Button variant="outline" onClick={exportUnmatched}><Download className="h-4 w-4 mr-2" />Exporter les non rattachés</Button>
          )}
          {report.deltas.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>CNK</TableHead><TableHead>Mois précédent</TableHead><TableHead>Ce mois</TableHead><TableHead>Écart</TableHead></TableRow></TableHeader>
              <TableBody>
                {report.deltas.slice(0, 200).map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.cnk ?? "—"}</TableCell><TableCell>{eur(d.prev)}</TableCell><TableCell>{eur(d.new)}</TableCell>
                    <TableCell><Badge variant={Math.abs(d.pct) > 30 ? "destructive" : "secondary"}>{d.pct > 0 ? "+" : ""}{String(d.pct).replace(".", ",")} %</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Derniers imports</h2>
        {imports.length === 0 ? <div className="text-sm text-muted-foreground">Aucun import protégé pour l'instant.</div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Tarif du</TableHead><TableHead>Fichier</TableHead><TableHead>Modifiés / ajoutés</TableHead><TableHead>Statut</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {imports.map((imp: any) => (
                <TableRow key={imp.id}>
                  <TableCell>{frDate(imp.created_at)}</TableCell>
                  <TableCell>{sourceName(imp.source_id)}</TableCell>
                  <TableCell>{frDate(imp.tariff_date)}</TableCell>
                  <TableCell className="truncate max-w-xs">{imp.file_name}</TableCell>
                  <TableCell>{imp.changed_count} / {imp.inserted_count}</TableCell>
                  <TableCell><Badge variant={imp.status === "reverted" ? "secondary" : "default"}>{imp.status === "reverted" ? "Annulé" : imp.status === "done" ? "Terminé" : "En cours"}</Badge></TableCell>
                  <TableCell>{imp.status !== "reverted" && (
                    <Button size="sm" variant="outline" onClick={() => revert(imp)} disabled={busy}><Undo2 className="h-4 w-4 mr-1" />Annuler cet import</Button>
                  )}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <GtinProposalsPanel sourceId={sourceId} month={tariffDate.slice(0, 7)} rows={mapped} />

      {sources.find((s: any) => s.id === sourceId)?.is_test && (
        <div className="rounded-xl border border-destructive/40 bg-card p-4 flex items-center justify-between gap-3">
          <span className="text-sm">Source de test : ses prix ne sont visibles que par les comptes de test.</span>
          <Button variant="destructive" onClick={deleteTestData} disabled={busy}>Supprimer les données de test</Button>
        </div>
      )}
    </div>
  );
}
