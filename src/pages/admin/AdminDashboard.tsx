import { useI18n } from "@/contexts/I18nContext";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useDashboardStats, useVendors, useOrders } from "@/hooks/useAdminData";
import {
  DollarSign, ShoppingCart, Store, Package, AlertTriangle,
  TrendingUp, UserPlus, Shield, AlertCircle, CreditCard, Box,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";

const gmvData = [
  { month: "Oct", gmv: 89200 },
  { month: "Nov", gmv: 95400 },
  { month: "Déc", gmv: 108700 },
  { month: "Jan", gmv: 102300 },
  { month: "Fév", gmv: 115800 },
  { month: "Mar", gmv: 127450 },
];

const alerts = [
  { icon: UserPlus, text: "Nouveau vendeur en attente de vérification", type: "warning", time: "Il y a 2h" },
  { icon: Package, text: "3 produits à modérer (images manquantes)", type: "warning", time: "Il y a 3h" },
  { icon: AlertCircle, text: "Litige #LT-892 escaladé — urgent", type: "urgent", time: "Il y a 5h" },
  { icon: Shield, text: "Certification CE expirée — Gants Aurelia", type: "urgent", time: "Il y a 1j" },
  { icon: Box, text: "Stock critique : Masques FFP2 (< 50 unités)", type: "warning", time: "Il y a 1j" },
  { icon: CreditCard, text: "Paiement en retard — PharmaDist (€4 200)", type: "urgent", time: "Il y a 2j" },
];

const AdminDashboard = () => {
  const { t } = useI18n();
  const stats = useDashboardStats();
  const vendorsQuery = useVendors();
  const ordersQuery = useOrders();

  const topSellers = (vendorsQuery.data || [])
    .filter(v => v.is_active)
    .slice(0, 5)
    .map(v => ({
      name: v.company_name || v.name,
      commission: Number(v.commission_rate) || 12,
    }));

  const recentOrders = (ordersQuery.data || []).slice(0, 6).map(o => ({
    id: o.order_number,
    buyer: (o.customers as any)?.company_name || "—",
    seller: "—",
    amount: `€ ${Number(o.total_incl_vat || 0).toLocaleString("fr-BE", { minimumFractionDigits: 2 })}`,
    status: o.status,
    date: new Date(o.created_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" }),
  }));

  const fmt = (n: number) => n.toLocaleString("fr-BE");

  return (
    <div>
      <AdminTopBar title={t("dashboard")} subtitle="Vue d'ensemble de la plateforme MediKong.pro" />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={DollarSign} label={t("gmvMonth")} value={`€${fmt(stats.gmv || 127450)}`} evolution={{ value: 18.3, label: "vs mois dernier" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={ShoppingCart} label={t("ordersMonth")} value={fmt(stats.totalOrders || 1089)} evolution={{ value: 12.1, label: "vs mois dernier" }} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={Store} label={t("activeSellers")} value={String(stats.activeVendors || 47)} evolution={{ value: 6.8, label: "vs mois dernier" }} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Package} label={t("catalogProducts")} value={fmt(stats.totalProducts || 12847)} evolution={{ value: 4.2, label: "vs mois dernier" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={AlertTriangle} label={t("disputeRate")} value={`${stats.disputeRate}%`} evolution={{ value: -0.1, label: "vs mois dernier" }} iconColor="#EF4343" iconBg="#FEF2F2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("gmvEvolution")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={gmvData}>
              <defs>
                <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B5BDA" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1B5BDA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8B95A5" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8B95A5" }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [`€${value.toLocaleString()}`, "GMV"]} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Area type="monotone" dataKey="gmv" stroke="#1B5BDA" strokeWidth={2.5} fill="url(#gmvGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("recentOrders")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["ID", t("buyer"), t("seller"), t("amount"), t("status"), t("date")].map((h) => (
                    <th key={h} className="pb-2 text-[11px] font-semibold pr-3" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(recentOrders.length > 0 ? recentOrders : [
                  { id: "MK-2025-04821", buyer: "Pharmacie Molière", seller: "MedSupply BE", amount: "€ 1 240.00", status: "delivered", date: "27/03" },
                  { id: "MK-2025-04820", buyer: "Hôpital St-Pierre", seller: "PharmaDist", amount: "€ 8 750.00", status: "shipped", date: "27/03" },
                  { id: "MK-2025-04819", buyer: "Cabinet Dr. Janssen", seller: "EuroMed NV", amount: "€ 185.00", status: "processing", date: "26/03" },
                  { id: "MK-2025-04818", buyer: "MaisonRepos Liège", seller: "CarePlus BVBA", amount: "€ 3 420.00", status: "pending", date: "26/03" },
                  { id: "MK-2025-04817", buyer: "Labo Bruxelles", seller: "MedSupply BE", amount: "€ 960.00", status: "delivered", date: "25/03" },
                  { id: "MK-2025-04816", buyer: "Clinique du Parc", seller: "PharmaDist", amount: "€ 2 100.00", status: "cancelled", date: "25/03" },
                ]).map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="py-2 text-[12px] font-medium pr-3" style={{ color: "#1B5BDA" }}>{o.id}</td>
                    <td className="py-2 text-[12px] pr-3" style={{ color: "#1D2530" }}>{o.buyer}</td>
                    <td className="py-2 text-[12px] pr-3" style={{ color: "#616B7C" }}>{o.seller}</td>
                    <td className="py-2 text-[12px] font-semibold pr-3" style={{ color: "#1D2530" }}>{o.amount}</td>
                    <td className="py-2 pr-3"><StatusBadge status={o.status} /></td>
                    <td className="py-2 text-[11px]" style={{ color: "#8B95A5" }}>{o.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("topSellers")}</h3>
          <div className="space-y-3">
            {(topSellers.length > 0 ? topSellers : [
              { name: "MedSupply BE", commission: 82 },
              { name: "PharmaDist NV", commission: 71 },
              { name: "EuroMed BVBA", commission: 65 },
              { name: "CarePlus Belgium", commission: 48 },
              { name: "HealthLine SA", commission: 34 },
            ]).map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: i < 3 ? "#1B5BDA" : "#8B95A5" }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{s.name}</span>
                    <span className="text-[12px] font-semibold" style={{ color: "#1B5BDA" }}>{s.commission}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(s.commission * 5, 100)}%`, backgroundColor: i < 3 ? "#1B5BDA" : "#8B95A5" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("alerts")}</h3>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: a.type === "urgent" ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${a.type === "urgent" ? "#FECACA" : "#FDE68A"}` }}>
                <a.icon size={16} style={{ color: a.type === "urgent" ? "#EF4343" : "#F59E0B" }} className="shrink-0" />
                <span className="flex-1 text-[12px]" style={{ color: "#1D2530" }}>{a.text}</span>
                <span className="text-[10px] shrink-0" style={{ color: "#8B95A5" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
