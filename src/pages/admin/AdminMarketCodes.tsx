import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Check, X, Package, Hash } from "lucide-react";

const FLAG_MAP: Record<string, string> = {
  BE: "🇧🇪", DE: "🇩🇪", FR: "🇫🇷", NL: "🇳🇱", IT: "🇮🇹", ES: "🇪🇸",
};

export default function AdminMarketCodes() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("codes");

  // Codes state
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [codeValues, setCodeValues] = useState<Record<string, { value: string; verified: boolean }>>({});

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
      <AdminTopBar title="Codes marché" subtitle="Gestion des codes produits par pays (CNK, PZN, CIP, etc.)" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="codes" className="text-xs gap-1.5"><Hash size={14} /> Codes marché</TabsTrigger>
          <TabsTrigger value="types" className="text-xs gap-1.5">Types de codes</TabsTrigger>
        </TabsList>

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
