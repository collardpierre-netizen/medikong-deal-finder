import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import StatusBadge from "@/components/admin/StatusBadge";
import VendorFormDialog from "@/components/admin/VendorFormDialog";
import { useI18n } from "@/contexts/I18nContext";
import { useVendors } from "@/hooks/useAdminData";
import { Search, Filter, Download, Plus, ExternalLink } from "lucide-react";

const AdminVendeurs = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: vendors = [], isLoading } = useVendors();
  const [activeTab, setActiveTab] = useState<"all" | "medikong" | "qogita_virtual" | "real">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const tabs = [
    { key: "all" as const, label: "Tous", count: vendors.length },
    { key: "medikong" as const, label: "MediKong", count: vendors.filter(v => v.type === "medikong").length },
    { key: "qogita_virtual" as const, label: "Qogita", count: vendors.filter(v => v.type === "qogita_virtual").length },
    { key: "real" as const, label: "Réels", count: vendors.filter(v => v.type === "real").length },
  ];

  const filtered = vendors
    .filter(v => activeTab === "all" || v.type === activeTab)
    .filter(v => (v.company_name || v.name).toLowerCase().includes(search.toLowerCase()) || (v.city || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <AdminTopBar title={t("sellers")} subtitle={`${vendors.length} vendeurs enregistrés`}
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: "#1E293B" }}>
            <Plus size={15} /> Ajouter un vendeur
          </button>
        }
      />

      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: activeTab === tab.key ? "#fff" : "#8B95A5" }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-sm" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <Search size={14} style={{ color: "#8B95A5" }} />
          <input type="text" placeholder="Rechercher un vendeur..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
        </div>
      </div>

      <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {isLoading ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "Type", "Ville", "Commission", "Statut", "Inscrit", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/admin/vendeurs/${s.id}`)}
                  className="cursor-pointer transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{s.company_name || s.name}</span>
                    <p className="text-[11px]" style={{ color: "#8B95A5" }}>{s.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#F1F5F9", color: "#616B7C" }}>{s.type}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{s.city || "—"}, {s.country_code}</td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: "#616B7C" }}>{s.commission_rate}%</td>
                  <td className="px-4 py-3"><StatusBadge status={s.is_active ? "active" : "inactive"} /></td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{new Date(s.created_at).toLocaleDateString("fr-BE")}</td>
                  <td className="px-4 py-3">
                    {s.slug && (
                      <a
                        href={`/vendeur/${s.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold hover:opacity-80 transition-opacity"
                        style={{ color: "#1B5BDA", backgroundColor: "#EEF2FF" }}
                      >
                        <ExternalLink size={11} /> Page publique
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun vendeur trouvé</div>
        )}
      </div>

      <VendorFormDialog open={showForm} onOpenChange={setShowForm} />
    </div>
  );
};

export default AdminVendeurs;