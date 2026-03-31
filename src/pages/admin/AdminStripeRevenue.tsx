import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, DollarSign, Percent, CreditCard } from "lucide-react";

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{label}</span>
      </div>
      <div className="text-[22px] font-bold" style={{ color: "#1D2530" }}>{value}</div>
    </div>
  );
}

export default function AdminStripeRevenue() {
  const { data: transfers = [] } = useQuery({
    queryKey: ["admin-transfers-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_transfers")
        .select("amount, commission_amount, commission_rate, created_at, vendor_id, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const vendorNameMap = new Map(vendors.map(v => [v.id, v.name]));

  const totalGMV = transfers.reduce((s, t) => s + t.amount + t.commission_amount, 0);
  const totalCommission = transfers.reduce((s, t) => s + t.commission_amount, 0);
  // Stripe fees estimate: 1.5% + 25c per transaction
  const transactionCount = new Set(transfers.map(t => t.created_at?.slice(0, 10))).size || 1;
  const stripeFees = Math.round(totalGMV * 0.015 + transactionCount * 25);
  const netMargin = totalCommission - stripeFees;

  // Monthly chart data
  const monthlyData = transfers.reduce((acc: Record<string, { gmv: number; commission: number; fees: number }>, t) => {
    const month = t.created_at?.slice(0, 7) || "unknown";
    if (!acc[month]) acc[month] = { gmv: 0, commission: 0, fees: 0 };
    acc[month].gmv += t.amount + t.commission_amount;
    acc[month].commission += t.commission_amount;
    acc[month].fees += Math.round((t.amount + t.commission_amount) * 0.015 + 25);
    return acc;
  }, {});

  const chartData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      gmv: d.gmv / 100,
      commission: d.commission / 100,
      marge: (d.commission - d.fees) / 100,
    }));

  return (
    <div>
      <AdminTopBar title="Revenue & Marges" subtitle="Suivi de la performance financière Stripe Connect" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={DollarSign} label="GMV Total" value={`${(totalGMV / 100).toFixed(2)} €`} color="#1B5BDA" />
        <StatCard icon={Percent} label="Commission brute" value={`${(totalCommission / 100).toFixed(2)} €`} color="#059669" />
        <StatCard icon={CreditCard} label="Frais Stripe (est.)" value={`${(stripeFees / 100).toFixed(2)} €`} color="#D97706" />
        <StatCard icon={TrendingUp} label="Marge nette" value={`${(netMargin / 100).toFixed(2)} €`} color={netMargin >= 0 ? "#059669" : "#EF4343"} />
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border p-5 mb-6" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#1D2530" }}>Évolution mensuelle</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8B95A5" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8B95A5" }} />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)} €`}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="gmv" name="GMV" fill="#1B5BDA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="commission" name="Commission" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="marge" name="Marge nette" fill="#F5C518" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {transfers.length === 0 && (
        <div className="bg-white rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0" }}>
          <p className="text-sm" style={{ color: "#8B95A5" }}>Aucun transfert enregistré pour le moment.</p>
        </div>
      )}
    </div>
  );
}
