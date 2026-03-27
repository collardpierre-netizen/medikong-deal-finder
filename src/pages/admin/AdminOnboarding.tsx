import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { useVendorOnboarding } from "@/hooks/useAdminData";
import {
  CheckCircle2, Clock, FileText, AlertTriangle, Users, ChevronRight,
  Shield, Award, FileCheck, Search, Filter, Settings,
} from "lucide-react";

const steps = [
  { num: 1, label: "Inscription", key: "inscription", icon: FileText },
  { num: 2, label: "Vérification KYC", key: "verification_kyc", icon: Shield },
  { num: 3, label: "Documents", key: "documents", icon: FileCheck },
  { num: 4, label: "Revue finale", key: "revue_finale", icon: Award },
  { num: 5, label: "Activé", key: "active", icon: CheckCircle2 },
];

const stepToNum = (step: string): number => {
  const found = steps.find(s => s.key === step);
  return found ? found.num : 1;
};

const AdminOnboarding = () => {
  const { t } = useI18n();
  const { data: onboardingData = [], isLoading } = useVendorOnboarding();
  const [activeTab, setActiveTab] = useState<"pipeline" | "documents" | "criteria">("pipeline");

  const candidates = onboardingData.map(o => ({
    id: o.id,
    company: (o.vendors as any)?.company_name || "—",
    legalForm: (o.vendors as any)?.legal_form || "SRL",
    contact: (o.vendors as any)?.contact_name || "—",
    email: (o.vendors as any)?.email || "—",
    step: stepToNum(o.step),
    stepLabel: steps.find(s => s.key === o.step)?.label || o.step,
    progress: o.progress_percent || 0,
    notes: o.notes || "",
    date: new Date(o.started_at).toLocaleDateString("fr-BE"),
    documents: o.documents as Record<string, boolean> || {},
  }));

  const stepCounts = steps.map(s => candidates.filter(c => c.step === s.num).length);

  const tabs = [
    { key: "pipeline" as const, label: "Pipeline" },
    { key: "documents" as const, label: "Suivi documents" },
    { key: "criteria" as const, label: "Critères éligibilité" },
  ];

  const docLabels = ["licence", "assurance", "ce", "afmps", "tracabilite", "vigilance"];
  const docLabelNames: Record<string, string> = {
    licence: "Licence grossiste", assurance: "Assurance RC", ce: "Certificats CE",
    afmps: "Notification AFMPS", tracabilite: "Traçabilité lots", vigilance: "Contact vigilance",
  };

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
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{c.company}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}>{c.legalForm}</span>
                    </div>
                    <p className="text-[12px] mt-0.5" style={{ color: "#616B7C" }}>{c.contact} · {c.email}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={c.step === 5 ? "active" : "pending"} label={c.stepLabel} />
                    <p className="text-[10px] mt-1" style={{ color: "#8B95A5" }}>Candidature: {c.date}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium" style={{ color: "#616B7C" }}>Progression</span>
                    <span className="text-[11px] font-bold" style={{ color: "#1B5BDA" }}>{c.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${c.progress}%`, backgroundColor: c.progress === 100 ? "#059669" : "#1B5BDA" }} />
                  </div>
                </div>
                {c.notes && <p className="text-[11px] italic" style={{ color: "#8B95A5" }}>{c.notes}</p>}
              </div>
            ))
          )}
          {!isLoading && candidates.length === 0 && (
            <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun vendeur en onboarding</div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>Vendeur</th>
                  {docLabels.map(d => (
                    <th key={d} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: "#8B95A5" }}>{docLabelNames[d]}</th>
                  ))}
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-center" style={{ color: "#8B95A5" }}>Progression</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1D2530" }}>{c.company}</td>
                    {docLabels.map(d => (
                      <td key={d} className="px-3 py-3 text-center">
                        {c.documents[d] ? <CheckCircle2 size={16} style={{ color: "#059669" }} className="mx-auto" /> : <AlertTriangle size={16} style={{ color: "#EF4343" }} className="mx-auto" />}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center text-[13px] font-bold" style={{ color: "#1B5BDA" }}>{c.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
