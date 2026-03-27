import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import {
  CheckCircle2, Clock, FileText, AlertTriangle, Users, ChevronRight,
  Shield, Award, FileCheck, Search, Filter, Settings,
} from "lucide-react";

interface OnboardingCandidate {
  id: string;
  company: string;
  legalForm: string;
  contact: string;
  email: string;
  sector: string;
  step: number;
  stepLabel: string;
  progress: number;
  docs: { licence: boolean; assurance: boolean; ce: boolean; afmps: boolean; tracabilite: boolean; vigilance: boolean };
  notes: string;
  date: string;
  daysInStep: number;
}

const candidates: OnboardingCandidate[] = [
  {
    id: "1", company: "HealthLine Belgium", legalForm: "NV", contact: "Marc Willems", email: "m.willems@healthline.be",
    sector: "Hygiène", step: 1, stepLabel: "Candidature", progress: 20,
    docs: { licence: false, assurance: false, ce: false, afmps: false, tracabilite: false, vigilance: false },
    notes: "Candidature reçue — en attente de revue initiale", date: "25/03/2025", daysInStep: 2,
  },
  {
    id: "2", company: "MediTech Wallonie", legalForm: "SRL", contact: "Sophie Dubois", email: "s.dubois@meditech.be",
    sector: "Dispositifs médicaux", step: 2, stepLabel: "Vérification KYC/KYB", progress: 40,
    docs: { licence: true, assurance: false, ce: true, afmps: true, tracabilite: false, vigilance: false },
    notes: "KYC en cours — BCE vérifié, TVA OK", date: "18/03/2025", daysInStep: 9,
  },
  {
    id: "3", company: "PharmaPlus Antwerpen", legalForm: "BVBA", contact: "Jan Van Damme", email: "j.vandamme@pharmaplus.be",
    sector: "Pharma OTC", step: 3, stepLabel: "Documents & Licences", progress: 60,
    docs: { licence: true, assurance: true, ce: true, afmps: true, tracabilite: false, vigilance: false },
    notes: "Licence grossiste AFMPS validée. Attente assurance RC pro.", date: "10/03/2025", daysInStep: 17,
  },
  {
    id: "4", company: "BioMed Liège", legalForm: "SA", contact: "Pierre Martin", email: "p.martin@biomed.be",
    sector: "Matériel médical", step: 4, stepLabel: "Revue finale", progress: 80,
    docs: { licence: true, assurance: true, ce: true, afmps: true, tracabilite: true, vigilance: true },
    notes: "Tous les documents OK — en revue finale par l'équipe compliance", date: "05/03/2025", daysInStep: 22,
  },
  {
    id: "5", company: "CareLine Brussels", legalForm: "SRL", contact: "Emma Laurent", email: "e.laurent@careline.be",
    sector: "Consommables", step: 5, stepLabel: "Activé", progress: 100,
    docs: { licence: true, assurance: true, ce: true, afmps: true, tracabilite: true, vigilance: true },
    notes: "Activé le 01/03 — période probation 30 jours", date: "15/02/2025", daysInStep: 0,
  },
];

const steps = [
  { num: 1, label: "Candidature", icon: FileText },
  { num: 2, label: "Vérification KYC/KYB", icon: Shield },
  { num: 3, label: "Documents & Licences", icon: FileCheck },
  { num: 4, label: "Revue finale", icon: Award },
  { num: 5, label: "Activé", icon: CheckCircle2 },
];

const docLabels = [
  { key: "licence" as const, label: "Licence grossiste" },
  { key: "assurance" as const, label: "Assurance RC" },
  { key: "ce" as const, label: "Certificats CE" },
  { key: "afmps" as const, label: "Notification AFMPS" },
  { key: "tracabilite" as const, label: "Traçabilité lots" },
  { key: "vigilance" as const, label: "Contact vigilance" },
];

const eligibilityCriteria = [
  { type: "Grossiste", criteria: ["Licence AFMPS", "Assurance RC Pro", "Certificats CE produits", "Système traçabilité", "GDP compliance"] },
  { type: "Fabricant DM", criteria: ["Marquage CE", "Déclaration conformité", "Dossier technique", "Système qualité ISO 13485", "Vigilance matériovigilance"] },
  { type: "Distributeur OTC", criteria: ["Notification AFMPS", "Bonnes pratiques distribution", "Traçabilité lots", "Pharmacien responsable", "Assurance RC"] },
  { type: "Fabricant cosmétique", criteria: ["Notification CPNP", "DIP (Dossier Info Produit)", "BPF ISO 22716", "Personne responsable", "Cosmétovigilance"] },
];

