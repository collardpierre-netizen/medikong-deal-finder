import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Building2, Mail, MapPin,
  DollarSign, Package, Tag, Factory, Activity,
} from "lucide-react";

const tabList = [
  { key: "resume", label: "Résumé", icon: Building2 },
  { key: "portfolio", label: "Portefeuille", icon: Tag },
  { key: "products", label: "Produits", icon: Package },
  { key: "activity", label: "Activité", icon: Activity },
];

const AdminVendeurDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("resume");

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: vendorBrands = [] } = useQuery({
    queryKey: ["vendor-brands", id],
    queryFn: async () => {
      const { data: offers } = await supabase.from("offers").select("product_id, products(name, brand_id)").eq("vendor_id", id!);
      const names = [...new Set((offers || []).map(o => (o.products as any)?.name).filter(Boolean))];
      return names.slice(0, 10).map(name => ({ name }));
    },
    enabled: !!id,
  });

  const { data: vendorProducts = [] } = useQuery({
    queryKey: ["vendor-products-list", id],
    queryFn: async () => {
      const { data: offers } = await supabase
        .from("offers")
        .select("product_id, price_excl_vat, stock_quantity, is_active, products(name)")
        .eq("vendor_id", id!);
      return offers || [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>;
  if (!vendor) return <div className="py-12 text-center text-[13px]" style={{ color: "#EF4343" }}>Vendeur non trouvé</div>;

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
      <span className="w-[180px] shrink-0 text-[12px] font-medium" style={{ color: "#8B95A5" }}>{label}</span>
      <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{value || "—"}</span>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/admin/vendeurs")} className="w-9 h-9 flex items-center justify-center rounded-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <ArrowLeft size={16} style={{ color: "#616B7C" }} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold" style={{ color: "#1D2530" }}>{vendor.company_name || vendor.name}</h1>
            <StatusBadge status={vendor.is_active ? "active" : "inactive"} />
            <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#F1F5F9", color: "#616B7C" }}>{vendor.type}</span>
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>{vendor.email || "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#1E293B" }}>Modifier</button>
        </div>
      </div>

      <div className="flex items-center gap-0.5 mb-5 overflow-x-auto pb-1" style={{ borderBottom: "1px solid #E2E8F0" }}>
        {tabList.map((tab) => (
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
          <div className="grid grid-cols-3 gap-3">
            <KpiCard icon={DollarSign} label="Commission" value={`${vendor.commission_rate}%`} />
            <KpiCard icon={Package} label="Type" value={vendor.type} iconColor="#7C3AED" iconBg="#F5F3FF" />
            <KpiCard icon={Package} label="Ventes totales" value={String(vendor.total_sales)} iconColor="#059669" iconBg="#F0FDF4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}><Building2 size={16} /> Identité</h3>
              <InfoRow label="Raison sociale" value={vendor.company_name || ""} />
              <InfoRow label="N° TVA" value={vendor.vat_number || ""} />
              <InfoRow label="Type" value={vendor.type} />
              <InfoRow label="Vérifié" value={vendor.is_verified ? "Oui" : "Non"} />
            </div>
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}><Mail size={16} /> Contact</h3>
              <InfoRow label="Email" value={vendor.email || ""} />
              <InfoRow label="Téléphone" value={vendor.phone || ""} />
              <InfoRow label="Adresse" value={vendor.address_line1 || ""} />
              <InfoRow label="Ville" value={`${vendor.postal_code || ""} ${vendor.city || ""}`} />
              <InfoRow label="Pays" value={vendor.country_code} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "portfolio" && (
        <div className="space-y-4">
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: "#1D2530" }}>
              <Tag size={16} style={{ color: "#1B5BDA" }} /> Produits en portefeuille ({vendorBrands.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {vendorBrands.map(b => (
                <span key={b.name} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA", border: "1px solid #DBEAFE" }}>{b.name}</span>
              ))}
              {vendorBrands.length === 0 && <span className="text-[12px]" style={{ color: "#8B95A5" }}>Aucun produit</span>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Produit", "Prix HT", "Stock", "Statut"].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorProducts.map((offer: any) => (
                <tr key={offer.product_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{offer.products?.name || "—"}</td>
                  <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>{offer.price_excl_vat ? `€${Number(offer.price_excl_vat).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{offer.stock_quantity ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={offer.is_active ? "active" : "inactive"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendorProducts.length === 0 && (
            <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun produit</div>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Activité récente</h3>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>Inscrit le {new Date(vendor.created_at).toLocaleDateString("fr-BE")}</p>
        </div>
      )}
    </div>
  );
};

export default AdminVendeurDetail;