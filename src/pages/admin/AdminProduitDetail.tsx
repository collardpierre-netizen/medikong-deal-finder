import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShoppingCart, Package } from "lucide-react";

const AdminProduitDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("resume");

  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: offers = [] } = useQuery({
    queryKey: ["product-offers", id],
    queryFn: async () => {
      const { data } = await supabase.from("offers").select("*, vendors(name, company_name)").eq("product_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>;
  if (!product) return <div className="py-12 text-center text-[13px]" style={{ color: "#EF4343" }}>Produit non trouvé</div>;

  const imageUrl = product.image_urls?.[0];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/admin/produits")} className="w-9 h-9 flex items-center justify-center rounded-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <ArrowLeft size={16} style={{ color: "#616B7C" }} />
        </button>
        {imageUrl && (
          <div className="w-12 h-12 rounded-lg overflow-hidden" style={{ backgroundColor: "#F1F5F9" }}>
            <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold" style={{ color: "#1D2530" }}>{product.name}</h1>
            <StatusBadge status={product.is_active ? "active" : "inactive"} />
          </div>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>
            CNK {product.cnk_code || "—"} · EAN {product.gtin || "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 mb-5 overflow-x-auto pb-1" style={{ borderBottom: "1px solid #E2E8F0" }}>
        {[
          { key: "resume", label: "Résumé", icon: Package },
          { key: "offers", label: "Offres", icon: ShoppingCart },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors"
            style={{ color: activeTab === tab.key ? "#1B5BDA" : "#8B95A5", borderBottom: activeTab === tab.key ? "2px solid #1B5BDA" : "2px solid transparent", marginBottom: "-1px" }}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resume" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <KpiCard icon={ShoppingCart} label="Offres" value={String(offers.length)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
            <KpiCard icon={Package} label="Stock total" value={String(product.total_stock)} iconColor="#059669" iconBg="#F0FDF4" />
            <KpiCard icon={Package} label="Meilleur prix" value={product.best_price_excl_vat ? `€${Number(product.best_price_excl_vat).toFixed(2)}` : "—"} iconColor="#7C3AED" iconBg="#F5F3FF" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Identifiants</h3>
              {[
                ["CNK", product.cnk_code], ["GTIN", product.gtin], ["SKU", product.sku],
              ].map(([label, val]) => (
                <div key={label} className="flex py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <span className="w-24 text-[12px] font-medium" style={{ color: "#8B95A5" }}>{label}</span>
                  <span className="text-[13px] font-mono" style={{ color: "#1D2530" }}>{val || "—"}</span>
                </div>
              ))}
            </div>
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Classification</h3>
              {[
                ["Source", product.source], ["Catégorie", product.category_id || "—"],
                ["Marque", product.brand_id || "—"],
              ].map(([label, val]) => (
                <div key={label} className="flex py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <span className="w-28 text-[12px] font-medium" style={{ color: "#8B95A5" }}>{label}</span>
                  <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{val || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "offers" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "Prix HT", "Prix TTC", "Stock", "MOQ", "Délai", "Qogita"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1B5BDA" }}>{(o.vendors as any)?.company_name || (o.vendors as any)?.name || "—"}</td>
                  <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{Number(o.price_excl_vat).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: "#616B7C" }}>€{Number(o.price_incl_vat).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.stock_quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.moq || 1}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.delivery_days}j</td>
                  <td className="px-4 py-3">
                    {o.is_qogita_backed ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#F0FDF4", color: "#059669" }}>Oui</span> : <span className="text-[11px]" style={{ color: "#8B95A5" }}>Non</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {offers.length === 0 && <div className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune offre</div>}
        </div>
      )}
    </div>
  );
};

export default AdminProduitDetail;