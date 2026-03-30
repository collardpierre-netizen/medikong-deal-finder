import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useOrders, useCustomers } from "@/hooks/useAdminData";
import {
  BarChart3, Users, Search, Target, ShoppingCart,
  TrendingUp, Database,
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const AdminAnalytics = () => {
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();

  const totalOrders = orders.length;
  const totalCustomers = customers.length;
  const gmv = orders.reduce((a, o) => a + (Number(o.total_incl_vat) || 0), 0);
  const avgBasket = totalOrders > 0 ? Math.round(gmv / totalOrders) : 0;

  const hasData = totalOrders > 0 || totalCustomers > 0;

  return (
    <div>
      <AdminTopBar title="Analytics" subtitle="Intelligence commerciale et comportementale" />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={Users} label="Acheteurs actifs" value={String(totalCustomers)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={ShoppingCart} label="Commandes" value={String(totalOrders)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={TrendingUp} label="GMV total" value={`${fmt(gmv)} €`} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={Target} label="Panier moyen" value={`${fmt(avgBasket)} €`} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Search} label="Recherches / jour" value="—" iconColor="#8B95A5" iconBg="#F8FAFC" />
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Database size={56} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[16px] font-bold text-[#1D2530] mb-2">Aucune donnée analytics</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-lg">
            Les analytics s'alimenteront automatiquement dès que des commandes et des clients seront enregistrés dans la base de données.
            Les modules de recherche, cohortes RFM et signaux marché seront activés progressivement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Buyer distribution */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Répartition acheteurs</h3>
            {customers.length === 0 ? (
              <p className="text-[13px] text-[#8B95A5] py-8 text-center">Aucun acheteur enregistré</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  customers.reduce<Record<string, number>>((acc, c) => {
                    const t = c.customer_type || "other";
                    acc[t] = (acc[t] || 0) + 1;
                    return acc;
                  }, {})
                ).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: "#F8FAFC" }}>
                    <span className="text-[12px] font-medium capitalize" style={{ color: "#1D2530" }}>{type}</span>
                    <span className="text-[12px] font-semibold" style={{ color: "#1B5BDA" }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orders summary */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Résumé commandes</h3>
            {orders.length === 0 ? (
              <p className="text-[13px] text-[#8B95A5] py-8 text-center">Aucune commande</p>
            ) : (
              <div className="space-y-3 text-[13px]">
                {Object.entries(
                  orders.reduce<Record<string, number>>((acc, o) => {
                    acc[o.status] = (acc[o.status] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span className="capitalize" style={{ color: "#616B7C" }}>{status}</span>
                    <span className="font-semibold" style={{ color: "#1D2530" }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;