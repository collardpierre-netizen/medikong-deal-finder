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
  Pencil, Power, AlertTriangle, Save,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const tabList = [
  { key: "resume", label: "Résumé", icon: Building2 },
  { key: "validation", label: "Validation", icon: CheckCircle2 },
  { key: "visibility", label: "Visibilité", icon: Eye },
  { key: "portfolio", label: "Portefeuille", icon: Tag },
  { key: "products", label: "Produits", icon: Package },
  { key: "activity", label: "Activité", icon: Activity },
];

const AdminVendeurDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("resume");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const queryClient = useQueryClient();
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
            <KpiCard icon={DollarSign} label="Commission" value={`${vendor.commission_rate}%`} />
            <KpiCard icon={Package} label="Type" value={vendor.type} iconColor="#7C3AED" iconBg="#F5F3FF" />
            <KpiCard icon={Package} label="Ventes totales" value={String(vendor.total_sales)} iconColor="#059669" iconBg="#F0FDF4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}><Building2 size={16} /> Identité</h3>
              <InfoRow label="ID MediKong" value={vendor.id} />
              <InfoRow label="ID Qogita" value={(vendor as any).qogita_seller_fid || "—"} />
              <InfoRow label="Raison sociale" value={vendor.company_name || ""} />
              <InfoRow label="N° TVA" value={vendor.vat_number || ""} />
              <InfoRow label="Type" value={vendor.type} />
              <InfoRow label="Type d'activité" value={(vendor as any).business_type || "—"} />
              <InfoRow label="Langue" value={(vendor as any).preferred_language?.toUpperCase() || "FR"} />
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
    </div>
  );
};

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

  const validationStatus = (vendor as any).validation_status || "pending_review";
  const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    pending_review: { label: "En attente de review", color: "#D97706", bg: "#FFFBEB" },
    under_review: { label: "En cours d'analyse", color: "#2563EB", bg: "#EFF6FF" },
    approved: { label: "Approuvé", color: "#059669", bg: "#F0FDF4" },
    rejected: { label: "Refusé", color: "#DC2626", bg: "#FEF2F2" },
  };
  const st = statusLabels[validationStatus] || statusLabels.pending_review;

  const handleAction = async (action: "under_review" | "approved" | "rejected") => {
    setActing(true);
    try {
      const update: any = {
        validation_status: action,
        validation_notes: notes,
        validated_at: new Date().toISOString(),
      };
      if (action === "approved") {
        update.is_active = true;
        update.is_verified = true;
      }
      if (action === "rejected") {
        update.is_active = false;
      }
      const { error } = await supabase.from("vendors").update(update).eq("id", vendor.id);
      if (error) throw error;

      // Send notification email to vendor
      if (action === "approved") {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "vendor-approved",
            recipientEmail: vendor.email,
            idempotencyKey: `vendor-approved-${vendor.id}-${Date.now()}`,
            templateData: { companyName: vendor.company_name || vendor.name },
          },
        }).catch(() => {});
      } else if (action === "rejected") {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "vendor-rejected",
            recipientEmail: vendor.email,
            idempotencyKey: `vendor-rejected-${vendor.id}-${Date.now()}`,
            templateData: { companyName: vendor.company_name || vendor.name, reason: notes || undefined },
          },
        }).catch(() => {});
      }

      toast.success(action === "approved" ? "Vendeur approuvé ! Email envoyé." : action === "rejected" ? "Vendeur refusé. Email envoyé." : "Statut mis à jour");
      onUpdate();
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
        {validationStatus === "approved" && <CheckCircle2 size={24} style={{ color: st.color }} />}
        {validationStatus === "rejected" && <XCircle size={24} style={{ color: st.color }} />}
        <div>
          <p className="text-[14px] font-bold" style={{ color: st.color }}>{st.label}</p>
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
        <div className="flex items-center gap-3">
          {validationStatus !== "approved" && (
            <button
              onClick={() => handleAction("approved")}
              disabled={acting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[12px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#059669" }}
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Approuver le vendeur
            </button>
          )}
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
        </div>
      </div>
    </div>
  );
}

function VendorEditDialog({ open, onOpenChange, vendor, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; vendor: any; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
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
    description: vendor.description || "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

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
        description: form.description.trim() || null,
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
          <div>
            <Label>Nom de l'entreprise</Label>
            <Input value={form.company_name} onChange={e => set("company_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          </div>
          <div><Label>N° TVA</Label><Input value={form.vat_number} onChange={e => set("vat_number", e.target.value)} /></div>
          <div><Label>Adresse</Label><Input value={form.address_line1} onChange={e => set("address_line1", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Ville</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
            <div><Label>Code postal</Label><Input value={form.postal_code} onChange={e => set("postal_code", e.target.value)} /></div>
            <div><Label>Pays</Label><Input value={form.country_code} onChange={e => set("country_code", e.target.value)} /></div>
          </div>
          <div><Label>Commission (%)</Label><Input type="number" value={form.commission_rate} onChange={e => set("commission_rate", e.target.value)} /></div>
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