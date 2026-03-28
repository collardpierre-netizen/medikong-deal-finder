import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { useOrders } from "@/hooks/useAdminData";
import {
  ShoppingCart, TrendingUp, Clock, CreditCard, Truck,
  Search, Filter, Download, Eye,
} from "lucide-react";

type BuyerType = "Pharmacie" | "MRS" | "Hôpital" | "Cabinet" | "Infirmier" | "Parapharmacie";

const buyerColors: Record<string, { bg: string; text: string }> = {
  Pharmacie: { bg: "#EFF6FF", text: "#1B5BDA" },
  pharmacie: { bg: "#EFF6FF", text: "#1B5BDA" },
  MRS: { bg: "#F5F3FF", text: "#7C3AED" },
  mrs: { bg: "#F5F3FF", text: "#7C3AED" },
  "Hôpital": { bg: "#FEF2F2", text: "#EF4343" },
  hopital: { bg: "#FEF2F2", text: "#EF4343" },
  Cabinet: { bg: "#FFFBEB", text: "#D97706" },
  cabinet: { bg: "#FFFBEB", text: "#D97706" },
  Infirmier: { bg: "#F0FDF4", text: "#059669" },
  infirmier: { bg: "#F0FDF4", text: "#059669" },
  Parapharmacie: { bg: "#FDF2F8", text: "#E70866" },
  parapharmacie: { bg: "#FDF2F8", text: "#E70866" },
  dentiste: { bg: "#F1F5F9", text: "#475569" },
};

