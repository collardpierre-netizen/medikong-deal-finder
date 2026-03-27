import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useI18n } from "@/contexts/I18nContext";
import { useDisputes } from "@/hooks/useAdminData";
import StatusBadge from "@/components/admin/StatusBadge";
import {
  AlertCircle, Search, Clock, CheckCircle2, MessageSquare,
  ArrowRight, User, Store,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  reclamation: "Réclamation",
  enquete: "Enquête",
  reponse_vendeur: "Attente vendeur",
  decision: "Décision",
  resolu: "Résolu",
  rejete: "Rejeté",
};

const stepLabels = ["Réclamation", "Enquête", "Réponse vendeur", "Décision"];

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminLitiges = () => {
  const { t } = useI18n();
  const { data: disputes = [], isLoading } = useDisputes();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const filtered = disputes.filter(
    (d) =>
      d.dispute_number.toLowerCase().includes(search.toLowerCase()) ||
      ((d.buyers as any)?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      ((d.vendors as any)?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      d.reason.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = disputes.filter((d) => d.status === "reclamation").length;
  const investigationCount = disputes.filter((d) => d.status === "enquete").length;
  const sellerCount = disputes.filter((d) => d.status === "reponse_vendeur" || d.status === "decision").length;
  const resolvedCount = disputes.filter((d) => d.status === "resolu").length;

  return (
    <div>
      <AdminTopBar title={t("disputes")} subtitle="Gestion des litiges et réclamations" />

      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard icon={AlertCircle} label="Ouverts" value={String(openCount)} iconColor="#EF4343" iconBg="#FEF2F2" />
        <KpiCard icon={Search} label="En enquête" value={String(investigationCount)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Clock} label="Attente vendeur" value={String(sellerCount)} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={CheckCircle2} label="Résolus" value={String(resolvedCount)} iconColor="#059669" iconBg="#F0FDF4" />
      </div>

      <div className="p-4 rounded-[10px] mb-5 flex items-center justify-center gap-2" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ backgroundColor: "#F8FAFC" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: ["#EF4343", "#1B5BDA", "#F59E0B", "#059669"][i] }}>{i + 1}</div>
              <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && <ArrowRight size={14} style={{ color: "#D4D9E1" }} />}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-md mb-4 max-w-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <Search size={14} style={{ color: "#8B95A5" }} />
        <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className={selected ? "col-span-7" : "col-span-12"}>
          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["ID", "Commande", "Acheteur", "Vendeur", "Motif", "Montant", "Statut", "SLA"].map((h) => (
                      <th key={h} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} onClick={() => setSelected(selected?.id === d.id ? null : d)} className="cursor-pointer transition-colors"
                      style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: selected?.id === d.id ? "#EFF6FF" : "transparent" }}
                      onMouseEnter={(e) => { if (selected?.id !== d.id) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                      onMouseLeave={(e) => { if (selected?.id !== d.id) e.currentTarget.style.backgroundColor = "transparent"; }}>
                      <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1B5BDA" }}>{d.dispute_number}</td>
                      <td className="px-3 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{(d.orders as any)?.order_number || "—"}</td>
                      <td className="px-3 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>{(d.buyers as any)?.company_name || "—"}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{(d.vendors as any)?.company_name || "—"}</td>
                      <td className="px-3 py-3 text-[11px] max-w-[160px] truncate" style={{ color: "#1D2530" }}>{d.reason}</td>
                      <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(Number(d.amount))} EUR</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                          backgroundColor: d.status === "resolu" ? "#F0FDF4" : d.status === "reclamation" ? "#FFFBEB" : "#EFF6FF",
                          color: d.status === "resolu" ? "#059669" : d.status === "reclamation" ? "#D97706" : "#1B5BDA",
                        }}>
                          {statusLabels[d.status] || d.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[10px] font-semibold" style={{ color: d.sla_deadline ? "#059669" : "#8B95A5" }}>
                        {d.sla_deadline ? new Date(d.sla_deadline).toLocaleDateString("fr-BE") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && (
          <div className="col-span-5 p-5 rounded-[10px] space-y-4" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <div className="flex items-center justify-between">
              <span className="text-[18px] font-bold" style={{ color: "#1D2530" }}>{selected.dispute_number}</span>
              <button onClick={() => setSelected(null)} className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Fermer</button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                <div className="flex items-center gap-2 mb-2"><User size={14} style={{ color: "#1B5BDA" }} /><span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Acheteur</span></div>
                <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{(selected.buyers as any)?.company_name || "—"}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                <div className="flex items-center gap-2 mb-2"><Store size={14} style={{ color: "#7C3AED" }} /><span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Vendeur</span></div>
                <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{(selected.vendors as any)?.company_name || "—"}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                <div className="flex items-center gap-2 mb-2"><MessageSquare size={14} style={{ color: "#F59E0B" }} /><span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Motif</span></div>
                <p className="text-[13px]" style={{ color: "#616B7C" }}>{selected.reason}</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg text-center" style={{ backgroundColor: "#F8FAFC" }}>
                  <span className="text-[10px]" style={{ color: "#8B95A5" }}>Montant</span>
                  <p className="text-[16px] font-bold" style={{ color: "#1D2530" }}>{fmt(Number(selected.amount))} EUR</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLitiges;
