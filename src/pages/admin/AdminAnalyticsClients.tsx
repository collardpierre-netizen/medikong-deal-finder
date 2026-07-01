import { useMemo, useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtEur } from "@/lib/format-currency";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  Bar,
  Line,
} from "recharts";
import { Users, UserPlus, UserMinus, ShoppingCart, TrendingUp, RefreshCw, DollarSign, Repeat } from "lucide-react";

type MonthlyRow = {
  month: string;
  orders_count: number;
  unique_customers: number;
  new_customers: number;
  returning_customers: number;
  gmv_ttc: number;
};

type RankingRow = {
  customer_id: string;
  company_name: string | null;
  email: string | null;
  customer_type: string | null;
  country_code: string | null;
  created_at: string;
  order_count: number;
  gmv_ttc: number;
  first_order: string | null;
  last_order: string | null;
  days_since_last_order: number | null;
  status: "new" | "active" | "churn" | "never";
  total_count: number;
};

const STATUS_META: Record<RankingRow["status"], { label: string; bg: string; fg: string }> = {
  new: { label: "Nouveau", bg: "#DCFCE7", fg: "#166534" },
  active: { label: "Actif", bg: "#DBEAFE", fg: "#1E3A8A" },
  churn: { label: "Churn", bg: "#FEE2E2", fg: "#991B1B" },
  never: { label: "Jamais commandé", bg: "#F1F5F9", fg: "#475569" },
};

