import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Tag, Plus, Pencil, Trash2, X, Loader2, Package, Search, Download, Upload, FileSpreadsheet, ChevronDown, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import * as XLSX from "xlsx";

const PROFILE_TYPES = [
  { value: "pharmacy", label: "Pharmacie" },
  { value: "hospital", label: "Hôpital" },
  { value: "dentist", label: "Dentiste" },
  { value: "nursing", label: "Infirmier" },
  { value: "veterinary", label: "Vétérinaire" },
  { value: "ehpad", label: "EHPAD/MRS" },
  { value: "wholesale", label: "Grossiste" },
];

const COUNTRIES = [
  { value: "BE", label: "Belgique" },
  { value: "FR", label: "France" },
  { value: "NL", label: "Pays-Bas" },
  { value: "LU", label: "Luxembourg" },
  { value: "DE", label: "Allemagne" },
];

/* ─── Product search hook (server-side, paginated) ─── */
const useProductSearch = (searchTerm: string, brandFilter: string, categoryFilter: string) =>
  useQuery({
    queryKey: ["product-search", searchTerm, brandFilter, categoryFilter],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name, gtin, slug, brand_name, category_name, image_urls")
        .eq("is_active", true)
        .order("name")
        .limit(50);
      if (searchTerm.length >= 2) {
        q = q.or(`name.ilike.%${searchTerm}%,gtin.ilike.%${searchTerm}%,cnk_code.ilike.%${searchTerm}%`);
      }
      if (brandFilter) q = q.ilike("brand_name", `%${brandFilter}%`);
      if (categoryFilter) q = q.ilike("category_name", `%${categoryFilter}%`);
      const { data } = await q;
      return data || [];
    },
    enabled: searchTerm.length >= 2 || !!brandFilter || !!categoryFilter,
  });

/* ─── Filters data ─── */
const useFilterOptions = () =>
  useQuery({
    queryKey: ["offer-filter-options"],
    queryFn: async () => {
      const [{ data: brands }, { data: cats }] = await Promise.all([
        supabase.from("brands").select("name").eq("is_active", true).order("name").limit(200),
        supabase.from("categories").select("name").eq("is_active", true).is("parent_id", null).order("name").limit(100),
      ]);
      return { brands: (brands || []).map((b: any) => b.name), categories: (cats || []).map((c: any) => c.name) };
    },
  });

