import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Upload, Check, X, Package, FileSpreadsheet, AlertTriangle, Download } from "lucide-react";
import * as XLSX from "xlsx";

const FLAG_MAP: Record<string, string> = {
  BE: "🇧🇪", DE: "🇩🇪", FR: "🇫🇷", NL: "🇳🇱", IT: "🇮🇹", ES: "🇪🇸",
};

const FEBELCO_SOURCE_ID = "afba1bff-5f01-47f8-975c-51aee216e183";
const CERP_SOURCE_ID = "9bbc2498-0480-4586-a038-1496db8bdb95";

type ImportPreview = {
  rows: Record<string, any>[];
  source: "febelco" | "cerp";
  fileName: string;
};

export default function AdminMarketCodes() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("import");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [codeValues, setCodeValues] = useState<Record<string, { value: string; verified: boolean }>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; matched: number; unmatched: number } | null>(null);

  // Fetch code types
  const { data: codeTypes = [] } = useQuery({
    queryKey: ["market-code-types"],
    queryFn: async () => {
      const { data } = await supabase.from("market_code_types").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  // Search products
  const { data: searchResults = [] } = useQuery({
    queryKey: ["admin-market-search", search],
    queryFn: async () => {
      if (!search.trim() || search.trim().length < 2) return [];
      const { data } = await supabase
        .from("products")
        .select("id, name, gtin, brand_name, image_urls")
        .or(`name.ilike.%${search.trim()}%,gtin.ilike.%${search.trim()}%,brand_name.ilike.%${search.trim()}%`)
        .eq("is_active", true)
        .limit(20);
      return data || [];
    },
    enabled: search.trim().length >= 2,
  });

  // Fetch existing codes for selected product
  const { data: existingCodes = [] } = useQuery({
    queryKey: ["product-market-codes", selectedProduct?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_market_codes")
        .select("*, market_code_types(code, label)")
        .eq("product_id", selectedProduct.id);
      return data || [];
    },
    enabled: !!selectedProduct?.id,
  });

  // Import history
  const { data: importHistory = [] } = useQuery({
    queryKey: ["market-import-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_price_sources")
        .select("id, name, slug, last_import_at, total_products")
        .in("slug", ["febelco", "cerp"])
        .order("name");
      return data || [];
    },
  });

  const selectProduct = (p: any) => {
    setSelectedProduct(p);
    setSearch("");
  };

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
      const upserts = Object.entries(codeValues)
        .filter(([, v]) => v.value.trim())
        .map(([typeId, v]) => ({
          product_id: selectedProduct.id,
          market_code_type_id: typeId,
          code_value: v.value.trim(),
          verified: v.verified,
          source: "manual",
          updated_at: new Date().toISOString(),
        }));
      if (upserts.length === 0) return;
      const { error } = await supabase.from("product_market_codes").upsert(upserts, { onConflict: "product_id,market_code_type_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-market-codes", selectedProduct?.id] });
      toast.success("Codes sauvegardés !");
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  // Parse Febelco XLSX
  const handleFebelcoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]]);
    setPreview({ rows, source: "febelco", fileName: file.name });
    setImportResult(null);
    e.target.value = "";
  };

  // Parse CERP XLSX
  const handleCerpFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]]);
    setPreview({ rows, source: "cerp", fileName: file.name });
    setImportResult(null);
    e.target.value = "";
  };

  // Import market prices
  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    let imported = 0, matched = 0, unmatched = 0;
    const sourceId = preview.source === "febelco" ? FEBELCO_SOURCE_ID : CERP_SOURCE_ID;
    const batchSize = 50;

    for (let i = 0; i < preview.rows.length; i += batchSize) {
      const batch = preview.rows.slice(i, i + batchSize);
      const upserts: any[] = [];

      for (const row of batch) {
        let cnk: string | null = null;
        let ean: string | null = null;
        let productName: string | null = null;
        let prixGrossiste: number | null = null;
        let prixPublic: number | null = null;
        let prixPharmacien: number | null = null;
        let tvaRate: number | null = null;
        let supplierName: string | null = null;

        if (preview.source === "febelco") {
          // Febelco mapping
          const keys = Object.keys(row);
          cnk = row[keys[0]]?.toString().trim() || null; // col 1 = CNK
          productName = row[keys[1]]?.toString().trim() || null; // col 2 = name
          prixGrossiste = parseFloat(row["Prix de gros"]) || parseFloat(row["prix de gros"]) || null;
          prixPublic = parseFloat(row["Prix public"]) || parseFloat(row["prix public"]) || null;
          prixPharmacien = parseFloat(row["Prix pharmacie"]) || parseFloat(row["prix pharmacie"]) || null;
          ean = row["EANCode"]?.toString().trim() || row["eancode"]?.toString().trim() || row["EAN"]?.toString().trim() || null;
        } else {
          // CERP mapping
          cnk = (row["CNK"] || row["cnk"])?.toString().trim() || null;
          productName = (row["Libelle"] || row["libelle"] || row["Libellé"])?.toString().trim() || null;
          supplierName = (row["Fournisseur"] || row["fournisseur"])?.toString().trim() || null;
          prixPharmacien = parseFloat(row["Px pharmacien"] || row["px pharmacien"]) || null;
          const tvaVal = row["TVA"] || row["tva"];
          tvaRate = tvaVal ? parseFloat(tvaVal) : null;
          // Normalize TVA (if >1, it's a percentage like 6 or 21)
          if (tvaRate && tvaRate > 1) tvaRate = tvaRate / 100;
        }

        if (!cnk && !ean) continue;

        // Try matching product
        let productId: string | null = null;
        if (ean) {
          const { data: products } = await supabase.from("products").select("id").eq("gtin", ean).limit(1);
          if (products?.length) productId = products[0].id;
        }
        if (!productId && cnk) {
          // Try matching by CNK via product_market_codes or products.cnk_code
          const { data: products } = await supabase.from("products").select("id").eq("cnk_code", cnk).limit(1);
          if (products?.length) productId = products[0].id;
        }

        upserts.push({
          source_id: sourceId,
          cnk: cnk,
          ean: ean,
          product_name_source: productName,
          prix_grossiste: prixGrossiste,
          prix_public: prixPublic,
          prix_pharmacien: prixPharmacien,
          tva_rate: tvaRate,
          supplier_name: supplierName,
          product_id: productId,
          is_matched: !!productId,
          imported_at: new Date().toISOString(),
        });

        if (productId) matched++;
        else unmatched++;
        imported++;
      }

      if (upserts.length > 0) {
        await supabase.from("market_prices").insert(upserts);
      }
    }

    // Update source last_import_at
    await supabase.from("market_price_sources").update({
      last_import_at: new Date().toISOString(),
      total_products: imported,
    }).eq("id", sourceId);

    setImporting(false);
    setImportResult({ imported, matched, unmatched });
    setPreview(null);
    queryClient.invalidateQueries({ queryKey: ["market-import-history"] });
    toast.success(`Import terminé : ${imported} lignes, ${matched} matchés`);
  };

  // Initialize codes
  const currentCodes = selectedProduct ? fillCodes() : {};
  if (selectedProduct && Object.keys(codeValues).length === 0 && existingCodes !== undefined) {
    setTimeout(() => setCodeValues(currentCodes), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Codes marché & Import prix</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="import" className="text-xs gap-1.5"><FileSpreadsheet size={14} /> Import Febelco / CERP</TabsTrigger>
          <TabsTrigger value="codes" className="text-xs gap-1.5"><Search size={14} /> Codes marché</TabsTrigger>
          <TabsTrigger value="types" className="text-xs gap-1.5">Types de codes</TabsTrigger>
        </TabsList>

        {/* ── Tab: Import ── */}
        <TabsContent value="import" className="space-y-6">
          {/* Import result banner */}
          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-emerald-800">✅ Import terminé</p>
              <p className="text-emerald-700 mt-1">
                {importResult.imported} lignes importées · {importResult.matched} matchées · {importResult.unmatched} non matchées
              </p>
            </div>
          )}

          {/* Febelco */}
          <div className="border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">🇧🇪 Import Febelco</h2>
                <p className="text-xs text-muted-foreground mt-1">Format attendu : CNK (col 1), Nom (col 2), Prix de gros, Prix public, Prix pharmacie, EANCode</p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:opacity-90">
                <Upload size={16} /> Charger XLSX
                <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFebelcoFile} />
              </label>
            </div>
            {importHistory.find((s: any) => s.slug === "febelco") && (
              <p className="text-xs text-muted-foreground">
                Dernier import : {importHistory.find((s: any) => s.slug === "febelco")?.last_import_at
                  ? new Date(importHistory.find((s: any) => s.slug === "febelco")!.last_import_at!).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "Jamais"} · {importHistory.find((s: any) => s.slug === "febelco")?.total_products || 0} produits
              </p>
            )}
          </div>

          {/* CERP */}
          <div className="border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">🇧🇪 Import CERP</h2>
                <p className="text-xs text-muted-foreground mt-1">Format attendu : CNK, Libelle, Fournisseur, Px pharmacien, TVA</p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:opacity-90">
                <Upload size={16} /> Charger XLSX
                <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleCerpFile} />
              </label>
            </div>
            {importHistory.find((s: any) => s.slug === "cerp") && (
              <p className="text-xs text-muted-foreground">
                Dernier import : {importHistory.find((s: any) => s.slug === "cerp")?.last_import_at
                  ? new Date(importHistory.find((s: any) => s.slug === "cerp")!.last_import_at!).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "Jamais"} · {importHistory.find((s: any) => s.slug === "cerp")?.total_products || 0} produits
              </p>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground">Aperçu — {preview.fileName}</h3>
                  <p className="text-xs text-muted-foreground">{preview.rows.length} lignes détectées · Source : {preview.source.toUpperCase()}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreview(null)}>Annuler</Button>
                  <Button size="sm" onClick={handleImport} disabled={importing}>
                    {importing ? "Import en cours..." : `Importer ${preview.rows.length} lignes`}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {Object.keys(preview.rows[0] || {}).slice(0, 8).map((key) => (
                        <th key={key} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {Object.keys(preview.rows[0] || {}).slice(0, 8).map((key) => (
                          <td key={key} className="px-3 py-2 whitespace-nowrap">{row[key]?.toString()?.substring(0, 40) || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 10 && (
                  <p className="text-xs text-muted-foreground p-3">… et {preview.rows.length - 10} lignes supplémentaires</p>
                )}
              </div>
            </div>
          )}

          {/* Import History */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">Historique des sources</h2>
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Source</TableHead>
                    <TableHead className="text-[11px]">Dernier import</TableHead>
                    <TableHead className="text-[11px] text-right">Produits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-[13px]">{s.name}</TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">
                        {s.last_import_at
                          ? new Date(s.last_import_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-[12px]">{s.total_products || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Codes marché ── */}
        <TabsContent value="codes" className="space-y-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit (nom, GTIN, marque)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedProduct(null); setCodeValues({}); }}
              className="pl-10"
            />
            {searchResults.length > 0 && search.trim() && !selectedProduct && (
              <div className="absolute z-50 top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-80 overflow-y-auto">
                {searchResults.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 text-left border-b border-border last:border-b-0"
                  >
                    {p.image_urls?.[0] ? (
                      <img src={p.image_urls[0]} alt="" className="w-10 h-10 object-contain rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center"><Package size={16} className="text-muted-foreground" /></div>
                    )}
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
                {selectedProduct.image_urls?.[0] ? (
                  <img src={selectedProduct.image_urls[0]} alt="" className="w-16 h-16 object-contain rounded border border-border" />
                ) : (
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center"><Package size={24} className="text-muted-foreground" /></div>
                )}
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
                        <span>{FLAG_MAP[ct.country_code] || "🏳️"}</span>
                        {ct.label} ({ct.country_name})
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder={ct.description || ct.code}
                          value={val.value}
                          onChange={(e) => setCodeValues(prev => ({ ...prev, [ct.id]: { ...val, value: e.target.value } }))}
                        />
                        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                          <Checkbox
                            checked={val.verified}
                            onCheckedChange={(checked) => setCodeValues(prev => ({ ...prev, [ct.id]: { ...val, verified: !!checked } }))}
                          />
                          Vérifié
                        </label>
                      </div>
                      {ct.validation_regex && val.value && !new RegExp(ct.validation_regex).test(val.value) && (
                        <p className="text-xs text-destructive">Format invalide (attendu: {ct.validation_regex})</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Sauvegarder les codes
              </Button>
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
