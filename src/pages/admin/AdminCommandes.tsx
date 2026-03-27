import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import {
  ShoppingCart, TrendingUp, Clock, CreditCard, Truck,
  Search, Filter, Download, Eye,
} from "lucide-react";

type BuyerType = "Pharmacie" | "MRS" | "Hôpital" | "Cabinet" | "Infirmier" | "Parapharmacie";

const buyerColors: Record<BuyerType, { bg: string; text: string }> = {
  Pharmacie: { bg: "#EFF6FF", text: "#1B5BDA" },
  MRS: { bg: "#F5F3FF", text: "#7C3AED" },
  "Hôpital": { bg: "#FEF2F2", text: "#EF4343" },
  Cabinet: { bg: "#FFFBEB", text: "#D97706" },
  Infirmier: { bg: "#F0FDF4", text: "#059669" },
  Parapharmacie: { bg: "#FDF2F8", text: "#E70866" },
};

interface Order {
  id: string;
  refPO: string;
  buyer: string;
  buyerType: BuyerType;
  seller: string;
  amountHT: number;
  tva: number;
  ttc: number;
  paymentTerms: string;
  dueDate: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  date: string;
  items: number;
}

const orders: Order[] = [
  { id: "MK-2025-00147", refPO: "PO-PHR-2025-089", buyer: "Pharmacie Centrale Bruxelles", buyerType: "Pharmacie", seller: "Valerco NV", amountHT: 1245.80, tva: 261.62, ttc: 1507.42, paymentTerms: "Net 30", dueDate: "15/04/2025", status: "confirmed", date: "16/03/2025", items: 8 },
  { id: "MK-2025-00146", refPO: "PO-MRS-2025-034", buyer: "Résidence Les Tilleuls", buyerType: "MRS", seller: "Pharmamed SRL", amountHT: 3890.50, tva: 233.43, ttc: 4123.93, paymentTerms: "Net 60", dueDate: "15/05/2025", status: "shipped", date: "15/03/2025", items: 24 },
  { id: "MK-2025-00145", refPO: "PO-HOP-2025-012", buyer: "CHU Saint-Pierre", buyerType: "Hôpital", seller: "MedDistri SA", amountHT: 12450.00, tva: 747.00, ttc: 13197.00, paymentTerms: "Net 60", dueDate: "14/05/2025", status: "pending", date: "14/03/2025", items: 45 },
  { id: "MK-2025-00144", refPO: "PO-CAB-2025-067", buyer: "Cabinet Dr. Janssens", buyerType: "Cabinet", seller: "Valerco NV", amountHT: 456.30, tva: 95.82, ttc: 552.12, paymentTerms: "Comptant", dueDate: "14/03/2025", status: "delivered", date: "12/03/2025", items: 5 },
  { id: "MK-2025-00143", refPO: "PO-INF-2025-021", buyer: "Soins Infirmiers Liège", buyerType: "Infirmier", seller: "Pharma-GDD SRL", amountHT: 234.60, tva: 49.27, ttc: 283.87, paymentTerms: "Net 30", dueDate: "10/04/2025", status: "confirmed", date: "11/03/2025", items: 3 },
  { id: "MK-2025-00142", refPO: "PO-PAR-2025-045", buyer: "Parapharmacie du Midi", buyerType: "Parapharmacie", seller: "Brussels Med Supply", amountHT: 678.90, tva: 142.57, ttc: 821.47, paymentTerms: "Net 30", dueDate: "09/04/2025", status: "shipped", date: "10/03/2025", items: 12 },
  { id: "MK-2025-00141", refPO: "PO-PHR-2025-088", buyer: "Pharmacie Molière", buyerType: "Pharmacie", seller: "Pharmamed SRL", amountHT: 890.20, tva: 53.41, ttc: 943.61, paymentTerms: "Net 30", dueDate: "08/04/2025", status: "delivered", date: "09/03/2025", items: 15 },
  { id: "MK-2025-00140", refPO: "PO-MRS-2025-033", buyer: "CPAS Namur", buyerType: "MRS", seller: "MedDistri SA", amountHT: 5670.00, tva: 340.20, ttc: 6010.20, paymentTerms: "Net 60", dueDate: "07/05/2025", status: "confirmed", date: "08/03/2025", items: 38 },
  { id: "MK-2025-00139", refPO: "PO-HOP-2025-011", buyer: "Clinique Ste-Anne", buyerType: "Hôpital", seller: "Valerco NV", amountHT: 8920.00, tva: 535.20, ttc: 9455.20, paymentTerms: "Net 60", dueDate: "06/05/2025", status: "cancelled", date: "07/03/2025", items: 32 },
  { id: "MK-2025-00138", refPO: "PO-PHR-2025-087", buyer: "Pharmacie Degroote", buyerType: "Pharmacie", seller: "Pharma-GDD SRL", amountHT: 345.60, tva: 72.58, ttc: 418.18, paymentTerms: "Comptant", dueDate: "06/03/2025", status: "delivered", date: "06/03/2025", items: 6 },
];

