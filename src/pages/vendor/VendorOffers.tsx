import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Tag, Plus, Pencil, Trash2, X, Loader2, Package, Search, Download, Upload, FileSpreadsheet, ChevronDown, Users, ChevronRight, TrendingDown, TrendingUp, BarChart3, Eye, ImagePlus } from "lucide-react";
import ProductPhotoUploader from "@/components/admin/ProductPhotoUploader";
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
  mov_amount: string;
  delivery_days: string;
  country_code: string;
}

const emptyForm: OfferForm = {
  product_id: "", product_name: "", price_excl_vat: "", vat_rate: "21", stock_quantity: "", moq: "1", mov_amount: "0", delivery_days: "3", country_code: "BE",
};

/* ─── Competitive Intelligence Module ─── */
function CompetitiveIntel({ productId, currentPrice, vendorId }: { productId: string; currentPrice: number; vendorId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["competitive-intel", productId],
    queryFn: async () => {
      const [{ data: offers }, { data: marketPrices }, { data: externalOffers }] = await Promise.all([
        supabase.from("offers").select("id, price_excl_vat, price_incl_vat, vendor_id, moq, mov_amount, country_code, is_active, vendors(company_name)")
          .eq("product_id", productId).eq("is_active", true).order("price_excl_vat"),
        supabase.from("market_prices").select("prix_pharmacien, prix_grossiste, prix_public, market_price_sources(name, source_type)")
          .eq("product_id", productId).limit(10),
        supabase.from("external_offers").select("unit_price, external_vendors(name), stock_status")
          .eq("product_id", productId).eq("is_active", true).order("unit_price").limit(10),
      ]);
      return { offers: offers || [], marketPrices: marketPrices || [], externalOffers: externalOffers || [] };
    },
    enabled: !!productId,
  });

  if (!productId) return null;
  if (isLoading) return <div className="mt-3 p-3 rounded-lg border flex items-center gap-2 text-[11px]" style={{ borderColor: "#E2E8F0", color: "#8B95A5" }}><Loader2 size={12} className="animate-spin" /> Analyse concurrentielle…</div>;

  const otherOffers = (data?.offers || []).filter((o: any) => o.vendor_id !== vendorId);
  const allMkPrices = otherOffers.map((o: any) => Number(o.price_excl_vat));
  const minMk = allMkPrices.length > 0 ? Math.min(...allMkPrices) : null;
  const maxMk = allMkPrices.length > 0 ? Math.max(...allMkPrices) : null;

  const marketPriceValues = (data?.marketPrices || []).flatMap((mp: any) => [mp.prix_pharmacien, mp.prix_grossiste].filter(Boolean).map(Number));
  const minMarket = marketPriceValues.length > 0 ? Math.min(...marketPriceValues) : null;

  const extPrices = (data?.externalOffers || []).map((e: any) => Number(e.unit_price));
  const minExt = extPrices.length > 0 ? Math.min(...extPrices) : null;

  const lowestCompetitor = [minMk, minMarket, minExt].filter(Boolean).length > 0 ? Math.min(...([minMk, minMarket, minExt].filter(Boolean) as number[])) : null;
  const positionColor = currentPrice > 0 && lowestCompetitor ? (currentPrice <= lowestCompetitor ? "#059669" : currentPrice <= lowestCompetitor * 1.05 ? "#F59E0B" : "#EF4343") : "#8B95A5";
  const positionLabel = currentPrice > 0 && lowestCompetitor ? (currentPrice <= lowestCompetitor ? "Meilleur prix" : currentPrice <= lowestCompetitor * 1.05 ? "Compétitif" : "Au-dessus du marché") : "—";

  return (
    <div className="mt-3 border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: "#F8FAFC" }}>
        <BarChart3 size={14} style={{ color: "#1B5BDA" }} />
        <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Veille concurrentielle</span>
        <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: positionColor + "15", color: positionColor }}>
          {positionLabel}
        </span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {/* MediKong offers */}
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: "#616B7C" }}>Offres MediKong actives</span>
          <span className="font-medium" style={{ color: "#1D2530" }}>
            {otherOffers.length} offre{otherOffers.length !== 1 ? "s" : ""}
            {minMk !== null && <span className="ml-1" style={{ color: "#8B95A5" }}>({minMk.toFixed(2)}€ – {maxMk!.toFixed(2)}€)</span>}
          </span>
        </div>
        {/* Market prices */}
        {marketPriceValues.length > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: "#616B7C" }}>Prix du marché (grossistes)</span>
            <span className="font-medium" style={{ color: "#1D2530" }}>dès {minMarket!.toFixed(2)}€ HT</span>
          </div>
        )}
        {/* External offers */}
        {extPrices.length > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: "#616B7C" }}>Offres externes</span>
            <span className="font-medium" style={{ color: "#1D2530" }}>{extPrices.length} offre{extPrices.length !== 1 ? "s" : ""} dès {minExt!.toFixed(2)}€</span>
          </div>
        )}
        {/* Position */}
        {currentPrice > 0 && lowestCompetitor && (
          <div className="flex items-center justify-between text-[11px] pt-1 border-t" style={{ borderColor: "#E2E8F0" }}>
            <span style={{ color: "#616B7C" }}>Votre positionnement</span>
            <span className="font-bold" style={{ color: positionColor }}>
              {currentPrice <= lowestCompetitor ? (
                <><TrendingDown size={12} className="inline mr-1" />{((1 - currentPrice / lowestCompetitor) * 100).toFixed(0)}% moins cher</>
              ) : (
                <><TrendingUp size={12} className="inline mr-1" />+{((currentPrice / lowestCompetitor - 1) * 100).toFixed(0)}% vs meilleur prix</>
              )}
            </span>
          </div>
        )}
        {otherOffers.length === 0 && marketPriceValues.length === 0 && extPrices.length === 0 && (
          <p className="text-[10px] text-center py-1" style={{ color: "#8B95A5" }}>Aucune donnée concurrentielle disponible pour ce produit.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Price Tiers Editor ─── */
interface PriceTier {
  id?: string;
  mov_threshold: string;
  unit_price: string;
}

function PriceTiersEditor({ offerId, basePrice, vatRate }: { offerId: string | null; basePrice: number; vatRate: number }) {
  const [expanded, setExpanded] = useState(false);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: existingTiers } = useQuery({
    queryKey: ["offer-price-tiers", offerId],
    queryFn: async () => {
      if (!offerId) return [];
      const { data } = await supabase.from("offer_price_tiers").select("*").eq("offer_id", offerId).order("tier_index");
      return data || [];
    },
    enabled: !!offerId,
  });

  useEffect(() => {
    if (existingTiers && existingTiers.length > 0) {
      setTiers(existingTiers.map((t: any) => ({ id: t.id, mov_threshold: String(t.mov_threshold), unit_price: String(t.price_excl_vat) })));
      setExpanded(true);
    }
  }, [existingTiers]);

  const addTier = () => setTiers(prev => [...prev, { mov_threshold: "", unit_price: "" }]);
  const updateTier = (idx: number, key: keyof PriceTier, val: string) =>
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [key]: val } : t));
  const removeTier = (idx: number) => setTiers(prev => prev.filter((_, i) => i !== idx));

  const saveTiers = async () => {
    if (!offerId) { toast.info("Sauvegardez l'offre d'abord."); return; }
    setSaving(true);
    try {
      await supabase.from("offer_price_tiers").delete().eq("offer_id", offerId);
      if (tiers.length > 0) {
        const payload = tiers.filter(t => t.mov_threshold && t.unit_price).map((t, idx) => {
          const priceExcl = parseFloat(t.unit_price);
          return {
            offer_id: offerId, tier_index: idx, mov_threshold: parseFloat(t.mov_threshold),
            price_excl_vat: priceExcl, price_incl_vat: Math.round(priceExcl * (1 + vatRate / 100) * 100) / 100,
            qogita_unit_price: priceExcl, is_active: true,
          };
        });
        if (payload.length > 0) {
          const { error } = await supabase.from("offer_price_tiers").insert(payload);
          if (error) throw error;
        }
      }
      qc.invalidateQueries({ queryKey: ["offer-price-tiers", offerId] });
      toast.success("Paliers de prix sauvegardés");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-3 border rounded-lg" style={{ borderColor: "#E2E8F0" }}>
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#F8FAFC] rounded-lg transition-colors">
        <TrendingDown size={14} style={{ color: "#059669" }} />
        <span className="text-[12px] font-medium" style={{ color: "#1D2530" }}>Prix dégressifs (paliers MOV/MOQ)</span>
        {tiers.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
            {tiers.length} palier{tiers.length > 1 ? "s" : ""}
          </span>
        )}
        <ChevronRight size={12} className={`ml-auto transition-transform ${expanded ? "rotate-90" : ""}`} style={{ color: "#8B95A5" }} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {tiers.length === 0 && (
            <p className="text-[11px] py-2 text-center" style={{ color: "#8B95A5" }}>
              Aucun palier. Le prix de base s'applique quelle que soit la quantité.
            </p>
          )}
          <div className="space-y-1.5">
            {tiers.map((tier, idx) => {
              const tierPrice = parseFloat(tier.unit_price) || 0;
              const discount = basePrice > 0 && tierPrice > 0 ? Math.round((1 - tierPrice / basePrice) * 100) : 0;
              return (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end p-2 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <div>
                    <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>Seuil MOV (€) *</label>
                    <input type="number" step="1" min="0" value={tier.mov_threshold}
                      onChange={e => updateTier(idx, "mov_threshold", e.target.value)}
                      placeholder="Ex: 500"
                      className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }} />
                  </div>
                  <div>
                    <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>Prix unitaire HT (€) *</label>
                    <input type="number" step="0.01" min="0" value={tier.unit_price}
                      onChange={e => updateTier(idx, "unit_price", e.target.value)}
                      placeholder={basePrice ? `< ${basePrice.toFixed(2)}` : "—"}
                      className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }} />
                  </div>
                  {discount > 0 && (
                    <span className="text-[9px] font-bold whitespace-nowrap pb-1" style={{ color: "#059669" }}>-{discount}%</span>
                  )}
                  <button type="button" onClick={() => removeTier(idx)} className="p-0.5 hover:bg-[#FEF2F2] rounded pb-1">
                    <Trash2 size={12} style={{ color: "#EF4343" }} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={addTier}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-[#ECFDF5] transition-colors"
              style={{ color: "#059669" }}>
              <Plus size={12} /> Ajouter un palier
            </button>
            {tiers.length > 0 && offerId && (
              <button type="button" onClick={saveTiers} disabled={saving}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-[#EFF6FF] transition-colors"
                style={{ color: "#1B5BDA" }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : null} Sauvegarder les paliers
              </button>
            )}
            {!offerId && tiers.length > 0 && (
              <span className="text-[10px]" style={{ color: "#F59E0B" }}>⚠ Créez l'offre d'abord</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
      const profileRulesQueue: { ean: string; cnk: string; rule: any }[] = [];

      for (const row of rows) {
        const ean = String(row["EAN"] || row["ean"] || row["GTIN"] || row["gtin"] || "");
        const cnk = String(row["CNK"] || row["cnk"] || "");
        const productId = allIds[ean] || allIds[cnk];
        if (!productId) { skipped++; continue; }

        const profileType = String(row["Profil"] || row["profil"] || row["profile_type"] || "").trim();

        // If profile column is filled, this is a profile rule row
        if (profileType) {
          profileRulesQueue.push({
            ean, cnk,
            rule: {
              profile_type: profileType,
              country_code: row["Profil_Pays"] || row["profil_pays"] || null,
              custom_price_excl_vat: row["Prix_Profil_HT"] || row["prix_profil_ht"] ? parseFloat(String(row["Prix_Profil_HT"] || row["prix_profil_ht"])) : null,
              discount_percentage: parseFloat(String(row["Remise_%"] || row["remise_%"] || row["remise_pct"] || "0")) || 0,
              moq: parseInt(String(row["MOQ_Profil"] || row["moq_profil"] || "1")) || 1,
              mov_amount: parseFloat(String(row["MOV_Profil"] || row["mov_profil"] || "0")) || 0,
            },
          });
          continue;
        }

        const priceExcl = parseFloat(row["Prix HT"] || row["prix_ht"] || row["price_excl_vat"] || "0");
        const vatRate = parseFloat(row["TVA"] || row["tva"] || row["vat_rate"] || "21");
        if (!priceExcl || priceExcl <= 0) { skipped++; continue; }

        const priceIncl = Math.round(priceExcl * (1 + vatRate / 100) * 100) / 100;
        // Stock: empty/undefined = in stock (99999), 0 = out of stock, number = exact qty
        const rawStock = row["Stock"] ?? row["stock"] ?? row["stock_quantity"];
        const stockIsEmpty = rawStock === undefined || rawStock === null || String(rawStock).trim() === "";
        const stock = stockIsEmpty ? 99999 : (parseInt(String(rawStock)) || 0);

        const purchasePrice = parseFloat(String(row["Prix_Achat_HT"] || row["prix_achat_ht"] || row["purchase_price"] || "0")) || null;
        const movAmount = parseFloat(String(row["MOV"] || row["mov"] || row["mov_amount"] || "0")) || 0;

        offers.push({
          vendor_id: vendorId,
          product_id: productId,
          price_excl_vat: priceExcl,
          price_incl_vat: priceIncl,
          purchase_price: purchasePrice,
          vat_rate: vatRate,
          stock_quantity: stock,
          moq: parseInt(row["MOQ"] || row["moq"] || "1") || 1,
          mov_amount: movAmount || null,
          delivery_days: parseInt(row["Délai"] || row["delai"] || row["delivery_days"] || "3") || 3,
          country_code: row["Pays"] || row["pays"] || row["country_code"] || "BE",
          stock_status: stock > 0 ? "in_stock" : "out_of_stock",
          is_active: true,
          _ean: ean,
          _cnk: cnk,
        });
        created++;
      }

      // Deduplicate offers by product_id+vendor_id+country_code (keep last occurrence)
      const deduped = new Map<string, typeof offers[number]>();
      for (const o of offers) {
        deduped.set(`${o.product_id}|${o.vendor_id}|${o.country_code}`, o);
      }
      const uniqueOffers = Array.from(deduped.values());

      // Upsert offers and collect IDs
      const offerIdsByKey: Record<string, string> = {};
      if (uniqueOffers.length > 0) {
        for (let i = 0; i < uniqueOffers.length; i += 100) {
          const batchSource = uniqueOffers.slice(i, i + 100);
          const batch = batchSource.map(({ _ean, _cnk, ...rest }) => rest);
          const { data: inserted, error } = await supabase.from("offers").upsert(batch, { onConflict: "product_id,vendor_id,country_code", ignoreDuplicates: false }).select("id, product_id");
          if (error) throw error;
          if (inserted) {
            inserted.forEach((ins: any, idx: number) => {
              const src = batchSource[idx];
              if (src._ean) offerIdsByKey[src._ean] = ins.id;
              if (src._cnk) offerIdsByKey[src._cnk] = ins.id;
            });
          }
        }
      }

      // Insert profile rules
      if (profileRulesQueue.length > 0) {
        const profileInserts = profileRulesQueue
          .map(({ ean, cnk, rule }) => {
            const offerId = offerIdsByKey[ean] || offerIdsByKey[cnk];
            if (!offerId) return null;
            return { offer_id: offerId, ...rule };
          })
          .filter(Boolean);

        if (profileInserts.length > 0) {
          for (let i = 0; i < profileInserts.length; i += 100) {
            const batch = profileInserts.slice(i, i + 100);
            await supabase.from("offer_profile_rules").insert(batch);
          }
        }
      }

      // Parse price tiers from "Paliers" sheet
      const tiersSheetName = wb.SheetNames.find(n => n.toLowerCase().includes("palier"));
      if (tiersSheetName && wb.Sheets[tiersSheetName]) {
        const tiersRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[tiersSheetName]);
        const tierInserts: any[] = [];
        for (const tr of tiersRows) {
          const tEan = String(tr["EAN"] || tr["ean"] || tr["GTIN"] || "");
          const tCnk = String(tr["CNK"] || tr["cnk"] || "");
          const tCountry = String(tr["Pays"] || tr["pays"] || "BE");
          const tierIndex = parseInt(String(tr["Palier"] || tr["palier"] || "1")) || 1;
          const movThreshold = parseFloat(String(tr["Seuil_MOV"] || tr["seuil_mov"] || "0")) || 0;
          const tierPrice = parseFloat(String(tr["Prix_HT"] || tr["prix_ht"] || "0"));
          if (!tierPrice || tierPrice <= 0) continue;

          // Find the offer ID by matching EAN/CNK
          const offerId = offerIdsByKey[tEan] || offerIdsByKey[tCnk];
          if (!offerId) continue;

          // Find base offer VAT rate
          const baseOffer = uniqueOffers.find(o => {
            const matchEan = o._ean && o._ean === tEan;
            const matchCnk = o._cnk && o._cnk === tCnk;
            return (matchEan || matchCnk) && o.country_code === tCountry;
          });
          const vatRate = baseOffer?.vat_rate || 21;
          const tierPriceIncl = Math.round(tierPrice * (1 + vatRate / 100) * 100) / 100;

          tierInserts.push({
            offer_id: offerId,
            tier_index: tierIndex,
            mov_threshold: movThreshold,
            qogita_unit_price: tierPrice,
            price_excl_vat: tierPrice,
            price_incl_vat: tierPriceIncl,
            is_active: true,
          });
        }
        if (tierInserts.length > 0) {
          // Delete existing tiers for these offers, then insert new ones
          const tierOfferIds = [...new Set(tierInserts.map(t => t.offer_id))];
          for (const oid of tierOfferIds) {
            await supabase.from("offer_price_tiers").delete().eq("offer_id", oid);
          }
          for (let i = 0; i < tierInserts.length; i += 100) {
            await supabase.from("offer_price_tiers").insert(tierInserts.slice(i, i + 100));
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      const tiersMsg = tiersSheetName ? " + paliers dégressifs" : "";
      toast.success(`Import terminé : ${created} offres créées, ${skipped} ignorées${tiersMsg}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur d'import");
    } finally {
      setImporting(false);
    }
  };

  return { importFile, importing };
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "EAN", "CNK", "Prix HT", "Prix_Achat_HT", "TVA", "Stock", "MOQ", "MOV", "Délai", "Pays",
      "Profil", "Profil_Pays", "Prix_Profil_HT", "Remise_%", "MOQ_Profil", "MOV_Profil",
    ],
    ["3401560100013", "1234567", "12.50", "8.00", "21", "100", "1", "150", "3", "BE", "", "", "", "", "", ""],
    ["3401560100013", "", "13.00", "8.50", "20", "", "1", "200", "5", "FR", "", "", "", "", "", ""],
    ["3401560100013", "", "", "", "", "", "", "", "", "", "pharmacy", "BE", "11.00", "", "5", "150"],
    ["3401560100013", "", "", "", "", "", "", "", "", "", "hospital", "", "", "10", "10", "500"],
  ]);
  ws["!cols"] = Array(16).fill(null).map(() => ({ wch: 16 }));

  // Price tiers sheet
  const wsTiers = XLSX.utils.aoa_to_sheet([
    ["EAN", "CNK", "Pays", "Palier", "Seuil_MOV", "Prix_HT"],
    ["3401560100013", "", "BE", "1", "0", "12.50"],
    ["3401560100013", "", "BE", "2", "500", "11.50"],
    ["3401560100013", "", "BE", "3", "1000", "10.80"],
  ]);
  wsTiers["!cols"] = Array(6).fill(null).map(() => ({ wch: 16 }));

  // Instructions sheet
  const instrRows = [
    ["Guide d'import des offres MediKong"],
    [""],
    ["=== Onglet 'Offres' — Colonnes principales ==="],
    ["EAN", "Code-barres EAN/GTIN du produit"],
    ["CNK", "Code CNK belge (alternative au EAN)"],
    ["Prix HT", "Prix de vente hors taxes en euros"],
    ["Prix_Achat_HT", "Prix d'achat HT (pour calcul de marge). Obligatoire en mode partage de marge."],
    ["TVA", "Taux de TVA (ex: 21)"],
    ["Stock", "Quantité en stock. Vide = en stock sans limite. 0 = rupture de stock."],
    ["MOQ", "Quantité minimum de commande (par défaut : 1)"],
    ["MOV", "Montant minimum de commande en € (par défaut : 0)"],
    ["Délai", "Délai de livraison en jours (par défaut : 3)"],
    ["Pays", "Code pays (BE, FR, NL, LU, DE) — une ligne par pays pour des configs différentes"],
    [""],
    ["=== Colonnes profil (optionnelles, pour prix différenciés) ==="],
    ["Profil", "Type de profil : pharmacy, hospital, dentist, nursing, veterinary, ehpad, wholesale"],
    ["Profil_Pays", "Code pays pour cette règle (vide = tous les pays)"],
    ["Prix_Profil_HT", "Prix HT fixe pour ce profil (prioritaire sur Remise_%)"],
    ["Remise_%", "% de remise sur le prix de base (utilisé si pas de prix fixe)"],
    ["MOQ_Profil", "MOQ spécifique pour ce profil"],
    ["MOV_Profil", "Montant minimum de commande en € pour ce profil"],
    [""],
    ["=== Onglet 'Paliers' — Prix dégressifs ==="],
    ["EAN", "Code-barres EAN/GTIN du produit"],
    ["CNK", "Code CNK belge (alternative au EAN)"],
    ["Pays", "Code pays"],
    ["Palier", "Numéro du palier (1 = prix de base, 2 = palier 2, etc.)"],
    ["Seuil_MOV", "Seuil de commande minimum en € pour accéder à ce palier"],
    ["Prix_HT", "Prix unitaire HT pour ce palier"],
    [""],
    ["=== Règles d'import ==="],
    ["- Une ligne avec EAN + Prix HT = offre principale (une par pays)"],
    ["- Stock vide = en stock sans limite, Stock = 0 = rupture"],
    ["- Une ligne avec le même EAN + Profil renseigné = règle profil pour cette offre"],
    ["- Onglet 'Paliers' : prix dégressifs par seuil de commande"],
    ["- Le Prix_Achat_HT permet de calculer la marge nette (vente - achat)"],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
  wsInstr["!cols"] = [{ wch: 20 }, { wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Offres");
  XLSX.utils.book_append_sheet(wb, wsTiers, "Paliers");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");
  XLSX.writeFile(wb, "template_offres_medikong.xlsx");
}

function exportOffers(offers: any[], profileRulesMap?: Map<string, any[]>, priceTiersMap?: Map<string, any[]>) {
  if (offers.length === 0) { toast.error("Aucune offre à exporter"); return; }
  const rows: any[] = [];
  const tiersRows: any[] = [];
  for (const o of offers) {
    const stockDisplay = o.stock_quantity >= 99999 ? "" : o.stock_quantity;
    rows.push({
      "Produit": (o.products as any)?.name || "",
      "EAN": (o.products as any)?.gtin || "",
      "CNK": (o.products as any)?.cnk_code || "",
      "Marque": (o.products as any)?.brand_name || "",
      "Catégorie": (o.products as any)?.category_name || "",
      "Prix HT": o.price_excl_vat,
      "Prix_Achat_HT": o.purchase_price ?? "",
      "Marge €": o.purchase_price ? Math.round((o.price_excl_vat - o.purchase_price) * 100) / 100 : "",
      "Marge %": o.purchase_price && o.purchase_price > 0 ? Math.round((o.price_excl_vat - o.purchase_price) / o.purchase_price * 10000) / 100 : "",
      "Prix TTC": o.price_incl_vat,
      "TVA": o.vat_rate,
      "Stock": stockDisplay,
      "MOQ": o.moq,
      "MOV": o.mov_amount ?? "",
      "Délai": o.delivery_days,
      "Pays": o.country_code,
      "Statut": o.is_active ? "Active" : "Inactive",
      "Profil": "",
      "Profil_Pays": "",
      "Prix_Profil_HT": "",
      "Remise_%": "",
      "MOQ_Profil": "",
      "MOV_Profil": "",
    });
    // Add profile rules as sub-rows
    const rules = profileRulesMap?.get(o.id) || [];
    for (const r of rules) {
      rows.push({
        "Produit": "", "EAN": (o.products as any)?.gtin || "", "CNK": (o.products as any)?.cnk_code || "",
        "Marque": "", "Catégorie": "", "Prix HT": "", "Prix_Achat_HT": "", "Marge €": "", "Marge %": "",
        "Prix TTC": "", "TVA": "", "Stock": "", "MOQ": "", "MOV": "", "Délai": "", "Pays": "", "Statut": "",
        "Profil": r.profile_type, "Profil_Pays": r.country_code || "",
        "Prix_Profil_HT": r.custom_price_excl_vat ?? "", "Remise_%": r.discount_percentage ?? "",
        "MOQ_Profil": r.moq ?? "", "MOV_Profil": r.mov_amount ?? "",
      });
    }
    // Collect price tiers
    const tiers = priceTiersMap?.get(o.id) || [];
    for (const t of tiers) {
      tiersRows.push({
        "Produit": (o.products as any)?.name || "",
        "EAN": (o.products as any)?.gtin || "",
        "CNK": (o.products as any)?.cnk_code || "",
        "Pays": o.country_code,
        "Palier": t.tier_index,
        "Seuil_MOV": t.mov_threshold,
        "Prix_HT": t.price_excl_vat,
        "Prix_TTC": t.price_incl_vat,
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mes Offres");
  if (tiersRows.length > 0) {
    const wsTiers = XLSX.utils.json_to_sheet(tiersRows);
    wsTiers["!cols"] = Object.keys(tiersRows[0]).map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsTiers, "Paliers");
  }
  XLSX.writeFile(wb, `offres_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success("Export téléchargé");
}

/* ─── Profile Rules Editor ─── */
interface ProfileRule {
  id?: string;
  profile_type: string;
  country_code: string;
  custom_price_excl_vat: string;
  discount_percentage: string;
  moq: string;
  mov_amount: string;
}

const emptyRule: ProfileRule = {
  profile_type: "", country_code: "", custom_price_excl_vat: "", discount_percentage: "0", moq: "1", mov_amount: "0",
};

function ProfileRulesEditor({ offerId, basePrice }: { offerId: string | null; basePrice: number }) {
  const [expanded, setExpanded] = useState(false);
  const [rules, setRules] = useState<ProfileRule[]>([]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: existingRules } = useQuery({
    queryKey: ["offer-profile-rules", offerId],
    queryFn: async () => {
      if (!offerId) return [];
      const { data } = await supabase
        .from("offer_profile_rules")
        .select("*")
        .eq("offer_id", offerId)
        .order("profile_type");
      return data || [];
    },
    enabled: !!offerId,
  });

  useEffect(() => {
    if (existingRules && existingRules.length > 0) {
      setRules(existingRules.map((r: any) => ({
        id: r.id,
        profile_type: r.profile_type,
        country_code: r.country_code || "",
        custom_price_excl_vat: r.custom_price_excl_vat ? String(r.custom_price_excl_vat) : "",
        discount_percentage: String(r.discount_percentage || 0),
        moq: String(r.moq || 1),
        mov_amount: String(r.mov_amount || 0),
      })));
      setExpanded(true);
    }
  }, [existingRules]);

  const addRule = () => setRules(prev => [...prev, { ...emptyRule }]);
  const updateRule = (idx: number, key: keyof ProfileRule, val: string) =>
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  const removeRule = (idx: number) => setRules(prev => prev.filter((_, i) => i !== idx));

  const saveRules = async () => {
    if (!offerId) { toast.info("Sauvegardez l'offre d'abord, puis modifiez-la pour ajouter les règles par profil."); return; }
    setSaving(true);
    try {
      await supabase.from("offer_profile_rules").delete().eq("offer_id", offerId);
      if (rules.length > 0) {
        const payload = rules.filter(r => r.profile_type).map(r => ({
          offer_id: offerId, profile_type: r.profile_type, country_code: r.country_code || null,
          custom_price_excl_vat: r.custom_price_excl_vat ? parseFloat(r.custom_price_excl_vat) : null,
          discount_percentage: parseFloat(r.discount_percentage) || 0,
          moq: parseInt(r.moq) || 1, mov_amount: parseFloat(r.mov_amount) || 0,
        }));
        if (payload.length > 0) {
          const { error } = await supabase.from("offer_profile_rules").insert(payload);
          if (error) throw error;
        }
      }
      qc.invalidateQueries({ queryKey: ["offer-profile-rules", offerId] });
      toast.success("Règles par profil sauvegardées");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const resolvedPrice = (rule: ProfileRule) => {
    if (rule.custom_price_excl_vat) return parseFloat(rule.custom_price_excl_vat);
    const disc = parseFloat(rule.discount_percentage) || 0;
    return basePrice > 0 ? Math.round(basePrice * (1 - disc / 100) * 100) / 100 : 0;
  };

  return (
    <div className="mt-4 border rounded-lg" style={{ borderColor: "#E2E8F0" }}>
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#F8FAFC] rounded-lg transition-colors">
        <Users size={14} style={{ color: "#1B5BDA" }} />
        <span className="text-[12px] font-medium" style={{ color: "#1D2530" }}>Prix & conditions par profil</span>
        {rules.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
            {rules.length} règle{rules.length > 1 ? "s" : ""}
          </span>
        )}
        <ChevronRight size={12} className={`ml-auto transition-transform ${expanded ? "rotate-90" : ""}`} style={{ color: "#8B95A5" }} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {rules.length === 0 && (
            <p className="text-[11px] py-2 text-center" style={{ color: "#8B95A5" }}>
              Aucune règle spécifique. Le prix de base s'applique à tous les profils.
            </p>
          )}
          {rules.map((rule, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_0.8fr_0.8fr_0.6fr_0.6fr_0.6fr_auto] gap-1.5 items-end p-2 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>Profil *</label>
                <select value={rule.profile_type} onChange={e => updateRule(idx, "profile_type", e.target.value)}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }}>
                  <option value="">Choisir…</option>
                  {PROFILE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>Pays</label>
                <select value={rule.country_code} onChange={e => updateRule(idx, "country_code", e.target.value)}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }}>
                  <option value="">Tous</option>
                  {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>Prix fixe HT</label>
                <input type="number" step="0.01" min="0" value={rule.custom_price_excl_vat}
                  onChange={e => updateRule(idx, "custom_price_excl_vat", e.target.value)}
                  placeholder={basePrice ? `${basePrice.toFixed(2)}` : "—"}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>Remise %</label>
                <input type="number" step="0.5" min="0" max="100" value={rule.discount_percentage}
                  onChange={e => updateRule(idx, "discount_percentage", e.target.value)}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>MOQ</label>
                <input type="number" min="1" value={rule.moq} onChange={e => updateRule(idx, "moq", e.target.value)}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>MOV €</label>
                <input type="number" step="1" min="0" value={rule.mov_amount}
                  onChange={e => updateRule(idx, "mov_amount", e.target.value)}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white" style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div className="flex items-center gap-1">
                {basePrice > 0 && (
                  <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: "#059669" }}>→{resolvedPrice(rule).toFixed(2)}€</span>
                )}
                <button type="button" onClick={() => removeRule(idx)} className="p-0.5 hover:bg-[#FEF2F2] rounded">
                  <Trash2 size={12} style={{ color: "#EF4343" }} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={addRule}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-[#EFF6FF] transition-colors"
              style={{ color: "#1B5BDA" }}>
              <Plus size={12} /> Ajouter un profil
            </button>
            {rules.length > 0 && offerId && (
              <button type="button" onClick={saveRules} disabled={saving}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-[#EFF6FF] transition-colors"
                style={{ color: "#059669" }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : null} Sauvegarder les règles
              </button>
            )}
            {!offerId && rules.length > 0 && (
              <span className="text-[10px]" style={{ color: "#F59E0B" }}>⚠ Créez l'offre d'abord, puis modifiez-la pour sauvegarder les règles</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function VendorOffers() {
  const { data: vendor } = useCurrentVendor();
  const { data: offers = [], isLoading } = useVendorOffers(vendor?.id);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFile, importing } = useOfferImport(vendor?.id);

  // Fetch all profile rules for export
  const { data: allProfileRules = [] } = useQuery({
    queryKey: ["all-offer-profile-rules", vendor?.id],
    queryFn: async () => {
      const offerIds = offers.map((o: any) => o.id);
      if (offerIds.length === 0) return [];
      const { data } = await supabase
        .from("offer_profile_rules")
        .select("*")
        .in("offer_id", offerIds);
      return data || [];
    },
    enabled: !!vendor?.id && offers.length > 0,
  });

  // Fetch all price tiers for export
  const { data: allPriceTiers = [] } = useQuery({
    queryKey: ["all-offer-price-tiers", vendor?.id],
    queryFn: async () => {
      const offerIds = offers.map((o: any) => o.id);
      if (offerIds.length === 0) return [];
      const { data } = await supabase
        .from("offer_price_tiers")
        .select("*")
        .in("offer_id", offerIds)
        .order("tier_index", { ascending: true });
      return data || [];
    },
    enabled: !!vendor?.id && offers.length > 0,
  });

  const profileRulesMap = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of allProfileRules) {
      const arr = m.get(r.offer_id) || [];
      arr.push(r);
      m.set(r.offer_id, arr);
    }
    return m;
  }, [allProfileRules]);

  const priceTiersMap = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of allPriceTiers) {
      const arr = m.get(t.offer_id) || [];
      arr.push(t);
      m.set(t.offer_id, arr);
    }
    return m;
  }, [allPriceTiers]);

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
      mov_amount: String(offer.mov_amount || 0),
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
        mov_amount: parseFloat(form.mov_amount) || 0, mov_currency: "EUR",
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
            <button onClick={() => exportOffers(offers, profileRulesMap, priceTiersMap)}
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
              <label className="text-[11px] block mb-1" style={{ color: "#8B95A5" }}>MOV (€ min. commande)</label>
              <input type="number" step="1" min="0" className="w-full px-3 py-2 text-[13px] border rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                style={{ borderColor: "#E2E8F0" }} value={form.mov_amount} onChange={e => setForm(p => ({ ...p, mov_amount: e.target.value }))} />
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
              {parseFloat(form.mov_amount) > 0 && <span className="ml-3">MOV : <strong style={{ color: "#1D2530" }}>{parseFloat(form.mov_amount).toFixed(0)} €</strong></span>}
            </div>
          )}

          {/* ─── Competitive Intelligence ─── */}
          {form.product_id && vendor && (
            <CompetitiveIntel productId={form.product_id} currentPrice={parseFloat(form.price_excl_vat) || 0} vendorId={vendor.id} />
          )}

          {/* ─── Price Tiers ─── */}
          <PriceTiersEditor offerId={editingId} basePrice={parseFloat(form.price_excl_vat) || 0} vatRate={parseFloat(form.vat_rate) || 21} />

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
