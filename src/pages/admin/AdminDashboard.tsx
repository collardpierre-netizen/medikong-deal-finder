import { useI18n } from "@/contexts/I18nContext";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useDashboardStats, useVendors, useOrders } from "@/hooks/useAdminData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, ShoppingCart, Store, Package, AlertTriangle,
  TrendingUp, Info, UserCheck, Users, ChevronRight, Clock,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const stats = useDashboardStats();

  const pendingVendors = useQuery({
    queryKey: ["pending-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, created_at, display_code, validation_status")
        .eq("validation_status", "pending_review")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const pendingBuyers = useQuery({
    queryKey: ["pending-buyers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, company_name, email, created_at, is_verified")
        .eq("is_verified", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const vendorsQuery = useVendors();
  const ordersQuery = useOrders();

  const topSellers = (vendorsQuery.data || [])
    .filter(v => v.is_active)
    .slice(0, 5)
    .map(v => ({
      name: v.company_name || v.name,
      commission: Number(v.commission_rate) || 0,
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

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Info size={28} className="mb-2" style={{ color: "#8B95A5" }} />
      <p className="text-[13px]" style={{ color: "#8B95A5" }}>{message}</p>
    </div>
  );

  return (
    <div>
      <AdminTopBar title={t("dashboard")} subtitle="Vue d'ensemble de la plateforme MediKong.pro" />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={DollarSign} label={t("gmvMonth")} value={`€${fmt(stats.gmv)}`} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={ShoppingCart} label={t("ordersMonth")} value={fmt(stats.totalOrders)} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={Store} label={t("activeSellers")} value={String(stats.activeVendors)} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Package} label={t("catalogProducts")} value={fmt(stats.totalProducts)} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={AlertTriangle} label={t("disputeRate")} value={`${stats.disputeRate}%`} iconColor="#EF4343" iconBg="#FEF2F2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* GMV Chart */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("gmvEvolution")}</h3>
          {stats.gmv > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={[{ month: "Ce mois", gmv: stats.gmv }]}>
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
          ) : (
            <EmptyState message="Aucune donnée GMV — lancez la synchronisation Qogita et passez des commandes" />
          )}
        </div>

        {/* Recent Orders */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("recentOrders")}</h3>
          {recentOrders.length > 0 ? (
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
                  {recentOrders.map((o) => (
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
          ) : (
            <EmptyState message="Aucune commande — les commandes apparaîtront ici" />
          )}
        </div>

        {/* Top Sellers */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("topSellers")}</h3>
          {topSellers.length > 0 ? (
            <div className="space-y-3">
              {topSellers.map((s, i) => (
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
          ) : (
            <EmptyState message="Aucun vendeur actif — ajoutez des vendeurs via le menu Gestion" />
          )}
        </div>

        {/* Alerts */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>{t("alerts")}</h3>
          <EmptyState message="Aucune alerte — tout est en ordre ✓" />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
