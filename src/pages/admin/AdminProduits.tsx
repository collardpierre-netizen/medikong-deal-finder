import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { useOffers as useOffersDirectAdmin, useBrands, useManufacturers, useProductCount, useBrandCount, useActiveOfferCount } from "@/hooks/useAdminData";
import { ProductFormDialog } from "@/components/admin/ProductFormDialog";
import { exportProducts, importProducts, downloadProductTemplate, type ImportProgress } from "@/lib/xlsx-utils";
import { toast } from "sonner";
import { Package, Tag, ShoppingCart, Search, Download, Upload, Plus, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";

const PER_PAGE = 50;

function useAdminPaginatedProducts(page: number, search: string, brandFilter: string, manufacturerFilter: string) {
  return useQuery({
    queryKey: ["admin-products-paginated", page, search, brandFilter, manufacturerFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, slug, gtin, cnk_code, brand_name, brand_id, manufacturer_id, image_url, image_urls, offer_count, total_stock, best_price_excl_vat, is_active, source, created_at", { count: "exact" })
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

  const { data: brands = [] } = useBrands();
  const { data: manufacturers = [] } = useManufacturers();
  const { data: totalProductCount = 0 } = useProductCount();
  const { data: totalBrandCount = 0 } = useBrandCount();
  const { data: totalActiveOfferCount = 0 } = useActiveOfferCount();
  const { data: offers = [], isLoading: loadingOffers } = useOffersDirectAdmin();

  const { data: pageData, isLoading: loadingProducts } = useAdminPaginatedProducts(page, debouncedSearch, brandFilter, manufacturerFilter);
  const products = pageData?.products || [];
  const totalFiltered = pageData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  const handleFilterChange = useCallback((type: "brand" | "manufacturer", value: string) => {
    if (type === "brand") setBrandFilter(value);
    else setManufacturerFilter(value);
    setPage(1);
  }, []);

  const tabs = [
    { key: "catalog" as const, label: "Catalogue master", count: totalProductCount.toLocaleString("fr-BE") },
    { key: "offers" as const, label: "Offres vendeurs", count: String(offers.length) },
  ];

  const filteredOffers = offers.filter(
    (o) =>
      ((o.products as any)?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      ((o.vendors as any)?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: { line: number; name: string; code: string; message: string }[]; brandsCreated?: number; manufacturersCreated?: number; totalRows: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (file: File) => {
    setImporting(true);
    toast.info("Import en cours, veuillez patienter...");
    try {
      const result = await importProducts(file);
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["admin-products-paginated"] });
      qc.invalidateQueries({ queryKey: ["admin-products-count"] });
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      qc.invalidateQueries({ queryKey: ["admin-manufacturers"] });
    } catch (e: any) {
      setImportResult({ created: 0, updated: 0, skipped: 0, errors: [{ line: 0, name: "—", code: "EXCEPTION", message: e.message || "Erreur inconnue" }], totalRows: 0 });
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
            <Button variant="outline" size="sm" onClick={() => downloadProductTemplate()} title="Télécharger le template d'import"><FileSpreadsheet size={14} className="mr-1" />Template</Button>
            <Button variant="outline" size="sm" onClick={() => exportProducts()}><Download size={14} className="mr-1" />Export XLSX</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-1" />Import XLSX</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
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

      {/* Search + Filters */}
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
                    {["", "Produit", "CNK", "EAN", "Offres", "Stock", "Meilleur prix", "Statut", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const imgUrl = (p.image_urls as string[] | null)?.[0] || (p as any).image_url || null;
                    return (
                    <tr key={p.id} className="cursor-pointer transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <td className="px-4 py-3 w-12">
                        {imgUrl ? (
                          <img src={imgUrl} alt={p.name} className="w-9 h-9 rounded object-contain bg-gray-50 border" style={{ borderColor: "#E2E8F0" }} referrerPolicy="no-referrer" onError={(e) => { const el = e.target as HTMLImageElement; el.classList.add("hidden"); el.nextElementSibling && (el.nextElementSibling as HTMLElement).classList.remove("hidden"); }} />
                        ) : null}
                        <div className={`w-9 h-9 rounded bg-gray-50 border flex items-center justify-center ${imgUrl ? "hidden" : ""}`} style={{ borderColor: "#E2E8F0" }}>
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
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          {loadingOffers ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  {["Produit", "Vendeur", "Prix HT", "Stock", "MOQ", "Délai", "Statut"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{(o.products as any)?.name || "—"}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "#1B5BDA" }}>{(o.vendors as any)?.company_name || (o.vendors as any)?.name || "—"}</td>
                    <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{Number(o.price_excl_vat).toFixed(2)}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.stock_quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.moq || 1}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.delivery_days}j</td>
                    <td className="px-4 py-3"><StatusBadge status={o.is_active ? "active" : "inactive"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ProductFormDialog open={productDialogOpen} onOpenChange={setProductDialogOpen} product={editProduct} brands={brands} manufacturers={manufacturers} />

      {/* Import result dialog */}
      <Dialog open={importResult !== null} onOpenChange={(open) => { if (!open) setImportResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {importResult?.errors.length === 0
                ? <><span className="text-green-600">✅</span> Import réussi</>
                : importResult?.created === 0 && importResult?.updated === 0
                  ? <><span className="text-red-600">❌</span> Échec de l'import</>
                  : <><span className="text-amber-500">⚠️</span> Import terminé avec alertes</>
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{importResult?.totalRows || 0}</p>
                <p className="text-[11px] text-muted-foreground">Lignes lues</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{importResult?.created || 0}</p>
                <p className="text-[11px] text-green-600">Créés</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{importResult?.updated || 0}</p>
                <p className="text-[11px] text-blue-600">Mis à jour</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{importResult?.skipped || 0}</p>
                <p className="text-[11px] text-red-600">Ignorés</p>
              </div>
            </div>

            {/* Auto-created entities */}
            {((importResult?.brandsCreated || 0) > 0 || (importResult?.manufacturersCreated || 0) > 0) && (
              <div className="bg-primary/5 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-primary">Entités auto-créées</p>
                {(importResult?.brandsCreated || 0) > 0 && <p className="text-sm">🏷️ <strong>{importResult!.brandsCreated}</strong> marque(s)</p>}
                {(importResult?.manufacturersCreated || 0) > 0 && <p className="text-sm">🏭 <strong>{importResult!.manufacturersCreated}</strong> fabricant(s)</p>}
              </div>
            )}

            {/* Errors table */}
            {(importResult?.errors?.length || 0) > 0 && (
              <div>
                <p className="text-sm font-semibold text-destructive mb-2">{importResult!.errors.length} erreur(s) détectée(s)</p>
                <div className="max-h-[220px] overflow-y-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-muted-foreground">Ligne</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground">Produit</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground">Code</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult!.errors.slice(0, 100).map((err, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">{err.line}</td>
                          <td className="px-3 py-1.5 font-medium truncate max-w-[120px]">{err.name}</td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              err.code === "DUPLICATE" ? "bg-amber-100 text-amber-700"
                              : err.code === "MISSING_NAME" ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                            }`}>{err.code}</span>
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px]">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importResult!.errors.length > 100 && (
                    <p className="text-center text-xs text-muted-foreground py-2">... et {importResult!.errors.length - 100} autres</p>
                  )}
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => setImportResult(null)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProduits;
