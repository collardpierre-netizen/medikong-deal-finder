import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { useBrands, useManufacturers, useProductCount, useBrandCount, useActiveOfferCount, useVendors } from "@/hooks/useAdminData";
import { ProductFormDialog } from "@/components/admin/ProductFormDialog";
import { exportProducts, exportOffers, importProducts, downloadProductTemplate, type ImportProgress } from "@/lib/xlsx-utils";
import { getProductImageSrc } from "@/lib/image-utils";
import { toast } from "sonner";
import { useImportJobs } from "@/contexts/ImportContext";
import { Package, Tag, ShoppingCart, Search, Download, Upload, Plus, FileSpreadsheet, ChevronLeft, ChevronRight, X, Loader2, ImageIcon, EyeOff, Eye, Pencil } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const PER_PAGE = 50;
const OFFERS_PER_PAGE = 50;

type OfferNumericFilters = {
  priceMin?: number; priceMax?: number;
  stockMin?: number; stockMax?: number;
  moqMin?: number; moqMax?: number;
  delayMax?: number;
};

function useAdminPaginatedOffers(
  page: number, search: string,
  vendorFilter: string, brandFilter: string, countryFilter: string, statusFilter: string,
  numeric: OfferNumericFilters,
) {
  return useQuery({
    queryKey: ["admin-offers-paginated", page, search, vendorFilter, brandFilter, countryFilter, statusFilter, numeric],
    queryFn: async () => {
      const hasRestrictiveFilter =
        !!search ||
        vendorFilter !== "all" ||
        brandFilter !== "all" ||
        countryFilter !== "all" ||
        Object.values(numeric).some(v => v !== undefined && v !== null && !Number.isNaN(v));

      const countMode: "exact" | "estimated" = hasRestrictiveFilter ? "exact" : "estimated";

      let query = supabase
        .from("offers")
        .select("*, vendors(name, company_name), products(name, brand_name, gtin, cnk_code)", { count: countMode });

      if (statusFilter === "active") query = query.eq("is_active", true).eq("admin_hidden", false);
      else if (statusFilter === "inactive") query = query.eq("is_active", false);
      else if (statusFilter === "hidden") query = query.eq("admin_hidden", true);

      if (vendorFilter !== "all") query = query.eq("vendor_id", vendorFilter);
      if (countryFilter !== "all") query = query.eq("country_code", countryFilter);

      // Numeric filters (server-side)
      if (numeric.priceMin !== undefined) query = query.gte("price_excl_vat", numeric.priceMin);
      if (numeric.priceMax !== undefined) query = query.lte("price_excl_vat", numeric.priceMax);
      if (numeric.stockMin !== undefined) query = query.gte("stock_quantity", numeric.stockMin);
      if (numeric.stockMax !== undefined) query = query.lte("stock_quantity", numeric.stockMax);
      if (numeric.moqMin !== undefined) query = query.gte("moq", numeric.moqMin);
      if (numeric.moqMax !== undefined) query = query.lte("moq", numeric.moqMax);
      if (numeric.delayMax !== undefined) query = query.lte("delivery_days", numeric.delayMax);

      if (brandFilter !== "all") {
        const { data: productIds } = await supabase.from("products").select("id").eq("brand_id", brandFilter);
        if (productIds && productIds.length > 0) {
          query = query.in("product_id", productIds.map(p => p.id));
        } else {
          return { offers: [], total: 0 };
        }
      }

      if (search) {
        const { data: matchProducts } = await supabase
          .from("products")
          .select("id")
          .or(`name.ilike.%${search}%,gtin.ilike.%${search}%,cnk_code.ilike.%${search}%`)
          .limit(500);
        if (matchProducts && matchProducts.length > 0) {
          query = query.in("product_id", matchProducts.map(p => p.id));
        } else {
          return { offers: [], total: 0 };
        }
      }

      query = query.order("updated_at", { ascending: false });
      const offset = (page - 1) * OFFERS_PER_PAGE;
      query = query.range(offset, offset + OFFERS_PER_PAGE - 1);

      const { data, error, count } = await query;
      if (error) {
        console.error("[admin-offers] query failed:", error);
        throw error;
      }
      return { offers: data || [], total: count || 0 };
    },
    staleTime: 30_000,
  });
}


