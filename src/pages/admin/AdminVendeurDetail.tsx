import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Building2, Mail, Phone, Globe, MapPin,
  DollarSign, ShoppingCart, Star, TrendingUp, Percent,
  RotateCcw, Package, Award, Shield, Users, FileText,
  MessageSquare, StickyNote, Activity, CheckCircle2,
  Clock, AlertTriangle, Download, Upload, Tag, Factory,
} from "lucide-react";

const tierColors: Record<string, { bg: string; text: string }> = {
  Bronze: { bg: "#FEF3C7", text: "#92400E" },
  Silver: { bg: "#F1F5F9", text: "#475569" },
  Gold: { bg: "#FEF9C3", text: "#A16207" },
  Platinum: { bg: "#EDE9FE", text: "#7C3AED" },
  Strategic: { bg: "#FCE7F3", text: "#BE185D" },
};

const riskColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "#F0FDF4", text: "#059669" },
  medium: { bg: "#FFFBEB", text: "#D97706" },
  high: { bg: "#FEF2F2", text: "#EF4343" },
};

const tabList = [
  { key: "resume", label: "Résumé", icon: Building2 },
  { key: "portfolio", label: "Portefeuille", icon: Tag },
  { key: "products", label: "Produits", icon: Package },
  { key: "activity", label: "Activité", icon: Activity },
];

const AdminVendeurDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("resume");

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch brands/manufacturers linked to this vendor via offers_direct → products
  const { data: vendorBrands = [] } = useQuery({
    queryKey: ["vendor-brands", id],
    queryFn: async () => {
      // Get distinct brand names via offers_direct join
      const { data: offers } = await supabase
        .from("offers_direct")
        .select("product_id, products(brand, brand_id)")
        .eq("vendor_id", id!);
      const brandNames = [...new Set((offers || []).map(o => (o.products as any)?.brand).filter(Boolean))];
      return brandNames.map(name => ({ name }));
    },
    enabled: !!id,
  });

  const { data: vendorManufacturers = [] } = useQuery({
    queryKey: ["vendor-manufacturers", id],
    queryFn: async () => {
      const { data: offers } = await supabase
        .from("offers_direct")
        .select("product_id, products(manufacturer_id)")
        .eq("vendor_id", id!);
      const mfrIds = [...new Set((offers || []).map(o => (o.products as any)?.manufacturer_id).filter(Boolean))];
      if (mfrIds.length === 0) return [];
      const { data } = await supabase.from("manufacturers").select("name").in("id", mfrIds);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: vendorProducts = [] } = useQuery({
    queryKey: ["vendor-products-list", id],
    queryFn: async () => {
      const { data: offers } = await supabase
        .from("offers_direct")
        .select("product_id, price_ht, stock, status, products(product_name, brand)")
        .eq("vendor_id", id!);
      return offers || [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>;
  }

  if (!vendor) {
    return <div className="py-12 text-center text-[13px]" style={{ color: "#EF4343" }}>Vendeur non trouvé</div>;
  }

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
      <span className="w-[180px] shrink-0 text-[12px] font-medium" style={{ color: "#8B95A5" }}>{label}</span>
      <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{value || "—"}</span>
    </div>
  );

  const tc = tierColors[vendor.tier] || tierColors.Bronze;
  const rc = riskColors[vendor.risk_level || "low"] || riskColors.low;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/admin/vendeurs")} className="w-9 h-9 flex items-center justify-center rounded-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <ArrowLeft size={16} style={{ color: "#616B7C" }} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold" style={{ color: "#1D2530" }}>{vendor.company_name}</h1>
            {vendor.legal_form && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}>{vendor.legal_form}</span>}
            <StatusBadge status={vendor.status} />
            <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: tc.bg, color: tc.text }}>{vendor.tier}</span>
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>{vendor.contact_name} · {vendor.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded-md text-[12px] font-semibold" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}>Suspendre</button>
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
          <div className="grid grid-cols-4 gap-3">
            <KpiCard icon={DollarSign} label="Commission" value={`${vendor.commission_rate}%`} />
            <KpiCard icon={Package} label="Tier" value={vendor.tier} iconColor="#7C3AED" iconBg="#F5F3FF" />
            <KpiCard icon={Star} label="Score interne" value={`${vendor.internal_score || 0}/100`} iconColor="#F59E0B" iconBg="#FFFBEB" />
            <KpiCard icon={Shield} label="Risque" value={(vendor.risk_level || "low").toUpperCase()} iconColor={rc.text} iconBg={rc.bg} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}><Building2 size={16} /> Identité légale</h3>
              <InfoRow label="Raison sociale" value={vendor.legal_name || vendor.company_name} />
              <InfoRow label="Forme juridique" value={vendor.legal_form || ""} />
              <InfoRow label="N° TVA" value={vendor.vat_number || ""} />
              <InfoRow label="N° BCE" value={vendor.bce || ""} />
              <InfoRow label="IBAN" value={vendor.iban || ""} />
              <InfoRow label="Licence AFMPS" value={vendor.afmps_number || ""} />
              <InfoRow label="Assurance RC" value={vendor.insurance_provider ? `${vendor.insurance_provider} — ${vendor.insurance_number}` : ""} />
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}><Mail size={16} /> Contact</h3>
                <InfoRow label="Nom" value={vendor.contact_name || ""} />
                <InfoRow label="Fonction" value={vendor.contact_role || ""} />
                <InfoRow label="Email" value={vendor.email} />
                <InfoRow label="Téléphone" value={vendor.phone || ""} />
              </div>
              <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}><MapPin size={16} /> Adresse</h3>
                <InfoRow label="Rue" value={vendor.address || ""} />
                <InfoRow label="Ville" value={`${vendor.postal_code || ""} ${vendor.city || ""}`} />
                <InfoRow label="Pays" value={vendor.country || "BE"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "portfolio" && (
        <div className="space-y-4">
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: "#1D2530" }}>
              <Tag size={16} style={{ color: "#1B5BDA" }} /> Marques en portefeuille ({vendorBrands.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {vendorBrands.map(b => (
                <span key={b.name} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA", border: "1px solid #DBEAFE" }}>{b.name}</span>
              ))}
              {vendorBrands.length === 0 && <span className="text-[12px]" style={{ color: "#8B95A5" }}>Aucune marque enregistrée</span>}
            </div>
          </div>
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: "#1D2530" }}>
              <Factory size={16} style={{ color: "#7C3AED" }} /> Fabricants ({vendorManufacturers.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {vendorManufacturers.map(m => (
                <span key={m.name} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ backgroundColor: "#F3F0FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>{m.name}</span>
              ))}
              {vendorManufacturers.length === 0 && <span className="text-[12px]" style={{ color: "#8B95A5" }}>Aucun fabricant enregistré</span>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Produit", "Marque", "Prix HT", "Stock", "Statut"].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorProducts.map((offer: any) => (
                <tr key={offer.product_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{offer.products?.product_name || "—"}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{offer.products?.brand || "—"}</td>
                  <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>—</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>—</td>
                  <td className="px-4 py-3"><StatusBadge status="active" /></td>
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
