import { useState, useRef } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Search, Upload, Check, X, Package, FileSpreadsheet, Download,
  Database, CheckCircle2, XCircle, RefreshCw, Hash, PlusCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

const FLAG_MAP: Record<string, string> = {
  BE: "🇧🇪", DE: "🇩🇪", FR: "🇫🇷", NL: "🇳🇱", IT: "🇮🇹", ES: "🇪🇸",
};

interface ImportResult {
  total_imported: number;
  matched: number;
  unmatched: number;
  created: number;
  enriched: number;
  unmatched_samples: { cnk: string; name: string }[];
}

export default function AdminMarketCodes() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("import");

  // Import state
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [autoCreateProducts, setAutoCreateProducts] = useState(true);
  const [autoEnrich, setAutoEnrich] = useState(true);

  // Codes state
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [codeValues, setCodeValues] = useState<Record<string, { value: string; verified: boolean }>>({});

  // ─── Queries ───
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["admin-market-sources"],
    queryFn: async () => {
      const { data } = await supabase.from("market_price_sources").select("*").order("name");
      return data || [];
    },
  });

  const { data: priceCounts = {} } = useQuery({
    queryKey: ["admin-market-price-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("market_prices").select("source_id, is_matched");
      const counts: Record<string, { total: number; matched: number }> = {};
      (data || []).forEach((row: any) => {
        if (!counts[row.source_id]) counts[row.source_id] = { total: 0, matched: 0 };
        counts[row.source_id].total++;
        if (row.is_matched) counts[row.source_id].matched++;
      });
      return counts;
    },
  });

  const { data: codeTypes = [] } = useQuery({
    queryKey: ["market-code-types"],
    queryFn: async () => {
      const { data } = await supabase.from("market_code_types").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["admin-market-search", search],
    queryFn: async () => {
      if (!search.trim() || search.trim().length < 2) return [];
      const { data } = await supabase.from("products").select("id, name, gtin, brand_name, image_urls")
        .or(`name.ilike.%${search.trim()}%,gtin.ilike.%${search.trim()}%,brand_name.ilike.%${search.trim()}%`)
        .limit(20);
      return data || [];
    },
    enabled: search.trim().length >= 2,
  });

  const { data: existingCodes = [] } = useQuery({
    queryKey: ["product-market-codes", selectedProduct?.id],
    queryFn: async () => {
      const { data } = await supabase.from("product_market_codes").select("*, market_code_types(code, label)").eq("product_id", selectedProduct.id);
      return data || [];
    },
    enabled: !!selectedProduct?.id,
  });

  // ─── File handling ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        setFileData(rows);
        toast.success(`${rows.length} lignes détectées`);
      } catch { toast.error("Erreur de lecture du fichier"); }
    };
    reader.readAsArrayBuffer(file);
  };

  // ─── Import with auto-create & auto-enrich ───
  const handleImport = async () => {
    if (!fileData || !selectedSourceId) { toast.error("Sélectionnez une source et un fichier"); return; }
    const source = sources.find((s: any) => s.id === selectedSourceId);
    if (!source) return;

    setImporting(true);
    setProgress(0);
    setImportResult(null);

    const BATCH = 500;
    let totalImported = 0, matched = 0, unmatched = 0, created = 0, enriched = 0;
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
            const keys = Object.keys(row);
            cnk = String(keys[0] ? row[keys[0]] : "").trim();
            ean = String(row["EANCode"] || row["eancode"] || row["EanCode"] || "").trim();
            productName = String(row["Product Name"] || row["product name"] || row["ProductName"] || keys[1] ? row[keys[1]] : "").trim();
            prixGrossiste = parseFloat(row["Prix de gros"] || row["prix de gros"]) || null;
            prixPublic = parseFloat(row["Prix public"] || row["prix public"]) || null;
            prixPharmacien = parseFloat(row["Prix pharmacie"] || row["prix pharmacie"]) || null;
            supplierCode = String(row["SupplierNbr"] || row["suppliernbr"] || "").trim();
            const status = String(row["ProductStatus"] || row["productstatus"] || "").trim();
            if (status === "CT") continue;
          } else if (format === "cerp_xlsx") {
            cnk = String(row["CNK"] || row["cnk"] || "").trim();
            productName = String(row["Libelle"] || row["libelle"] || row["Libellé"] || "").trim();
            supplierName = String(row["Fournisseur"] || row["fournisseur"] || "").trim();
            prixPharmacien = parseFloat(row["Px pharmacien"] || row["px pharmacien"] || row["Prix pharmacien"]) || null;
            tvaRate = parseFloat(row["TVA"] || row["tva"]) || null;
          } else {
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

          // ── Match product ──
          let productId: string | null = null;
          if (ean && ean.length >= 8) {
            const { data: byGtin } = await supabase.from("products").select("id").eq("gtin", ean).maybeSingle();
            productId = byGtin?.id || null;
          }
          if (!productId && cnk) {
            const { data: byCnk } = await supabase.from("products").select("id").eq("cnk_code", cnk).maybeSingle();
            productId = byCnk?.id || null;
          }
          if (!productId && cnk) {
            const { data: byMarketCode } = await supabase.from("product_market_codes").select("product_id").eq("code_value", cnk).maybeSingle();
            productId = byMarketCode?.product_id || null;
          }
          if (!productId && cnk) {
            const { data: crossMatch } = await supabase.from("market_prices").select("product_id").eq("cnk", cnk).not("product_id", "is", null).limit(1).maybeSingle();
            productId = crossMatch?.product_id || null;
          }

          // ── Auto-create unmatched product ──
          if (!productId && autoCreateProducts && productName) {
            const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + (cnk || ean || Date.now());
            const newProduct: any = {
              name: productName,
              slug,
              gtin: ean || null,
              cnk_code: cnk || null,
              is_active: false,
              is_published: false,
              source: "manual" as const,
            };
            const { data: inserted } = await supabase.from("products").insert(newProduct).select("id").maybeSingle();
            if (inserted) {
              productId = inserted.id;
              created++;
              // Also save CNK as market code
              if (cnk) {
                const cnkType = codeTypes.find((ct: any) => ct.code === "CNK");
                if (cnkType) {
                  await supabase.from("product_market_codes").upsert({
                    product_id: inserted.id,
                    market_code_type_id: cnkType.id,
                    code_value: cnk,
                    source: "import",
                    verified: false,
                  }, { onConflict: "product_id,market_code_type_id" });
                }
              }
            }
          }

          // ── Auto-enrich matched product ──
          if (productId && autoEnrich) {
            const updates: any = {};
            if (cnk) updates.cnk_code = cnk;
            if (Object.keys(updates).length > 0) {
              await supabase.from("products").update(updates).eq("id", productId);
              enriched++;
            }
            // Save CNK as market code
            if (cnk) {
              const cnkType = codeTypes.find((ct: any) => ct.code === "CNK");
              if (cnkType) {
                await supabase.from("product_market_codes").upsert({
                  product_id: productId,
                  market_code_type_id: cnkType.id,
                  code_value: cnk,
                  source: "import",
                  verified: false,
                }, { onConflict: "product_id,market_code_type_id" });
              }
            }
          }

          if (productId) matched++;
          else {
            unmatched++;
            if (unmatchedSamples.length < 20) unmatchedSamples.push({ cnk, name: productName });
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
          const deduped = new Map<string, any>();
          for (const r of rows) { deduped.set(r.cnk || r.ean || `${Math.random()}`, r); }
          const { error } = await supabase.from("market_prices").upsert(Array.from(deduped.values()), { onConflict: "source_id,cnk" });
          if (error) {
            for (const r of Array.from(deduped.values())) {
              await supabase.from("market_prices").upsert(r, { onConflict: "source_id,cnk" });
            }
          }
          totalImported += deduped.size;
        }

        setProgress(Math.round(((i + BATCH) / fileData.length) * 100));
        await new Promise(r => setTimeout(r, 50));
      }

      await supabase.from("market_price_sources").update({ last_import_at: new Date().toISOString(), total_products: totalImported }).eq("id", selectedSourceId);

      setImportResult({ total_imported: totalImported, matched, unmatched, created, enriched, unmatched_samples: unmatchedSamples });
      toast.success(`Import terminé : ${totalImported} lignes, ${matched} matchés, ${created} créés`);
      queryClient.invalidateQueries({ queryKey: ["admin-market-price-counts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-market-sources"] });
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

  // ─── Codes management ───
  const selectProduct = (p: any) => { setSelectedProduct(p); setSearch(""); setCodeValues({}); };

  const fillCodes = () => {
    const vals: Record<string, { value: string; verified: boolean }> = {};
    for (const ct of codeTypes) {
      const existing = existingCodes.find((e: any) => e.market_code_type_id === ct.id);
      vals[ct.id] = { value: existing?.code_value || "", verified: existing?.verified || false };
    }
    return vals;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts = Object.entries(codeValues).filter(([, v]) => v.value.trim()).map(([typeId, v]) => ({
        product_id: selectedProduct.id, market_code_type_id: typeId, code_value: v.value.trim(), verified: v.verified, source: "manual", updated_at: new Date().toISOString(),
      }));
      if (upserts.length === 0) return;
      const { error } = await supabase.from("product_market_codes").upsert(upserts, { onConflict: "product_id,market_code_type_id" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["product-market-codes", selectedProduct?.id] }); toast.success("Codes sauvegardés !"); },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const currentCodes = selectedProduct ? fillCodes() : {};
  if (selectedProduct && Object.keys(codeValues).length === 0 && existingCodes !== undefined) {
    setTimeout(() => setCodeValues(currentCodes), 0);
  }

  return (
    <div>
      <AdminTopBar title="Prix & Codes marché" subtitle="Import de prix (Febelco, CERP, etc.), gestion des codes produits (CNK, PZN, CIP)" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="import" className="text-xs gap-1.5"><FileSpreadsheet size={14} /> Import prix</TabsTrigger>
          <TabsTrigger value="codes" className="text-xs gap-1.5"><Hash size={14} /> Codes marché</TabsTrigger>
          <TabsTrigger value="types" className="text-xs gap-1.5">Types de codes</TabsTrigger>
        </TabsList>

        {/* ── Tab: Import ── */}
        <TabsContent value="import" className="space-y-6">
          {/* Sources overview */}
          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Source</TableHead>
                  <TableHead className="text-[11px]">Type</TableHead>
                  <TableHead className="text-[11px]">Format</TableHead>
                  <TableHead className="text-[11px] text-center">Produits</TableHead>
                  <TableHead className="text-[11px] text-center">Matchés</TableHead>
                  <TableHead className="text-[11px]">Dernier import</TableHead>
                  <TableHead className="text-[11px] text-center">Statut</TableHead>
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
                        <Badge variant={src.is_active ? "default" : "secondary"} className="text-[10px]">{src.is_active ? "Actif" : "Inactif"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Import form */}
          <div className="bg-white rounded-lg border border-border p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet size={18} className="text-primary" />
              <h3 className="text-[15px] font-bold">Importer un fichier de prix</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[12px] text-muted-foreground block mb-1.5">Source</label>
                <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                  <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Sélectionner la source" /></SelectTrigger>
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

            {/* Options */}
            <div className="flex gap-6 pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <Switch checked={autoCreateProducts} onCheckedChange={setAutoCreateProducts} />
                <PlusCircle size={14} className="text-primary" />
                <span>Créer automatiquement les produits non matchés (inactifs)</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <Switch checked={autoEnrich} onCheckedChange={setAutoEnrich} />
                <CheckCircle2 size={14} className="text-green-600" />
                <span>Enrichir les fiches produits matchés (CNK, etc.)</span>
              </label>
            </div>

            {/* Preview */}
            {fileData && (
              <div className="text-[12px] text-muted-foreground">
                <Database size={12} className="inline mr-1" />
                <strong>{fileData.length}</strong> lignes dans <strong>{fileName}</strong>
                {fileData.length > 0 && <span className="ml-2">— Colonnes : {Object.keys(fileData[0]).slice(0, 8).join(", ")}{Object.keys(fileData[0]).length > 8 ? "…" : ""}</span>}
              </div>
            )}

            {importing && (
              <div>
                <Progress value={progress} className="h-2" />
                <p className="text-[11px] text-muted-foreground mt-1">{progress}% — Traitement en cours…</p>
              </div>
            )}

            {importResult && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-6 text-sm flex-wrap">
                  <span className="flex items-center gap-1.5"><Database size={14} className="text-primary" /> <strong>{importResult.total_imported}</strong> importées</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> <strong>{importResult.matched}</strong> matchés</span>
                  <span className="flex items-center gap-1.5"><PlusCircle size={14} className="text-blue-600" /> <strong>{importResult.created}</strong> produits créés</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-600" /> <strong>{importResult.enriched}</strong> enrichis</span>
                  <span className="flex items-center gap-1.5"><XCircle size={14} className="text-amber-500" /> <strong>{importResult.unmatched}</strong> non matchés</span>
                </div>
                {importResult.unmatched_samples.length > 0 && (
                  <>
                    <p className="text-[12px] text-muted-foreground font-medium">Exemples non matchés :</p>
                    <div className="max-h-40 overflow-auto text-[12px] space-y-1">
                      {importResult.unmatched_samples.map((s, i) => (
                        <div key={i} className="flex gap-3 text-muted-foreground">
                          <span className="font-mono">{s.cnk}</span><span>{s.name}</span>
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
        </TabsContent>

        {/* ── Tab: Codes marché ── */}
        <TabsContent value="codes" className="space-y-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher un produit (nom, GTIN, marque)..." value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedProduct(null); setCodeValues({}); }} className="pl-10" />
            {searchResults.length > 0 && search.trim() && !selectedProduct && (
              <div className="absolute z-50 top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-80 overflow-y-auto">
                {searchResults.map((p: any) => (
                  <button key={p.id} onClick={() => selectProduct(p)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 text-left border-b border-border last:border-b-0">
                    {p.image_urls?.[0] ? <img src={p.image_urls[0]} alt="" className="w-10 h-10 object-contain rounded" /> :
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center"><Package size={16} className="text-muted-foreground" /></div>}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.gtin} · {p.brand_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedProduct && (
            <div className="border border-border rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-4">
                {selectedProduct.image_urls?.[0] ? <img src={selectedProduct.image_urls[0]} alt="" className="w-16 h-16 object-contain rounded border border-border" /> :
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center"><Package size={24} className="text-muted-foreground" /></div>}
                <div>
                  <h3 className="font-bold text-foreground">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">GTIN: {selectedProduct.gtin} · {selectedProduct.brand_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {codeTypes.map((ct: any) => {
                  const val = codeValues[ct.id] || { value: "", verified: false };
                  return (
                    <div key={ct.id} className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <span>{FLAG_MAP[ct.country_code] || "🏳️"}</span> {ct.label} ({ct.country_name})
                      </label>
                      <div className="flex items-center gap-2">
                        <Input placeholder={ct.description || ct.code} value={val.value}
                          onChange={(e) => setCodeValues(prev => ({ ...prev, [ct.id]: { ...val, value: e.target.value } }))} />
                        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                          <Checkbox checked={val.verified}
                            onCheckedChange={(checked) => setCodeValues(prev => ({ ...prev, [ct.id]: { ...val, verified: !!checked } }))} />
                          Vérifié
                        </label>
                      </div>
                      {ct.validation_regex && val.value && !new RegExp(ct.validation_regex).test(val.value) && (
                        <p className="text-xs text-destructive">Format invalide</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Sauvegarder les codes</Button>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Types de codes ── */}
        <TabsContent value="types">
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Code</TableHead>
                  <TableHead className="text-[11px]">Label</TableHead>
                  <TableHead className="text-[11px]">Pays</TableHead>
                  <TableHead className="text-[11px]">Regex</TableHead>
                  <TableHead className="text-[11px]">Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codeTypes.map((ct: any) => (
                  <TableRow key={ct.id}>
                    <TableCell className="font-mono text-xs">{ct.code}</TableCell>
                    <TableCell className="text-[13px]">{ct.label}</TableCell>
                    <TableCell className="text-[13px]">{FLAG_MAP[ct.country_code] || ""} {ct.country_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ct.validation_regex || "—"}</TableCell>
                    <TableCell>{ct.is_active ? <Check size={16} className="text-green-600" /> : <X size={16} className="text-muted-foreground" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
