import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, ShoppingCart, ExternalLink, TrendingUp, Globe,
  Package, FileText, Activity, Shield, BarChart3, Star,
  CheckCircle2, AlertTriangle, Clock, Layers,
} from "lucide-react";

const tabList = [
  { key: "resume", label: "Résumé", icon: Package },
  { key: "offers", label: "Offres", icon: ShoppingCart },
  { key: "compliance", label: "Compliance", icon: Shield },
];

const AdminProduitDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("resume");
  const [offerSubTab, setOfferSubTab] = useState<"direct" | "indirect" | "market">("direct");

  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: directOffers = [] } = useQuery({
    queryKey: ["product-direct-offers", id],
    queryFn: async () => {
      const { data } = await supabase.from("offers_direct").select("*, vendors(company_name)").eq("product_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: indirectOffers = [] } = useQuery({
    queryKey: ["product-indirect-offers", id],
    queryFn: async () => {
      const { data } = await supabase.from("offers_indirect").select("*").eq("product_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: marketOffers = [] } = useQuery({
    queryKey: ["product-market-offers", id],
    queryFn: async () => {
      const { data } = await supabase.from("offers_market").select("*").eq("product_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: compliance } = useQuery({
    queryKey: ["product-compliance", id],
    queryFn: async () => {
      const { data } = await supabase.from("compliance_records").select("*").eq("product_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>;
  if (!product) return <div className="py-12 text-center text-[13px]" style={{ color: "#EF4343" }}>Produit non trouvé</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/admin/produits")} className="w-9 h-9 flex items-center justify-center rounded-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <ArrowLeft size={16} style={{ color: "#616B7C" }} />
        </button>
        <div className="w-12 h-12 rounded-lg overflow-hidden" style={{ backgroundColor: "#F1F5F9" }}>
          <img src={product.primary_image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold" style={{ color: "#1D2530" }}>{product.product_name}</h1>
            <StatusBadge status={product.status || "active"} />
          </div>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>
            {product.brand} · CNK {product.cnk || "—"} · EAN {product.gtin}
          </p>
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
          <div className="grid grid-cols-3 gap-4">
            <KpiCard icon={ShoppingCart} label="Offres directes" value={String(directOffers.length)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
            <KpiCard icon={ExternalLink} label="Offres indirectes" value={String(indirectOffers.length)} iconColor="#7C3AED" iconBg="#F5F3FF" />
            <KpiCard icon={Globe} label="Sources marché" value={String(marketOffers.length)} iconColor="#059669" iconBg="#F0FDF4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Identifiants</h3>
              {[
                ["CNK", product.cnk], ["GTIN", product.gtin], ["MPN", product.mpn],
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
                ["Marque", product.brand], ["Catégorie L1", product.category_l1],
                ["Catégorie L2", product.category_l2], ["Catégorie L3", product.category_l3],
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
        <div>
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
            {[
              { key: "direct" as const, label: "Directes", count: directOffers.length },
              { key: "indirect" as const, label: "Indirectes", count: indirectOffers.length },
              { key: "market" as const, label: "Marché", count: marketOffers.length },
            ].map((st) => (
              <button key={st.key} onClick={() => setOfferSubTab(st.key)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-semibold transition-colors"
                style={{ backgroundColor: offerSubTab === st.key ? "#1B5BDA" : "transparent", color: offerSubTab === st.key ? "#fff" : "#616B7C" }}>
                {st.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: offerSubTab === st.key ? "rgba(255,255,255,0.2)" : "#F1F5F9" }}>{st.count}</span>
              </button>
            ))}
          </div>

          {offerSubTab === "direct" && (
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["Vendeur", "Prix HT", "Stock", "MOQ", "Délai", "Buy Box"].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {directOffers.map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1B5BDA" }}>{(o.vendors as any)?.company_name || "—"}</td>
                      <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{Number(o.price_ht).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.stock.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.moq || 1}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.delivery_days || 3}j</td>
                      <td className="px-4 py-3">
                        {o.is_buy_box ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#F0FDF4", color: "#059669" }}>★ Buy Box</span> : <span className="text-[11px]" style={{ color: "#8B95A5" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {directOffers.length === 0 && <div className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune offre directe</div>}
            </div>
          )}

          {offerSubTab === "indirect" && (
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["URL", "Prix", "Modèle", "Clicks 30j", "Revenu"].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {indirectOffers.map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#1B5BDA" }}>{o.external_url || "—"}</td>
                      <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{Number(o.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#F5F3FF", color: "#7C3AED" }}>{o.model}</span></td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.clicks_30d || 0}</td>
                      <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#059669" }}>€{Number(o.revenue_30d || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {indirectOffers.length === 0 && <div className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune offre indirecte</div>}
            </div>
          )}

          {offerSubTab === "market" && (
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["Source", "Prix", "Méthode", "Confiance", "Dernier changement"].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marketOffers.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1D2530" }}>{s.source_name}</td>
                      <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{Number(s.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: s.method === "api" ? "#F0FDF4" : "#FFFBEB", color: s.method === "api" ? "#059669" : "#D97706" }}>{s.method}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                            <div className="h-2 rounded-full" style={{ width: `${s.match_confidence || 0}%`, backgroundColor: (s.match_confidence || 0) >= 90 ? "#059669" : "#F59E0B" }} />
                          </div>
                          <span className="text-[11px] font-semibold" style={{ color: "#1D2530" }}>{s.match_confidence || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{s.last_change_date ? new Date(s.last_change_date).toLocaleDateString("fr-BE") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {marketOffers.length === 0 && <div className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune source marché</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === "compliance" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Conformité réglementaire</h3>
          {compliance ? (
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid #F1F5F9" }}><span style={{ color: "#8B95A5" }}>Classe MDR</span><span className="font-bold" style={{ color: "#1D2530" }}>{compliance.mdr_class || "—"}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid #F1F5F9" }}><span style={{ color: "#8B95A5" }}>Marquage CE</span>{compliance.ce_marked ? <CheckCircle2 size={16} style={{ color: "#059669" }} /> : <AlertTriangle size={16} style={{ color: "#EF4343" }} />}</div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid #F1F5F9" }}><span style={{ color: "#8B95A5" }}>Expiration CE</span><span style={{ color: "#1D2530" }}>{compliance.ce_expiry ? new Date(compliance.ce_expiry).toLocaleDateString("fr-BE") : "—"}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid #F1F5F9" }}><span style={{ color: "#8B95A5" }}>N° AFMPS</span><span className="font-mono" style={{ color: "#8B95A5" }}>{compliance.afmps_notification || "—"}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: "1px solid #F1F5F9" }}><span style={{ color: "#8B95A5" }}>Risque</span><span className="font-bold" style={{ color: compliance.risk_level === "LOW" ? "#059669" : "#EF4343" }}>{compliance.risk_level || "—"}</span></div>
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: "#8B95A5" }}>Aucune donnée de conformité enregistrée</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminProduitDetail;