const AdminAnalyticsClients = () => {
  const [months, setMonths] = useState<number>(12);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const kpis = useQuery({
    queryKey: ["admin-customer-analytics-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_customer_analytics_kpis");
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });

  const monthly = useQuery({
    queryKey: ["admin-customer-analytics-monthly", months],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_customer_analytics_monthly", { _months: months });
      if (error) throw error;
      return (data || []) as MonthlyRow[];
    },
    staleTime: 60_000,
  });

  const ranking = useQuery({
    queryKey: ["admin-customer-analytics-ranking", statusFilter, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_customer_analytics_ranking", {
        _limit: 200,
        _offset: 0,
        _search: search || null,
        _status: statusFilter || null,
      });
      if (error) throw error;
      return (data || []) as RankingRow[];
    },
    staleTime: 30_000,
  });

  const chartData = useMemo(
    () =>
      (monthly.data || []).map((r) => ({
        ...r,
        label: new Date(r.month).toLocaleDateString("fr-BE", { month: "short", year: "2-digit" }),
      })),
    [monthly.data],
  );

  const k = kpis.data || {};
  const totalRows = ranking.data?.[0]?.total_count ?? 0;

  return (
    <div>
      <AdminTopBar title="Analytics clients" subtitle="Progression commandes, nouveaux clients, churn et volume moyen par acheteur" />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Users} label="Clients total" value={String(k.total_customers ?? 0)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={ShoppingCart} label="Clients ayant commandé" value={`${k.customers_with_orders ?? 0}`} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={UserPlus} label="Nouveaux (30j)" value={String(k.new_30d ?? 0)} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={UserMinus} label="Churn (>12 mois)" value={`${k.churned_12m ?? 0} · ${k.churn_rate_pct ?? 0}%`} iconColor="#DC2626" iconBg="#FEE2E2" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={TrendingUp} label="Actifs (12 mois)" value={String(k.active_12m ?? 0)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Repeat} label="Taux de récurrence" value={`${k.repeat_rate_pct ?? 0}%`} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={ShoppingCart} label="Commandes / client" value={String(k.avg_orders_per_customer ?? 0)} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={DollarSign} label="GMV moyen / client" value={`${fmtEur(Number(k.avg_gmv_per_customer ?? 0))} EUR`} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      {/* Progression mensuelle */}
      <div className="p-5 rounded-[10px] mb-6" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Progression des commandes</h3>
            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
              Commandes / mois · clients uniques · nouveaux vs récurrents (toutes commandes incluses)
            </p>
          </div>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="text-[12px] rounded-md border px-2 py-1"
            style={{ borderColor: "#E2E8F0" }}
          >
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
            <option value={24}>24 mois</option>
          </select>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <RTooltip
                formatter={(v: any, name: any) =>
                  name === "GMV TTC" ? [`${fmtEur(Number(v))} EUR`, name] : [v, name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="new_customers" name="Nouveaux clients" stackId="c" fill="#059669" />
              <Bar yAxisId="left" dataKey="returning_customers" name="Clients récurrents" stackId="c" fill="#1B5BDA" />
              <Line yAxisId="left" type="monotone" dataKey="orders_count" name="Commandes" stroke="#7C3AED" strokeWidth={2} dot />
              <Line yAxisId="right" type="monotone" dataKey="gmv_ttc" name="GMV TTC" stroke="#F59E0B" strokeWidth={2} dot />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table clients */}
      <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Classement clients</h3>
            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
              {totalRows} client{totalRows > 1 ? "s" : ""} · triés par GMV TTC décroissant
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Rechercher société ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[12px] rounded-md border px-2 py-1 w-64"
              style={{ borderColor: "#E2E8F0" }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[12px] rounded-md border px-2 py-1"
              style={{ borderColor: "#E2E8F0" }}
            >
              <option value="">Tous statuts</option>
              <option value="new">Nouveau (≤90j)</option>
              <option value="active">Actif</option>
              <option value="churn">Churn (&gt;12 mois)</option>
              <option value="never">Jamais commandé</option>
            </select>
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); }}
              className="text-[12px] rounded-md border px-2 py-1 hover:bg-slate-50"
              style={{ borderColor: "#E2E8F0", color: "#616B7C" }}
            >
              <RefreshCw size={12} className="inline mr-1" /> Réinitialiser
            </button>
          </div>
        </div>

        {ranking.isLoading ? (
          <div className="py-8 text-center text-[12px]" style={{ color: "#8B95A5" }}>Chargement…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Client", "Type", "Pays", "Statut", "Commandes", "GMV TTC", "1re", "Dernière", "Ancienneté"].map((h) => (
                    <th key={h} className="pb-2 text-[11px] font-semibold pr-3" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(ranking.data || []).map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={r.customer_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="py-2 pr-3">
                        <div className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{r.company_name || "—"}</div>
                        <div className="text-[11px]" style={{ color: "#8B95A5" }}>{r.email || "—"}</div>
                      </td>
                      <td className="py-2 text-[12px] pr-3" style={{ color: "#616B7C" }}>{r.customer_type || "—"}</td>
                      <td className="py-2 text-[12px] pr-3" style={{ color: "#616B7C" }}>{r.country_code || "—"}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 text-[12px] font-semibold pr-3" style={{ color: "#1D2530" }}>{r.order_count}</td>
                      <td className="py-2 text-[12px] font-semibold pr-3" style={{ color: "#1B5BDA" }}>{fmtEur(Number(r.gmv_ttc || 0))} EUR</td>
                      <td className="py-2 text-[11px] pr-3" style={{ color: "#8B95A5" }}>
                        {r.first_order ? new Date(r.first_order).toLocaleDateString("fr-BE") : "—"}
                      </td>
                      <td className="py-2 text-[11px] pr-3" style={{ color: "#8B95A5" }}>
                        {r.last_order ? new Date(r.last_order).toLocaleDateString("fr-BE") : "—"}
                      </td>
                      <td className="py-2 text-[11px]" style={{ color: r.status === "churn" ? "#DC2626" : "#616B7C" }}>
                        {r.days_since_last_order != null ? `${r.days_since_last_order} j` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {(ranking.data || []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-[12px]" style={{ color: "#8B95A5" }}>
                      Aucun client ne correspond aux filtres
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalyticsClients;
