import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Clock, Upload, FileText, Shield, Award, AlertTriangle, X, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import VendorCommercialSettings from "./VendorCommercialSettings";

interface KycCriteria {
  id: string;
  business_type: string;
  label: string;
  description: string | null;
  is_required: boolean;
  requires_document: boolean;
  sort_order: number;
}

interface KycSubmission {
  id: string;
  vendor_id: string;
  criteria_id: string;
  status: string;
  document_url: string | null;
  notes: string | null;
  admin_notes: string | null;
}

const STEP_CONFIG = [
  { num: 1, label: "Inscription", icon: FileText, key: "registered" },
  { num: 2, label: "Vérification KYC", icon: Shield, key: "kyc" },
  { num: 3, label: "Documents", icon: Upload, key: "docs" },
  { num: 4, label: "Paramètres", icon: Settings2, key: "commercial" },
  { num: 5, label: "Revue finale", icon: Award, key: "review" },
  { num: 6, label: "Activé", icon: CheckCircle2, key: "active" },
];

export default function VendorKycStepper({ vendor }: { vendor: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

  const businessType = vendor?.business_type || "grossiste";
  const validationStatus = vendor?.validation_status || "pending_review";

  // Current step based on validation_status
  const currentStep = validationStatus === "approved" ? 6
    : validationStatus === "under_review" ? 5
    : 2; // pending_review

  // Fetch criteria for this business type
  const { data: criteria = [] } = useQuery({
    queryKey: ["kyc-criteria", businessType],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_kyc_criteria")
        .select("*")
        .eq("business_type", businessType)
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as KycCriteria[];
    },
  });

  // Fetch submissions
  const { data: submissions = [] } = useQuery({
    queryKey: ["kyc-submissions", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_kyc_submissions")
        .select("*")
        .eq("vendor_id", vendor.id);
      return (data || []) as KycSubmission[];
    },
    enabled: !!vendor?.id,
  });

  const getSubmission = (criteriaId: string) =>
    submissions.find(s => s.criteria_id === criteriaId);

  const allSubmitted = criteria.every(c => {
    const sub = getSubmission(c.id);
    return sub && (sub.status === "submitted" || sub.status === "approved");
  });

  const allApproved = criteria.every(c => {
    const sub = getSubmission(c.id);
    return sub && sub.status === "approved";
  });

  // Upload document mutation
  const uploadDoc = async (criteriaId: string, file: File) => {
    if (!vendor?.id) return;
    setUploading(criteriaId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${vendor.id}/${criteriaId}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("vendor-kyc-docs")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("vendor-kyc-docs").getPublicUrl(path);

      await supabase.from("vendor_kyc_submissions").upsert({
        vendor_id: vendor.id,
        criteria_id: criteriaId,
        status: "submitted",
        document_url: urlData.publicUrl,
      } as any, { onConflict: "vendor_id,criteria_id" });

      qc.invalidateQueries({ queryKey: ["kyc-submissions", vendor.id] });
      toast.success("Document envoyé !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(null);
    }
  };

  const markComplete = async (criteriaId: string) => {
    if (!vendor?.id) return;
    await supabase.from("vendor_kyc_submissions").upsert({
      vendor_id: vendor.id,
      criteria_id: criteriaId,
      status: "submitted",
    } as any, { onConflict: "vendor_id,criteria_id" });
    qc.invalidateQueries({ queryKey: ["kyc-submissions", vendor.id] });
    toast.success("Critère marqué comme complété");
  };

  const statusIcon = (status: string | undefined) => {
    if (!status || status === "pending") return <Clock size={14} style={{ color: "#8B95A5" }} />;
    if (status === "submitted") return <Clock size={14} style={{ color: "#2563EB" }} />;
    if (status === "approved") return <CheckCircle2 size={14} style={{ color: "#059669" }} />;
    if (status === "rejected") return <AlertTriangle size={14} style={{ color: "#DC2626" }} />;
    return null;
  };

  const statusLabel = (status: string | undefined) => {
    if (!status || status === "pending") return "À compléter";
    if (status === "submitted") return "En attente de validation";
    if (status === "approved") return "Validé";
    if (status === "rejected") return "Rejeté";
    return status;
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="p-5 rounded-xl" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: "#1D2530" }}>Progression de votre dossier</h2>
        <div className="flex items-center gap-0">
          {STEP_CONFIG.map((step, i) => {
            const done = step.num < currentStep;
            const active = step.num === currentStep;
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5"
                    style={{
                      backgroundColor: done ? "#ECFDF5" : active ? "#1B5BDA" : "#F1F5F9",
                      color: done ? "#059669" : active ? "#fff" : "#8B95A5",
                    }}>
                    {done ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                  </div>
                  <span className="text-[11px] font-semibold text-center" style={{ color: active ? "#1B5BDA" : done ? "#059669" : "#8B95A5" }}>
                    {step.label}
                  </span>
                </div>
                {i < STEP_CONFIG.length - 1 && (
                  <div className="h-0.5 w-full mx-1 rounded" style={{ backgroundColor: done ? "#059669" : "#E2E8F0" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status message */}
      {validationStatus === "pending_review" && (
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <AlertTriangle size={18} style={{ color: "#D97706" }} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-bold" style={{ color: "#92400E" }}>Dossier en attente</p>
            <p className="text-[12px] mt-0.5" style={{ color: "#A16207" }}>
              Complétez les critères ci-dessous pour soumettre votre dossier à validation. Une fois tous les documents envoyés, notre équipe examinera votre candidature.
            </p>
          </div>
        </div>
      )}

      {validationStatus === "approved" && (
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" }}>
          <CheckCircle2 size={18} style={{ color: "#059669" }} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-bold" style={{ color: "#065F46" }}>Compte vérifié et activé</p>
            <p className="text-[12px] mt-0.5" style={{ color: "#047857" }}>
              Votre dossier KYC a été approuvé. Vous pouvez maintenant gérer vos offres et commencer à vendre.
            </p>
          </div>
        </div>
      )}

      {/* Criteria list */}
      {currentStep < 5 && criteria.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
            <h3 className="text-[13px] font-bold" style={{ color: "#1D2530" }}>
              Critères KYC — {businessType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "#8B95A5" }}>
              {submissions.filter(s => s.status === "submitted" || s.status === "approved").length} / {criteria.length} complétés
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
            {criteria.map((c) => {
              const sub = getSubmission(c.id);
              const status = sub?.status;
              return (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  {statusIcon(status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{c.label}</span>
                      {c.is_required && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Requis</span>
                      )}
                    </div>
                    {c.description && <p className="text-[11px] mt-0.5" style={{ color: "#8B95A5" }}>{c.description}</p>}
                    {sub?.admin_notes && status === "rejected" && (
                      <p className="text-[11px] mt-1 px-2 py-1 rounded" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                        Motif : {sub.admin_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium" style={{
                      color: status === "approved" ? "#059669" : status === "submitted" ? "#2563EB" : status === "rejected" ? "#DC2626" : "#8B95A5"
                    }}>
                      {statusLabel(status)}
                    </span>
                    {(!status || status === "pending" || status === "rejected") && (
                      c.requires_document ? (
                        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors hover:opacity-90"
                          style={{ backgroundColor: "#EEF2FF", color: "#1B5BDA" }}>
                          {uploading === c.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          Envoyer
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => { if (e.target.files?.[0]) uploadDoc(c.id, e.target.files[0]); }} />
                        </label>
                      ) : (
                        <button onClick={() => markComplete(c.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors hover:opacity-90"
                          style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                          <CheckCircle2 size={12} /> Confirmer
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