const statusFilters = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmées" },
  { key: "shipped", label: "Expédiées" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];

const agingData = [
  { range: "0-30 jours", color: "#059669", bg: "#F0FDF4", amount: 45890, invoices: 28 },
  { range: "31-60 jours", color: "#1B5BDA", bg: "#EFF6FF", amount: 23450, invoices: 14 },
  { range: "61-90 jours", color: "#F59E0B", bg: "#FFFBEB", amount: 8760, invoices: 5 },
  { range: "+90 jours", color: "#EF4343", bg: "#FEF2F2", amount: 3200, invoices: 2 },
];

const buyerProfiles: { type: BuyerType; orders: number; gmv: number; avgBasket: number; paymentTerms: string }[] = [
  { type: "Pharmacie", orders: 412, gmv: 245800, avgBasket: 596, paymentTerms: "Net 30" },
  { type: "MRS", orders: 89, gmv: 178400, avgBasket: 2004, paymentTerms: "Net 60" },
  { type: "Hôpital", orders: 34, gmv: 312600, avgBasket: 9194, paymentTerms: "Net 60" },
  { type: "Cabinet", orders: 156, gmv: 67800, avgBasket: 435, paymentTerms: "Comptant / Net 30" },
  { type: "Infirmier", orders: 78, gmv: 23400, avgBasket: 300, paymentTerms: "Net 30" },
  { type: "Parapharmacie", orders: 67, gmv: 45600, avgBasket: 681, paymentTerms: "Net 30" },
];

const timeline = [
  { time: "14:32", event: "Commande MK-2025-00147 confirmée", detail: "Pharmacie Centrale Bruxelles", type: "confirmed" },
  { time: "13:15", event: "Expédition MK-2025-00146", detail: "Résidence Les Tilleuls — Transporteur: Bpost", type: "shipped" },
  { time: "11:48", event: "Nouvelle commande MK-2025-00145", detail: "CHU Saint-Pierre — 12 450,00 EUR HT", type: "pending" },
  { time: "10:20", event: "Livraison confirmée MK-2025-00144", detail: "Cabinet Dr. Janssens", type: "delivered" },
  { time: "09:05", event: "Annulation MK-2025-00139", detail: "Clinique Ste-Anne — Raison: budget gelé", type: "cancelled" },
  { time: "08:30", event: "Paiement reçu MK-2025-00138", detail: "Pharmacie Degroote — 418,18 EUR TTC", type: "delivered" },
];