const AdminOnboarding = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"pipeline" | "documents" | "criteria" | "settings">("pipeline");

  const stepCounts = steps.map((s) => candidates.filter((c) => c.step === s.num).length);

  const tabs = [
    { key: "pipeline" as const, label: "Pipeline" },
    { key: "documents" as const, label: "Suivi documents" },
    { key: "criteria" as const, label: "Critères éligibilité" },
    { key: "settings" as const, label: "Paramètres workflow" },
  ];

  return (
    <div>
      <AdminTopBar
        title={t("onboarding")}
        subtitle="Pipeline KYC/KYB des vendeurs"
      />

      {/* Funnel horizontal */}
      <div className="flex items-center gap-2 mb-6 p-4 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center flex-1">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: stepCounts[i] > 0 ? "#1B5BDA" : "#F1F5F9",
                    color: stepCounts[i] > 0 ? "#fff" : "#8B95A5",
                  }}
                >
                  <step.icon size={14} />
                </div>
                <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{step.label}</span>
              </div>
              <div className="ml-9">
                <span
                  className="text-[20px] font-bold"
                  style={{ color: stepCounts[i] > 0 ? "#1B5BDA" : "#8B95A5" }}
                >
                  {stepCounts[i]}
                </span>
              </div>
            </div>
            {i < steps.length - 1 && <ChevronRight size={18} style={{ color: "#D4D9E1" }} className="shrink-0 mx-1" />}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent",
              color: activeTab === tab.key ? "#fff" : "#616B7C",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pipeline" && (
        <div className="space-y-3">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-[10px] transition-shadow hover:shadow-md"
              style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{c.company}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}>
                      {c.legalForm}
                    </span>
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: "#616B7C" }}>
                    {c.contact} · {c.email} · {c.sector}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge
                    status={c.step === 5 ? "active" : c.daysInStep > 15 ? "urgent" : "pending"}
                    label={c.stepLabel}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "#8B95A5" }}>
                    Candidature: {c.date} {c.daysInStep > 0 && `· ${c.daysInStep}j dans cette étape`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium" style={{ color: "#616B7C" }}>Progression</span>
                  <span className="text-[11px] font-bold" style={{ color: "#1B5BDA" }}>{c.progress}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${c.progress}%`,
                      backgroundColor: c.progress === 100 ? "#059669" : "#1B5BDA",
                    }}
                  />
                </div>
              </div>

              {/* Doc badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {docLabels.map((doc) => (
                  <span
                    key={doc.key}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: c.docs[doc.key] ? "#F0FDF4" : "#FEF2F2",
                      color: c.docs[doc.key] ? "#059669" : "#EF4343",
                      border: `1px solid ${c.docs[doc.key] ? "#BBF7D0" : "#FECACA"}`,
                    }}
                  >
                    {c.docs[doc.key] ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                    {doc.label}
                  </span>
                ))}
              </div>

              {/* Notes */}
              <p className="text-[11px] italic" style={{ color: "#8B95A5" }}>
                {c.notes}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
                  Vendeur
                </th>
                {docLabels.map((d) => (
                  <th key={d.key} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: "#8B95A5" }}>
                    {d.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-center" style={{ color: "#8B95A5" }}>
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const score = Object.values(c.docs).filter(Boolean).length;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{c.company}</span>
                    </td>
                    {docLabels.map((d) => (
                      <td key={d.key} className="px-3 py-3 text-center">
                        {c.docs[d.key] ? (
                          <CheckCircle2 size={16} style={{ color: "#059669" }} className="mx-auto" />
                        ) : (
                          <AlertTriangle size={16} style={{ color: "#EF4343" }} className="mx-auto" />
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: score >= 5 ? "#059669" : score >= 3 ? "#F59E0B" : "#EF4343" }}
                      >
                        {score}/6
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "criteria" && (
        <div className="grid grid-cols-2 gap-4">
          {eligibilityCriteria.map((ec) => (
            <div
              key={ec.type}
              className="p-5 rounded-[10px]"
              style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
            >
              <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>{ec.type}</h3>
              <ul className="space-y-2">
                {ec.criteria.map((cr) => (
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

      {activeTab === "settings" && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Délai max traitement", value: "15 jours", desc: "Temps maximum pour compléter le processus d'onboarding" },
            { label: "Relance automatique", value: "3 jours", desc: "Délai avant envoi d'un rappel automatique pour documents manquants" },
            { label: "Score minimum requis", value: "5/6", desc: "Nombre minimum de documents validés pour passer en revue finale" },
            { label: "Période probation", value: "30 jours", desc: "Durée de la période d'essai après activation avec +3% commission" },
          ].map((param) => (
            <div
              key={param.label}
              className="p-5 rounded-[10px]"
              style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{param.label}</span>
                <span
                  className="px-3 py-1 rounded-md text-[13px] font-bold"
                  style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}
                >
                  {param.value}
                </span>
              </div>
              <p className="text-[11px]" style={{ color: "#8B95A5" }}>{param.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOnboarding;
