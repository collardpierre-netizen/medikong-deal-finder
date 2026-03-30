import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { useProducts as useAdminProducts, useOffers as useOffersDirectAdmin, useBrands } from "@/hooks/useAdminData";
import { ProductFormDialog } from "@/components/admin/ProductFormDialog";
import { exportProducts, importProducts } from "@/lib/xlsx-utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Tag, ShoppingCart, AlertTriangle, Search, Filter, Download, Upload, Plus, ImageOff } from "lucide-react";

const AdminProduits = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: products = [], isLoading: loadingProducts } = useAdminProducts();
  const { data: offers = [], isLoading: loadingOffers } = useOffersDirectAdmin();
  const { data: brands = [] } = useBrands();
  const [activeTab, setActiveTab] = useState<"catalog" | "offers">("catalog");
  const [search, setSearch] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeOffers = offers.filter(o => o.is_active).length;

  const tabs = [
    { key: "catalog" as const, label: "Catalogue master", count: String(products.length) },
    { key: "offers" as const, label: "Offres vendeurs", count: String(offers.length) },
  ];

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.cnk_code || "").includes(search) ||
      (p.gtin || "").includes(search)
  );

  const filteredOffers = offers.filter(
    (o) =>
      ((o.products as any)?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      ((o.vendors as any)?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleImport = async (file: File) => {
    toast.info("Import en cours...");
    try {
      const result = await importProducts(file);
      toast.success(`${result.created} produits importés`);
      if (result.errors.length > 0) toast.warning(`${result.errors.length} erreur(s): ${result.errors[0]}`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur import");
    }
  };

  return (
    <div>
      <AdminTopBar title={t("products")} subtitle="Catalogue PIM centralisé"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportProducts()}><Download size={14} className="mr-1" />Export XLSX</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-1" />Import XLSX</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
            <Button size="sm" onClick={() => { setEditProduct(null); setProductDialogOpen(true); }} className="bg-[#1E293B] hover:bg-[#1E293B]/90"><Plus size={14} className="mr-1" />Produit</Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <KpiCard icon={Package} label="Produits catalogue" value={String(products.length)} evolution={{ value: 4.2, label: "vs mois dernier" }} />
        <KpiCard icon={Tag} label="Marques" value={String(brands.length)} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={ShoppingCart} label="Offres actives" value={String(activeOffers)} evolution={{ value: 8.7, label: "vs mois dernier" }} iconColor="#059669" iconBg="#F0FDF4" />
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

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <Search size={14} style={{ color: "#8B95A5" }} />
          <input type="text" placeholder="Rechercher par nom, CNK, EAN..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
        </div>
      </div>

      {activeTab === "catalog" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          {loadingProducts ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  {["Produit", "CNK", "EAN", "Offres", "Stock", "Meilleur prix", "Statut", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="cursor-pointer transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <td className="px-4 py-3" onClick={() => navigate(`/admin/produits/${p.id}`)}>
                      <span className="text-[13px] font-semibold block" style={{ color: "#1D2530" }}>{p.name}</span>
                      <span className="text-[11px]" style={{ color: "#8B95A5" }}>{p.source}</span>
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
                ))}
              </tbody>
            </table>
          )}
        </div>
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

      <ProductFormDialog open={productDialogOpen} onOpenChange={setProductDialogOpen} product={editProduct} brands={brands} manufacturers={[]} />
    </div>
  );
};

export default AdminProduits;