const timelineColors: Record<string, string> = {
  confirmed: "#1B5BDA",
  shipped: "#7C3AED",
  pending: "#F59E0B",
  delivered: "#059669",
  cancelled: "#EF4343",
};

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminCommandes = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"list" | "timeline" | "aging" | "buyers">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.buyer.toLowerCase().includes(search.toLowerCase()) && !o.seller.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByStatus = (s: string) => s === "all" ? orders.length : orders.filter((o) => o.status === s).length;

  const tabs = [
    { key: "list" as const, label: "Liste" },
    { key: "timeline" as const, label: "Timeline" },
    { key: "aging" as const, label: "Échéances paiement" },
    { key: "buyers" as const, label: "Par type acheteur" },
  ];

  return (
    <div>
      <AdminTopBar title={t("orders")} subtitle="Gestion des commandes B2B" actions={
        <button className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: "#1B5BDA" }}>
          <Download size={15} /> Export CSV
        </button>
      } />

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard icon={TrendingUp} label="GMV jour" value="18 450 EUR" evolution={{ value: 12.4, label: "vs hier" }} />
        <KpiCard icon={ShoppingCart} label="Commandes jour" value="47" evolution={{ value: 8.2, label: "vs hier" }} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={CreditCard} label="Panier moyen" value="392 EUR" iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Clock} label="Encours paiements" value="81 300 EUR" iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Truck} label="Délai moyen livraison" value="2,4j" iconColor="#E70866" iconBg="#FDF2F8" />
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

      {/* Tab: Liste */}
      {activeTab === "list" && (
        <div>
          {/* Status chips */}
          <div className="flex items-center gap-2 mb-4">
            {statusFilters.map((sf) => (
              <button key={sf.key} onClick={() => setStatusFilter(sf.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                style={{
                  backgroundColor: statusFilter === sf.key ? "#1E293B" : "#fff",
                  color: statusFilter === sf.key ? "#fff" : "#616B7C",
                  border: `1px solid ${statusFilter === sf.key ? "#1E293B" : "#E2E8F0"}`,
                }}>
                {sf.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: statusFilter === sf.key ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: statusFilter === sf.key ? "#fff" : "#8B95A5" }}>
                  {countByStatus(sf.key)}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <Search size={14} style={{ color: "#8B95A5" }} />
              <input type="text" placeholder="Rechercher par ID, acheteur, vendeur..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}>
              <Filter size={14} /> Filtres
            </button>
          </div>

          {/* Table */}
          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["ID / Réf PO", "Acheteur", "Type", "Vendeur", "HT", "TVA", "TTC", "Paiement", "Échéance", "Statut"].map((h) => (
                      <th key={h} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="cursor-pointer transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <td className="px-3 py-3">
                        <span className="text-[12px] font-bold font-mono block" style={{ color: "#1B5BDA" }}>{o.id}</span>
                        <span className="text-[10px]" style={{ color: "#8B95A5" }}>{o.refPO}</span>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>{o.buyer}</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: buyerColors[o.buyerType].bg, color: buyerColors[o.buyerType].text }}>
                          {o.buyerType}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.seller}</td>
                      <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(o.amountHT)}</td>
                      <td className="px-3 py-3 text-[11px] font-mono" style={{ color: "#8B95A5" }}>{fmt(o.tva)}</td>
                      <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(o.ttc)}</td>
                      <td className="px-3 py-3 text-[11px]" style={{ color: "#616B7C" }}>{o.paymentTerms}</td>
                      <td className="px-3 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{o.dueDate}</td>
                      <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Timeline */}
      {activeTab === "timeline" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Activité du jour</h3>
          {timeline.map((t, i) => (
            <div key={i} className="flex items-start gap-4 py-3" style={{ borderBottom: i < timeline.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <span className="text-[12px] font-mono shrink-0 w-12 pt-0.5" style={{ color: "#8B95A5" }}>{t.time}</span>
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: timelineColors[t.type] || "#8B95A5" }} />
              <div>
                <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{t.event}</span>
                <p className="text-[11px] mt-0.5" style={{ color: "#8B95A5" }}>{t.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Échéances paiement (balance âgée) */}
      {activeTab === "aging" && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-5">
            {agingData.map((a) => (
              <div key={a.range} className="p-5 rounded-[10px] text-center" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <span className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>{a.range}</span>
                <p className="text-[22px] font-bold mt-1" style={{ color: a.color }}>{fmt(a.amount)} EUR</p>
                <p className="text-[11px] mt-1" style={{ color: "#616B7C" }}>{a.invoices} factures</p>
                <div className="mt-3 h-2 rounded-full" style={{ backgroundColor: a.bg }}>
                  <div className="h-2 rounded-full" style={{ width: `${(a.amount / 45890) * 100}%`, backgroundColor: a.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-1" style={{ color: "#1D2530" }}>Total encours</h3>
            <p className="text-[28px] font-bold" style={{ color: "#1D2530" }}>{fmt(agingData.reduce((a, d) => a + d.amount, 0))} EUR</p>
            <p className="text-[12px] mt-1" style={{ color: "#8B95A5" }}>{agingData.reduce((a, d) => a + d.invoices, 0)} factures en attente de paiement</p>
          </div>
        </div>
      )}

      {/* Tab: Par type acheteur */}
      {activeTab === "buyers" && (
        <div className="grid grid-cols-3 gap-4">
          {buyerProfiles.map((bp) => (
            <div key={bp.type} className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: buyerColors[bp.type].bg, color: buyerColors[bp.type].text }}>
                  {bp.type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px]" style={{ color: "#8B95A5" }}>Commandes</span>
                  <p className="text-[18px] font-bold" style={{ color: "#1D2530" }}>{bp.orders}</p>
                </div>
                <div>
                  <span className="text-[11px]" style={{ color: "#8B95A5" }}>GMV</span>
                  <p className="text-[18px] font-bold" style={{ color: "#1B5BDA" }}>{(bp.gmv / 1000).toFixed(1)}k EUR</p>
                </div>
                <div>
                  <span className="text-[11px]" style={{ color: "#8B95A5" }}>Panier moyen</span>
                  <p className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{bp.avgBasket} EUR</p>
                </div>
                <div>
                  <span className="text-[11px]" style={{ color: "#8B95A5" }}>Paiement</span>
                  <p className="text-[12px] font-semibold" style={{ color: "#616B7C" }}>{bp.paymentTerms}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCommandes;
