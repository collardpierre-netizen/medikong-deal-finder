import { useState, useRef } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Database, FileSpreadsheet, CheckCircle2, XCircle, Download, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportResult {
  total_imported: number;
  matched: number;
  unmatched: number;
  unmatched_samples: { cnk: string; name: string }[];
}

export default function AdminPrixReference() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["admin-market-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_price_sources")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: priceCounts = {} } = useQuery({
    queryKey: ["admin-market-price-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_prices")
        .select("source_id, is_matched");
      if (error) throw error;
      const counts: Record<string, { total: number; matched: number }> = {};
      (data || []).forEach((row: any) => {
        if (!counts[row.source_id]) counts[row.source_id] = { total: 0, matched: 0 };
        counts[row.source_id].total++;
        if (row.is_matched) counts[row.source_id].matched++;
      });
      return counts;
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setFileData(rows);
        toast.success(`${rows.length} lignes détectées dans le fichier`);
      } catch {
        toast.error("Erreur de lecture du fichier");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!fileData || !selectedSourceId) {
      toast.error("Sélectionnez une source et un fichier");
      return;
    }

    const source = sources.find((s: any) => s.id === selectedSourceId);
    if (!source) return;

    setImporting(true);
    setProgress(0);
    setImportResult(null);

    const BATCH = 500;
    let totalImported = 0;
    let matched = 0;
    let unmatched = 0;
    const unmatchedSamples: { cnk: string; name: string }[] = [];

    try {
      for (let i = 0; i < fileData.length; i += BATCH) {
        const batch = fileData.slice(i, i + BATCH);
        const rows: any[] = [];

        for (const row of batch) {
          let cnk = "", ean = "", productName = "", prixGrossiste: number | null = null;
          let prixPharmacien: number | null = null, prixPublic: number | null = null;
          let tvaRate: number | null = null, supplierName = "", supplierCode = "", productUrl = "";

          const format = source.file_format;

          if (format === "febelco_xlsx") {
            // Febelco: Col A (index 0) = CNK, named columns for rest
            const keys = Object.keys(row);
            cnk = String(keys[0] ? row[keys[0]] : "").trim();
            ean = String(row["EANCode"] || row["eancode"] || row["EanCode"] || "").trim();
            productName = String(row["Product Name"] || row["product name"] || row["ProductName"] || "").trim();
            prixGrossiste = parseFloat(row["Prix de gros"] || row["prix de gros"]) || null;
            prixPublic = parseFloat(row["Prix public"] || row["prix public"]) || null;
            prixPharmacien = parseFloat(row["Prix pharmacie"] || row["prix pharmacie"]) || null;
            supplierCode = String(row["SupplierNbr"] || row["suppliernbr"] || "").trim();
            const status = String(row["ProductStatus"] || row["productstatus"] || "").trim();
            if (status === "CT") continue; // skip discontinued
          } else if (format === "cerp_xlsx") {
            cnk = String(row["CNK"] || row["cnk"] || "").trim();
            productName = String(row["Libelle"] || row["libelle"] || row["Libellé"] || "").trim();
            supplierName = String(row["Fournisseur"] || row["fournisseur"] || "").trim();
            prixPharmacien = parseFloat(row["Px pharmacien"] || row["px pharmacien"] || row["Prix pharmacien"]) || null;
            tvaRate = parseFloat(row["TVA"] || row["tva"]) || null;
          } else {
            // Generic: try to detect columns
            cnk = String(row["CNK"] || row["cnk"] || row["Code CNK"] || "").trim();
            ean = String(row["EAN"] || row["ean"] || row["GTIN"] || row["gtin"] || row["EANCode"] || "").trim();
            productName = String(row["Nom"] || row["nom"] || row["Product Name"] || row["Libelle"] || row["Libellé"] || "").trim();
            prixGrossiste = parseFloat(row["Prix grossiste"] || row["prix_grossiste"] || row["Prix de gros"]) || null;
            prixPharmacien = parseFloat(row["Prix pharmacien"] || row["prix_pharmacien"] || row["Px pharmacien"]) || null;
            prixPublic = parseFloat(row["Prix public"] || row["prix_public"]) || null;
            tvaRate = parseFloat(row["TVA"] || row["tva"]) || null;
            supplierName = String(row["Fournisseur"] || row["fournisseur"] || "").trim();
            productUrl = String(row["URL"] || row["url"] || row["Lien"] || "").trim();
          }

          if (!cnk && !ean) continue;

          // Match product
          let productId: string | null = null;
          if (ean && ean.length >= 8) {
            const { data: byGtin } = await supabase
              .from("products")
              .select("id")
              .eq("gtin", ean)
              .maybeSingle();
            productId = byGtin?.id || null;
          }
          if (!productId && cnk) {
            const { data: byCnk } = await supabase
              .from("product_market_codes")
              .select("product_id")
              .eq("code_value", cnk)
              .maybeSingle();
            productId = byCnk?.product_id || null;
          }
          // Cross-match via other source's market_prices
          if (!productId && cnk) {
            const { data: crossMatch } = await supabase
              .from("market_prices")
              .select("product_id")
              .eq("cnk", cnk)
              .not("product_id", "is", null)
              .limit(1)
              .maybeSingle();
            productId = crossMatch?.product_id || null;
          }

          if (productId) matched++;
          else {
            unmatched++;
            if (unmatchedSamples.length < 20) {
              unmatchedSamples.push({ cnk, name: productName });
            }
          }

          rows.push({
            source_id: selectedSourceId,
            cnk: cnk || null,
            ean: ean || null,
            product_id: productId,
            product_name_source: productName || null,
            prix_grossiste: prixGrossiste,
            prix_pharmacien: prixPharmacien,
            prix_public: prixPublic,
            tva_rate: tvaRate,
            supplier_name: supplierName || null,
            supplier_code: supplierCode || null,
            product_url: productUrl || null,
            is_matched: !!productId,
            imported_at: new Date().toISOString(),
          });
        }

        if (rows.length > 0) {
          // Deduplicate by cnk within batch
          const deduped = new Map<string, any>();
          for (const r of rows) {
            const key = r.cnk || r.ean || `${Math.random()}`;
            deduped.set(key, r);
          }

          const { error } = await supabase
            .from("market_prices")
            .upsert(Array.from(deduped.values()), { onConflict: "source_id,cnk" });
          if (error) {
            console.error("Upsert error:", error);
            // Try individual inserts as fallback
            for (const r of Array.from(deduped.values())) {
              await supabase.from("market_prices").upsert(r, { onConflict: "source_id,cnk" });
            }
          }
          totalImported += deduped.size;
        }

        setProgress(Math.round(((i + BATCH) / fileData.length) * 100));
        await new Promise(r => setTimeout(r, 100));
      }

      // Update source stats
      await supabase
        .from("market_price_sources")
        .update({ last_import_at: new Date().toISOString(), total_products: totalImported })
        .eq("id", selectedSourceId);

      setImportResult({ total_imported: totalImported, matched, unmatched, unmatched_samples: unmatchedSamples });
      toast.success(`Import terminé : ${totalImported} lignes, ${matched} matchées`);
      qc.invalidateQueries({ queryKey: ["admin-market-price-counts"] });
      qc.invalidateQueries({ queryKey: ["admin-market-sources"] });
    } catch (e: any) {
      toast.error("Erreur d'import : " + e.message);
    } finally {
      setImporting(false);
      setProgress(100);
    }
  };

  const downloadUnmatched = () => {
    if (!importResult?.unmatched_samples.length) return;
    const ws = XLSX.utils.json_to_sheet(importResult.unmatched_samples);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Non matchés");
    XLSX.writeFile(wb, "non-matches.xlsx");
  };

  return (
    <div>
      <AdminTopBar title="Prix du Marché" subtitle="Import et gestion des prix de référence (Febelco, CERP, etc.)" />

      {/* Sources overview */}
      <div className="bg-white rounded-lg border border-border overflow-hidden mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px] font-semibold text-muted-foreground">Source</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground">Type</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground">Format</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground text-center">Produits</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground text-center">Matchés</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground">Dernier import</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground text-center">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : sources.map((src: any) => {
              const counts = (priceCounts as any)[src.id];
              return (
                <TableRow key={src.id}>
                  <TableCell className="text-[13px] font-semibold">{src.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{src.source_type}</Badge></TableCell>
                  <TableCell className="text-[12px] text-muted-foreground font-mono">{src.file_format || "—"}</TableCell>
                  <TableCell className="text-center text-[13px] font-medium">{counts?.total || 0}</TableCell>
                  <TableCell className="text-center">
                    {counts?.total > 0 ? (
                      <span className="text-[13px] font-medium text-green-700">{counts?.matched || 0} <span className="text-[10px] text-muted-foreground">({Math.round(((counts?.matched || 0) / counts.total) * 100)}%)</span></span>
                    ) : <span className="text-[12px] text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {src.last_import_at ? new Date(src.last_import_at).toLocaleDateString("fr-FR") : "Jamais"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={src.is_active ? "default" : "secondary"} className="text-[10px]">
                      {src.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Import section */}
      <div className="bg-white rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet size={18} className="text-primary" />
          <h3 className="text-[15px] font-bold">Importer un fichier de prix</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">Source</label>
            <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Sélectionner la source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} {s.file_format ? `(${s.file_format})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">Fichier (.xlsx, .csv)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleImport} disabled={!fileData || !selectedSourceId || importing} className="gap-1.5">
              {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? "Import en cours…" : "Lancer l'import"}
            </Button>
          </div>
        </div>

        {/* Preview */}
        {fileData && (
          <div className="text-[12px] text-muted-foreground mb-3">
            <Database size={12} className="inline mr-1" />
            <strong>{fileData.length}</strong> lignes détectées dans <strong>{fileName}</strong>
            {fileData.length > 0 && (
              <span className="ml-2">— Colonnes : {Object.keys(fileData[0]).slice(0, 8).join(", ")}{Object.keys(fileData[0]).length > 8 ? "…" : ""}</span>
            )}
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="mb-3">
            <Progress value={progress} className="h-2" />
            <p className="text-[11px] text-muted-foreground mt-1">{progress}% — Traitement en cours…</p>
          </div>
        )}

        {/* Results */}
        {importResult && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-6 text-sm">
              <span className="flex items-center gap-1.5"><Database size={14} className="text-primary" /> <strong>{importResult.total_imported}</strong> lignes importées</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> <strong>{importResult.matched}</strong> matchés</span>
              <span className="flex items-center gap-1.5"><XCircle size={14} className="text-amber-500" /> <strong>{importResult.unmatched}</strong> non matchés</span>
            </div>
            {importResult.unmatched_samples.length > 0 && (
              <>
                <p className="text-[12px] text-muted-foreground font-medium">Exemples de produits non matchés :</p>
                <div className="max-h-40 overflow-auto text-[12px] space-y-1">
                  {importResult.unmatched_samples.map((s, i) => (
                    <div key={i} className="flex gap-3 text-muted-foreground">
                      <span className="font-mono">{s.cnk}</span>
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadUnmatched}>
                  <Download size={12} /> Télécharger non-matchés
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