const useVendorOffers = (vendorId: string | undefined) =>
  useQuery({
    queryKey: ["vendor-offers", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data, error } = await supabase
        .from("offers")
        .select("*, products(name, gtin, image_urls, slug, brand_name, category_name, cnk_code)")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

interface OfferForm {
  product_id: string;
  product_name: string;
  price_excl_vat: string;
  vat_rate: string;
  stock_quantity: string;
  moq: string;
  delivery_days: string;
  country_code: string;
}

const emptyForm: OfferForm = {
  product_id: "", product_name: "", price_excl_vat: "", vat_rate: "21", stock_quantity: "", moq: "1", delivery_days: "3", country_code: "BE",
};

/* ─── Searchable Select for filters ─── */
function SearchableSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    if (!q) return options;
    const lower = q.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(lower));
  }, [options, q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="flex-1 relative">
      <button type="button" onClick={() => { setOpen(!open); setQ(""); }}
        className="w-full flex items-center justify-between text-[11px] px-2 py-1 rounded border border-[#E2E8F0] bg-white text-[#616B7C] text-left">
        <span className={value ? "text-[#1D2530] truncate" : "text-[#8B95A5] truncate"}>{value || placeholder}</span>
        {value ? (
          <X size={10} className="shrink-0 ml-1 hover:text-[#EF4343]" onClick={e => { e.stopPropagation(); onChange(""); }} />
        ) : (
          <ChevronDown size={10} className="shrink-0 ml-1" />
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-0.5 w-full bg-white rounded-lg shadow-lg border border-[#E2E8F0] max-h-[200px] flex flex-col">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
            className="px-2 py-1.5 text-[11px] border-b border-[#E2E8F0] focus:outline-none" />
          <div className="overflow-auto flex-1">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full text-left px-2 py-1 text-[11px] hover:bg-[#F8FAFC] ${!value ? "font-medium text-[#1B5BDA]" : "text-[#8B95A5]"}`}>
              {placeholder}
            </button>
            {filtered.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-2 py-1 text-[11px] hover:bg-[#F8FAFC] truncate ${value === o ? "font-medium text-[#1B5BDA]" : "text-[#616B7C]"}`}>
                {o}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-[10px] text-[#8B95A5] p-2 text-center">Aucun résultat</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Product Picker Component ─── */
function ProductPicker({ value, productName, onChange }: { value: string; productName: string; onChange: (id: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: results = [], isLoading } = useProductSearch(search, brandFilter, categoryFilter);
  const { data: filterOpts } = useFilterOptions();

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-[13px] border rounded-lg bg-white text-left"
        style={{ borderColor: open ? "#1B5BDA" : "#E2E8F0" }}>
        <span className={value ? "text-[#1D2530]" : "text-[#8B95A5]"}>
          {value ? productName : "Rechercher un produit (nom, EAN, CNK)…"}
        </span>
        <ChevronDown size={14} className="text-[#8B95A5]" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-[#E2E8F0] max-h-[420px] flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-[#E2E8F0]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tapez un nom, EAN ou CNK…"
                className="w-full pl-8 pr-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none" />
            </div>
          </div>

          {/* Searchable Filters */}
          <div className="px-2 py-1.5 border-b border-[#E2E8F0] flex gap-2">
            <SearchableSelect
              value={brandFilter}
              onChange={setBrandFilter}
              options={filterOpts?.brands || []}
              placeholder="Toutes marques"
            />
            <SearchableSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={filterOpts?.categories || []}
              placeholder="Toutes catégories"
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto">
            {search.length < 2 && !brandFilter && !categoryFilter ? (
              <p className="text-[12px] text-[#8B95A5] p-4 text-center">Tapez au moins 2 caractères pour rechercher</p>
            ) : isLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[#1B5BDA]" /></div>
            ) : results.length === 0 ? (
              <p className="text-[12px] text-[#8B95A5] p-4 text-center">Aucun produit trouvé</p>
            ) : (
              results.map((p: any) => (
                <button key={p.id} type="button"
                  onClick={() => { onChange(p.id, p.name); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0">
                  {p.image_urls?.[0] ? (
                    <img src={p.image_urls[0]} alt="" className="w-8 h-8 rounded object-contain bg-[#F8FAFC] shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-[#F1F5F9] flex items-center justify-center shrink-0"><Package size={12} className="text-[#CBD5E1]" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#1D2530] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#8B95A5] truncate">
                      {p.brand_name && <span className="mr-2">{p.brand_name}</span>}
                      {p.gtin && <span className="mr-2">EAN: {p.gtin}</span>}
                      {p.category_name && <span>{p.category_name}</span>}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Import/Export ─── */
function useOfferImport(vendorId: string | undefined) {
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);

  const importFile = async (file: File) => {
    if (!vendorId) return;
    setImporting(true);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (rows.length === 0) throw new Error("Fichier vide");

      // Match products by EAN/CNK
      const gtins = rows.map(r => String(r["EAN"] || r["ean"] || r["GTIN"] || r["gtin"] || "")).filter(Boolean);
      const cnks = rows.map(r => String(r["CNK"] || r["cnk"] || "")).filter(Boolean);

      const allIds: Record<string, string> = {};

      if (gtins.length > 0) {
        // Batch in groups of 200
        for (let i = 0; i < gtins.length; i += 200) {
          const batch = gtins.slice(i, i + 200);
          const { data } = await supabase.from("products").select("id, gtin").in("gtin", batch);
          data?.forEach((p: any) => { if (p.gtin) allIds[p.gtin] = p.id; });
        }
      }
      if (cnks.length > 0) {
        for (let i = 0; i < cnks.length; i += 200) {
          const batch = cnks.slice(i, i + 200);
          const { data } = await supabase.from("products").select("id, cnk_code").in("cnk_code", batch);
          data?.forEach((p: any) => { if (p.cnk_code) allIds[p.cnk_code] = p.id; });
        }
      }

      let created = 0, skipped = 0;
      const offers: any[] = [];

      for (const row of rows) {
        const ean = String(row["EAN"] || row["ean"] || row["GTIN"] || row["gtin"] || "");
        const cnk = String(row["CNK"] || row["cnk"] || "");
        const productId = allIds[ean] || allIds[cnk];
        if (!productId) { skipped++; continue; }

        const priceExcl = parseFloat(row["Prix HT"] || row["prix_ht"] || row["price_excl_vat"] || "0");
        const vatRate = parseFloat(row["TVA"] || row["tva"] || row["vat_rate"] || "21");
        if (!priceExcl || priceExcl <= 0) { skipped++; continue; }

        const priceIncl = Math.round(priceExcl * (1 + vatRate / 100) * 100) / 100;
        const stock = parseInt(row["Stock"] || row["stock"] || row["stock_quantity"] || "0") || 0;

        offers.push({
          vendor_id: vendorId,
          product_id: productId,
          price_excl_vat: priceExcl,
          price_incl_vat: priceIncl,
          vat_rate: vatRate,
          stock_quantity: stock,
          moq: parseInt(row["MOQ"] || row["moq"] || "1") || 1,
          delivery_days: parseInt(row["Délai"] || row["delai"] || row["delivery_days"] || "3") || 3,
          country_code: row["Pays"] || row["pays"] || row["country_code"] || "BE",
          stock_status: stock > 0 ? "in_stock" : "out_of_stock",
          is_active: true,
        });
        created++;
      }

      if (offers.length > 0) {
        // Batch insert in groups of 100
        for (let i = 0; i < offers.length; i += 100) {
          const batch = offers.slice(i, i + 100);
          const { error } = await supabase.from("offers").insert(batch);
          if (error) throw error;
        }
      }

      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      toast.success(`Import terminé : ${created} offres créées, ${skipped} ignorées`);
    } catch (err: any) {
      toast.error(err.message || "Erreur d'import");
    } finally {
      setImporting(false);
    }
  };

  return { importFile, importing };
}

function downloadTemplate() {
  const headers = ["EAN", "CNK", "Prix HT", "TVA", "Stock", "MOQ", "Délai", "Pays"];
  const example = ["3401560100013", "1234567", "12.50", "21", "100", "1", "3", "BE"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Offres");
  XLSX.writeFile(wb, "template_offres_medikong.xlsx");
}

function exportOffers(offers: any[]) {
  if (offers.length === 0) { toast.error("Aucune offre à exporter"); return; }
  const rows = offers.map((o: any) => ({
    "Produit": (o.products as any)?.name || "",
    "EAN": (o.products as any)?.gtin || "",
    "CNK": (o.products as any)?.cnk_code || "",
    "Marque": (o.products as any)?.brand_name || "",
    "Catégorie": (o.products as any)?.category_name || "",
    "Prix HT": o.price_excl_vat,
    "Prix TTC": o.price_incl_vat,
    "TVA": o.vat_rate,
    "Stock": o.stock_quantity,
    "MOQ": o.moq,
    "Délai": o.delivery_days,
    "Pays": o.country_code,
    "Statut": o.is_active ? "Active" : "Inactive",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mes Offres");
  XLSX.writeFile(wb, `offres_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success("Export téléchargé");
}

/* ─── Main Page ─── */
export default function VendorOffers() {
  const { data: vendor } = useCurrentVendor();
  const { data: offers = [], isLoading } = useVendorOffers(vendor?.id);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFile, importing } = useOfferImport(vendor?.id);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCountry, setFilterCountry] = useState("");

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (offer: any) => {
    setForm({
      product_id: offer.product_id,
      product_name: (offer.products as any)?.name || "",
      price_excl_vat: String(offer.price_excl_vat),
      vat_rate: String(offer.vat_rate),
      stock_quantity: String(offer.stock_quantity),
      moq: String(offer.moq),
      delivery_days: String(offer.delivery_days),
      country_code: offer.country_code || "BE",
    });
    setEditingId(offer.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const saveOffer = useMutation({
    mutationFn: async () => {
      if (!vendor) throw new Error("No vendor");
      const priceExcl = parseFloat(form.price_excl_vat);
      const vatRate = parseFloat(form.vat_rate);
      if (!form.product_id || isNaN(priceExcl) || priceExcl <= 0) throw new Error("Champs requis manquants");
      const priceIncl = Math.round(priceExcl * (1 + vatRate / 100) * 100) / 100;
      const payload = {
        vendor_id: vendor.id, product_id: form.product_id,
        price_excl_vat: priceExcl, price_incl_vat: priceIncl, vat_rate: vatRate,
        stock_quantity: parseInt(form.stock_quantity) || 0, moq: parseInt(form.moq) || 1,
        delivery_days: parseInt(form.delivery_days) || 3, country_code: form.country_code,
        stock_status: parseInt(form.stock_quantity) > 0 ? "in_stock" as const : "out_of_stock" as const,
        is_active: true,
      };
      if (editingId) {
        const { error } = await supabase.from("offers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("offers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editingId ? "Offre modifiée" : "Offre créée"); qc.invalidateQueries({ queryKey: ["vendor-offers"] }); closeForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOffer = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("offers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Offre supprimée"); qc.invalidateQueries({ queryKey: ["vendor-offers"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  // Unique brands from current offers for filter
  const offerBrands = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o: any) => { const b = (o.products as any)?.brand_name; if (b) set.add(b); });
    return Array.from(set).sort();
  }, [offers]);

  const filteredOffers = useMemo(() => {
    return offers.filter((o: any) => {
      const prod = o.products as any;
      const name = prod?.name || "";
      const gtin = prod?.gtin || "";
      const cnk = prod?.cnk_code || "";
      const s = search.toLowerCase();
      if (s && !name.toLowerCase().includes(s) && !gtin.includes(s) && !cnk.includes(s)) return false;
      if (filterBrand && prod?.brand_name !== filterBrand) return false;
      if (filterCountry && o.country_code !== filterCountry) return false;
      return true;
    });
  }, [offers, search, filterBrand, filterCountry]);

  if (!vendor) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold" style={{ color: "#1D2530" }}>Mes Offres</h1>
        <VCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Tag size={48} style={{ color: "#CBD5E1" }} className="mb-4" />
            <h3 className="text-[15px] font-bold mb-2" style={{ color: "#1D2530" }}>Profil vendeur non trouvé</h3>
            <p className="text-[13px]" style={{ color: "#8B95A5" }}>Connectez-vous avec votre compte vendeur.</p>
          </div>
        </VCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1D2530" }}>Mes Offres</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>{offers.length} offre{offers.length !== 1 ? "s" : ""} au total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors hover:bg-[#F8FAFC]"
            style={{ borderColor: "#E2E8F0", color: "#616B7C" }}>
            <FileSpreadsheet size={14} /> Template
          </button>
          <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors hover:bg-[#F8FAFC] ${importing ? "opacity-50 pointer-events-none" : ""}`}
            style={{ borderColor: "#E2E8F0", color: "#616B7C" }}>
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importer
            <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
              onChange={e => { if (e.target.files?.[0]) { importFile(e.target.files[0]); e.target.value = ""; } }} />
          </label>
          {offers.length > 0 && (
            <button onClick={() => exportOffers(offers)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors hover:bg-[#F8FAFC]"
              style={{ borderColor: "#E2E8F0", color: "#616B7C" }}>
              <Download size={14} /> Exporter
            </button>
          )}
          <VBtn primary icon="Plus" onClick={openCreate}>Nouvelle offre</VBtn>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <VCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#1D2530" }}>{editingId ? "Modifier l'offre" : "Nouvelle offre"}</h3>
            <button onClick={closeForm} className="p-1 hover:bg-[#F1F5F9] rounded"><X size={16} style={{ color: "#8B95A5" }} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>Produit *</label>
              <ProductPicker value={form.product_id} productName={form.product_name}
                onChange={(id, name) => setForm(p => ({ ...p, product_id: id, product_name: name }))} />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>Prix HT (€) *</label>
              <input type="number" step="0.01" min="0" className="w-full px-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                style={{ borderColor: "#E2E8F0" }} value={form.price_excl_vat} onChange={e => setForm(p => ({ ...p, price_excl_vat: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>TVA (%)</label>
              <select className="w-full px-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                style={{ borderColor: "#E2E8F0" }} value={form.vat_rate} onChange={e => setForm(p => ({ ...p, vat_rate: e.target.value }))}>
                <option value="21">21%</option><option value="6">6%</option><option value="0">0%</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>Stock</label>
              <input type="number" min="0" className="w-full px-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                style={{ borderColor: "#E2E8F0" }} value={form.stock_quantity} onChange={e => setForm(p => ({ ...p, stock_quantity: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>MOQ (min.)</label>
              <input type="number" min="1" className="w-full px-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                style={{ borderColor: "#E2E8F0" }} value={form.moq} onChange={e => setForm(p => ({ ...p, moq: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>Délai livraison (jours)</label>
              <input type="number" min="1" className="w-full px-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                style={{ borderColor: "#E2E8F0" }} value={form.delivery_days} onChange={e => setForm(p => ({ ...p, delivery_days: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>Pays</label>
              <select className="w-full px-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                style={{ borderColor: "#E2E8F0" }} value={form.country_code} onChange={e => setForm(p => ({ ...p, country_code: e.target.value }))}>
                <option value="BE">Belgique</option><option value="FR">France</option><option value="NL">Pays-Bas</option>
                <option value="LU">Luxembourg</option><option value="DE">Allemagne</option>
              </select>
            </div>
          </div>
          {form.price_excl_vat && (
            <div className="mt-3 p-3 rounded-lg text-[12px]" style={{ backgroundColor: "#F8FAFC", color: "#616B7C" }}>
              Prix TTC : <strong style={{ color: "#1D2530" }}>{(parseFloat(form.price_excl_vat) * (1 + parseFloat(form.vat_rate) / 100)).toFixed(2)} €</strong>
            </div>
          )}

          {/* ─── Profile Rules Section ─── */}
          <ProfileRulesEditor offerId={editingId} basePrice={parseFloat(form.price_excl_vat) || 0} />

          <div className="flex justify-end gap-2 mt-4">
            <VBtn small onClick={closeForm}>Annuler</VBtn>
            <VBtn small primary onClick={() => saveOffer.mutate()}>
              {saveOffer.isPending ? <Loader2 size={14} className="animate-spin" /> : editingId ? "Modifier" : "Créer l'offre"}
            </VBtn>
          </div>
        </VCard>
      )}

      {/* Filters bar */}
      {offers.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B95A5" }} />
            <input className="w-full pl-9 pr-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
              style={{ borderColor: "#E2E8F0" }} placeholder="Rechercher (nom, EAN, CNK)…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {offerBrands.length > 1 && (
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
              className="text-[12px] px-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E2E8F0", color: "#616B7C" }}>
              <option value="">Toutes marques</option>
              {offerBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
            className="text-[12px] px-3 py-2 rounded-lg border bg-white" style={{ borderColor: "#E2E8F0", color: "#616B7C" }}>
            <option value="">Tous pays</option>
            <option value="BE">Belgique</option><option value="FR">France</option>
            <option value="NL">Pays-Bas</option><option value="LU">Luxembourg</option><option value="DE">Allemagne</option>
          </select>
          <span className="text-[11px] font-medium" style={{ color: "#8B95A5" }}>{filteredOffers.length} résultat{filteredOffers.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Offers table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#1B5BDA" }} /></div>
      ) : filteredOffers.length === 0 ? (
        <VCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={48} style={{ color: "#CBD5E1" }} className="mb-4" />
            <h3 className="text-[15px] font-bold mb-2" style={{ color: "#1D2530" }}>Aucune offre</h3>
            <p className="text-[13px] max-w-md mb-4" style={{ color: "#8B95A5" }}>
              {search || filterBrand || filterCountry ? "Aucune offre ne correspond à vos filtres." : "Créez vos offres manuellement ou importez-les via XLSX."}
            </p>
            {!search && !filterBrand && !filterCountry && (
              <div className="flex gap-2">
                <VBtn primary icon="Plus" onClick={openCreate}>Créer une offre</VBtn>
                <label className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold cursor-pointer border transition-colors hover:bg-[#F8FAFC]"
                  style={{ borderColor: "#E2E8F0", color: "#1B5BDA" }}>
                  <Upload size={14} /> Importer XLSX
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv"
                    onChange={e => { if (e.target.files?.[0]) { importFile(e.target.files[0]); e.target.value = ""; } }} />
                </label>
              </div>
            )}
          </div>
        </VCard>
      ) : (
        <VCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}
                  className="text-[11px] uppercase tracking-wide" >
                  <th className="text-left py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Produit</th>
                  <th className="text-left py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Marque</th>
                  <th className="text-right py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Prix HT</th>
                  <th className="text-right py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Prix TTC</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Stock</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>MOQ</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Délai</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Pays</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Statut</th>
                  <th className="text-right py-2.5 px-3 font-medium" style={{ color: "#8B95A5" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map((offer: any) => {
                  const prod = offer.products as any;
                  return (
                    <tr key={offer.id} className="hover:bg-[#F8FAFC]" style={{ borderBottom: "1px solid #E2E8F0" }}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {prod?.image_urls?.[0] ? (
                            <img src={prod.image_urls[0]} alt="" className="w-8 h-8 rounded object-contain shrink-0" style={{ backgroundColor: "#F8FAFC" }} />
                          ) : (
                            <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: "#F1F5F9" }}>
                              <Package size={14} style={{ color: "#CBD5E1" }} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-medium line-clamp-1 max-w-[200px] block" style={{ color: "#1D2530" }}>{prod?.name || "Produit inconnu"}</span>
                            {prod?.gtin && <span className="text-[10px] block" style={{ color: "#8B95A5" }}>EAN: {prod.gtin}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[12px]" style={{ color: "#616B7C" }}>{prod?.brand_name || "—"}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{Number(offer.price_excl_vat).toFixed(2)} €</td>
                      <td className="py-2.5 px-3 text-right">{Number(offer.price_incl_vat).toFixed(2)} €</td>
                      <td className="py-2.5 px-3 text-center">{offer.stock_quantity}</td>
                      <td className="py-2.5 px-3 text-center">{offer.moq}</td>
                      <td className="py-2.5 px-3 text-center">{offer.delivery_days}j</td>
                      <td className="py-2.5 px-3 text-center">{offer.country_code}</td>
                      <td className="py-2.5 px-3 text-center">
                        <VBadge color={offer.is_active ? "#059669" : "#8B95A5"}>{offer.is_active ? "Active" : "Inactive"}</VBadge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(offer)} className="p-1.5 hover:bg-[#EFF6FF] rounded" title="Modifier">
                            <Pencil size={14} style={{ color: "#1B5BDA" }} />
                          </button>
                          <button onClick={() => { if (confirm("Supprimer cette offre ?")) deleteOffer.mutate(offer.id); }}
                            className="p-1.5 hover:bg-[#FEF2F2] rounded" title="Supprimer">
                            <Trash2 size={14} style={{ color: "#EF4343" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </VCard>
      )}
    </div>
  );
}