function useAdminPaginatedProducts(page: number, search: string, brandFilter: string, manufacturerFilter: string) {
  return useQuery({
    queryKey: ["admin-products-paginated", page, search, brandFilter, manufacturerFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, slug, gtin, cnk_code, sku, brand_name, brand_id, manufacturer_id, category_name, description, short_description, unit_quantity, image_url, image_urls, offer_count, total_stock, best_price_excl_vat, is_active, source, created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      if (search.trim()) {
        const pattern = `%${search.trim()}%`;
        query = query.or(`name.ilike.${pattern},gtin.ilike.${pattern},cnk_code.ilike.${pattern},brand_name.ilike.${pattern}`);
      }

      if (brandFilter && brandFilter !== "all") {
        query = query.eq("brand_id", brandFilter);
      }

      if (manufacturerFilter && manufacturerFilter !== "all") {
        query = query.eq("manufacturer_id", manufacturerFilter);
      }

      const offset = (page - 1) * PER_PAGE;
      query = query.range(offset, offset + PER_PAGE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { products: data || [], total: count || 0 };
    },
    staleTime: 30_000,
  });
}

const AdminProduits = () => {
  const { t } = useI18n();
  const { addJob, updateJob, finishJob } = useImportJobs();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"catalog" | "offers">("catalog");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [brandFilter, setBrandFilter] = useState("all");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Offers tab state
  const [offersPage, setOffersPage] = useState(1);
  const [offersSearch, setOffersSearch] = useState("");
  const [debouncedOffersSearch, setDebouncedOffersSearch] = useState("");
  const [offersVendorFilter, setOffersVendorFilter] = useState("all");
  const [offersBrandFilter, setOffersBrandFilter] = useState("all");
  const [offersCountryFilter, setOffersCountryFilter] = useState("all");
  const [offersStatusFilter, setOffersStatusFilter] = useState("all");
  const offersDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [offersPriceMin, setOffersPriceMin] = useState<string>("");
  const [offersPriceMax, setOffersPriceMax] = useState<string>("");
  const [offersStockMin, setOffersStockMin] = useState<string>("");
  const [offersStockMax, setOffersStockMax] = useState<string>("");
  const [offersMoqMin, setOffersMoqMin] = useState<string>("");
  const [offersMoqMax, setOffersMoqMax] = useState<string>("");
  const [offersDelayMax, setOffersDelayMax] = useState<string>("");
  // Debounce numeric filters: une seule requête après 350ms d'inactivité
  const [debouncedNumeric, setDebouncedNumeric] = useState<OfferNumericFilters>({});
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedNumeric({
        priceMin: offersPriceMin ? parseFloat(offersPriceMin) : undefined,
        priceMax: offersPriceMax ? parseFloat(offersPriceMax) : undefined,
        stockMin: offersStockMin ? parseInt(offersStockMin, 10) : undefined,
        stockMax: offersStockMax ? parseInt(offersStockMax, 10) : undefined,
        moqMin: offersMoqMin ? parseInt(offersMoqMin, 10) : undefined,
        moqMax: offersMoqMax ? parseInt(offersMoqMax, 10) : undefined,
        delayMax: offersDelayMax ? parseInt(offersDelayMax, 10) : undefined,
      });
      setOffersPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [offersPriceMin, offersPriceMax, offersStockMin, offersStockMax, offersMoqMin, offersMoqMax, offersDelayMax]);
  const numericFilters = debouncedNumeric;
  const hasNumericFilter = Object.values(numericFilters).some(v => v !== undefined && !Number.isNaN(v));
  const resetNumericFilters = () => {
    setOffersPriceMin(""); setOffersPriceMax("");
    setOffersStockMin(""); setOffersStockMax("");
    setOffersMoqMin(""); setOffersMoqMax("");
    setOffersDelayMax("");
  };
  const [busyHide, setBusyHide] = useState<string | null>(null);
  const qcMain = useQueryClient();

  const toggleHideOffer = async (offer: any) => {
    const next = !offer.admin_hidden;
    let reason: string | null = offer.admin_hidden_reason ?? null;
    if (next) {
      reason = window.prompt("Raison du masquage (optionnel) :", "") ?? "";
    } else {
      const productName = offer.products?.name || "cette offre";
      const ok = window.confirm(
        `Réactiver « ${productName} » ?\n\nL'offre redeviendra visible sur le frontend acheteur (is_active = true, admin_hidden = false).`
      );
      if (!ok) return;
    }
    setBusyHide(offer.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("offers").update({
      admin_hidden: next,
      admin_hidden_reason: next ? (reason || null) : null,
      admin_hidden_at: next ? new Date().toISOString() : null,
      admin_hidden_by: next ? user?.id ?? null : null,
      ...(next ? {} : { is_active: true }),
    } as any).eq("id", offer.id);
    setBusyHide(null);
    if (error) { toast.error("Échec", { description: error.message }); return; }
    toast.success(next ? "Offre masquée" : "Offre ré-affichée");
    qcMain.invalidateQueries({ queryKey: ["admin-offers-paginated"] });
  };

  const editHideReason = async (offer: any) => {
    const current = offer.admin_hidden_reason ?? "";
    const input = window.prompt(
      `Raison interne pour cette offre${offer.admin_hidden ? " (masquée)" : ""} :\n\nLaisser vide pour effacer la raison.`,
      current
    );
    if (input === null) return; // cancelled
    const newReason = input.trim() || null;
    if (newReason === (current || null)) return; // no change
    setBusyHide(offer.id);
    const { error } = await supabase.from("offers").update({
      admin_hidden_reason: newReason,
    } as any).eq("id", offer.id);
    setBusyHide(null);
    if (error) { toast.error("Échec", { description: error.message }); return; }
    toast.success(newReason ? "Raison mise à jour" : "Raison effacée");
    qcMain.invalidateQueries({ queryKey: ["admin-offers-paginated"] });
  };

  const { data: brands = [] } = useBrands();
  const { data: manufacturers = [] } = useManufacturers();
  const { data: vendors = [] } = useVendors();
  const { data: totalProductCount = 0 } = useProductCount();
  const { data: totalBrandCount = 0 } = useBrandCount();
  const { data: totalActiveOfferCount = 0 } = useActiveOfferCount();

  const { data: pageData, isLoading: loadingProducts } = useAdminPaginatedProducts(page, debouncedSearch, brandFilter, manufacturerFilter);
  const products = pageData?.products || [];
  const totalFiltered = pageData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));

  const { data: offersData, isLoading: loadingOffers } = useAdminPaginatedOffers(offersPage, debouncedOffersSearch, offersVendorFilter, offersBrandFilter, offersCountryFilter, offersStatusFilter, numericFilters);
  const offersItems = offersData?.offers || [];
  const totalOffersFiltered = offersData?.total || 0;
  const totalOffersPages = Math.max(1, Math.ceil(totalOffersFiltered / OFFERS_PER_PAGE));

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  const handleOffersSearchChange = useCallback((value: string) => {
    setOffersSearch(value);
    clearTimeout(offersDebounceRef.current);
    offersDebounceRef.current = setTimeout(() => {
      setDebouncedOffersSearch(value);
      setOffersPage(1);
    }, 400);
  }, []);

  const handleFilterChange = useCallback((type: "brand" | "manufacturer", value: string) => {
    if (type === "brand") setBrandFilter(value);
    else setManufacturerFilter(value);
    setPage(1);
  }, []);

  const tabs = [
    { key: "catalog" as const, label: "Catalogue master", count: totalProductCount.toLocaleString("fr-BE") },
    { key: "offers" as const, label: "Offres vendeurs", count: totalActiveOfferCount.toLocaleString("fr-BE") },
  ];

  const sortedVendors = [...vendors].sort((a, b) => (a.company_name || a.name).localeCompare(b.company_name || b.name));

  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: { line: number; name: string; code: string; message: string }[]; brandsCreated?: number; manufacturersCreated?: number; categoriesCreated?: number; totalRows: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [migratingImages, setMigratingImages] = useState(false);

  const handleMigrateImages = async () => {
    if (!confirm("Migrer les images externes vers le stockage MediKong ? Cela peut prendre quelques minutes.")) return;
    setMigratingImages(true);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-product-images", {
        body: { limit: 100 },
      });
      if (error) throw error;
      const result = data as { migrated: number; failed: number; total_candidates: number; errors?: { product: string; error: string }[] };
      toast.success(`${result.migrated} produits migrés, ${result.failed} erreurs sur ${result.total_candidates} candidats`);
      if (result.errors && result.errors.length > 0) {
        console.warn("Migration errors:", result.errors);
      }
      qc.invalidateQueries({ queryKey: ["admin-products-paginated"] });
    } catch (e: any) {
      toast.error("Erreur migration : " + (e.message || "inconnue"));
    } finally {
      setMigratingImages(false);
    }
  };

  const handleImport = async (file: File) => {
    const jobId = "import-products-" + Date.now();
    addJob(jobId, "Import produits");
    setImporting(true);
    setImportResult(null);
    setImportPanelOpen(true);
    setImportProgress({ phase: "reading", current: 0, total: 0, created: 0, updated: 0, skipped: 0, errors: [], brandsCreated: 0, manufacturersCreated: 0, categoriesCreated: 0 });
    try {
      const result = await importProducts(file, (p) => {
        setImportProgress({ ...p });
        updateJob(jobId, { phase: p.phase === "reading" ? "Lecture…" : p.phase === "products" ? `Produit ${p.current}/${p.total}` : p.phase, current: p.current, total: p.total });
      });
      setImportResult(result);
      setImportProgress(prev => prev ? { ...prev, phase: "done" } : null);
      finishJob(jobId, { success: result.created + result.updated, errors: result.errors.map(e => e.message) });
      qc.invalidateQueries({ queryKey: ["admin-products-paginated"] });
      qc.invalidateQueries({ queryKey: ["admin-products-count"] });
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      qc.invalidateQueries({ queryKey: ["admin-manufacturers"] });
    } catch (e: any) {
      setImportResult({ created: 0, updated: 0, skipped: 0, errors: [{ line: 0, name: "—", code: "EXCEPTION", message: e.message || "Erreur inconnue" }], totalRows: 0 });
      finishJob(jobId, { success: 0, errors: [e.message || "Erreur inconnue"] });
    } finally {
      setImporting(false);
    }
  };

  // Sort brands/manufacturers alphabetically for selects
  const sortedBrands = [...brands].sort((a, b) => a.name.localeCompare(b.name));
  const sortedManufacturers = [...manufacturers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <AdminTopBar title={t("products")} subtitle="Catalogue PIM centralisé"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild title="Mapping source → marque/catégorie">
              <a href="/admin/produits/mapping">🔗 Mapping</a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadProductTemplate()} title="Télécharger le template d'import"><FileSpreadsheet size={14} className="mr-1" />Template</Button>
            <Button variant="outline" size="sm" onClick={() => activeTab === "offers" ? exportOffers() : exportProducts()}><Download size={14} className="mr-1" />{activeTab === "offers" ? "Export Offres" : "Export XLSX"}</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-1" />Import XLSX</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={handleMigrateImages} disabled={migratingImages}>
              {migratingImages ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ImageIcon size={14} className="mr-1" />}
              {migratingImages ? "Migration..." : "Migrer images"}
            </Button>
            <Button size="sm" onClick={() => { setEditProduct(null); setProductDialogOpen(true); }} className="bg-[#1E293B] hover:bg-[#1E293B]/90"><Plus size={14} className="mr-1" />Produit</Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <KpiCard icon={Package} label="Produits catalogue" value={totalProductCount.toLocaleString("fr-BE")} evolution={{ value: 4.2, label: "vs mois dernier" }} />
        <KpiCard icon={Tag} label="Marques" value={totalBrandCount.toLocaleString("fr-BE")} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={ShoppingCart} label="Offres actives" value={totalActiveOfferCount.toLocaleString("fr-BE")} evolution={{ value: 8.7, label: "vs mois dernier" }} iconColor="#059669" iconBg="#F0FDF4" />
      </div>

      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: activeTab === tab.key ? "#fff" : "#8B95A5" }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Filters — Catalogue master uniquement */}
      {activeTab === "catalog" && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <Search size={14} style={{ color: "#8B95A5" }} />
            <input type="text" placeholder="Rechercher par nom, CNK, EAN, marque..." value={search} onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
          </div>

          <Select value={brandFilter} onValueChange={(v) => handleFilterChange("brand", v)}>
            <SelectTrigger className="w-[200px] h-9 text-[13px]">
              <SelectValue placeholder="Toutes les marques" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">Toutes les marques</SelectItem>
              {sortedBrands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={manufacturerFilter} onValueChange={(v) => handleFilterChange("manufacturer", v)}>
            <SelectTrigger className="w-[200px] h-9 text-[13px]">
              <SelectValue placeholder="Tous les fabricants" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">Tous les fabricants</SelectItem>
              {sortedManufacturers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(brandFilter !== "all" || manufacturerFilter !== "all" || debouncedSearch) && (
            <Button variant="ghost" size="sm" className="text-[12px] h-9" onClick={() => {
              setBrandFilter("all");
              setManufacturerFilter("all");
              setSearch("");
              setDebouncedSearch("");
              setPage(1);
            }}>
              Réinitialiser
            </Button>
          )}
        </div>
      )}

      {activeTab === "catalog" && (
        <>
          {/* Results count + pagination top */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px]" style={{ color: "#8B95A5" }}>
              {totalFiltered.toLocaleString("fr-BE")} produit{totalFiltered > 1 ? "s" : ""} trouvé{totalFiltered > 1 ? "s" : ""}
              {debouncedSearch || brandFilter !== "all" || manufacturerFilter !== "all" ? " (filtré)" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
                {page} / {totalPages.toLocaleString("fr-BE")}
              </span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>

          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            {loadingProducts ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {[
                      { key: "thumb", label: "" },
                      { key: "product", label: "Produit" },
                      { key: "cnk", label: "CNK" },
                      { key: "ean", label: "EAN" },
                      { key: "offers", label: "Offres" },
                      { key: "stock", label: "Stock" },
                      { key: "price", label: "Meilleur prix" },
                      { key: "status", label: "Statut" },
                      { key: "actions", label: "" },
                    ].map((h) => (
                      <th key={h.key} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const rawImgUrl = (p.image_urls as string[] | null)?.[0] || (p as any).image_url || null;
                    const proxiedUrl = rawImgUrl ? getProductImageSrc(rawImgUrl) : null;

                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: "1px solid #F1F5F9" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <td className="px-4 py-3 w-12">
                          {proxiedUrl ? (
                            <img
                              src={proxiedUrl}
                              alt={p.name}
                              className="w-9 h-9 rounded object-contain bg-gray-50 border"
                              style={{ borderColor: "#E2E8F0" }}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                if (rawImgUrl && el.dataset.fallbackTried !== "true") {
                                  el.dataset.fallbackTried = "true";
                                  el.src = rawImgUrl;
                                  return;
                                }
                                el.classList.add("hidden");
                                el.nextElementSibling && (el.nextElementSibling as HTMLElement).classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-9 h-9 rounded bg-gray-50 border flex items-center justify-center ${proxiedUrl ? "hidden" : ""}`}
                            style={{ borderColor: "#E2E8F0" }}
                          >
                            <Package size={14} className="text-gray-300" />
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={() => navigate(`/admin/produits/${p.id}`)}>
                          <span className="text-[13px] font-semibold block" style={{ color: "#1D2530" }}>{p.name}</span>
                          <span className="text-[11px]" style={{ color: "#8B95A5" }}>{p.brand_name || p.source}</span>
                        </td>
                        <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#1B5BDA" }}>{p.cnk_code || "—"}</td>
                        <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{p.gtin || "—"}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{p.offer_count}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{p.total_stock}</td>
                        <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#059669" }}>{p.best_price_excl_vat ? `€${Number(p.best_price_excl_vat).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.is_active ? "active" : "inactive"} /></td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={() => { setEditProduct(p); setProductDialogOpen(true); }}>Éditer</Button>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun produit trouvé</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination bottom */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)} className="text-[12px] h-8">
                Début
              </Button>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0">
                <ChevronLeft size={14} />
              </Button>
              <span className="text-[13px] font-medium px-3" style={{ color: "#1D2530" }}>
                Page {page} sur {totalPages.toLocaleString("fr-BE")}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0">
                <ChevronRight size={14} />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="text-[12px] h-8">
                Fin
              </Button>
            </div>
          )}
        </>
      )}

      {activeTab === "offers" && (
        <>
          {/* Offers filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-sm" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <Search size={14} style={{ color: "#8B95A5" }} />
              <input type="text" placeholder="Rechercher par produit, EAN, CNK..." value={offersSearch} onChange={(e) => handleOffersSearchChange(e.target.value)}
                className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
            </div>
            <Select value={offersVendorFilter} onValueChange={(v) => { setOffersVendorFilter(v); setOffersPage(1); }}>
              <SelectTrigger className="w-[180px] h-9 text-[13px]"><SelectValue placeholder="Tous les vendeurs" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">Tous les vendeurs</SelectItem>
                {sortedVendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.company_name || v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={offersBrandFilter} onValueChange={(v) => { setOffersBrandFilter(v); setOffersPage(1); }}>
              <SelectTrigger className="w-[180px] h-9 text-[13px]"><SelectValue placeholder="Toutes les marques" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">Toutes les marques</SelectItem>
                {sortedBrands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={offersCountryFilter} onValueChange={(v) => { setOffersCountryFilter(v); setOffersPage(1); }}>
              <SelectTrigger className="w-[120px] h-9 text-[13px]"><SelectValue placeholder="Pays" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous pays</SelectItem>
                <SelectItem value="BE">🇧🇪 BE</SelectItem>
                <SelectItem value="FR">🇫🇷 FR</SelectItem>
                <SelectItem value="NL">🇳🇱 NL</SelectItem>
                <SelectItem value="LU">🇱🇺 LU</SelectItem>
                <SelectItem value="DE">🇩🇪 DE</SelectItem>
              </SelectContent>
            </Select>
            <Select value={offersStatusFilter} onValueChange={(v) => { setOffersStatusFilter(v); setOffersPage(1); }}>
              <SelectTrigger className="w-[130px] h-9 text-[13px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="active">Actives (visibles)</SelectItem>
                <SelectItem value="inactive">Inactives</SelectItem>
                <SelectItem value="hidden">Masquées (admin)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={() => { setOffersStatusFilter(offersStatusFilter === "hidden" ? "all" : "hidden"); setOffersPage(1); }}
              title={offersStatusFilter === "hidden" ? "Cliquer pour retirer le filtre" : "Afficher uniquement les offres masquées du frontend"}
              className="h-9 text-[12px] gap-1 border"
              style={offersStatusFilter === "hidden"
                ? { backgroundColor: "#DC2626", color: "white", borderColor: "#B91C1C" }
                : { backgroundColor: "white", color: "#991B1B", borderColor: "#FCA5A5" }}
            >
              <EyeOff size={13} /> Masquées frontend
            </Button>
            {(offersVendorFilter !== "all" || offersBrandFilter !== "all" || offersCountryFilter !== "all" || offersStatusFilter !== "all" || debouncedOffersSearch ||
              offersPriceMin || offersPriceMax || offersStockMin || offersStockMax || offersMoqMin || offersMoqMax || offersDelayMax) && (
              <Button variant="ghost" size="sm" className="text-[12px] h-9" onClick={() => {
                setOffersVendorFilter("all"); setOffersBrandFilter("all"); setOffersCountryFilter("all"); setOffersStatusFilter("all");
                setOffersSearch(""); setDebouncedOffersSearch(""); setOffersPage(1);
                setOffersPriceMin(""); setOffersPriceMax("");
                setOffersStockMin(""); setOffersStockMax("");
                setOffersMoqMin(""); setOffersMoqMax(""); setOffersDelayMax("");
              }}>Réinitialiser</Button>
            )}
          </div>

          {/* Numeric filters row */}
          <div className="mb-4 p-3 rounded-[10px] flex items-end gap-3 flex-wrap" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#616B7C" }}>Prix HT (€)</label>
              <div className="flex gap-1.5">
                <input type="number" step="0.01" placeholder="min" value={offersPriceMin}
                  onChange={(e) => setOffersPriceMin(e.target.value)}
                  className="w-24 h-9 px-2 rounded border outline-none text-[13px] bg-white" style={{ borderColor: "#CBD5E1" }} />
                <input type="number" step="0.01" placeholder="max" value={offersPriceMax}
                  onChange={(e) => setOffersPriceMax(e.target.value)}
                  className="w-24 h-9 px-2 rounded border outline-none text-[13px] bg-white" style={{ borderColor: "#CBD5E1" }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#616B7C" }}>Stock</label>
              <div className="flex gap-1.5">
                <input type="number" placeholder="min" value={offersStockMin}
                  onChange={(e) => setOffersStockMin(e.target.value)}
                  className="w-24 h-9 px-2 rounded border outline-none text-[13px] bg-white" style={{ borderColor: "#CBD5E1" }} />
                <input type="number" placeholder="max" value={offersStockMax}
                  onChange={(e) => setOffersStockMax(e.target.value)}
                  className="w-24 h-9 px-2 rounded border outline-none text-[13px] bg-white" style={{ borderColor: "#CBD5E1" }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#616B7C" }}>MOQ</label>
              <div className="flex gap-1.5">
                <input type="number" placeholder="min" value={offersMoqMin}
                  onChange={(e) => setOffersMoqMin(e.target.value)}
                  className="w-24 h-9 px-2 rounded border outline-none text-[13px] bg-white" style={{ borderColor: "#CBD5E1" }} />
                <input type="number" placeholder="max" value={offersMoqMax}
                  onChange={(e) => setOffersMoqMax(e.target.value)}
                  className="w-24 h-9 px-2 rounded border outline-none text-[13px] bg-white" style={{ borderColor: "#CBD5E1" }} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#616B7C" }}>Délai max (jours)</label>
              <input type="number" placeholder="ex: 7" value={offersDelayMax}
                onChange={(e) => setOffersDelayMax(e.target.value)}
                className="w-28 h-9 px-2 rounded border outline-none text-[13px] bg-white" style={{ borderColor: "#CBD5E1" }} />
            </div>
            {hasNumericFilter && (
              <Button variant="ghost" size="sm" onClick={resetNumericFilters} className="h-9 text-[12px]">
                Effacer filtres chiffrés
              </Button>
            )}
          </div>

          {/* Offers count + pagination */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px]" style={{ color: "#8B95A5" }}>
              {totalOffersFiltered.toLocaleString("fr-BE")} offre{totalOffersFiltered > 1 ? "s" : ""} trouvée{totalOffersFiltered > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={offersPage <= 1} onClick={() => setOffersPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
                {offersPage} / {totalOffersPages.toLocaleString("fr-BE")}
              </span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={offersPage >= totalOffersPages} onClick={() => setOffersPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>

          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            {loadingOffers ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["Produit", "EAN", "Vendeur", "Pays", "Prix HT", "Prix TTC", "Stock", "MOQ", "Délai", "Marge", "Statut", "Raison", "Action"].map((h) => (
                      <th key={h} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {offersItems.map((o: any) => (
                    <tr key={o.id}
                      title={o.admin_hidden ? `⚠ Masquée du frontend${o.admin_hidden_reason ? ` — ${o.admin_hidden_reason}` : ""}` : undefined}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        backgroundColor: o.admin_hidden ? "#FEF2F2" : (!o.is_active ? "#FFFBEB" : undefined),
                        borderLeft: o.admin_hidden ? "4px solid #DC2626" : (!o.is_active ? "4px solid #F59E0B" : "4px solid transparent"),
                      }}>
                      <td className="px-3 py-3">
                        <span className="text-[13px] font-medium block" style={{ color: o.admin_hidden ? "#991B1B" : "#1D2530", textDecoration: o.admin_hidden ? "line-through" : undefined }}>{o.products?.name || "—"}</span>
                        <span className="text-[10px]" style={{ color: "#8B95A5" }}>{o.products?.brand_name || ""}</span>
                      </td>
                      <td className="px-3 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{o.products?.gtin || "—"}</td>
                      <td className="px-3 py-3 text-[12px] font-medium" style={{ color: "#1B5BDA" }}>{o.vendors?.company_name || o.vendors?.name || "—"}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.country_code || "—"}</td>
                      <td className="px-3 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{Number(o.price_excl_vat).toFixed(2)}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>€{Number(o.price_incl_vat).toFixed(2)}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.stock_quantity.toLocaleString()}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.moq || 1}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.delivery_days}j</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: o.margin_amount && o.margin_amount > 0 ? "#059669" : "#616B7C" }}>
                        {o.margin_amount ? `€${Number(o.margin_amount).toFixed(2)}` : "—"}
                        {o.applied_margin_percentage ? <span className="text-[10px] ml-1">({o.applied_margin_percentage}%)</span> : null}
                      </td>
                      <td className="px-3 py-3">
                        {o.admin_hidden
                          ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border" style={{ backgroundColor: "#FEE2E2", color: "#991B1B", borderColor: "#FCA5A5" }}>
                              <EyeOff size={11} /> Masquée frontend
                            </span>
                          : !o.is_active
                            ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>Inactive</span>
                            : <StatusBadge status="active" />}
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        <button
                          type="button"
                          onClick={() => editHideReason(o)}
                          disabled={busyHide === o.id}
                          title={o.admin_hidden_reason ? `Raison : ${o.admin_hidden_reason}\n\nCliquer pour éditer` : "Aucune raison saisie — cliquer pour ajouter"}
                          className="group flex items-start gap-1 text-left w-full hover:bg-[#F1F5F9] rounded px-1 py-0.5 transition-colors"
                        >
                          {o.admin_hidden_reason ? (
                            <span className="text-[11px] leading-snug line-clamp-2" style={{ color: o.admin_hidden ? "#991B1B" : "#616B7C" }}>
                              {o.admin_hidden_reason}
                            </span>
                          ) : (
                            <span className="text-[11px] italic" style={{ color: "#CBD5E1" }}>—</span>
                          )}
                          <Pencil size={10} className="opacity-0 group-hover:opacity-60 mt-0.5 shrink-0" style={{ color: "#616B7C" }} />
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant={o.admin_hidden ? "default" : "ghost"}
                          disabled={busyHide === o.id}
                          onClick={() => toggleHideOffer(o)}
                          title={o.admin_hidden
                            ? `Masquée${o.admin_hidden_reason ? ` — ${o.admin_hidden_reason}` : ""}\nCliquer pour réactiver (visible frontend)`
                            : "Masquer cette offre du catalogue"}
                          className="h-7 px-2 text-[11px] gap-1"
                          style={o.admin_hidden ? { backgroundColor: "#16A34A", color: "white", borderColor: "#15803D" } : undefined}
                        >
                          {busyHide === o.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : o.admin_hidden ? <><Eye size={12} /> Réactiver</> : <><EyeOff size={12} /> Masquer</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {offersItems.length === 0 && (
                    <tr><td colSpan={13} className="px-4 py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune offre trouvée</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination bottom */}
          {totalOffersPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={offersPage <= 1} onClick={() => setOffersPage(1)} className="text-[12px] h-8">Début</Button>
              <Button variant="outline" size="sm" disabled={offersPage <= 1} onClick={() => setOffersPage(p => p - 1)} className="h-8 w-8 p-0"><ChevronLeft size={14} /></Button>
              <span className="text-[13px] font-medium px-3" style={{ color: "#1D2530" }}>Page {offersPage} sur {totalOffersPages.toLocaleString("fr-BE")}</span>
              <Button variant="outline" size="sm" disabled={offersPage >= totalOffersPages} onClick={() => setOffersPage(p => p + 1)} className="h-8 w-8 p-0"><ChevronRight size={14} /></Button>
              <Button variant="outline" size="sm" disabled={offersPage >= totalOffersPages} onClick={() => setOffersPage(totalOffersPages)} className="text-[12px] h-8">Fin</Button>
            </div>
          )}
        </>
      )}

      <ProductFormDialog open={productDialogOpen} onOpenChange={setProductDialogOpen} product={editProduct} brands={brands} manufacturers={manufacturers} />

    </div>
  );
};

export default AdminProduits;
