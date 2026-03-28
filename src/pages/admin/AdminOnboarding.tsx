import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { useVendors } from "@/hooks/useAdminData";
import {
  CheckCircle2, Clock, FileText, AlertTriangle, Users, ChevronRight,
  Shield, Award, FileCheck,
} from "lucide-react";

const steps = [
  { num: 1, label: "Inscription", icon: FileText },
  { num: 2, label: "Vérification KYC", icon: Shield },
  { num: 3, label: "Documents", icon: FileCheck },
  { num: 4, label: "Revue finale", icon: Award },
  { num: 5, label: "Activé", icon: CheckCircle2 },
];

const AdminOnboarding = () => {
  const { t } = useI18n();
  const { data: vendors = [], isLoading } = useVendors();
  const [activeTab, setActiveTab] = useState<"pipeline" | "criteria">("pipeline");

  // Map vendors to onboarding candidates based on verification status
  const candidates = vendors
    .filter(v => v.type === "real")
    .map(v => ({
      id: v.id,
      company: v.company_name || v.name,
      email: v.email || "—",
      step: v.is_active && v.is_verified ? 5 : v.is_verified ? 4 : 2,
      stepLabel: v.is_active && v.is_verified ? "Activé" : v.is_verified ? "Revue finale" : "Vérification KYC",
      progress: v.is_active && v.is_verified ? 100 : v.is_verified ? 75 : 40,
      date: new Date(v.created_at).toLocaleDateString("fr-BE"),
    }));

  const stepCounts = steps.map(s => candidates.filter(c => c.step === s.num).length);

  const tabs = [
    { key: "pipeline" as const, label: "Pipeline" },
    { key: "criteria" as const, label: "Critères éligibilité" },
  ];

  return (
    <div>
      <AdminTopBar title={t("onboarding")} subtitle="Pipeline KYC/KYB des vendeurs" />

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

      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pipeline" && (
        <div className="space-y-3">
          {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            candidates.map((c) => (
              <div key={c.id} className="p-4 rounded-[10px] transition-shadow hover:shadow-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{c.company}</span>
                    <p className="text-[12px] mt-0.5" style={{ color: "#616B7C" }}>{c.email}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={c.step === 5 ? "active" : "pending"} label={c.stepLabel} />
                    <p className="text-[10px] mt-1" style={{ color: "#8B95A5" }}>Candidature: {c.date}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium" style={{ color: "#616B7C" }}>Progression</span>
                    <span className="text-[11px] font-bold" style={{ color: "#1B5BDA" }}>{c.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${c.progress}%`, backgroundColor: c.progress === 100 ? "#059669" : "#1B5BDA" }} />
                  </div>
                </div>
              </div>
            ))
          )}
          {!isLoading && candidates.length === 0 && (
            <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun vendeur en onboarding</div>
          )}
        </div>
      )}

      {activeTab === "criteria" && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { type: "Grossiste", criteria: ["Licence AFMPS", "Assurance RC Pro", "Certificats CE produits", "Système traçabilité", "GDP compliance"] },
            { type: "Fabricant DM", criteria: ["Marquage CE", "Déclaration conformité", "Dossier technique", "ISO 13485", "Vigilance matériovigilance"] },
            { type: "Distributeur OTC", criteria: ["Notification AFMPS", "Bonnes pratiques distribution", "Traçabilité lots", "Pharmacien responsable", "Assurance RC"] },
            { type: "Fabricant cosmétique", criteria: ["Notification CPNP", "DIP", "BPF ISO 22716", "Personne responsable", "Cosmétovigilance"] },
          ].map(ec => (
            <div key={ec.type} className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>{ec.type}</h3>
              <ul className="space-y-2">
                {ec.criteria.map(cr => (
                  <li key={cr} className="flex items-center gap-2">
                    <CheckCircle2 size={14} style={{ color: "#059669" }} />
                    <span className="text-[12px]" style={{ color: "#616B7C" }}>{cr}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOnboarding;