import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import {
  AlertCircle, Search, Clock, CheckCircle2, MessageSquare,
  ArrowRight, User, Store,
} from "lucide-react";

interface Dispute {
  id: string;
  orderId: string;
  buyer: string;
  seller: string;
  reason: string;
  amount: number;
  status: "open" | "investigation" | "seller_response" | "resolved" | "escalated";
  sla: string;
  slaOk: boolean;
  date: string;
  priority: "low" | "medium" | "high" | "urgent";
}

const disputes: Dispute[] = [
  { id: "CLM-001", orderId: "MK-2025-00140", buyer: "CPAS Namur", seller: "MedDistri SA", reason: "Produit non conforme — lot expiré", amount: 2340.00, status: "open", sla: "48h restantes", slaOk: true, date: "15/03/2025", priority: "urgent" },
  { id: "CLM-002", orderId: "MK-2025-00138", buyer: "Pharmacie Degroote", seller: "Pharma-GDD SRL", reason: "Quantité incorrecte — manque 2 boîtes", amount: 145.20, status: "investigation", sla: "24h restantes", slaOk: true, date: "14/03/2025", priority: "medium" },
  { id: "CLM-003", orderId: "MK-2025-00135", buyer: "CHU Saint-Pierre", seller: "Valerco NV", reason: "Retard livraison > 5 jours", amount: 890.00, status: "seller_response", sla: "12h restantes", slaOk: false, date: "12/03/2025", priority: "high" },
  { id: "CLM-004", orderId: "MK-2025-00130", buyer: "Cabinet Dr. Janssens", seller: "Pharmamed SRL", reason: "Produit endommagé au transport", amount: 67.50, status: "resolved", sla: "Résolu", slaOk: true, date: "08/03/2025", priority: "low" },
  { id: "CLM-005", orderId: "MK-2025-00128", buyer: "Parapharmacie du Midi", seller: "Brussels Med Supply", reason: "Erreur de référence produit", amount: 234.00, status: "resolved", sla: "Résolu", slaOk: true, date: "05/03/2025", priority: "medium" },
  { id: "CLM-006", orderId: "MK-2025-00125", buyer: "Résidence Les Tilleuls", seller: "MedDistri SA", reason: "Certificat CE manquant", amount: 1560.00, status: "escalated", sla: "Dépassé", slaOk: false, date: "01/03/2025", priority: "urgent" },
];

const statusLabels: Record<string, string> = {
  open: "Réclamation",
  investigation: "Enquête",
  seller_response: "Attente vendeur",
  resolved: "Résolu",
  escalated: "Escaladé",
};

const statusSteps = ["open", "investigation", "seller_response", "resolved"];
const stepLabels = ["Réclamation", "Enquête", "Réponse vendeur", "Décision"];

const priorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "#F0FDF4", text: "#059669" },
  medium: { bg: "#EFF6FF", text: "#1B5BDA" },
  high: { bg: "#FFFBEB", text: "#D97706" },
  urgent: { bg: "#FEF2F2", text: "#EF4343" },
};

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminLitiges = () => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Dispute | null>(null);

  const filtered = disputes.filter(
    (d) =>
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.buyer.toLowerCase().includes(search.toLowerCase()) ||
      d.seller.toLowerCase().includes(search.toLowerCase()) ||
      d.reason.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = disputes.filter((d) => d.status === "open").length;
  const investigationCount = disputes.filter((d) => d.status === "investigation").length;
  const sellerCount = disputes.filter((d) => d.status === "seller_response" || d.status === "escalated").length;
  const resolvedCount = disputes.filter((d) => d.status === "resolved").length;

  return (
    <div>
      <AdminTopBar title={t("disputes")} subtitle="Gestion des litiges et réclamations" />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard icon={AlertCircle} label="Ouverts" value={String(openCount)} iconColor="#EF4343" iconBg="#FEF2F2" />
        <KpiCard icon={Search} label="En enquête" value={String(investigationCount)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Clock} label="Attente vendeur" value={String(sellerCount)} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={CheckCircle2} label="Résolus ce mois" value={String(resolvedCount)} iconColor="#059669" iconBg="#F0FDF4" />
      </div>

      {/* Workflow steps */}
      <div className="p-4 rounded-[10px] mb-5 flex items-center justify-center gap-2" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ backgroundColor: "#F8FAFC" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: ["#EF4343", "#1B5BDA", "#F59E0B", "#059669"][i] }}>
                {i + 1}
              </div>
              <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && <ArrowRight size={14} style={{ color: "#D4D9E1" }} />}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md mb-4 max-w-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <Search size={14} style={{ color: "#8B95A5" }} />
        <input type="text" placeholder="Rechercher par ID, acheteur, vendeur, motif..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Table */}
        <div className={selected ? "col-span-7" : "col-span-12"}>
          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  {["ID", "Commande", "Acheteur", "Vendeur", "Motif", "Montant", "Priorité", "Statut", "SLA"].map((h) => (
                    <th key={h} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} onClick={() => setSelected(d)} className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: selected?.id === d.id ? "#EFF6FF" : "transparent" }}
                    onMouseEnter={(e) => { if (selected?.id !== d.id) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                    onMouseLeave={(e) => { if (selected?.id !== d.id) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1B5BDA" }}>{d.id}</td>
                    <td className="px-3 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{d.orderId}</td>
                    <td className="px-3 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>{d.buyer}</td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{d.seller}</td>
                    <td className="px-3 py-3 text-[11px] max-w-[160px] truncate" style={{ color: "#1D2530" }}>{d.reason}</td>
                    <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(d.amount)} EUR</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: priorityColors[d.priority].bg, color: priorityColors[d.priority].text }}>
                        {d.priority === "urgent" ? "Urgent" : d.priority === "high" ? "Haute" : d.priority === "medium" ? "Moyenne" : "Basse"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        backgroundColor: d.status === "resolved" ? "#F0FDF4" : d.status === "escalated" ? "#FEF2F2" : d.status === "open" ? "#FFFBEB" : "#EFF6FF",
                        color: d.status === "resolved" ? "#059669" : d.status === "escalated" ? "#EF4343" : d.status === "open" ? "#D97706" : "#1B5BDA",
                      }}>
                        {statusLabels[d.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[10px] font-semibold" style={{ color: d.slaOk ? "#059669" : "#EF4343" }}>{d.sla}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="col-span-5 p-5 rounded-[10px] space-y-4" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[18px] font-bold" style={{ color: "#1D2530" }}>{selected.id}</span>
                <span className="text-[12px] ml-2" style={{ color: "#8B95A5" }}>{selected.date}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Fermer</button>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-1">
              {statusSteps.map((step, i) => {
                const currentIdx = statusSteps.indexOf(selected.status === "escalated" ? "seller_response" : selected.status);
                const isActive = i <= currentIdx;
                return (
                  <div key={step} className="flex-1">
                    <div className="h-2 rounded-full" style={{ backgroundColor: isActive ? ["#EF4343", "#1B5BDA", "#F59E0B", "#059669"][i] : "#E2E8F0" }} />
                    <span className="text-[9px] mt-1 block text-center" style={{ color: isActive ? "#1D2530" : "#8B95A5" }}>{stepLabels[i]}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} style={{ color: "#1B5BDA" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Acheteur</span>
                </div>
                <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{selected.buyer}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Store size={14} style={{ color: "#7C3AED" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Vendeur</span>
                </div>
                <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{selected.seller}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} style={{ color: "#F59E0B" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Motif</span>
                </div>
                <p className="text-[13px]" style={{ color: "#616B7C" }}>{selected.reason}</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg text-center" style={{ backgroundColor: "#F8FAFC" }}>
                  <span className="text-[10px]" style={{ color: "#8B95A5" }}>Montant</span>
                  <p className="text-[16px] font-bold" style={{ color: "#1D2530" }}>{fmt(selected.amount)} EUR</p>
                </div>
                <div className="flex-1 p-3 rounded-lg text-center" style={{ backgroundColor: "#F8FAFC" }}>
                  <span className="text-[10px]" style={{ color: "#8B95A5" }}>Commande</span>
                  <p className="text-[13px] font-mono font-bold" style={{ color: "#1B5BDA" }}>{selected.orderId}</p>
                </div>
              </div>
            </div>

            {selected.status !== "resolved" && (
              <div className="flex gap-2 pt-2">
                <button className="flex-1 py-2 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#1B5BDA" }}>
                  Avancer le statut
                </button>
                <button className="py-2 px-4 rounded-md text-[12px] font-bold" style={{ backgroundColor: "#FEF2F2", color: "#EF4343" }}>
                  Escalader
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLitiges;
