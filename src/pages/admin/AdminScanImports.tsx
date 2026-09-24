/**
 * /admin/scan/imports — Import mensuel des prix pharmacien HTVA des grossistes.
 * Upload CSV/XLSX → choix grossiste + mois → mapping colonnes → aperçu → import.
 * Serveur : RPC admin_import_wholesaler_prices (market_prices = prix courant,
 * market_price_history = 1 ligne par produit et par mois ; écarts > 15 % vs mois précédent).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sb = supabase as any;
const NONE = "__none__";
const BATCH = 1500;
const eur = (v: number) => `${Number(v).toFixed(2).replace(".", ",")} €`;

type Report = { rows: number; matched: number; unmatched: any[]; deltas: any[] };

function guess(headers: string[], re: RegExp) {
  return headers.find((h) => re.test(h)) ?? NONE;
}

export default function AdminScanImports() {
  const [sourceId, setSourceId] = useState<string>("");
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [map, setMap] = useState({ cnk: NONE, ean: NONE, price: NONE, name: NONE });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<Report | null>(null);

  const { data: sources = [] } = useQuery({
    queryKey: ["admin-market-price-sources"],
    queryFn: async () => {
      const { data } = await sb.from("market_price_sources").select("id, name").order("name");
      return data ?? [];
    },
  });

  const onFile = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", raw: false });
    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
    const h = Object.keys(json[0] ?? {});
    setFileName(f.name); setHeaders(h); setRows(json); setReport(null);
    setMap({
      cnk: guess(h, /cnk/i),
      ean: guess(h, /ean|gtin|barcode/i),
      price: guess(h, /pharm|prix|price|htva/i),
      name: guess(h, /nom|name|d[ée]signation|libell/i),
    });
  };

  const mapped = useMemo(() => rows.map((r) => ({
    cnk: map.cnk !== NONE ? String(r[map.cnk] ?? "") : null,
    ean: map.ean !== NONE ? String(r[map.ean] ?? "") : null,
    price: map.price !== NONE ? String(r[map.price] ?? "") : null,
    name: map.name !== NONE ? String(r[map.name] ?? "") : null,
  })), [rows, map]);

  const canImport = !!sourceId && !!month && rows.length > 0 && map.price !== NONE && (map.cnk !== NONE || map.ean !== NONE);

  const runImport = async () => {
    setBusy(true); setProgress(0);
    const agg: Report = { rows: 0, matched: 0, unmatched: [], deltas: [] };
    try {
      for (let i = 0; i < mapped.length; i += BATCH) {
        const { data, error } = await sb.rpc("admin_import_wholesaler_prices", {
          _source_id: sourceId, _period: `${month}-01`, _rows: mapped.slice(i, i + BATCH), _source_file: fileName,
        });
        if (error) throw error;
        agg.rows += data.rows; agg.matched += data.matched;
        agg.unmatched.push(...(data.unmatched ?? [])); agg.deltas.push(...(data.deltas ?? []));
        setProgress(Math.min(100, Math.round(((i + BATCH) / mapped.length) * 100)));
      }
      setReport(agg);
      toast.success(`Import terminé : ${agg.rows} lignes, ${agg.matched} rattachées`);
    } catch (e: any) {
      toast.error(`Import interrompu : ${e.message ?? e}`);
      setReport(agg);
    } finally { setBusy(false); }
  };

  const exportUnmatched = () => {
    if (!report) return;
    const ws = XLSX.utils.json_to_sheet(report.unmatched);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Non rattachés");
    XLSX.writeFile(wb, `non-rattaches-${month}.xlsx`);
  };

  const colSelect = (key: keyof typeof map, label: string) => (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <Select value={map[key]} onValueChange={(v) => setMap((m) => ({ ...m, [key]: v }))}>
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
      <AdminTopBar title="Scan · Import des prix grossistes" subtitle="Prix pharmacien HTVA mensuels (Febelco, CERP…)" />

      <div className="grid gap-4 md:grid-cols-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">Grossiste</div>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>{sources.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">Mois</div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
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
          <div className="grid gap-4 md:grid-cols-4">
            {colSelect("cnk", "CNK")}
            {colSelect("ean", "EAN")}
            {colSelect("price", "Prix pharmacien HTVA")}
            {colSelect("name", "Libellé (optionnel)")}
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>CNK</TableHead><TableHead>EAN</TableHead><TableHead>Prix HTVA</TableHead><TableHead>Libellé</TableHead></TableRow></TableHeader>
            <TableBody>
              {mapped.slice(0, 10).map((r, i) => (
                <TableRow key={i}><TableCell>{r.cnk}</TableCell><TableCell>{r.ean}</TableCell><TableCell>{r.price}</TableCell><TableCell className="truncate max-w-xs">{r.name}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-3">
            <Button onClick={runImport} disabled={!canImport || busy}>
              <Upload className="h-4 w-4 mr-2" />{busy ? `Import… ${progress} %` : "Importer"}
            </Button>
            {!canImport && <span className="text-sm text-muted-foreground">Choisissez un grossiste, un mois, la colonne prix et au moins CNK ou EAN.</span>}
          </div>
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
    </div>
  );
}
