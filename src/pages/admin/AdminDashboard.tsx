import { useMemo, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useDashboardStats, useVendors, useOrders } from "@/hooks/useAdminData";
import GmvEvolutionChart from "@/components/admin/GmvEvolutionChart";
import OrdersStatusPieChart from "@/components/admin/OrdersStatusPieChart";
import { fmtEur, withDotThousands } from "@/lib/format-currency";
import { CUSTOMER_TYPE_OPTIONS } from "./AdminCustomers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import {
  DollarSign, ShoppingCart, Store, Package, AlertTriangle,
  TrendingUp, Info, UserCheck, Users, ChevronRight, Clock, Truck, Percent, CalendarClock, UserPlus, UserMinus, Repeat,
} from "lucide-react";

const toAmount = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getLineTotalInclVat = (line: any) => {
  const explicitIncl = toAmount(line?.line_total_incl_vat);
  if (explicitIncl > 0) return explicitIncl;

  const qty = toAmount(line?.quantity);
  const unitIncl = toAmount(line?.unit_price_incl_vat);
  if (qty > 0 && unitIncl > 0) return qty * unitIncl;

  const explicitExcl = toAmount(line?.line_total_excl_vat);
  const unitExcl = toAmount(line?.unit_price_excl_vat);
  const vatRate = toAmount(line?.vat_rate);
  const exclTotal = explicitExcl > 0 ? explicitExcl : qty * unitExcl;
  return exclTotal > 0 ? exclTotal * (1 + vatRate / 100) : 0;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const stats = useDashboardStats();
  const [includeForecast, setIncludeForecast] = useState(false);

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

  // Répartition des clients par typologie (camembert dashboard)
  const customersByTypeQuery = useQuery({
    queryKey: ["admin-dashboard-customers-by-type"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("customer_type");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const customerTypeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of (customersByTypeQuery.data || []) as any[]) {
      const t = c.customer_type || "other";
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return CUSTOMER_TYPE_OPTIONS
      .map((opt) => ({ name: opt.label, value: counts.get(opt.value) || 0, color: opt.color }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [customersByTypeQuery.data]);

  const vendorLabelById = new Map((vendorsQuery.data || []).map((v: any) => [v.id, v.company_name || v.name]));

  // Catégories (pour répartition par catégorie parent)
  const categoriesQuery = useQuery({
    queryKey: ["admin-dashboard-categories-tree"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, name_fr, parent_id");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const rootCategoryById = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; parent_id: string | null }>();
    for (const c of (categoriesQuery.data || []) as any[]) {
      byId.set(c.id, { id: c.id, name: c.name_fr || c.name || "—", parent_id: c.parent_id });
    }
    const rootOf = new Map<string, { id: string; name: string }>();
    for (const [id] of byId) {
      let cur = byId.get(id);
      const seen = new Set<string>();
      while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parent_id)!;
      }
      if (cur) rootOf.set(id, { id: cur.id, name: cur.name });
    }
    return rootOf;
  }, [categoriesQuery.data]);

  // Commandes "en cours" + prévisionnelles
  const isActiveOrForecast = (o: any) =>
    !o.hidden_from_list && !o.deleted_at && (
      Boolean(o.is_forecast) || ["pending", "confirmed", "processing", "shipped"].includes(o.status)
    );

  const topVendors = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of (ordersQuery.data || []) as any[]) {
      if (!isActiveOrForecast(o)) continue;
      const persisted = (o.order_lines || []) as any[];
      const draft = o.status === "draft" && Array.isArray(o.draft_payload?.lines) ? o.draft_payload.lines : [];
      const lines = persisted.length > 0 ? persisted : draft;
      for (const l of lines as any[]) {
        const vid = l.vendor_id;
        if (!vid) continue;
        const amt = getLineTotalInclVat(l);
        totals.set(vid, (totals.get(vid) || 0) + amt);
      }
    }
    const total = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    return Array.from(totals.entries())
      .map(([id, amount]) => ({
        id,
        name: vendorLabelById.get(id) || `Vendeur ${id.slice(0, 6)}`,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [ordersQuery.data, vendorLabelById]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number }>();
    for (const o of (ordersQuery.data || []) as any[]) {
      if (!isActiveOrForecast(o)) continue;
      const lines = (o.order_lines || []) as any[];
      for (const l of lines) {
        const pcid = l.products?.primary_category_id;
        if (!pcid) continue;
        const root = rootCategoryById.get(pcid);
        if (!root) continue;
        const amt = getLineTotalInclVat(l);
        const cur = totals.get(root.id) || { name: root.name, amount: 0 };
        cur.amount += amt;
        totals.set(root.id, cur);
      }
    }
    return Array.from(totals.entries())
      .map(([id, v]) => ({ id, name: v.name, value: Math.round(v.amount * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [ordersQuery.data, rootCategoryById]);

  const CATEGORY_COLORS = ["#1B5BDA", "#7C3AED", "#059669", "#F59E0B", "#EF4444", "#0EA5E9", "#EC4899", "#14B8A6", "#8B5CF6", "#F97316"];

  const recentOrders = (ordersQuery.data || [])
    .filter((o: any) => !o.hidden_from_list && !o.deleted_at && !o.is_test)
    .slice(0, 6).map((o: any) => {
    const persistedLines = (o.order_lines || []) as Array<{ vendor_id: string | null; line_total_incl_vat?: number | null; unit_price_incl_vat?: number | null; quantity?: number | null; vendors?: { company_name?: string | null; slug?: string | null } | null }>;
    const draftLines = (o.status === "draft" && Array.isArray(o.draft_payload?.lines)) ? o.draft_payload.lines as Array<{ vendor_id?: string | null; line_total_incl_vat?: number | null; unit_price_incl_vat?: number | null; quantity?: number | null }> : [];
    const lines = persistedLines.length > 0 ? persistedLines : draftLines;
    const seenIds = new Set<string>();
    const names: string[] = [];
    for (const l of lines as any[]) {
      const key = l.vendor_id || l.vendors?.slug || l.vendors?.company_name;
      if (!key || seenIds.has(key)) continue;
      seenIds.add(key);
      const name = (l.vendors?.company_name?.trim?.() || vendorLabelById.get(l.vendor_id)) as string | undefined;
      if (name) names.push(name);
    }
    let seller = "—";
    if (names.length === 1) seller = names[0];
    else if (names.length > 1) seller = `${names[0]} +${names.length - 1}`;
    else if (seenIds.size > 0) seller = `${seenIds.size} vendeur${seenIds.size > 1 ? "s" : ""}`;
    // Pour les brouillons / commandes sans total figé, on calcule depuis les lignes
    let amountNum = Number(o.total_incl_vat || 0);
    if (!amountNum && lines.length > 0) {
      amountNum = (lines as any[]).reduce((sum, l) => sum + getLineTotalInclVat(l), 0);
    }
    return {
      id: o.order_number,
      buyer: (o.customers as any)?.company_name || "—",
      seller,
      amount: `${fmtEur(amountNum)} EUR`,
      status: o.status,
      isForecast: Boolean(o.is_forecast),
      date: new Date(o.created_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" }),
    };
  });

  const pendingVendorsList = pendingVendors.data || [];
  const pendingBuyersList = pendingBuyers.data || [];
  const totalPending = pendingVendorsList.length + pendingBuyersList.length;

  const fmt = (n: number) => withDotThousands(n.toLocaleString("fr-BE"));
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "< 1h";
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}j`;
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Info size={28} className="mb-2" style={{ color: "#8B95A5" }} />
      <p className="text-[13px]" style={{ color: "#8B95A5" }}>{message}</p>
    </div>
  );

  // Shipping stats
  const shippingStats = useQuery({
    queryKey: ["admin-shipping-stats"],
    queryFn: async () => {
      const [vendorsByMode, shipmentsRes, marginRes] = await Promise.all([
        supabase.from("vendors").select("vendor_shipping_mode").eq("is_active", true),
        supabase.from("shipments").select("id", { count: "exact", head: true }),
        supabase.from("shipping_invoices").select("total_margin_cents, total_base_cents").eq("status", "paid"),
      ]);
      const modes = (vendorsByMode.data || []).reduce((acc: Record<string, number>, v: any) => {
        acc[v.vendor_shipping_mode] = (acc[v.vendor_shipping_mode] || 0) + 1;
        return acc;
      }, {});
      const totalMarginRevenue = (marginRes.data || []).reduce((s: number, i: any) => s + (i.total_margin_cents || 0), 0) / 100;
      const totalBase = (marginRes.data || []).reduce((s: number, i: any) => s + (i.total_base_cents || 0), 0) / 100;
      const avgMargin = totalBase > 0 ? (totalMarginRevenue / totalBase * 100) : 0;
      return {
        modes,
        totalShipments: shipmentsRes.count ?? 0,
        totalMarginRevenue,
        avgMargin: Math.round(avgMargin * 10) / 10,
      };
    },
    staleTime: 60_000,
  });

  const ss = shippingStats.data;

  // Analytics clients (synthèse dashboard)
  const clientAnalytics = useQuery({
    queryKey: ["admin-dashboard-client-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_customer_analytics_kpis");
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });
  const ca = clientAnalytics.data || {};

  return (
    <div>
      <AdminTopBar title={t("dashboard")} subtitle="Vue d'ensemble de la plateforme MediKong.pro" />

      <div className="flex items-center justify-between mb-3">
        <div />
        <label
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer select-none transition-colors"
          style={{
            backgroundColor: includeForecast ? "#EDE9FE" : "#fff",
            color: includeForecast ? "#6D28D9" : "#616B7C",
            border: `1px solid ${includeForecast ? "#DDD6FE" : "#E2E8F0"}`,
          }}
          title="Inclure les commandes prévisionnelles dans les KPIs et le graphique GMV"
        >
          <input
            type="checkbox"
            className="accent-violet-600"
            checked={includeForecast}
            onChange={(e) => setIncludeForecast(e.target.checked)}
          />
          Inclure le prévisionnel
          {(stats as any).forecastOrders ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#DDD6FE", color: "#5B21B6" }}>
              {(stats as any).forecastOrders}
            </span>
          ) : null}
        </label>
      </div>

      {(() => {
        const s: any = stats;
        const gmvTotal = s.gmv + (includeForecast ? (s.forecastGmv || 0) : 0);
        const marginTotal = (s.gmvMargin || 0) + (includeForecast ? (s.forecastMargin || 0) : 0);
        // Pondération du % par CA HTVA = on recompose un dénominateur cohérent
        // (gmv et forecastGmv sont TTC ; le % côté hook est calculé sur HTVA — on l'expose tel quel via moyenne pondérée approchée)
        const realPct = s.gmvMarginPct || 0;
        const fcstPct = s.forecastMarginPct || 0;
        const pctTotal = includeForecast && (s.gmv + s.forecastGmv) > 0
          ? ((realPct * s.gmv) + (fcstPct * s.forecastGmv)) / (s.gmv + s.forecastGmv)
          : realPct;
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
            <KpiCard
              icon={DollarSign}
              label={t("gmvMonth")}
              value={`${fmtEur(gmvTotal)} EUR`}
              iconColor="#1B5BDA"
              iconBg="#EFF6FF"
            />
            <KpiCard
              icon={TrendingUp}
              label={includeForecast ? "Marge brute (incl. prév.)" : "Marge brute"}
              value={`${fmtEur(marginTotal)} EUR`}
              iconColor="#059669"
              iconBg="#ECFDF5"
            />
            <KpiCard
              icon={Percent}
              label="Marge %"
              value={`${pctTotal.toFixed(1)}%`}
              iconColor="#059669"
              iconBg="#ECFDF5"
            />
            <KpiCard
              icon={ShoppingCart}
              label={t("ordersMonth")}
              value={fmt(stats.totalOrders + (includeForecast ? (s.forecastOrders || 0) : 0))}
              iconColor="#7C3AED"
              iconBg="#F5F3FF"
            />
            <KpiCard icon={Store} label={t("activeSellers")} value={fmt(stats.activeVendors)} iconColor="#059669" iconBg="#F0FDF4" />
            <KpiCard icon={Package} label={t("catalogProducts")} value={fmt(stats.totalProducts)} iconColor="#F59E0B" iconBg="#FFFBEB" />
          </div>
        );
      })()}

      {/* Shipping KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard icon={Truck} label="Expéditions totales" value={String(ss?.totalShipments ?? 0)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Store} label="Vendeurs par mode" value={`WL: ${ss?.modes?.medikong_whitelabel ?? 0} | SC: ${ss?.modes?.own_sendcloud ?? 0} | M: ${ss?.modes?.no_shipping ?? 0}`} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={DollarSign} label="Revenu marge WL" value={`${fmtEur(ss?.totalMarginRevenue ?? 0)} EUR`} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Percent} label="Marge moyenne" value={`${ss?.avgMargin ?? 0}%`} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      {/* Synthèse Analytics clients */}
      <div className="mb-6 p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Analytics clients</h3>
            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
              Progression du portefeuille — nouveaux clients, churn (&gt; 12 mois), volume moyen par client
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/analytics-clients")}
            className="flex items-center gap-1 text-[12px] font-medium hover:underline"
            style={{ color: "#1B5BDA" }}
          >
            Voir le détail <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={UserPlus} label="Nouveaux (30j)" value={String(ca.new_30d ?? 0)} iconColor="#059669" iconBg="#ECFDF5" />
          <KpiCard icon={UserMinus} label={`Churn (>12 mois)`} value={`${ca.churned_12m ?? 0} · ${ca.churn_rate_pct ?? 0}%`} iconColor="#DC2626" iconBg="#FEE2E2" />
          <KpiCard icon={ShoppingCart} label="Commandes / client" value={String(ca.avg_orders_per_customer ?? 0)} iconColor="#7C3AED" iconBg="#F5F3FF" />
          <KpiCard icon={Repeat} label="Taux récurrence" value={`${ca.repeat_rate_pct ?? 0}%`} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        </div>
      </div>


      {/* Pending Actions */}
      {totalPending > 0 && (
        <div className="mb-6 p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <Clock size={16} style={{ color: "#D97706" }} />
            </div>
            <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>
              Actions en attente
            </h3>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: "#D97706" }}>
              {totalPending}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pending Vendors */}
            {pendingVendorsList.length > 0 && (
              <div className="rounded-lg p-4" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Store size={15} style={{ color: "#D97706" }} />
                    <span className="text-[13px] font-semibold" style={{ color: "#92400E" }}>
                      Vendeurs en attente
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#FDE68A", color: "#92400E" }}>
                      {pendingVendorsList.length}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate("/admin/vendeurs")}
                    className="flex items-center gap-1 text-[12px] font-medium hover:underline"
                    style={{ color: "#D97706" }}
                  >
                    Voir tout <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {pendingVendorsList.slice(0, 3).map((v) => (
                    <div key={v.id} className="flex items-center justify-between rounded-md px-3 py-2" style={{ backgroundColor: "#fff" }}>
                      <div>
                        <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>
                          {v.company_name || v.name}
                        </span>
                        <span className="ml-2 text-[11px]" style={{ color: "#8B95A5" }}>
                          {v.display_code}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: "#8B95A5" }}>il y a {timeAgo(v.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Buyers */}
            {pendingBuyersList.length > 0 && (
              <div className="rounded-lg p-4" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={15} style={{ color: "#1D4ED8" }} />
                    <span className="text-[13px] font-semibold" style={{ color: "#1E3A5F" }}>
                      Acheteurs en attente
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#BFDBFE", color: "#1E3A5F" }}>
                      {pendingBuyersList.length}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate("/admin/users")}
                    className="flex items-center gap-1 text-[12px] font-medium hover:underline"
                    style={{ color: "#1D4ED8" }}
                  >
                    Voir tout <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {pendingBuyersList.slice(0, 3).map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-md px-3 py-2" style={{ backgroundColor: "#fff" }}>
                      <div>
                        <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>
                          {b.company_name}
                        </span>
                        <span className="ml-2 text-[11px]" style={{ color: "#8B95A5" }}>
                          {b.email}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: "#8B95A5" }}>il y a {timeAgo(b.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GMV Chart */}
        <GmvEvolutionChart title={t("gmvEvolution")} orders={(ordersQuery.data || []) as any} includeForecast={includeForecast} onIncludeForecastChange={setIncludeForecast} />

        <OrdersStatusPieChart title="Répartition des commandes par statut" orders={(ordersQuery.data || []) as any} />


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
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <StatusBadge status={o.status} />
                          {o.isForecast && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#EDE9FE", color: "#6D28D9" }} title="Commande prévisionnelle">
                              <CalendarClock size={9} /> Prévisionnel
                            </span>
                          )}
                        </div>
                      </td>
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

        {/* Top vendeurs (en cours + prévisionnel) */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-1" style={{ color: "#1D2530" }}>Top vendeurs</h3>
          <p className="text-[11px] mb-4" style={{ color: "#8B95A5" }}>CA TTC sur commandes en cours + prévisionnelles</p>
          {topVendors.length > 0 ? (
            <div className="space-y-3">
              {topVendors.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: i < 3 ? "#1B5BDA" : "#8B95A5" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-[13px] font-medium truncate" style={{ color: "#1D2530" }}>{s.name}</span>
                      <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: "#1B5BDA" }}>
                        {fmtEur(s.amount)} EUR <span className="text-[11px]" style={{ color: "#8B95A5" }}>· {s.pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(s.pct, 100)}%`, backgroundColor: i < 3 ? "#1B5BDA" : "#8B95A5" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Aucune commande en cours ou prévisionnelle" />
          )}
        </div>

        {/* Répartition par catégorie parent */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-1" style={{ color: "#1D2530" }}>Catégories vendues</h3>
          <p className="text-[11px] mb-4" style={{ color: "#8B95A5" }}>Répartition CA TTC par catégorie parent (en cours + prévisionnel)</p>
          {categoryBreakdown.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(e: any) => `${e.name} (${((e.percent || 0) * 100).toFixed(1)}%)`}
                    labelLine={false}
                  >
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: any) => `${fmtEur(Number(v))} EUR`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="Aucune ligne avec catégorie résolue" />
          )}
        </div>


        {/* Clients par typologie */}
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-1" style={{ color: "#1D2530" }}>Clients par typologie</h3>
          <p className="text-[11px] mb-4" style={{ color: "#8B95A5" }}>
            Répartition du portefeuille clients (gérée dans <button onClick={() => navigate("/admin/customers")} className="underline hover:text-[#1B5BDA]">/admin/customers</button>)
          </p>
          {(() => {
            const total = customerTypeBreakdown.reduce((s, r) => s + r.value, 0);
            const retail = customerTypeBreakdown.find((r) => r.name === "Retail");
            const retailCount = retail?.value || 0;
            const retailPct = total > 0 ? ((retailCount / total) * 100).toFixed(1) : "0";
            return (
              <div className="mb-4 rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FDBA74" }}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#F97316" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "#7C2D12" }}>Retail</span>
                </div>
                <div className="text-right">
                  <span className="text-[16px] font-bold" style={{ color: "#C2410C" }}>{retailCount}</span>
                  <span className="text-[12px] ml-1 font-medium" style={{ color: "#9A3412" }}>({retailPct}%)</span>
                </div>
              </div>
            );
          })()}
          {customerTypeBreakdown.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={customerTypeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={(e: any) => {
                      const pct = (e.percent * 100).toFixed(1);
                      return `${e.name} ${pct}%`;
                    }}
                  >
                    {customerTypeBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(v: any, n: any) => {
                      const total = customerTypeBreakdown.reduce((s, r) => s + r.value, 0);
                      const pct = total > 0 ? ((Number(v) / total) * 100).toFixed(1) : "0";
                      return [`${v} client${Number(v) > 1 ? "s" : ""} (${pct}%)`, n];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="Aucun client enregistré" />
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
