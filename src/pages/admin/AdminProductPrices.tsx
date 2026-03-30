import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Search, Save, Upload, Loader2, Package, ImageOff, X, Check } from "lucide-react";
import { applyMargin } from "@/lib/pricing";

export default function AdminProductPrices() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Fetch price levels
  const { data: levels = [] } = useQuery({
    queryKey: ["price-levels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_levels")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data || [];
    },
  });

  // Search products
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["admin-price-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data } = await supabase
        .from("products")
        .select("id, name, gtin, brand_name, image_urls, best_price_excl_vat")
        .or(`name.ilike.%${search}%,gtin.ilike.%${search}%,brand_name.ilike.%${search}%`)
        .eq("is_active", true)
        .limit(10);
      return data || [];
    },
    enabled: search.length >= 2,
  });

  // Load existing prices for selected product
  const { data: existingPrices } = useQuery({
    queryKey: ["product-prices-edit", selectedProduct?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_prices")
        .select("price, price_level_id")
        .eq("product_id", selectedProduct!.id);
      return data || [];
    },
    enabled: !!selectedProduct?.id,
  });

  // Initialize prices when product is selected
  useMemo(() => {
    if (!selectedProduct || !levels.length) return;
    const map: Record<string, string> = {};
    for (const lvl of levels) {
      const ep = existingPrices?.find((p: any) => p.price_level_id === lvl.id);
      if (ep) {
        map[lvl.code] = String(ep.price);
      } else if (lvl.code === "medikong" && selectedProduct.best_price_excl_vat) {
        map[lvl.code] = String(applyMargin(selectedProduct.best_price_excl_vat).toFixed(2));
      } else {
        map[lvl.code] = "";
      }
    }
    setPrices(map);
  }, [selectedProduct?.id, existingPrices, levels]);

  const handleSave = async () => {
    if (!selectedProduct || !user) return;
    setSaving(true);
    try {
      const upserts = levels
        .filter((lvl: any) => {
          const val = parseFloat(prices[lvl.code]?.replace(",", ".") || "0");
          return val > 0;
        })
        .map((lvl: any) => ({
          product_id: selectedProduct.id,
          price_level_id: lvl.id,
          price: parseFloat(prices[lvl.code].replace(",", ".")),
          source: "manual",
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        }));

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("product_prices")
          .upsert(upserts, { onConflict: "product_id,price_level_id" });
        if (error) throw error;
      }
      toast.success(`${upserts.length} prix sauvegardés`);
      queryClient.invalidateQueries({ queryKey: ["product-prices-edit", selectedProduct.id] });
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // CSV Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      const dataLines = lines.slice(1);
      let updated = 0, notFound = 0;

      for (const line of dataLines) {
        const parts = line.split(/[;,]/).map(s => s.replace(/"/g, "").trim());
        const gtin = parts[0];
        const pPublic = parseFloat(parts[1]?.replace(",", ".") || "0");
        const pPharma = parseFloat(parts[2]?.replace(",", ".") || "0");
        const pGrossiste = parseFloat(parts[3]?.replace(",", ".") || "0");
        const pHopital = parseFloat(parts[4]?.replace(",", ".") || "0");
        if (!gtin) continue;

        const { data: product } = await supabase
          .from("products")
          .select("id")
          .eq("gtin", gtin)
          .maybeSingle();

        if (!product) { notFound++; continue; }

        const entries: { code: string; price: number }[] = [
          { code: "public", price: pPublic },
          { code: "pharmacien", price: pPharma },
          { code: "grossiste", price: pGrossiste },
          { code: "hopital", price: pHopital },
        ].filter(e => e.price > 0);

        for (const entry of entries) {
          const lvl = levels.find((l: any) => l.code === entry.code);
          if (!lvl) continue;
          await supabase.from("product_prices").upsert({
            product_id: product.id,
            price_level_id: lvl.id,
            price: entry.price,
            source: "csv_import",
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: "product_id,price_level_id" });
        }
        updated++;
      }

      toast.success(`${updated} produits mis à jour${notFound > 0 ? `, ${notFound} GTIN non trouvés` : ""}`);
    } catch {
      toast.error("Erreur lors de l'import");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: "#1D2530" }}>Prix multi-niveaux</h1>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>Encodez des prix différenciés par type de client</p>
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Importer CSV
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Rechercher un produit</h3>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom, GTIN ou marque..."
              className="pl-9 text-[13px]"
            />
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {searching && <div className="text-[12px] py-3 text-center" style={{ color: "#8B95A5" }}>Recherche...</div>}
            {searchResults.map((p: any) => (
              <button
                key={p.id}
                onClick={() => { setSelectedProduct(p); setSearch(""); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-[#F8FAFC]"
                style={{ border: selectedProduct?.id === p.id ? "1px solid #1B5BDA" : "1px solid transparent" }}
              >
                <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center shrink-0" style={{ backgroundColor: "#F1F5F9" }}>
                  {p.image_urls?.[0] ? (
                    <img src={p.image_urls[0]} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <ImageOff size={14} className="text-[#8B95A5]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "#1D2530" }}>{p.name}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>{p.gtin || "—"} · {p.brand_name || "—"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Price form */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          {!selectedProduct ? (
            <div className="text-center py-12">
              <Package size={32} className="mx-auto mb-3" style={{ color: "#CBD5E1" }} />
              <p className="text-[13px]" style={{ color: "#8B95A5" }}>Sélectionnez un produit pour encoder ses prix</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0" }}>
                  {selectedProduct.image_urls?.[0] ? (
                    <img src={selectedProduct.image_urls[0]} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <ImageOff size={16} className="text-[#8B95A5]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold truncate" style={{ color: "#1D2530" }}>{selectedProduct.name}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>GTIN {selectedProduct.gtin || "—"}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="p-1 hover:bg-[#F1F5F9] rounded-md">
                  <X size={14} style={{ color: "#8B95A5" }} />
                </button>
              </div>

              <div className="space-y-3">
                {levels.map((lvl: any) => (
                  <div key={lvl.id}>
                    <label className="text-[12px] font-medium mb-1 block" style={{ color: "#616B7C" }}>{lvl.label_fr}</label>
                    <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
                      <input
                        type="text"
                        value={prices[lvl.code] || ""}
                        onChange={e => setPrices(prev => ({ ...prev, [lvl.code]: e.target.value }))}
                        placeholder="0.00"
                        className="flex-1 px-3 py-2.5 text-[13px] bg-white outline-none"
                      />
                      <span className="px-3 text-[11px] font-medium" style={{ color: "#8B95A5" }}>EUR</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#1B5BDA" }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Sauvegarde..." : "Sauvegarder les prix"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 text-[11px]" style={{ color: "#8B95A5" }}>
        Format CSV attendu : <code className="bg-[#F1F5F9] px-1.5 py-0.5 rounded text-[#1D2530]">GTIN;prix_public;prix_pharmacien;prix_grossiste;prix_hopital</code>
      </div>
    </div>
  );
}
