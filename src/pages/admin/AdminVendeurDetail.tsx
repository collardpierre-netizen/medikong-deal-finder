import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Building2, Mail, MapPin,
  DollarSign, Package, Tag, Factory, Activity, Eye, Plus, Trash2,
  CheckCircle2, XCircle, Clock, Globe, Phone, FileText, Loader2,
  Pencil, Power, AlertTriangle, Save, ExternalLink, Link2, Send, Copy,
} from "lucide-react";
import { useImpersonation } from "@/contexts/impersonation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { EntityDelegatesSection } from "@/components/admin/EntityDelegatesSection";
import { ContractHistoryTable } from "@/components/vendor/ContractHistoryTable";

type VendorValidationStatus = "pending_review" | "under_review" | "accepted" | "approved" | "rejected";

const tabList = [
  { key: "resume", label: "Résumé", icon: Building2 },
  { key: "validation", label: "Validation", icon: CheckCircle2 },
  { key: "visibility", label: "Visibilité", icon: Eye },
  { key: "offers", label: "Offres & Marges", icon: DollarSign },
  { key: "portfolio", label: "Portefeuille", icon: Tag },
  { key: "products", label: "Produits", icon: Package },
  { key: "delegates", label: "Délégués", icon: Globe },
  { key: "contracts", label: "Conventions", icon: FileText },
  { key: "activity", label: "Activité", icon: Activity },
];

const AdminVendeurDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("resume");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const queryClient = useQueryClient();
  const { startImpersonation } = useImpersonation();
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
        .select("product_id, price_excl_vat, stock_quantity, is_active, purchase_price, margin_amount, applied_margin_percentage, qogita_base_price, products(name, offer_count, gtin)")
        .eq("vendor_id", id!);
      return offers || [];
    },
    enabled: !!id,
  });

  // Detailed offers with all vendors per product for the Offres & Marges tab
  const { data: detailedOffers = [] } = useQuery({
    queryKey: ["vendor-offers-detailed", id],
    queryFn: async () => {
      // Get this vendor's offers with product info
      const { data: myOffers } = await supabase
        .from("offers")
        .select("id, product_id, price_excl_vat, purchase_price, margin_amount, applied_margin_percentage, qogita_base_price, stock_quantity, is_active, vat_rate, products(name, gtin, offer_count, best_price_excl_vat)")
        .eq("vendor_id", id!)
        .eq("is_active", true)
        .order("price_excl_vat", { ascending: true });

      if (!myOffers?.length) return [];

      // For each product, get total vendor count
      const productIds = [...new Set(myOffers.map(o => o.product_id))];
      const vendorCounts: Record<string, number> = {};
      
      // Batch query vendor counts
      for (let i = 0; i < productIds.length; i += 50) {
        const batch = productIds.slice(i, i + 50);
        const { data: counts } = await supabase
          .from("offers")
          .select("product_id, vendor_id")
          .in("product_id", batch)
          .eq("is_active", true);
        if (counts) {
          for (const c of counts) {
            vendorCounts[c.product_id] = (vendorCounts[c.product_id] || 0) + 1;
          }
        }
      }

      return myOffers.map(o => {
        const product = o.products as any;
        const purchasePrice = o.purchase_price ? Number(o.purchase_price) : null;
        const sellPrice = Number(o.price_excl_vat);
        const netMargin = purchasePrice ? sellPrice - purchasePrice : (o.margin_amount ? Number(o.margin_amount) : null);
        const marginPct = netMargin && sellPrice > 0 ? (netMargin / sellPrice * 100) : (o.applied_margin_percentage ? Number(o.applied_margin_percentage) : null);

        return {
          id: o.id,
          product_id: o.product_id,
          product_name: product?.name || "—",
          gtin: product?.gtin || "—",
          total_offers: vendorCounts[o.product_id] || 1,
          sell_price: sellPrice,
          purchase_price: purchasePrice,
          qogita_base: o.qogita_base_price ? Number(o.qogita_base_price) : null,
          net_margin: netMargin,
          margin_pct: marginPct,
          stock: o.stock_quantity,
        };
      });
    },
    enabled: !!id,
  });

  const { data: visibilityRules = [] } = useQuery({
    queryKey: ["vendor-visibility-rules", id],
    queryFn: async () => {
      const { data } = await supabase.from("vendor_visibility_rules" as any).select("*").eq("vendor_id", id!).order("priority", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const addVisibilityRule = async (rule: { country_code: string | null; customer_type: string | null; show_real_name: boolean; priority: number }) => {
    await supabase.from("vendor_visibility_rules" as any).insert({ vendor_id: id, ...rule } as any);
    queryClient.invalidateQueries({ queryKey: ["vendor-visibility-rules", id] });
    toast.success("Règle ajoutée");
  };

  const deleteVisibilityRule = async (ruleId: string) => {
    await supabase.from("vendor_visibility_rules" as any).delete().eq("id", ruleId);
    queryClient.invalidateQueries({ queryKey: ["vendor-visibility-rules", id] });
    toast.success("Règle supprimée");
  };

  const toggleActive = async () => {
    setTogglingStatus(true);
    try {
      const { error } = await supabase.from("vendors").update({ is_active: !vendor.is_active } as any).eq("id", id!);
      if (error) throw error;
      toast.success(vendor.is_active ? "Vendeur désactivé" : "Vendeur activé");
      queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("vendors").delete().eq("id", id!);
      if (error) throw error;
      toast.success("Vendeur supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      navigate("/admin/vendeurs");
    } catch (e: any) {
      toast.error(e.message || "Impossible de supprimer ce vendeur");
    }
    setShowDelete(false);
  };

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
          <button
            onClick={() => {
              startImpersonation(
                vendor.auth_user_id || vendor.id,
                vendor.email || "",
                "vendor",
                vendor.company_name || vendor.name,
                vendor.id
              ).then(() => {
                navigate(`/vendor?impersonation_vendor_id=${encodeURIComponent(vendor.id)}`);
              });
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#7C3AED" }}
          >
            <ExternalLink size={14} /> Accéder au portail
          </button>
          {!vendor.auth_user_id && (
            <button
              onClick={async () => {
                if (!vendor.email) { toast.error("Email requis pour créer un compte"); return; }
                try {
                  const { data, error } = await supabase.functions.invoke("create-vendor-account", {
                    body: {
                      company_name: vendor.company_name || vendor.name,
                      email: vendor.email,
                      vendor_id: vendor.id,
                    },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  toast.success(`Compte créé ! Mot de passe temporaire : ${data.temp_password}`);
                  queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
                } catch (e: any) {
                  toast.error(e.message || "Erreur");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA", border: "1px solid #DBEAFE" }}
            >
              <Plus size={14} /> Créer un accès
            </button>
          )}
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#F0FDF4", color: "#059669", border: "1px solid #BBF7D0" }}
          >
            <Send size={14} /> Inviter
          </button>
          <button
            onClick={toggleActive}
            disabled={togglingStatus}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: vendor.is_active ? "#FEF2F2" : "#F0FDF4",
              color: vendor.is_active ? "#DC2626" : "#059669",
              border: `1px solid ${vendor.is_active ? "#FECACA" : "#BBF7D0"}`,
            }}
          >
            <Power size={14} />
            {togglingStatus ? "..." : vendor.is_active ? "Désactiver" : "Activer"}
          </button>
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#1B5BDA" }}>
            <Pencil size={14} /> Modifier
          </button>
          <button onClick={() => setShowDelete(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold transition-opacity hover:opacity-90" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
            <Trash2 size={14} /> Supprimer
          </button>
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
            <KpiCard icon={DollarSign} label="Commission" value={
              (vendor as any).commission_model === 'margin_split'
                ? `Partage ${(vendor as any).margin_split_pct || 50}/${100 - ((vendor as any).margin_split_pct || 50)}`
                : (vendor as any).commission_model === 'fixed_amount'
                ? `€${(vendor as any).fixed_commission_amount || 0}/unité`
                : `${vendor.commission_rate}%`
            } />
            <KpiCard icon={Package} label="Type" value={vendor.type} iconColor="#7C3AED" iconBg="#F5F3FF" />
            <KpiCard icon={Package} label="Ventes totales" value={String(vendor.total_sales)} iconColor="#059669" iconBg="#F0FDF4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}><Building2 size={16} /> Identité</h3>
              <InfoRow label="ID MediKong" value={vendor.id} />
              <InfoRow label="ID Qogita" value={(vendor as any).qogita_seller_alias || "—"} />
              <InfoRow label="Raison sociale" value={vendor.company_name || ""} />
              <InfoRow label="N° TVA" value={vendor.vat_number || ""} />
              <InfoRow label="Type" value={vendor.type} />
              <InfoRow label="Type d'activité" value={(vendor as any).business_type || "—"} />
              <InfoRow label="Langue" value={(vendor as any).preferred_language?.toUpperCase() || "FR"} />
              <InfoRow label="Vérifié" value={vendor.is_verified ? "Oui" : "Non"} />
              <InfoRow label="Compte accès" value={vendor.auth_user_id ? "✅ Oui" : "❌ Non"} />
              <InfoRow label="Modèle commission" value={
                (vendor as any).commission_model === 'margin_split'
                  ? `Partage de marge (${(vendor as any).margin_split_pct || 50}% vendeur / ${100 - ((vendor as any).margin_split_pct || 50)}% MediKong)`
                  : (vendor as any).commission_model === 'fixed_amount'
                  ? `Montant fixe : €${(vendor as any).fixed_commission_amount || 0}/unité`
                  : `Pourcentage fixe : ${vendor.commission_rate}%`
              } />
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

      {activeTab === "validation" && (
        <VendorValidationTab vendor={vendor} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] })} />
      )}

      {activeTab === "visibility" && (
        <VendorVisibilityTab
          vendorId={id!}
          vendorName={vendor.company_name || vendor.name}
          showRealName={!!(vendor as any).show_real_name}
          rules={visibilityRules}
          onAddRule={addVisibilityRule}
          onDeleteRule={deleteVisibilityRule}
        />
      )}

      {activeTab === "offers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard icon={Package} label="Offres actives" value={String(detailedOffers.length)} />
            <KpiCard icon={DollarSign} label="Marge moyenne" value={
              detailedOffers.length > 0
                ? `${(detailedOffers.reduce((s, o) => s + (o.margin_pct || 0), 0) / detailedOffers.length).toFixed(1)}%`
                : "—"
            } iconColor="#059669" iconBg="#F0FDF4" />
            <KpiCard icon={Factory} label="Marge totale €" value={
              detailedOffers.length > 0
                ? `€${detailedOffers.reduce((s, o) => s + (o.net_margin || 0), 0).toFixed(2)}`
                : "—"
            } iconColor="#7C3AED" iconBg="#F5F3FF" />
          </div>
          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  {["Produit", "GTIN", "Offres", "Prix vente HT", "Prix achat HT", "Marge €", "Marge %", "Stock"].map(h => (
                    <th key={h} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailedOffers.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-3 py-2.5 text-[12px] font-medium max-w-[250px] truncate" style={{ color: "#1D2530" }}>{o.product_name}</td>
                    <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: "#616B7C" }}>{o.gtin}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
                        {o.total_offers} vendeur{o.total_offers > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold" style={{ color: "#1D2530" }}>€{o.sell_price.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: "#616B7C" }}>
                      {o.purchase_price != null ? `€${o.purchase_price.toFixed(2)}` : o.qogita_base ? `€${o.qogita_base.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold" style={{ color: o.net_margin && o.net_margin > 0 ? "#059669" : "#DC2626" }}>
                      {o.net_margin != null ? `€${o.net_margin.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {o.margin_pct != null ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold" style={{
                          backgroundColor: o.margin_pct >= 15 ? "#F0FDF4" : o.margin_pct >= 5 ? "#FFFBEB" : "#FEF2F2",
                          color: o.margin_pct >= 15 ? "#059669" : o.margin_pct >= 5 ? "#D97706" : "#DC2626",
                        }}>
                          {o.margin_pct.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: "#616B7C" }}>{o.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detailedOffers.length === 0 && (
              <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune offre active</div>
            )}
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
                {["Produit", "GTIN", "Offres", "Prix HT", "Stock", "Statut"].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorProducts.map((offer: any) => (
                <tr key={offer.product_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-medium max-w-[300px] truncate" style={{ color: "#1D2530" }}>{offer.products?.name || "—"}</td>
                  <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{offer.products?.gtin || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
                      {offer.products?.offer_count || 1}
                    </span>
                  </td>
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

      {activeTab === "delegates" && (
        <EntityDelegatesSection entityType="vendor" entityId={vendor.id} />
      )}

      {activeTab === "contracts" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-bold flex items-center gap-2" style={{ color: "#1D2530" }}>
              <FileText size={16} style={{ color: "#1B5BDA" }} />
              Historique des signatures de conventions
            </h3>
            <span className="text-[11px]" style={{ color: "#8B95A5" }}>
              Date · Statut · Empreinte SHA-256 · IP
            </span>
          </div>
          <ContractHistoryTable vendorId={vendor.id} adminView />
        </div>
      )}

      {activeTab === "activity" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Activité récente</h3>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>Inscrit le {new Date(vendor.created_at).toLocaleDateString("fr-BE")}</p>
        </div>
       )}

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} /> Supprimer le vendeur
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer <strong>{vendor.company_name || vendor.name}</strong> ? Cette action est irréversible et supprimera toutes les offres associées.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowDelete(false)} className="px-4 py-2 rounded-md text-[12px] font-semibold" style={{ border: "1px solid #E2E8F0" }}>Annuler</button>
            <button onClick={handleDelete} className="px-4 py-2 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#DC2626" }}>Confirmer la suppression</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <VendorEditDialog open={showEdit} onOpenChange={setShowEdit} vendor={vendor} onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
        queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      }} />

      {/* Invitation dialog */}
      <VendorInviteDialog open={showInvite} onOpenChange={setShowInvite} vendor={vendor} />
    </div>
  );
};

/* ─── Vendor Invite Dialog ─── */
function VendorInviteDialog({ open, onOpenChange, vendor }: { open: boolean; onOpenChange: (o: boolean) => void; vendor: any }) {
  const [mode, setMode] = useState<"choice" | "link" | "email">("choice");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const reset = () => { setMode("choice"); setLink(""); setCopied(false); setSent(false); };
  const handleClose = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const doInvite = async (m: "link" | "email") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-vendor", {
        body: { vendor_id: vendor.id, mode: m },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLink(data.invitation_link || "");
      if (m === "email") setSent(true);
      setMode(m);
      if (m === "email") toast.success("Invitation envoyée par email !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'invitation");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send size={18} style={{ color: "#059669" }} /> Inviter {vendor.company_name || vendor.name}
          </DialogTitle>
        </DialogHeader>

        {mode === "choice" && (
          <div className="space-y-3 mt-2">
            <p className="text-[12px]" style={{ color: "#616B7C" }}>
              Choisissez comment inviter ce vendeur à accéder à son portail :
            </p>
            <button
              onClick={() => doInvite("link")}
              disabled={loading}
              className="w-full flex items-center gap-3 p-4 rounded-lg text-left transition-colors hover:bg-[#F8FAFC]"
              style={{ border: "1px solid #E2E8F0" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EFF6FF" }}>
                <Link2 size={18} style={{ color: "#1B5BDA" }} />
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: "#1D2530" }}>Générer un lien d'invitation</p>
                <p className="text-[11px]" style={{ color: "#8B95A5" }}>Copiez le lien et partagez-le manuellement avec le vendeur</p>
              </div>
            </button>
            <button
              onClick={() => doInvite("email")}
              disabled={loading}
              className="w-full flex items-center gap-3 p-4 rounded-lg text-left transition-colors hover:bg-[#F8FAFC]"
              style={{ border: "1px solid #E2E8F0" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F0FDF4" }}>
                <Mail size={18} style={{ color: "#059669" }} />
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: "#1D2530" }}>Envoyer par email</p>
                <p className="text-[11px]" style={{ color: "#8B95A5" }}>Un email d'invitation sera envoyé à <strong>{vendor.email}</strong></p>
              </div>
            </button>
            {loading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 size={16} className="animate-spin" style={{ color: "#1B5BDA" }} />
                <span className="ml-2 text-[12px]" style={{ color: "#8B95A5" }}>Génération en cours...</span>
              </div>
            )}
          </div>
        )}

        {mode === "link" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <CheckCircle2 size={16} style={{ color: "#059669" }} />
              <span className="text-[12px] font-medium" style={{ color: "#059669" }}>Lien d'invitation généré !</span>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase" style={{ color: "#8B95A5" }}>Lien d'invitation</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={link} readOnly className="text-[11px] font-mono" />
                <button onClick={copyLink} className="shrink-0 p-2 rounded-md transition-colors hover:bg-[#F1F5F9]" style={{ border: "1px solid #E2E8F0" }}>
                  {copied ? <CheckCircle2 size={16} style={{ color: "#059669" }} /> : <Copy size={16} style={{ color: "#616B7C" }} />}
                </button>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
              Ce lien permet au vendeur de définir son mot de passe et d'accéder à son portail. Il expire après une utilisation.
            </p>
            <button onClick={() => handleClose(false)} className="w-full py-2.5 rounded-md text-[12px] font-semibold text-white" style={{ backgroundColor: "#1E293B" }}>
              Fermer
            </button>
          </div>
        )}

        {mode === "email" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <CheckCircle2 size={16} style={{ color: "#059669" }} />
              <span className="text-[12px] font-medium" style={{ color: "#059669" }}>Invitation envoyée à {vendor.email}</span>
            </div>
            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
              Le vendeur recevra un email avec un lien pour définir son mot de passe et accéder à son portail.
            </p>
            {link && (
              <div>
                <Label className="text-[11px] font-semibold uppercase" style={{ color: "#8B95A5" }}>Lien de secours (si l'email n'arrive pas)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={link} readOnly className="text-[11px] font-mono" />
                  <button onClick={copyLink} className="shrink-0 p-2 rounded-md transition-colors hover:bg-[#F1F5F9]" style={{ border: "1px solid #E2E8F0" }}>
                    {copied ? <CheckCircle2 size={16} style={{ color: "#059669" }} /> : <Copy size={16} style={{ color: "#616B7C" }} />}
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => handleClose(false)} className="w-full py-2.5 rounded-md text-[12px] font-semibold text-white" style={{ backgroundColor: "#1E293B" }}>
              Fermer
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const CUSTOMER_TYPES = [
  { value: "", label: "Tous les profils" },
  { value: "pharmacy", label: "Pharmacie" },
  { value: "hospital", label: "Hôpital" },
  { value: "nursing_home", label: "Maison de repos" },
  { value: "dentist", label: "Dentiste" },
  { value: "nurse", label: "Infirmier" },
  { value: "veterinary", label: "Vétérinaire" },
  { value: "wholesaler", label: "Grossiste" },
];

const COUNTRIES = [
  { value: "", label: "Tous les pays" },
  { value: "BE", label: "🇧🇪 Belgique" },
  { value: "FR", label: "🇫🇷 France" },
  { value: "LU", label: "🇱🇺 Luxembourg" },
  { value: "NL", label: "🇳🇱 Pays-Bas" },
  { value: "DE", label: "🇩🇪 Allemagne" },
];

function VendorVisibilityTab({ vendorId, vendorName, showRealName, rules, onAddRule, onDeleteRule }: {
  vendorId: string;
  vendorName: string;
  showRealName: boolean;
  rules: any[];
  onAddRule: (r: { country_code: string | null; customer_type: string | null; show_real_name: boolean; priority: number }) => void;
  onDeleteRule: (id: string) => void;
}) {
  const [newCountry, setNewCountry] = useState("");
  const [newType, setNewType] = useState("");
  const [newShow, setNewShow] = useState(true);
  const [newPriority, setNewPriority] = useState(10);

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <h3 className="text-[14px] font-bold mb-1" style={{ color: "#1D2530" }}>
          Visibilité publique — {vendorName}
        </h3>
        <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>
          Par défaut : <strong>{showRealName ? "Nom réel visible" : "Anonymisé"}</strong>. Les règles ci-dessous permettent de surcharger ce comportement selon le pays et/ou le profil client. La règle avec la priorité la plus élevée l'emporte.
        </p>

        {/* Existing rules */}
        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Pays", "Profil client", "Affichage", "Priorité", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: "#1D2530" }}>
                    {COUNTRIES.find(c => c.value === r.country_code)?.label || "Tous"}
                  </td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: "#1D2530" }}>
                    {CUSTOMER_TYPES.find(t => t.value === r.customer_type)?.label || "Tous"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-1 rounded text-[10px] font-bold" style={{
                      backgroundColor: r.show_real_name ? "#ECFDF5" : "#FEF2F2",
                      color: r.show_real_name ? "#059669" : "#DC2626"
                    }}>
                      {r.show_real_name ? "Nom réel" : "Anonyme"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: "#616B7C" }}>{r.priority}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => onDeleteRule(r.id)} className="p-1 rounded hover:bg-red-50 transition-colors">
                      <Trash2 size={14} style={{ color: "#DC2626" }} />
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[12px]" style={{ color: "#8B95A5" }}>Aucune règle — le paramètre global du vendeur s'applique</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add new rule */}
        <div className="flex items-end gap-3 p-4 rounded-lg" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B95A5" }}>Pays</label>
            <select value={newCountry} onChange={e => setNewCountry(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-[12px]" style={{ border: "1px solid #E2E8F0" }}>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B95A5" }}>Profil</label>
            <select value={newType} onChange={e => setNewType(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-[12px]" style={{ border: "1px solid #E2E8F0" }}>
              {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="w-[120px]">
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B95A5" }}>Affichage</label>
            <select value={newShow ? "true" : "false"} onChange={e => setNewShow(e.target.value === "true")}
              className="w-full px-3 py-2 rounded-md text-[12px]" style={{ border: "1px solid #E2E8F0" }}>
              <option value="true">Nom réel</option>
              <option value="false">Anonyme</option>
            </select>
          </div>
          <div className="w-[80px]">
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B95A5" }}>Priorité</label>
            <input type="number" value={newPriority} onChange={e => setNewPriority(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md text-[12px]" style={{ border: "1px solid #E2E8F0" }} />
          </div>
          <button onClick={() => {
            onAddRule({
              country_code: newCountry || null,
              customer_type: newType || null,
              show_real_name: newShow,
              priority: newPriority,
            });
          }} className="flex items-center gap-1 px-4 py-2 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#1B5BDA" }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function VendorValidationTab({ vendor, onUpdate }: { vendor: any; onUpdate: () => void }) {
  const [notes, setNotes] = useState((vendor as any).validation_notes || "");
  const [acting, setActing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const queryClient = useQueryClient();

  // Fetch KYC criteria for this vendor's business type
  const businessType = (vendor as any).business_type || "grossiste";
  const { data: criteria = [] } = useQuery({
    queryKey: ["kyc-criteria", businessType],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_kyc_criteria")
        .select("*")
        .eq("business_type", businessType)
        .eq("is_active", true)
        .order("sort_order");
      return data || [];
    },
  });

  // Fetch KYC submissions for this vendor
  const { data: submissions = [] } = useQuery({
    queryKey: ["kyc-submissions", vendor.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_kyc_submissions")
        .select("*, vendor_kyc_criteria(label, requires_document)")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const syncVendorCaches = (update: Record<string, any>) => {
    queryClient.setQueryData(["vendor-detail", vendor.id], (current: any) =>
      current ? { ...current, ...update } : current,
    );

    queryClient.setQueryData(["admin-vendors"], (current: any[] | undefined) =>
      Array.isArray(current)
        ? current.map((entry) => (entry.id === vendor.id ? { ...entry, ...update } : entry))
        : current,
    );
  };

  const refreshVendorQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendor-detail", vendor.id] }),
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] }),
      queryClient.invalidateQueries({ queryKey: ["pending-vendors"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-submissions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-counts"] }),
    ]);
    onUpdate();
  };

  const handleReviewSubmission = async (submissionId: string, status: "approved" | "rejected") => {
    setReviewingId(submissionId);
    try {
      await supabase.from("vendor_kyc_submissions").update({
        status,
        admin_notes: status === "rejected" ? rejectNote || null : null,
        reviewed_at: new Date().toISOString(),
      } as any).eq("id", submissionId);
      queryClient.invalidateQueries({ queryKey: ["kyc-submissions", vendor.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-submissions"] });
      toast.success(status === "approved" ? "Critère KYC approuvé" : "Critère KYC rejeté");
      setRejectNote("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const validationStatus = (vendor as any).validation_status || "pending_review";
  const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    pending_review: { label: "En attente de review", color: "#D97706", bg: "#FFFBEB" },
    under_review: { label: "En cours d'analyse", color: "#2563EB", bg: "#EFF6FF" },
    accepted: { label: "Candidature acceptée — KYC en cours", color: "#7C3AED", bg: "#F5F3FF" },
    approved: { label: "Validé — Compte opérationnel", color: "#059669", bg: "#F0FDF4" },
    rejected: { label: "Refusé", color: "#DC2626", bg: "#FEF2F2" },
  };
  const st = statusLabels[validationStatus] || statusLabels.pending_review;

  const kycAllApproved = criteria.length > 0 && criteria.every((cr: any) => {
    const sub = submissions.find((s: any) => s.criteria_id === cr.id);
    return sub?.status === "approved";
  });

  const handleAction = async (action: "under_review" | "accepted" | "approved" | "rejected") => {
    setActing(true);
    try {
      const update: any = {
        validation_status: action,
        validation_notes: notes,
        validated_at: new Date().toISOString(),
      };
      if (action === "accepted") {
        update.is_active = true;
        update.is_verified = false;
      } else if (action === "approved") {
        update.is_active = true;
        update.is_verified = true;
      } else if (action === "rejected") {
        update.is_active = false;
        update.is_verified = false;
      }
      const { error } = await supabase.from("vendors").update(update).eq("id", vendor.id);
      if (error) throw error;

      syncVendorCaches(update);
      await refreshVendorQueries();

      try {
        if (action === "accepted") {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "vendor-approved",
              recipientEmail: vendor.email,
              idempotencyKey: `vendor-accepted-${vendor.id}-${Date.now()}`,
              templateData: { companyName: vendor.company_name || vendor.name, isAcceptance: true },
            },
          });
        } else if (action === "approved") {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "vendor-approved",
              recipientEmail: vendor.email,
              idempotencyKey: `vendor-approved-${vendor.id}-${Date.now()}`,
              templateData: { companyName: vendor.company_name || vendor.name },
            },
          });
        } else if (action === "rejected") {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "vendor-rejected",
              recipientEmail: vendor.email,
              idempotencyKey: `vendor-rejected-${vendor.id}-${Date.now()}`,
              templateData: { companyName: vendor.company_name || vendor.name, reason: notes || undefined },
            },
          });
        }
      } catch (emailErr) {
        console.error("Erreur envoi email vendeur:", emailErr);
      }

      const messages: Record<string, string> = {
        under_review: "Statut mis à jour",
        accepted: "Candidature acceptée ! Le vendeur peut accéder au portail et compléter son KYC.",
        approved: "Vendeur validé ! Compte pleinement opérationnel.",
        rejected: "Vendeur refusé. Email envoyé.",
      };
      toast.success(messages[action]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="p-5 rounded-[10px] flex items-center gap-4" style={{ backgroundColor: st.bg, border: `1px solid ${st.color}20` }}>
        {validationStatus === "pending_review" && <Clock size={24} style={{ color: st.color }} />}
        {validationStatus === "under_review" && <FileText size={24} style={{ color: st.color }} />}
        {validationStatus === "accepted" && <CheckCircle2 size={24} style={{ color: st.color }} />}
        {validationStatus === "approved" && <CheckCircle2 size={24} style={{ color: st.color }} />}
        {validationStatus === "rejected" && <XCircle size={24} style={{ color: st.color }} />}
        <div>
          <p className="text-[14px] font-bold" style={{ color: st.color }}>{st.label}</p>
          {validationStatus === "accepted" && (
            <p className="text-[12px] mt-0.5" style={{ color: "#7C3AED" }}>
              Le vendeur a accès au portail et doit compléter son KYC
            </p>
          )}
          {(vendor as any).validated_at && (
            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
              Le {new Date((vendor as any).validated_at).toLocaleDateString("fr-BE")} à {new Date((vendor as any).validated_at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Vendor info summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
            <Building2 size={16} /> Candidature
          </h3>
          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#8B95A5" }}>Société</span>
              <span className="font-medium" style={{ color: "#1D2530" }}>{vendor.company_name}</span>
            </div>
            <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#8B95A5" }}>Type activité</span>
              <span className="font-medium" style={{ color: "#1D2530" }}>{(vendor as any).business_type || "—"}</span>
            </div>
            <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#8B95A5" }}>TVA</span>
              <span className="font-medium" style={{ color: "#1D2530" }}>{vendor.vat_number || "—"}</span>
            </div>
            <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#8B95A5" }}>Pays</span>
              <span className="font-medium" style={{ color: "#1D2530" }}>{vendor.country_code}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span style={{ color: "#8B95A5" }}>Inscrit le</span>
              <span className="font-medium" style={{ color: "#1D2530" }}>{new Date(vendor.created_at).toLocaleDateString("fr-BE")}</span>
            </div>
          </div>
        </div>
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
            <Phone size={16} /> Contact
          </h3>
          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#8B95A5" }}>Email</span>
              <a href={`mailto:${vendor.email}`} className="font-medium" style={{ color: "#1B5BDA" }}>{vendor.email}</a>
            </div>
            <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#8B95A5" }}>Téléphone</span>
              <a href={`tel:${vendor.phone}`} className="font-medium" style={{ color: "#1B5BDA" }}>{vendor.phone || "—"}</a>
            </div>
            <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#8B95A5" }}>Langue</span>
              <span className="font-medium" style={{ color: "#1D2530" }}>{((vendor as any).preferred_language || "fr").toUpperCase()}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span style={{ color: "#8B95A5" }}>Ville</span>
              <span className="font-medium" style={{ color: "#1D2530" }}>{vendor.city || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {vendor.description && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-2" style={{ color: "#1D2530" }}>Description / Détails</h3>
          <p className="text-[12px] whitespace-pre-wrap" style={{ color: "#616B7C" }}>{vendor.description}</p>
        </div>
      )}

      {/* Notes & Actions */}
      <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Notes de validation</h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Ajoutez vos notes internes (raison du refus, conditions, etc.)"
          className="w-full border rounded-md px-3 py-2.5 text-[13px] mb-4 focus:outline-none focus:border-[#1B5BDA] resize-none"
          style={{ borderColor: "#E2E8F0" }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          {/* Step 0: Pass to review */}
          {validationStatus === "pending_review" && (
            <button
              onClick={() => handleAction("under_review")}
              disabled={acting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[12px] font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA", border: "1px solid #BFDBFE" }}
            >
              <FileText size={14} /> Passer en review
            </button>
          )}

          {/* Step 1: Accept candidature → portal access + KYC */}
          {(validationStatus === "pending_review" || validationStatus === "under_review") && (
            <button
              onClick={() => handleAction("accepted")}
              disabled={acting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[12px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#7C3AED" }}
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Accepter la candidature
            </button>
          )}

          {/* Step 2: Final validation → only when KYC is complete */}
          {validationStatus === "accepted" && (
            <button
              onClick={() => handleAction("approved")}
              disabled={acting || !kycAllApproved}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#059669" }}
              title={!kycAllApproved ? "Tous les critères KYC doivent être approuvés" : undefined}
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Validation finale
              {!kycAllApproved && <span className="text-[10px] ml-1 opacity-75">(KYC incomplet)</span>}
            </button>
          )}

          {/* Reject — always available unless already rejected */}
          {validationStatus !== "rejected" && (
            <button
              onClick={() => handleAction("rejected")}
              disabled={acting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[12px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#DC2626" }}
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Refuser
            </button>
          )}
        </div>
      </div>

      {/* KYC Submissions Review Panel */}
      <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <h3 className="text-[14px] font-bold mb-1 flex items-center gap-2" style={{ color: "#1D2530" }}>
          <FileText size={16} style={{ color: "#1B5BDA" }} /> Critères KYC — {businessType.replace(/_/g, " ")}
        </h3>
        <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>
          {criteria.length} critère(s) requis • {submissions.filter((s: any) => s.status === "approved").length} approuvé(s) • {submissions.filter((s: any) => s.status === "submitted").length} en attente
        </p>

        <div className="space-y-2">
          {criteria.map((cr: any) => {
            const sub = submissions.find((s: any) => s.criteria_id === cr.id);
            const statusColor = !sub ? { bg: "#F1F5F9", color: "#8B95A5", label: "Non soumis" }
              : sub.status === "approved" ? { bg: "#F0FDF4", color: "#059669", label: "Approuvé" }
              : sub.status === "rejected" ? { bg: "#FEF2F2", color: "#DC2626", label: "Rejeté" }
              : sub.status === "submitted" ? { bg: "#FFFBEB", color: "#D97706", label: "À valider" }
              : { bg: "#F1F5F9", color: "#8B95A5", label: sub.status };

            return (
              <div key={cr.id} className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {sub?.status === "approved" ? <CheckCircle2 size={16} style={{ color: "#059669" }} /> :
                     sub?.status === "rejected" ? <XCircle size={16} style={{ color: "#DC2626" }} /> :
                     sub?.status === "submitted" ? <Clock size={16} style={{ color: "#D97706" }} /> :
                     <div className="w-4 h-4 rounded-full" style={{ border: "2px solid #D4D9E1" }} />}
                    <div>
                      <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{cr.label}</span>
                      {cr.description && <p className="text-[11px]" style={{ color: "#8B95A5" }}>{cr.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cr.requires_document && (
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>Document</span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: statusColor.bg, color: statusColor.color }}>
                      {statusColor.label}
                    </span>
                  </div>
                </div>

                {sub?.document_url && (
                  <div className="mt-2 ml-6">
                    <a href={sub.document_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded"
                      style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
                      <Eye size={12} /> Voir le document
                    </a>
                  </div>
                )}

                {sub?.notes && (
                  <p className="mt-1 ml-6 text-[11px]" style={{ color: "#616B7C" }}>Note vendeur : {sub.notes}</p>
                )}

                {sub?.status === "submitted" && (
                  <div className="mt-2 ml-6 flex items-center gap-2">
                    <button
                      onClick={() => handleReviewSubmission(sub.id, "approved")}
                      disabled={reviewingId === sub.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-bold text-white"
                      style={{ backgroundColor: "#059669" }}>
                      {reviewingId === sub.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Approuver
                    </button>
                    <button
                      onClick={() => handleReviewSubmission(sub.id, "rejected")}
                      disabled={reviewingId === sub.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-bold text-white"
                      style={{ backgroundColor: "#DC2626" }}>
                      <XCircle size={12} /> Rejeter
                    </button>
                    <input
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      placeholder="Motif (optionnel)"
                      className="flex-1 px-2 py-1 text-[11px] rounded border"
                      style={{ borderColor: "#E2E8F0" }}
                    />
                  </div>
                )}

                {sub?.status === "rejected" && sub?.admin_notes && (
                  <p className="mt-1 ml-6 text-[11px] font-medium" style={{ color: "#DC2626" }}>Motif : {sub.admin_notes}</p>
                )}
              </div>
            );
          })}

          {criteria.length === 0 && (
            <p className="text-[12px] text-center py-4" style={{ color: "#8B95A5" }}>
              Aucun critère KYC configuré pour le type "{businessType.replace(/_/g, " ")}".
              Configurez-les dans Onboarding → Critères éligibilité.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function VendorEditDialog({ open, onOpenChange, vendor, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; vendor: any; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    company_name: vendor.company_name || "",
    email: vendor.email || "",
    phone: vendor.phone || "",
    vat_number: vendor.vat_number || "",
    address_line1: vendor.address_line1 || "",
    city: vendor.city || "",
    postal_code: vendor.postal_code || "",
    country_code: vendor.country_code || "BE",
    commission_rate: String(vendor.commission_rate ?? 0),
    commission_model: (vendor as any).commission_model || "flat_percentage",
    fixed_commission_amount: String((vendor as any).fixed_commission_amount ?? 0),
    margin_split_pct: String((vendor as any).margin_split_pct ?? 50),
    description: vendor.description || "",
    logo_url: vendor.logo_url || "",
    website_url: vendor.website_url || "",
    contact_name: vendor.contact_name || "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `vendors/${vendor.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("cms-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("cms-images").getPublicUrl(path);
      set("logo_url", urlData.publicUrl);
      toast.success("Logo uploadé");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("vendors").update({
        company_name: form.company_name.trim(),
        name: form.company_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        vat_number: form.vat_number.trim() || null,
        address_line1: form.address_line1.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country_code: form.country_code || "BE",
        commission_rate: parseFloat(form.commission_rate) || 0,
        commission_model: form.commission_model,
        fixed_commission_amount: form.commission_model === 'fixed_amount' ? parseFloat(form.fixed_commission_amount) || 0 : null,
        margin_split_pct: form.commission_model === 'margin_split' ? parseInt(form.margin_split_pct) || 50 : null,
        description: form.description.trim() || null,
        logo_url: form.logo_url.trim() || null,
        website_url: form.website_url.trim() || null,
        contact_name: form.contact_name.trim() || null,
      } as any).eq("id", vendor.id);
      if (error) throw error;
      toast.success("Vendeur mis à jour");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le vendeur</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {/* Logo */}
          <div>
            <Label>Logo</Label>
            <div className="flex items-center gap-3 mt-1">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-12 h-12 rounded-md object-contain border border-border bg-muted" />
              ) : (
                <div className="w-12 h-12 rounded-md border border-dashed border-border bg-muted flex items-center justify-center text-muted-foreground text-xs">Logo</div>
              )}
              <label className="cursor-pointer px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors">
                {uploading ? "Upload..." : "Choisir un fichier"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
              {form.logo_url && (
                <button type="button" onClick={() => set("logo_url", "")} className="text-xs text-destructive hover:underline">Supprimer</button>
              )}
            </div>
            <div className="mt-2">
              <Input
                placeholder="Ou coller une URL (https://...)"
                value={form.logo_url?.startsWith("http") && !form.logo_url.includes("supabase") ? form.logo_url : ""}
                onChange={e => set("logo_url", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Nom de l'entreprise</Label>
            <Input value={form.company_name} onChange={e => set("company_name", e.target.value)} />
          </div>
          <div>
            <Label>Personne de contact</Label>
            <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Nom du contact principal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          </div>
          <div>
            <Label>Site web</Label>
            <Input value={form.website_url} onChange={e => set("website_url", e.target.value)} placeholder="https://..." />
          </div>
          <div><Label>N° TVA</Label><Input value={form.vat_number} onChange={e => set("vat_number", e.target.value)} /></div>
          <div><Label>Adresse</Label><Input value={form.address_line1} onChange={e => set("address_line1", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Ville</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
            <div><Label>Code postal</Label><Input value={form.postal_code} onChange={e => set("postal_code", e.target.value)} /></div>
            <div><Label>Pays</Label><Input value={form.country_code} onChange={e => set("country_code", e.target.value)} /></div>
          </div>
          {/* Commission */}
          <div>
            <Label>Modèle de commission</Label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.commission_model} onChange={e => set("commission_model", e.target.value)}>
              <option value="flat_percentage">Pourcentage fixe (%)</option>
              <option value="margin_split">Partage de marge (margin split)</option>
              <option value="fixed_amount">Montant fixe par unité (€)</option>
            </select>
          </div>
          {form.commission_model === "flat_percentage" && (
            <div><Label>Taux de commission (%)</Label><Input type="number" value={form.commission_rate} onChange={e => set("commission_rate", e.target.value)} /></div>
          )}
          {form.commission_model === "margin_split" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Part vendeur (%)</Label><Input type="number" value={form.margin_split_pct} onChange={e => set("margin_split_pct", e.target.value)} /></div>
              <div><Label>Part MediKong (%)</Label><Input type="number" value={String(100 - (parseInt(form.margin_split_pct) || 50))} disabled /></div>
            </div>
          )}
          {form.commission_model === "fixed_amount" && (
            <div><Label>Montant fixe par unité (€)</Label><Input type="number" value={form.fixed_commission_amount} onChange={e => set("fixed_commission_amount", e.target.value)} /></div>
          )}
          <div>
            <Label>Description</Label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background min-h-[60px] resize-y" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#1B5BDA" }}>
            <Save size={14} /> {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdminVendeurDetail;