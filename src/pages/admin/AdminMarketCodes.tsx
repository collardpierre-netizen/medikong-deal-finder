import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Upload, Plus, Check, X, Package, Flag } from "lucide-react";
import * as XLSX from "xlsx";

const FLAG_MAP: Record<string, string> = {
  BE: "🇧🇪", DE: "🇩🇪", FR: "🇫🇷", NL: "🇳🇱", IT: "🇮🇹", ES: "🇪🇸",
};

export default function AdminMarketCodes() {
  const { role } = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [codeValues, setCodeValues] = useState<Record<string, { value: string; verified: boolean }>>({});
  const [importResult, setImportResult] = useState<string | null>(null);

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

  const selectProduct = (p: any) => {
    setSelectedProduct(p);
    setSearch("");
  };

  // Pre-fill code values when existing codes load
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

  // CSV Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);

    let imported = 0, notFound = 0;
    const codeTypeMap = Object.fromEntries(codeTypes.map((ct: any) => [ct.code, ct.id]));

    for (const row of rows) {
      const gtin = row.GTIN || row.gtin || row.EAN || row.ean;
      if (!gtin) continue;
      const { data: products } = await supabase.from("products").select("id").eq("gtin", gtin.toString().trim()).limit(1);
      if (!products?.length) { notFound++; continue; }
      const productId = products[0].id;
      const upserts: any[] = [];
      for (const [code, typeId] of Object.entries(codeTypeMap)) {
        const val = row[code] || row[code.toUpperCase()];
        if (val && val.toString().trim()) {
          upserts.push({
            product_id: productId,
            market_code_type_id: typeId,
            code_value: val.toString().trim(),
            source: "csv_import",
            updated_at: new Date().toISOString(),
          });
        }
      }
      if (upserts.length > 0) {
        await supabase.from("product_market_codes").upsert(upserts, { onConflict: "product_id,market_code_type_id" });
        imported += upserts.length;
      }
    }
    setImportResult(`${imported} codes importés, ${notFound} GTIN non trouvés`);
    toast.success(`Import terminé : ${imported} codes`);
    e.target.value = "";
  };

  // Initialize codes when product or existing codes change
  const currentCodes = selectedProduct ? fillCodes() : {};
  if (selectedProduct && Object.keys(codeValues).length === 0 && existingCodes !== undefined) {
    setTimeout(() => setCodeValues(currentCodes), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Codes marché</h1>
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:opacity-90">
          <Upload size={16} /> Importer CSV
          <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} />
        </label>
      </div>

      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">{importResult}</div>
      )}

      {/* Search */}
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

      {/* Product form */}
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

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
          >
            Sauvegarder les codes
          </button>
        </div>
      )}

      {/* Code types management */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">Types de codes configurés</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Label</th>
                <th className="text-left px-4 py-3 font-semibold">Pays</th>
                <th className="text-left px-4 py-3 font-semibold">Regex</th>
                <th className="text-left px-4 py-3 font-semibold">Actif</th>
              </tr>
            </thead>
            <tbody>
              {codeTypes.map((ct: any) => (
                <tr key={ct.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{ct.code}</td>
                  <td className="px-4 py-3">{ct.label}</td>
                  <td className="px-4 py-3">{FLAG_MAP[ct.country_code] || ""} {ct.country_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ct.validation_regex || "—"}</td>
                  <td className="px-4 py-3">{ct.is_active ? <Check size={16} className="text-green-600" /> : <X size={16} className="text-muted-foreground" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
