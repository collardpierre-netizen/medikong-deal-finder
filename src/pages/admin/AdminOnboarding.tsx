import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminTopBar from "@/components/admin/AdminTopBar";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { useVendors } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, FileText, AlertTriangle, Shield, Award, ChevronRight,
  Plus, Trash2, Edit2, Save, X, Upload, FileCheck, Eye,
} from "lucide-react";

const steps = [
  { num: 1, label: "Inscription", icon: FileText },
  { num: 2, label: "Vérification KYC", icon: Shield },
  { num: 3, label: "Documents", icon: FileCheck },
  { num: 4, label: "Revue finale", icon: Award },
  { num: 5, label: "Activé", icon: CheckCircle2 },
];

const BUSINESS_TYPES = [
  { key: "grossiste", label: "Grossiste" },
  { key: "fabricant_dm", label: "Fabricant DM" },
  { key: "distributeur_otc", label: "Distributeur OTC" },
  { key: "fabricant_cosmetique", label: "Fabricant cosmétique" },
];

const AdminOnboarding = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: vendors = [], isLoading } = useVendors();
  const [activeTab, setActiveTab] = useState<"pipeline" | "criteria">("pipeline");
  const qc = useQueryClient();

  // KYC Criteria from DB
  const { data: allCriteria = [] } = useQuery({
    queryKey: ["admin-kyc-criteria"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_kyc_criteria")
        .select("*")
        .order("business_type")
        .order("sort_order");
      return data || [];
    },
  });

  // KYC Submissions (all)
  const { data: allSubmissions = [] } = useQuery({
    queryKey: ["admin-kyc-submissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_kyc_submissions")
        .select("*, vendor_kyc_criteria(label, business_type)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", description: "", is_required: true, requires_document: false });
  const [newCriteria, setNewCriteria] = useState<string | null>(null); // business_type for new
  const [newForm, setNewForm] = useState({ label: "", description: "", is_required: true, requires_document: false });

  const candidates = vendors
    .filter(v => v.type === "real")
    .map(v => {
      const vs = (v as any).validation_status || "pending_review";
      const vendorSubs = allSubmissions.filter((s: any) => s.vendor_id === v.id);
      const submittedCount = vendorSubs.filter((s: any) => s.status === "submitted" || s.status === "approved").length;
      const approvedCount = vendorSubs.filter((s: any) => s.status === "approved").length;
      const bt = (v as any).business_type || "grossiste";
      const totalCriteria = allCriteria.filter((c: any) => c.business_type === bt && c.is_active).length;

      const step = vs === "approved" ? 5 : vs === "under_review" ? 4 : submittedCount > 0 ? 3 : 2;
      const progress = totalCriteria > 0 ? Math.round((approvedCount / totalCriteria) * 100) : (vs === "approved" ? 100 : 0);

      return {
        id: v.id,
        company: v.company_name || v.name,
        email: v.email || "—",
        businessType: bt,
        step,
        stepLabel: steps[step - 1]?.label || "Inscription",
        progress,
        submittedCount,
        approvedCount,
        totalCriteria,
        validationStatus: vs,
        date: new Date(v.created_at).toLocaleDateString("fr-BE"),
      };
    });

  const stepCounts = steps.map(s => candidates.filter(c => c.step === s.num).length);

  const saveCriteria = async (id: string, updates: any) => {
    await supabase.from("vendor_kyc_criteria").update(updates as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-kyc-criteria"] });
    setEditingId(null);
    toast.success("Critère mis à jour");
  };

  const addCriteria = async (businessType: string) => {
    if (!newForm.label.trim()) return;
    const maxSort = allCriteria.filter((c: any) => c.business_type === businessType).length;
    await supabase.from("vendor_kyc_criteria").insert({
      business_type: businessType,
      label: newForm.label,
      description: newForm.description || null,
      is_required: newForm.is_required,
      requires_document: newForm.requires_document,
      sort_order: maxSort + 1,
    } as any);
    qc.invalidateQueries({ queryKey: ["admin-kyc-criteria"] });
    setNewCriteria(null);
    setNewForm({ label: "", description: "", is_required: true, requires_document: false });
    toast.success("Critère ajouté");
  };

  const deleteCriteria = async (id: string) => {
    if (!confirm("Supprimer ce critère ?")) return;
    await supabase.from("vendor_kyc_criteria").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-kyc-criteria"] });
    toast.success("Critère supprimé");
  };

  const reviewSubmission = async (submissionId: string, status: "approved" | "rejected", adminNotes?: string) => {
    await supabase.from("vendor_kyc_submissions").update({
      status,
      admin_notes: adminNotes || null,
      reviewed_at: new Date().toISOString(),
    } as any).eq("id", submissionId);
    qc.invalidateQueries({ queryKey: ["admin-kyc-submissions"] });
    toast.success(status === "approved" ? "Critère approuvé" : "Critère rejeté");
  };

  const tabs = [
    { key: "pipeline" as const, label: "Pipeline" },
    { key: "criteria" as const, label: "Critères éligibilité" },
  ];

  return (
    <div>
      <AdminTopBar title={t("onboarding")} subtitle="Pipeline KYC/KYB des vendeurs" />

      {/* Pipeline stepper */}
      <div className="flex items-center gap-2 mb-6 p-4 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center flex-1">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: stepCounts[i] > 0 ? "#1B5BDA" : "#F1F5F9", color: stepCounts[i] > 0 ? "#fff" : "#8B95A5" }}>
                  <step.icon size={14} />
                </div>
                <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{step.label}</span>
              </div>
              <div className="ml-9">
                <span className="text-[20px] font-bold" style={{ color: stepCounts[i] > 0 ? "#1B5BDA" : "#8B95A5" }}>{stepCounts[i]}</span>
              </div>
            </div>
            {i < steps.length - 1 && <ChevronRight size={18} style={{ color: "#D4D9E1" }} className="shrink-0 mx-1" />}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pipeline tab */}
      {activeTab === "pipeline" && (
        <div className="space-y-3">
          {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            candidates.map((c) => {
              const vendorSubs = allSubmissions.filter((s: any) => s.vendor_id === c.id && s.status === "submitted");
              return (
                <div key={c.id} className="p-4 rounded-[10px] transition-shadow hover:shadow-md cursor-pointer"
                  style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
                  onClick={() => navigate(`/admin/vendeurs/${c.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{c.company}</span>
                      <p className="text-[12px] mt-0.5" style={{ color: "#616B7C" }}>{c.email}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: "#F1F5F9", color: "#616B7C" }}>
                        {c.businessType.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={c.validationStatus === "approved" ? "active" : "pending"} label={c.stepLabel} />
                      <p className="text-[10px] mt-1" style={{ color: "#8B95A5" }}>Candidature: {c.date}</p>
                      {vendorSubs.length > 0 && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>
                          <AlertTriangle size={10} /> {vendorSubs.length} doc(s) à valider
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: "#616B7C" }}>
                        KYC: {c.approvedCount}/{c.totalCriteria} validés
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: "#1B5BDA" }}>{c.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${c.progress}%`, backgroundColor: c.progress === 100 ? "#059669" : "#1B5BDA" }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {!isLoading && candidates.length === 0 && (
            <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun vendeur en onboarding</div>
          )}
        </div>
      )}

      {/* Criteria tab — CMS editable */}
      {activeTab === "criteria" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BUSINESS_TYPES.map(bt => {
            const items = allCriteria.filter((c: any) => c.business_type === bt.key);
            return (
              <div key={bt.key} className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{bt.label}</h3>
                  <button onClick={() => { setNewCriteria(bt.key); setNewForm({ label: "", description: "", is_required: true, requires_document: false }); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold"
                    style={{ backgroundColor: "#EEF2FF", color: "#1B5BDA" }}>
                    <Plus size={11} /> Ajouter
                  </button>
                </div>
                <ul className="space-y-2">
                  {items.map((cr: any) => (
                    <li key={cr.id}>
                      {editingId === cr.id ? (
                        <div className="p-2 rounded-lg space-y-2" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                          <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                            className="w-full px-2 py-1 text-[12px] rounded border" style={{ borderColor: "#E2E8F0" }} placeholder="Label" />
                          <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full px-2 py-1 text-[12px] rounded border" style={{ borderColor: "#E2E8F0" }} placeholder="Description" />
                          <div className="flex items-center gap-4 text-[11px]">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={editForm.is_required} onChange={e => setEditForm(f => ({ ...f, is_required: e.target.checked }))} />
                              Requis
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={editForm.requires_document} onChange={e => setEditForm(f => ({ ...f, requires_document: e.target.checked }))} />
                              Document
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => saveCriteria(cr.id, editForm)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                              <Save size={10} /> Sauver
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded text-[10px] font-bold" style={{ color: "#8B95A5" }}>
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <CheckCircle2 size={14} style={{ color: cr.is_active ? "#059669" : "#8B95A5" }} />
                          <span className="text-[12px] flex-1" style={{ color: "#616B7C" }}>
                            {cr.label}
                            {cr.requires_document && <Upload size={10} className="inline ml-1" style={{ color: "#8B95A5" }} />}
                          </span>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button onClick={() => { setEditingId(cr.id); setEditForm({ label: cr.label, description: cr.description || "", is_required: cr.is_required, requires_document: cr.requires_document }); }}
                              className="p-1 rounded hover:bg-[#F1F5F9]"><Edit2 size={11} style={{ color: "#616B7C" }} /></button>
                            <button onClick={() => deleteCriteria(cr.id)}
                              className="p-1 rounded hover:bg-[#FEF2F2]"><Trash2 size={11} style={{ color: "#DC2626" }} /></button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* New criteria form */}
                {newCriteria === bt.key && (
                  <div className="mt-3 p-2 rounded-lg space-y-2" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <input value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))}
                      className="w-full px-2 py-1 text-[12px] rounded border" style={{ borderColor: "#E2E8F0" }} placeholder="Nom du critère" autoFocus />
                    <input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-2 py-1 text-[12px] rounded border" style={{ borderColor: "#E2E8F0" }} placeholder="Description (optionnel)" />
                    <div className="flex items-center gap-4 text-[11px]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={newForm.is_required} onChange={e => setNewForm(f => ({ ...f, is_required: e.target.checked }))} />
                        Requis
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={newForm.requires_document} onChange={e => setNewForm(f => ({ ...f, requires_document: e.target.checked }))} />
                        Document requis
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => addCriteria(bt.key)} className="flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold" style={{ backgroundColor: "#1B5BDA", color: "#fff" }}>
                        <Plus size={10} /> Ajouter
                      </button>
                      <button onClick={() => setNewCriteria(null)} className="px-2 py-1 rounded text-[10px] font-bold" style={{ color: "#8B95A5" }}>Annuler</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminOnboarding;