const statusFilters = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmées" },
  { key: "shipped", label: "Expédiées" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminCommandes = () => {
  const { t } = useI18n();
  const { data: ordersData = [], isLoading } = useOrders();
  const { data: buyersData = [] } = useBuyers();
  const [activeTab, setActiveTab] = useState<"list" | "timeline" | "aging" | "buyers">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const orders = ordersData.map(o => ({
    id: o.order_number,
    refPO: o.po_reference || "—",
    buyer: (o.buyers as any)?.company_name || "—",
    buyerType: ((o.buyers as any)?.type || o.buyer_type || "pharmacie") as string,
    seller: (o.vendors as any)?.company_name || "—",
    amountHT: Number(o.total_ht) || Number(o.subtotal) || 0,
    tva: Number(o.tva_amount) || 0,
    ttc: Number(o.total_ttc) || Number(o.total) || 0,
    paymentTerms: o.payment_method || "Net 30",
    dueDate: o.due_date ? new Date(o.due_date).toLocaleDateString("fr-BE") : "—",
    status: o.status as "pending" | "confirmed" | "shipped" | "delivered" | "cancelled",
    date: new Date(o.created_at).toLocaleDateString("fr-BE"),
    items: o.items_count || 0,
  }));

  // Fallback mock data if no orders in DB
  const displayOrders = orders.length > 0 ? orders : [
    { id: "MK-2025-00147", refPO: "PO-PHR-2025-089", buyer: "Pharmacie Centrale Bruxelles", buyerType: "Pharmacie", seller: "Valerco NV", amountHT: 1245.80, tva: 261.62, ttc: 1507.42, paymentTerms: "Net 30", dueDate: "15/04/2025", status: "confirmed" as const, date: "16/03/2025", items: 8 },
    { id: "MK-2025-00146", refPO: "PO-MRS-2025-034", buyer: "Résidence Les Tilleuls", buyerType: "MRS", seller: "Pharmamed SRL", amountHT: 3890.50, tva: 233.43, ttc: 4123.93, paymentTerms: "Net 60", dueDate: "15/05/2025", status: "shipped" as const, date: "15/03/2025", items: 24 },
    { id: "MK-2025-00145", refPO: "PO-HOP-2025-012", buyer: "CHU Saint-Pierre", buyerType: "Hôpital", seller: "MedDistri SA", amountHT: 12450.00, tva: 747.00, ttc: 13197.00, paymentTerms: "Net 60", dueDate: "14/05/2025", status: "pending" as const, date: "14/03/2025", items: 45 },
    { id: "MK-2025-00144", refPO: "PO-CAB-2025-067", buyer: "Cabinet Dr. Janssens", buyerType: "Cabinet", seller: "Valerco NV", amountHT: 456.30, tva: 95.82, ttc: 552.12, paymentTerms: "Comptant", dueDate: "14/03/2025", status: "delivered" as const, date: "12/03/2025", items: 5 },
    { id: "MK-2025-00143", refPO: "PO-INF-2025-021", buyer: "Soins Infirmiers Liège", buyerType: "Infirmier", seller: "Pharma-GDD SRL", amountHT: 234.60, tva: 49.27, ttc: 283.87, paymentTerms: "Net 30", dueDate: "10/04/2025", status: "confirmed" as const, date: "11/03/2025", items: 3 },
  ];

  const filtered = displayOrders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.buyer.toLowerCase().includes(search.toLowerCase()) && !o.seller.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByStatus = (s: string) => s === "all" ? displayOrders.length : displayOrders.filter((o) => o.status === s).length;

  const gmvDay = displayOrders.reduce((a, o) => a + o.amountHT, 0);
  const avgBasket = displayOrders.length > 0 ? Math.round(gmvDay / displayOrders.length) : 0;

  const tabs = [
    { key: "list" as const, label: "Liste" },
    { key: "timeline" as const, label: "Timeline" },
    { key: "aging" as const, label: "Échéances paiement" },
    { key: "buyers" as const, label: "Par type acheteur" },
  ];

  // Timeline from actual orders
  const timeline = displayOrders.slice(0, 6).map(o => ({
    time: new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }),
    event: `${o.status === "pending" ? "Nouvelle commande" : o.status === "confirmed" ? "Commande confirmée" : o.status === "shipped" ? "Expédition" : o.status === "delivered" ? "Livraison confirmée" : "Annulation"} ${o.id}`,
    detail: `${o.buyer} — ${fmt(o.ttc)} EUR TTC`,
    type: o.status,
  }));

  const timelineColors: Record<string, string> = {
    confirmed: "#1B5BDA", shipped: "#7C3AED", pending: "#F59E0B", delivered: "#059669", cancelled: "#EF4343",
  };

  // Buyer profile aggregation
  const buyerTypeMap = new Map<string, { orders: number; gmv: number }>();
  displayOrders.forEach(o => {
    const t = o.buyerType;
    const existing = buyerTypeMap.get(t) || { orders: 0, gmv: 0 };
    existing.orders++;
    existing.gmv += o.amountHT;
    buyerTypeMap.set(t, existing);
  });

  const buyerProfiles = Array.from(buyerTypeMap.entries()).map(([type, data]) => ({
    type,
    orders: data.orders,
    gmv: data.gmv,
    avgBasket: data.orders > 0 ? Math.round(data.gmv / data.orders) : 0,
  }));

  return (
    <div>
      <AdminTopBar title={t("orders")} subtitle="Gestion des commandes B2B" actions={
        <button className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: "#1B5BDA" }}>
          <Download size={15} /> Export CSV
        </button>
      } />

      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard icon={TrendingUp} label="GMV total" value={`${fmt(gmvDay)} EUR`} evolution={{ value: 12.4, label: "vs mois dernier" }} />
        <KpiCard icon={ShoppingCart} label="Commandes" value={String(displayOrders.length)} evolution={{ value: 8.2, label: "vs mois dernier" }} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={CreditCard} label="Panier moyen" value={`${avgBasket} EUR`} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Clock} label="En attente" value={String(countByStatus("pending"))} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Truck} label="En livraison" value={String(countByStatus("shipped"))} iconColor="#E70866" iconBg="#FDF2F8" />
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

      {activeTab === "list" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            {statusFilters.map((sf) => (
              <button key={sf.key} onClick={() => setStatusFilter(sf.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                style={{ backgroundColor: statusFilter === sf.key ? "#1E293B" : "#fff", color: statusFilter === sf.key ? "#fff" : "#616B7C", border: `1px solid ${statusFilter === sf.key ? "#1E293B" : "#E2E8F0"}` }}>
                {sf.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: statusFilter === sf.key ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: statusFilter === sf.key ? "#fff" : "#8B95A5" }}>
                  {countByStatus(sf.key)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <Search size={14} style={{ color: "#8B95A5" }} />
              <input type="text" placeholder="Rechercher par ID, acheteur, vendeur..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}><Filter size={14} /> Filtres</button>
          </div>

          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
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
                    {filtered.map((o) => {
                      const bc = buyerColors[o.buyerType] || { bg: "#F1F5F9", text: "#475569" };
                      return (
                        <tr key={o.id} className="cursor-pointer transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                          <td className="px-3 py-3">
                            <span className="text-[12px] font-bold font-mono block" style={{ color: "#1B5BDA" }}>{o.id}</span>
                            <span className="text-[10px]" style={{ color: "#8B95A5" }}>{o.refPO}</span>
                          </td>
                          <td className="px-3 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>{o.buyer}</td>
                          <td className="px-3 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: bc.bg, color: bc.text }}>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Activité récente</h3>
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

      {activeTab === "buyers" && (
        <div className="grid grid-cols-3 gap-4">
          {buyerProfiles.map((bp) => {
            const bc = buyerColors[bp.type] || { bg: "#F1F5F9", text: "#475569" };
            return (
              <div key={bp.type} className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: bc.bg, color: bc.text }}>
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
                    <p className="text-[18px] font-bold" style={{ color: "#1B5BDA" }}>{fmt(bp.gmv)} EUR</p>
                  </div>
                  <div>
                    <span className="text-[11px]" style={{ color: "#8B95A5" }}>Panier moyen</span>
                    <p className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{bp.avgBasket} EUR</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "aging" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Balance âgée des paiements</h3>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>Données agrégées depuis les commandes en base.</p>
          <div className="mt-4 grid grid-cols-4 gap-4">
            {[
              { range: "0-30 jours", color: "#059669", amount: displayOrders.filter(o => o.status === "pending" || o.status === "confirmed").reduce((a, o) => a + o.ttc, 0) },
              { range: "31-60 jours", color: "#1B5BDA", amount: displayOrders.filter(o => o.status === "shipped").reduce((a, o) => a + o.ttc, 0) },
              { range: "Livré", color: "#059669", amount: displayOrders.filter(o => o.status === "delivered").reduce((a, o) => a + o.ttc, 0) },
              { range: "Annulé", color: "#EF4343", amount: displayOrders.filter(o => o.status === "cancelled").reduce((a, o) => a + o.ttc, 0) },
            ].map(a => (
              <div key={a.range} className="p-4 rounded-lg text-center" style={{ backgroundColor: "#F8FAFC" }}>
                <span className="text-[12px]" style={{ color: "#8B95A5" }}>{a.range}</span>
                <p className="text-[18px] font-bold mt-1" style={{ color: a.color }}>{fmt(a.amount)} EUR</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCommandes;
