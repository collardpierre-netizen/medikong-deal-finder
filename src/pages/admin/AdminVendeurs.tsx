import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { Search, Filter, Download, Plus, Star, TrendingUp } from "lucide-react";

interface Seller {
  id: string;
  company: string;
  legalForm: string;
  city: string;
  sector: string;
  caMois: number;
  commandes: number;
  commission: number;
  rating: number;
  products: number;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Strategic";
  status: "active" | "pending" | "suspended";
  joined: string;
}

const sellers: Seller[] = [
  { id: "1", company: "Valerco", legalForm: "NV", city: "Kontich", sector: "Matériel médical", caMois: 38900, commandes: 124, commission: 8.5, rating: 4.9, products: 698, tier: "Gold", status: "active", joined: "12/01/2024" },
  { id: "2", company: "Pharmamed", legalForm: "SRL", city: "Bruxelles", sector: "Pharma OTC", caMois: 45200, commandes: 189, commission: 7.2, rating: 4.8, products: 423, tier: "Platinum", status: "active", joined: "03/09/2023" },
  { id: "3", company: "MedDistri", legalForm: "SA", city: "Liège", sector: "Dispositifs médicaux", caMois: 31400, commandes: 87, commission: 9.0, rating: 4.5, products: 312, tier: "Silver", status: "active", joined: "22/05/2024" },
  { id: "4", company: "Brussels Med Supply", legalForm: "BVBA", city: "Bruxelles", sector: "Consommables", caMois: 22800, commandes: 56, commission: 11.0, rating: 3.8, products: 156, tier: "Bronze", status: "active", joined: "14/11/2024" },
  { id: "5", company: "Pharma-GDD", legalForm: "SRL", city: "Gand", sector: "Pharma générique", caMois: 18600, commandes: 42, commission: 8.0, rating: 4.2, products: 89, tier: "Bronze", status: "active", joined: "08/02/2025" },
  { id: "6", company: "HealthLine Belgium", legalForm: "NV", city: "Anvers", sector: "Hygiène", caMois: 0, commandes: 0, commission: 10.0, rating: 0, products: 0, tier: "Bronze", status: "pending", joined: "25/03/2025" },
  { id: "7", company: "MediTech Wallonie", legalForm: "SRL", city: "Namur", sector: "Dispositifs médicaux", caMois: 0, commandes: 0, commission: 10.0, rating: 0, products: 0, tier: "Bronze", status: "pending", joined: "22/03/2025" },
  { id: "8", company: "PharmaStar", legalForm: "SA", city: "Charleroi", sector: "Pharma OTC", caMois: 8200, commandes: 18, commission: 12.0, rating: 2.9, products: 34, tier: "Bronze", status: "suspended", joined: "10/08/2024" },
];

const tierColors: Record<string, { bg: string; text: string }> = {
  Bronze: { bg: "#FEF3C7", text: "#92400E" },
  Silver: { bg: "#F1F5F9", text: "#475569" },
  Gold: { bg: "#FEF9C3", text: "#A16207" },
  Platinum: { bg: "#EDE9FE", text: "#7C3AED" },
  Strategic: { bg: "#FCE7F3", text: "#BE185D" },
};

const AdminVendeurs = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "suspended">("active");
  const [search, setSearch] = useState("");

  const tabs = [
    { key: "active" as const, label: "Actifs", count: sellers.filter((s) => s.status === "active").length },
    { key: "pending" as const, label: "En attente", count: sellers.filter((s) => s.status === "pending").length },
    { key: "suspended" as const, label: "Suspendus", count: sellers.filter((s) => s.status === "suspended").length },
  ];

  const filtered = sellers
    .filter((s) => s.status === activeTab)
    .filter((s) => s.company.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <AdminTopBar
        title={t("sellers")}
        subtitle={`${sellers.length} vendeurs enregistrés`}
        actions={
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white"
            style={{ backgroundColor: "#1E293B" }}
          >
            <Plus size={15} />
            Ajouter un vendeur
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent",
              color: activeTab === tab.key ? "#fff" : "#616B7C",
            }}
          >
            {tab.label}
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#F1F5F9",
                color: activeTab === tab.key ? "#fff" : "#8B95A5",
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-sm"
          style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
        >
          <Search size={14} style={{ color: "#8B95A5" }} />
          <input
            type="text"
            placeholder="Rechercher un vendeur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-[13px] outline-none bg-transparent"
            style={{ color: "#1D2530" }}
          />
        </div>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium"
          style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}
        >
          <Filter size={14} />
          Filtres
        </button>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium"
          style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}
        >
          <Download size={14} />
          Export
        </button>
      </div>

      {/* Table */}
      <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <table className="w-full text-left">
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
              {["Vendeur", "Secteur", "CA mois", "Commandes", "Commission", "Rating", "Tier", "Statut", "Inscrit"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.id}
                onClick={() => navigate(`/admin/vendeurs/${s.id}`)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid #F1F5F9" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <td className="px-4 py-3">
                  <div>
                    <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{s.company}</span>
                    <p className="text-[11px]" style={{ color: "#8B95A5" }}>{s.legalForm} — {s.city}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{s.sector}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>
                      €{s.caMois.toLocaleString()}
                    </span>
                    {s.caMois > 0 && <TrendingUp size={12} style={{ color: "#059669" }} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{s.commandes}</td>
                <td className="px-4 py-3 text-[13px]" style={{ color: "#616B7C" }}>{s.commission}%</td>
                <td className="px-4 py-3">
                  {s.rating > 0 ? (
                    <div className="flex items-center gap-1">
                      <Star size={13} fill="#F59E0B" style={{ color: "#F59E0B" }} />
                      <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{s.rating}</span>
                    </div>
                  ) : (
                    <span className="text-[11px]" style={{ color: "#8B95A5" }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: tierColors[s.tier].bg, color: tierColors[s.tier].text }}
                  >
                    {s.tier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{s.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>
            Aucun vendeur trouvé
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVendeurs;
