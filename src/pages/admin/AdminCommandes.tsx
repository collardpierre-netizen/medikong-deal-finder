import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import AdminOrderSlaPanel from "@/components/admin/AdminOrderSlaPanel";
import { useI18n } from "@/contexts/I18nContext";
import { useOrders } from "@/hooks/useAdminData";
import { useAdminOrdersPaginated } from "@/hooks/useAdminOrdersPaginated";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  ShoppingCart, TrendingUp, Clock, CreditCard, Truck, Percent,
  Search, Filter, Download, ChevronDown, ChevronRight, Package, Trash2, AlertTriangle, CalendarClock, Copy, Pencil, Flame, FileDown, Eye, Check, X,
} from "lucide-react";
import { fmtEur } from "@/lib/format-currency";
import { computeOrderTotals } from "@/lib/manual-order-metrics";
import { type VendorCommissionConfig } from "@/lib/vendorMargin";
import { computeCommissionFromLines as computeCommissionFromLinesPure } from "@/lib/order-commission-fallback";
import { AdminCommandesCommissionCell } from "./AdminCommandesCommissionCell";

type PeriodKey = "7d" | "30d" | "90d" | "12m" | "all";
const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "7d", label: "7 j", days: 7 },
  { key: "30d", label: "30 j", days: 30 },
  { key: "90d", label: "90 j", days: 90 },
  { key: "12m", label: "12 mois", days: 365 },
  { key: "all", label: "Tout", days: null },
];

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
  { key: "draft", label: "Brouillons" },
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmées" },
  { key: "processing", label: "En cours" },
  { key: "shipped", label: "Expédiées" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];

const fmt = fmtEur;

const AdminCommandes = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: vendorsData = [] } = useQuery({
    queryKey: ["admin-order-vendor-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, commission_model, commission_rate, margin_split_pct, fixed_commission_amount");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [activeTab, setActiveTab] = useState<"list" | "timeline" | "aging" | "buyers" | "sla">("list");
  const [hideDeleted, setHideDeleted] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; number: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<{ id: string; number: string; status: string } | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);

  const { data: slaCount } = useQuery({
    queryKey: ["admin-sla-count"],
    queryFn: async () => {
      const { data } = await supabase.rpc("admin_sla_open_alerts_count" as any);
      return (data as any)?.[0] || { total: 0, warnings: 0, criticals: 0 };
    },
    refetchInterval: 60_000,
  });

  // Cohérence commission ↔ CA HT ↔ marge HT (RPC serveur, source de vérité)
  const { data: coherenceData = [] } = useQuery({
    queryKey: ["admin-orders-coherence"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_check_orders_coherence" as any, { _order_ids: null });
      if (error) throw error;
      return (data as Array<{
        order_id: string;
        coherence: "OK" | "COMMISSION_GT_CA" | "COMMISSION_GT_MARGE" | "NEGATIVE";
        issue: string | null;
        ca_ht: number; cost_ht: number; marge_ht: number | null; commission: number; commission_pct: number | null;
      }>) ?? [];
    },
    staleTime: 60_000,
  });
  const coherenceById = new Map(coherenceData.map(c => [c.order_id, c]));
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hideTest, setHideTest] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [onlyWithCommission, setOnlyWithCommission] = useState(false);
  const [forecastFilter, setForecastFilter] = useState<"all" | "real" | "forecast">("all");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [vendorFilterOpen, setVendorFilterOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgePreview, setPurgePreview] = useState<null | {
    targets_count: number;
    total_incl_vat?: number;
    targets: Array<{ id: string; order_number: string; status: string; total_incl_vat: number; created_at: string }>;
  }>(null);
  const [confirmToken, setConfirmToken] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const isProd = typeof window !== "undefined" && /medikong\.pro|medikong\.com/i.test(window.location.hostname);
  const REQUIRED_TOKEN = "PURGE TEST ORDERS";
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Compute period bounds up front (they feed the RPC).
  const hasCustomDatesPre = Boolean(dateFrom || dateTo);
  const periodStartIso = (() => {
    if (dateFrom) { const d = new Date(dateFrom); d.setHours(0, 0, 0, 0); return d.toISOString(); }
    if (hasCustomDatesPre) return null;
    const days = PERIODS.find(p => p.key === period)?.days;
    if (!days) return null;
    const d = new Date(); d.setDate(d.getDate() - days); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const periodEndIso = (() => {
    if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); return d.toISOString(); }
    return null;
  })();

  // Reset to page 1 whenever any filter changes.
  const filtersKey = JSON.stringify({
    statusFilter, search, hideTest, period, dateFrom, dateTo,
    onlyWithCommission, forecastFilter, selectedVendorIds,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {}); // (kept intentionally to preserve prior order of hooks; setPage handled below)

  // Server-side paginated + filtered query.
  const {
    data: ordersPage,
    isLoading,
    isFetching,
  } = useAdminOrdersPaginated(
    {
      status: statusFilter,
      dateFrom: periodStartIso,
      dateTo: periodEndIso,
      vendorIds: selectedVendorIds,
      search,
      onlyWithCommission,
      forecastFilter,
      hideTest,
      hideDeleted: true,
    },
    page,
    pageSize,
  );
  const ordersData = ordersPage?.rows ?? [];
  const serverStatusCounts = ordersPage?.statusCounts ?? {};
  const serverKpis = ordersPage?.kpis;
  const serverTotal = ordersPage?.total ?? 0;

  // Reset page to 1 whenever the filter signature changes.
  if (typeof window !== "undefined") {
    const w = window as any;
    if (w.__admin_orders_filters_key !== filtersKey) {
      w.__admin_orders_filters_key = filtersKey;
      if (page !== 1) setTimeout(() => setPage(1), 0);
    }
  }


  const vendorLabelById = new Map((vendorsData as any[]).map(v => [v.id, v.company_name || v.name || v.id]));
  const vendorCommissionById = new Map<string, VendorCommissionConfig>(
    (vendorsData as any[]).map(v => [v.id, {
      commission_model: (v.commission_model as any) ?? "flat_percentage",
      commission_rate: v.commission_rate as number | null,
      margin_split_pct: v.margin_split_pct as number | null,
      fixed_commission_amount: v.fixed_commission_amount as number | null,
    }]),
  );

  /** Fallback : recalcule la commission depuis order_lines + vendors.commission_* */
  const computeCommissionFromLines = (lines: any[]): number =>
    computeCommissionFromLinesPure(lines, vendorCommissionById);

  const readStoredCommission = (raw: any): { value: number; explicit: boolean } => {
    const subs = ((raw as any).sub_orders || []) as Array<{
      commission_amount_override: number | null;
      commission_rate_override: number | null;
      subtotal_incl_vat: number | null;
    }>;
    let explicit = false;
    const value = subs.reduce((acc, s) => {
      const amt = s.commission_amount_override;
      if (amt !== null && amt !== undefined && Number.isFinite(Number(amt))) {
        explicit = true;
        return acc + Number(amt);
      }
      const rate = s.commission_rate_override;
      const sub = Number(s.subtotal_incl_vat) || 0;
      if (rate !== null && rate !== undefined && Number.isFinite(Number(rate))) {
        explicit = true;
        if (sub > 0) return acc + (sub * Number(rate)) / 100;
      }
      return acc;
    }, 0);
    return { value, explicit };
  };

  const orders = ordersData.map(o => {
    const draftPayload = (o as any).draft_payload as any;
    const draftLines = o.status === "draft" && Array.isArray(draftPayload?.lines) ? draftPayload.lines : [];
    const persistedLines = ((o as any).order_lines || []) as any[];
    const lines = persistedLines.length > 0 ? persistedLines : draftLines;
    const draftTotals = draftLines.length > 0 ? computeOrderTotals(draftLines) : null;
    const stored = readStoredCommission(o);
    // Fallback : ni override stocké, ni draft → recalcul depuis order_lines + vendors.commission_*
    const fallbackCommission = !stored.explicit && !draftTotals && persistedLines.length > 0
      ? computeCommissionFromLines(persistedLines)
      : 0;
    const commissionEur = stored.explicit
      ? stored.value
      : draftTotals
        ? draftTotals.commission
        : fallbackCommission;

    const amountHT = Number(o.subtotal_excl_vat) || 0;
    const effectiveHT = draftTotals ? draftTotals.excl : amountHT;

    // Marge HT = CA HT - coût d'achat HT (par ligne, agrégé)
    let costTotal = 0;
    let hasAnyCost = false;
    const isProvided = (v: any) => v !== null && v !== undefined && v !== "";
    for (const l of lines as any[]) {
      const qty = Number(l.quantity) || 0;
      // order_lines.line_cost = total coût HT déjà persisté ; fallback sur coût unitaire.
      const lineCostRaw = l.line_cost;
      const lineCost = Number(lineCostRaw);
      if (isProvided(lineCostRaw) && Number.isFinite(lineCost) && lineCost > 0) {
        costTotal += lineCost;
        hasAnyCost = true;
        continue;
      }
      // order_lines.cost_price (€/u) OU draft lines.unit_cost_excl_vat — uniquement si saisi explicitement > 0.
      const unitCostRaw = l.cost_price ?? l.unit_cost_excl_vat;
      const unitCost = Number(unitCostRaw);
      if (isProvided(unitCostRaw) && qty > 0 && Number.isFinite(unitCost) && unitCost > 0) {
        costTotal += qty * unitCost;
        hasAnyCost = true;
      }
    }
    const grossMarginEur = hasAnyCost ? effectiveHT - costTotal : 0;
    const grossMarginPct = hasAnyCost && effectiveHT > 0 ? (grossMarginEur / effectiveHT) * 100 : 0;
    const netMarginEur = hasAnyCost ? grossMarginEur - commissionEur : 0;

    return {
      id: o.order_number,
      rawId: o.id,
      refPO: "—",
      buyer: (o.customers as any)?.company_name || "—",
      buyerType: (o.customers as any)?.customer_type || "pharmacy",
      seller: "—",
      amountHT: effectiveHT,
      tva: draftTotals ? draftTotals.vat : Number(o.vat_amount) || 0,
      ttc: draftTotals ? draftTotals.incl : Number(o.total_incl_vat) || 0,
      commissionEur,
      commissionPct: effectiveHT > 0 ? (commissionEur / effectiveHT) * 100 : 0,
      commissionSource: stored.explicit ? "stored" : draftTotals ? "draft" : fallbackCommission > 0 ? "computed" : "none",
      grossMarginEur,
      grossMarginPct,
      netMarginEur,
      hasCost: hasAnyCost,
      costTotal,
      paymentTerms: o.payment_method || "invoice",
      dueDate: o.payment_due_date ? new Date(o.payment_due_date).toLocaleDateString("fr-BE") : "—",
      status: o.status as "draft" | "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled",
      isTest: Boolean((o as any).is_test),
      isForecast: Boolean((o as any).is_forecast),
      wasForecast: Boolean((o as any).was_forecast),
      forecastConvertedAt: (o as any).forecast_converted_at as string | null,
      forecastCreatedAt: (o as any).forecast_created_at as string | null,
      forecastSnapshot: (o as any).forecast_snapshot as any,
      hiddenFromList: Boolean((o as any).hidden_from_list),
      createdAtRaw: o.created_at,
      date: new Date(o.created_at).toLocaleDateString("fr-BE"),
      lines,
    };
  });

  // --- Période : bornes locales pour l'affichage (calcul serveur déjà fait via periodStartIso/EndIso). ---
  const hasCustomDates = Boolean(dateFrom || dateTo);
  const periodStartDate = periodStartIso ? new Date(periodStartIso) : null;
  const periodEndDate = periodEndIso ? new Date(periodEndIso) : new Date();

  // Le serveur (RPC admin_list_orders) applique déjà tous les filtres (statut, période, vendeurs,
  // recherche, commission, prévisionnel, test, supprimées). La page courante = `orders`.
  const displayOrders = orders;
  const filtered = orders;

  // Compteurs / KPIs : issus du RPC (calculés sur l'ensemble filtré, pas la page courante).
  const forecastCount = Number(serverKpis?.forecast_count ?? 0);
  const testCount = 0; // masqué serveur — badge de nettoyage géré via useOrders() ci-dessous
  const deletedCount = 0;

  const countByStatus = (s: string) => Number(serverStatusCounts?.[s] ?? 0);

  const gmvDay = Number(serverKpis?.total_ht ?? 0);
  const totalCount = serverTotal;
  const avgBasket = totalCount > 0 ? Math.round(gmvDay / totalCount) : 0;
  const commissionTotal = Number(serverKpis?.commission_total ?? 0);
  const commissionPctGlobal = gmvDay > 0 ? (commissionTotal / gmvDay) * 100 : 0;
  const grossMarginTotal = Number(serverKpis?.margin_total ?? 0);
  const grossMarginCaBase = Number(serverKpis?.margin_base_ht ?? 0);
  const grossMarginPctGlobal = grossMarginCaBase > 0 ? (grossMarginTotal / grossMarginCaBase) * 100 : 0;


  const tabs = [
    { key: "list" as const, label: "Liste" },
    { key: "sla" as const, label: `Retards SLA${slaCount?.total ? ` (${slaCount.total})` : ""}` },
    { key: "timeline" as const, label: "Timeline" },
    { key: "aging" as const, label: "Échéances paiement" },
    { key: "buyers" as const, label: "Par type acheteur" },
  ];

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("admin_soft_delete_order" as any, {
        _order_id: deleteTarget.id,
        _reason: deleteReason || null,
      });
      if (error) throw error;
      toast.success(`Commande ${deleteTarget.number} supprimée`);
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setDeleteTarget(null);
      setDeleteReason("");
    } catch (e: any) {
      toast.error(e?.message || "Échec de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return;
    setHardDeleting(true);
    try {
      const { error } = await supabase.rpc("admin_hard_delete_order" as any, {
        _order_id: hardDeleteTarget.id,
      });
      if (error) throw error;
      toast.success(`Commande ${hardDeleteTarget.number} supprimée définitivement`);
      logAdminAudit("order.hard_delete", {
        targetId: hardDeleteTarget.id, targetType: "order",
        metadata: { number: hardDeleteTarget.number },
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setHardDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Échec de la suppression définitive");
    } finally {
      setHardDeleting(false);
    }
  };

  const [convertingId, setConvertingId] = useState<string | null>(null);
  const handleConvertForecast = async (orderId: string, orderNumber: string) => {
    setConvertingId(orderId);
    try {
      const { error } = await supabase.rpc("admin_convert_forecast_to_real" as any, {
        _order_id: orderId,
        _notes: null,
      });
      if (error) throw error;
      toast.success(`Commande ${orderNumber} convertie en commande réelle`);
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      toast.error(e?.message || "Échec de la conversion");
    } finally {
      setConvertingId(null);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      ["Numéro", "Date", "Acheteur", "Type", "HT", "TVA", "TTC", "Statut", "Paiement", "Prévisionnel actif", "Anciennement prévisionnel", "Snapshot TTC", "Snapshot date", "Converti le"],
      ...filtered.map(o => [
        o.id,
        o.date,
        o.buyer,
        o.buyerType,
        o.amountHT.toFixed(2),
        o.tva.toFixed(2),
        o.ttc.toFixed(2),
        o.status,
        o.paymentTerms,
        o.isForecast ? "oui" : "non",
        o.wasForecast ? "oui" : "non",
        o.forecastSnapshot?.total_incl_vat != null ? Number(o.forecastSnapshot.total_incl_vat).toFixed(2) : "",
        o.forecastCreatedAt ? new Date(o.forecastCreatedAt).toLocaleDateString("fr-BE") : "",
        o.forecastConvertedAt ? new Date(o.forecastConvertedAt).toLocaleDateString("fr-BE") : "",
      ]),
    ];
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? "");
      return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} commande(s) exportée(s)`);
  };


  const timeline = displayOrders.slice(0, 6).map(o => ({
    time: new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }),
    event: `${o.status === "pending" ? "Nouvelle commande" : o.status === "confirmed" ? "Commande confirmée" : o.status === "processing" ? "En cours" : o.status === "shipped" ? "Expédition" : o.status === "delivered" ? "Livraison confirmée" : "Annulation"} ${o.id}`,
    detail: `${o.buyer} — ${fmt(o.ttc)} EUR TTC`,
    type: o.status,
  }));

  const timelineColors: Record<string, string> = {
    confirmed: "#059669", processing: "#1B5BDA", shipped: "#7C3AED", pending: "#F59E0B", delivered: "#059669", cancelled: "#EF4343",
  };

  const buyerTypeMap = new Map<string, { orders: number; gmv: number }>();
  displayOrders.forEach(o => {
    const existing = buyerTypeMap.get(o.buyerType) || { orders: 0, gmv: 0 };
    existing.orders++;
    existing.gmv += o.amountHT;
    buyerTypeMap.set(o.buyerType, existing);
  });

  const buyerProfiles = Array.from(buyerTypeMap.entries()).map(([type, data]) => ({
    type,
    orders: data.orders,
    gmv: data.gmv,
    avgBasket: data.orders > 0 ? Math.round(data.gmv / data.orders) : 0,
  }));

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId);
  };

  const openPurgeDialog = async () => {
    setPurgeOpen(true);
    setPurgePreview(null);
    setConfirmToken("");
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_purge_test_orders" as any, {
        _dry_run: true,
        _confirm_token: null,
      });
      if (error) throw error;
      setPurgePreview(data as any);
    } catch (e: any) {
      toast.error(e?.message || "Impossible de prévisualiser");
      setPurgeOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePurgeTestOrders = async () => {
    if (confirmToken !== REQUIRED_TOKEN) return;
    setPurging(true);
    try {
      const { data, error } = await supabase.rpc("admin_purge_test_orders" as any, {
        _dry_run: false,
        _confirm_token: confirmToken,
      });
      if (error) throw error;
      const result = (data as any) || {};
      const n = Number(result.orders_deleted || 0);
      if (n === 0) {
        toast.info("Aucune commande test à supprimer");
      } else {
        toast.success(`${n} commande${n > 1 ? "s" : ""} test supprimée${n > 1 ? "s" : ""} (${result.lines_deleted || 0} ligne(s))`);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setPurgeOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Échec de la suppression");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div>
      <AdminTopBar title={t("orders")} subtitle="Gestion des commandes B2B" actions={
        <div className="flex items-center gap-2">
          {testCount > 0 && (
            <button
              onClick={openPurgeDialog}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-semibold"
              style={{ backgroundColor: "#fff", border: "1px solid #FCA5A5", color: "#B91C1C" }}
              title="Supprimer toutes les commandes marquées « test »"
            >
              <Trash2 size={14} /> Purger commandes test ({testCount})
            </button>
          )}
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: "#1B5BDA" }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      } />

      {/* Sélecteur de période — applique à tous les KPIs et toutes les vues */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <span className="px-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>Période</span>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setDateFrom(""); setDateTo(""); }}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors"
              style={{ backgroundColor: period === p.key && !hasCustomDates ? "#1B5BDA" : "transparent", color: period === p.key && !hasCustomDates ? "#fff" : "#616B7C" }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
            Du
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 rounded-md text-[12px] font-medium" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#1D2530" }} />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
            Au
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 rounded-md text-[12px] font-medium" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#1D2530" }} />
          </label>
          {hasCustomDates && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{ backgroundColor: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5" }}>
              Réinitialiser
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "#616B7C" }}>
          <CalendarClock size={14} style={{ color: "#8B95A5" }} />
          {periodStartDate
            ? `Du ${periodStartDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} au ${periodEndDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
            : `Jusqu'au ${periodEndDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3 mb-5">
        <KpiCard icon={TrendingUp} label={`GMV total (${PERIODS.find(p => p.key === period)?.label})`} value={`${fmt(gmvDay)} EUR`} />
        <KpiCard icon={ShoppingCart} label="Commandes" value={String(totalCount)} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={CreditCard} label="Panier moyen" value={`${fmt(avgBasket)} EUR`} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Percent} label="Commission totale" value={`${fmt(commissionTotal)} EUR`} evolution={{ value: Number(commissionPctGlobal.toFixed(2)), label: "% du CA HT" }} iconColor="#10B981" iconBg="#ECFDF5" />
        <KpiCard
          icon={TrendingUp}
          label="Marge HT"
          value={grossMarginCaBase > 0 ? `${fmt(grossMarginTotal)} EUR` : "—"}
          evolution={grossMarginCaBase > 0 ? { value: Number(grossMarginPctGlobal.toFixed(2)), label: "% du CA HT (avec coût)" } : undefined}
          iconColor="#0E7490"
          iconBg="#ECFEFF"
        />
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
              <input type="text" placeholder="Rechercher par ID, acheteur..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium cursor-pointer select-none"
              style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}
              title="Masquer les commandes payées avec une clé Stripe de test">
              <input type="checkbox" checked={hideTest} onChange={(e) => setHideTest(e.target.checked)} />
              Masquer commandes test
              {testCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
                  {testCount}
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium cursor-pointer select-none"
              style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}
              title="N'afficher que les commandes avec une commission > 0 €">
              <input type="checkbox" checked={onlyWithCommission} onChange={(e) => setOnlyWithCommission(e.target.checked)} />
              Avec commission
            </label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium cursor-pointer select-none"
              style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: forecastFilter !== "real" ? "#6D28D9" : "#616B7C" }}
              title="Inclure les commandes prévisionnelles (date d'encodage future ou tag manuel) dans la liste">
              <input
                type="checkbox"
                checked={forecastFilter !== "real"}
                onChange={(e) => setForecastFilter(e.target.checked ? "all" : "real")}
              />
              <CalendarClock size={12} />
              Inclure prévisionnelles
              {forecastCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#EDE9FE", color: "#6D28D9" }}>
                  {forecastCount}
                </span>
              )}
            </label>
            <button
              onClick={() => setForecastFilter(forecastFilter === "forecast" ? "all" : "forecast")}
              className="px-3 py-2 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
              style={{
                backgroundColor: forecastFilter === "forecast" ? "#EDE9FE" : "#fff",
                border: "1px solid #E2E8F0",
                color: forecastFilter === "forecast" ? "#6D28D9" : "#616B7C",
              }}
              title="N'afficher que les commandes prévisionnelles"
            >
              <CalendarClock size={12} />
              Prévisionnelles uniquement
            </button>
            <Popover open={vendorFilterOpen} onOpenChange={setVendorFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: selectedVendorIds.length > 0 ? "#EFF6FF" : "#fff",
                    border: "1px solid #E2E8F0",
                    color: selectedVendorIds.length > 0 ? "#1B5BDA" : "#616B7C",
                  }}
                  title="Filtrer les commandes par vendeurs présents dans les lignes"
                >
                  <Filter size={14} /> Filtres
                  {selectedVendorIds.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#1B5BDA", color: "#fff" }}>
                      {selectedVendorIds.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Filtrer par vendeur(s)</div>
                  {selectedVendorIds.length > 0 && (
                    <button
                      onClick={() => setSelectedVendorIds([])}
                      className="text-[11px] font-medium hover:underline inline-flex items-center gap-1"
                      style={{ color: "#EF4343" }}
                    >
                      <X size={11} /> Réinitialiser
                    </button>
                  )}
                </div>
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Rechercher un vendeur..."
                    value={vendorSearch}
                    onValueChange={setVendorSearch}
                  />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Aucun vendeur trouvé</CommandEmpty>
                    <CommandGroup>
                      {(vendorsData as any[])
                        .filter((v) => {
                          const label = (v.company_name || v.name || "").toLowerCase();
                          return !vendorSearch || label.includes(vendorSearch.toLowerCase());
                        })
                        .slice(0, 100)
                        .map((v) => {
                          const isSelected = selectedVendorIds.includes(v.id);
                          const label = v.company_name || v.name || v.id;
                          return (
                            <CommandItem
                              key={v.id}
                              value={v.id}
                              onSelect={() => {
                                setSelectedVendorIds((prev) =>
                                  prev.includes(v.id) ? prev.filter((x) => x !== v.id) : [...prev, v.id],
                                );
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <div
                                  className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                                  style={{
                                    backgroundColor: isSelected ? "#1B5BDA" : "#fff",
                                    borderColor: isSelected ? "#1B5BDA" : "#CBD5E1",
                                  }}
                                >
                                  {isSelected && <Check size={12} color="#fff" />}
                                </div>
                                <span className="text-[12px] truncate" style={{ color: "#1D2530" }}>{label}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedVendorIds.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8B95A5" }}>
                Vendeurs :
              </span>
              {selectedVendorIds.map((vid) => {
                const label = vendorLabelById.get(vid) || vid;
                return (
                  <span
                    key={vid}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA", border: "1px solid #BFDBFE" }}
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => setSelectedVendorIds((prev) => prev.filter((x) => x !== vid))}
                      className="inline-flex items-center justify-center rounded-full hover:bg-blue-100 transition-colors"
                      style={{ width: 14, height: 14 }}
                      title={`Retirer ${label}`}
                      aria-label={`Retirer ${label}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedVendorIds([])}
                className="text-[11px] font-medium hover:underline inline-flex items-center gap-1 ml-1"
                style={{ color: "#EF4343" }}
              >
                <X size={11} /> Tout retirer
              </button>
            </div>
          )}


          <div className="flex items-center gap-1.5 mb-2 text-[12px]" style={{ color: "#8B95A5" }}>
            <CalendarClock size={13} />
            {periodStartDate
              ? `Période filtrée : ${periodStartDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} – ${periodEndDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
              : `Période filtrée : jusqu'au ${periodEndDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}
            <span className="mx-1">·</span>
            <span className="font-semibold" style={{ color: "#1D2530" }}>
              {totalCount} résultat{totalCount > 1 ? "s" : ""}
              {totalCount > pageSize && (
                <span className="font-normal" style={{ color: "#8B95A5" }}>
                  {" "}· page {page} / {Math.max(1, Math.ceil(totalCount / pageSize))}
                </span>
              )}
              {isFetching && !isLoading && (
                <span className="ml-2 text-[10px] font-normal" style={{ color: "#8B95A5" }}>(mise à jour…)</span>
              )}
            </span>
          </div>

          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                      <th className="px-2 py-3 w-8"></th>
                      {["ID / Réf PO", "Acheteur", "Type", "Lignes", "Vendeurs", "Lignes uniques", "HT", "TVA", "TTC", "Marge HT", "Commission", "Cohérence", "Paiement", "Statut", ""].map((h) => (
                        <th key={h} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => {
                      const bc = buyerColors[o.buyerType] || { bg: "#F1F5F9", text: "#475569" };
                      const isExpanded = expandedOrder === o.rawId;
                      return (
                        <>
                          <tr key={o.rawId} className="cursor-pointer transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}
                            onClick={() => toggleExpand(o.rawId)}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                            <td className="px-2 py-3 text-center">
                              {isExpanded ? <ChevronDown size={14} style={{ color: "#8B95A5" }} /> : <ChevronRight size={14} style={{ color: "#8B95A5" }} />}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-bold font-mono" style={{ color: "#1B5BDA" }}>{o.id}</span>
                                {o.isTest && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
                                    Test
                                  </span>
                                )}
                                {o.isForecast && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#EDE9FE", color: "#6D28D9" }} title="Commande prévisionnelle">
                                    <CalendarClock size={9} /> Prévisionnel
                                  </span>
                                )}
                                {!o.isForecast && o.wasForecast && o.forecastConvertedAt && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#DCFCE7", color: "#15803D" }} title={`Convertie depuis prévisionnel le ${new Date(o.forecastConvertedAt).toLocaleDateString("fr-BE")}`}>
                                    <CalendarClock size={9} /> Convertie
                                  </span>
                                )}
                                {!o.isForecast && o.wasForecast && !o.forecastConvertedAt && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#F1F5F9", color: "#475569" }} title="Anciennement prévisionnelle (modifiée ou annulée)">
                                    <CalendarClock size={9} /> Ex-prév.
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px]" style={{ color: "#8B95A5" }}>{o.date}</span>
                            </td>
                            <td className="px-3 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>{o.buyer}</td>
                            <td className="px-3 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: bc.bg, color: bc.text }}>
                                {o.buyerType}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
                                {o.lines.length} article{o.lines.length > 1 ? "s" : ""}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {(() => {
                                const names = Array.from(new Set((o.lines || []).map((l: any) => l.vendors?.company_name || (l.vendor_id ? vendorLabelById.get(l.vendor_id) : null) || l.qogita_seller_fid).filter(Boolean)));
                                if (names.length === 0) return <span className="text-[11px]" style={{ color: "#8B95A5" }}>—</span>;
                                const shown = names.slice(0, 2).join(", ");
                                const extra = names.length > 2 ? ` +${names.length - 2}` : "";
                                return (
                                  <span className="text-[11px]" style={{ color: "#1D2530" }} title={names.join(", ")}>
                                    {shown}{extra}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>
                                {(() => {
                                  const ids = (o.lines || [])
                                    .map((l: any) => l.product_id || l.id)
                                    .filter(Boolean);
                                  return ids.length === 0 ? "—" : new Set(ids).size;
                                })()}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(o.amountHT)}</td>
                            <td className="px-3 py-3 text-[11px] font-mono" style={{ color: "#8B95A5" }}>{fmt(o.tva)}</td>
                            <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(o.ttc)}</td>
                            <td
                              className="px-3 py-3 font-mono"
                              title={
                                o.hasCost
                                  ? `Marge HT = CA HT (${fmt(o.amountHT)}) − coût d'achat (${fmt(o.costTotal)})${o.commissionEur > 0 ? `\nMarge nette estimée (− commission) : ${fmt(o.netMarginEur)} EUR` : ""}`
                                  : "Aucun prix d'achat renseigné sur les lignes — marge non calculable"
                              }
                            >
                              {o.hasCost ? (
                                <div className="leading-tight">
                                  <div className="text-[12px] font-bold" style={{ color: o.grossMarginEur >= 0 ? "#0E7490" : "#EF4444" }}>{fmt(o.grossMarginEur)}</div>
                                  <div className="text-[10px]" style={{ color: "#8B95A5" }}>{o.grossMarginPct.toFixed(2)} %</div>
                                </div>
                              ) : (
                                <span className="text-[11px]" style={{ color: "#CBD5E1" }}>—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-mono">
                              <div className="leading-tight" title={`Commission MediKong = ${fmt(o.commissionEur)} EUR (${o.commissionPct.toFixed(2)} % du CA HT)`}>
                                <div className="text-[12px] font-bold" style={{ color: "#059669" }}>{fmt(o.commissionEur)}</div>
                                <div className="text-[10px]" style={{ color: "#8B95A5" }}>{o.commissionPct.toFixed(2)} %</div>
                              </div>
                            </td>
                            {(() => {
                              const c = coherenceById.get(o.rawId);
                              const status = c?.coherence ?? "OK";
                              const isOk = status === "OK";
                              const label = isOk ? "OK" : status === "COMMISSION_GT_CA" ? "Com > CA" : status === "COMMISSION_GT_MARGE" ? "Com > marge" : "Négative";
                              const title = isOk
                                ? `Cohérence OK · CA HT ${fmt(c?.ca_ht ?? o.amountHT)} · Marge HT ${c?.marge_ht != null ? fmt(c.marge_ht) : "—"} · Commission ${fmt(c?.commission ?? o.commissionEur)}${c?.commission_pct != null ? ` (${c.commission_pct.toFixed(2)} %)` : ""}`
                                : `${c?.issue ?? "Incohérence détectée"} · CA HT ${fmt(c?.ca_ht ?? 0)} · Marge HT ${c?.marge_ht != null ? fmt(c.marge_ht) : "—"} · Commission ${fmt(c?.commission ?? 0)}`;
                              return (
                                <td className="px-3 py-3">
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                                    style={isOk
                                      ? { backgroundColor: "#ECFDF5", color: "#047857" }
                                      : { backgroundColor: "#FEF2F2", color: "#B91C1C" }}
                                    title={title}
                                  >
                                    {isOk ? "✓" : <AlertTriangle size={10} />} {label}
                                  </span>
                                </td>
                              );
                            })()}
                            <td className="px-3 py-3 text-[11px]" style={{ color: "#616B7C" }}>{o.paymentTerms}</td>
                            <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                            <td className="px-3 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                {(o.status === "draft" || o.isForecast) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(o.status === "draft" ? `/admin/commandes/nouvelle?draft=${o.rawId}` : `/admin/commandes/nouvelle?edit=${o.rawId}`);
                                    }}
                                    title={o.status === "draft" ? "Ouvrir et modifier ce brouillon" : "Modifier cette commande prévisionnelle"}
                                    className="p-1.5 rounded hover:bg-amber-50"
                                    style={{ color: "#D97706" }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                {o.isForecast && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleConvertForecast(o.rawId, o.id); }}
                                    disabled={convertingId === o.rawId}
                                    title="Convertir cette commande prévisionnelle en commande réelle (statut confirmée)"
                                    className="p-1.5 rounded hover:bg-violet-50 disabled:opacity-50"
                                    style={{ color: "#6D28D9" }}
                                  >
                                    <CalendarClock size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/commandes/${o.rawId}`); }}
                                  title="Voir le détail de la commande"
                                  className="p-1.5 rounded hover:bg-slate-100"
                                  style={{ color: "#475569" }}
                                >
                                  <Eye size={14} />
                                 </button>
                                {!(o.status === "draft" || o.isForecast) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/commandes/nouvelle?edit=${o.rawId}`); }}
                                    title="Modifier la commande"
                                    className="p-1.5 rounded hover:bg-amber-50"
                                    style={{ color: "#B45309" }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const { data, error } = await supabase.functions.invoke("generate-order-pdf", { body: { order_id: o.rawId } });
                                      if (error) throw error;
                                      const url = (data as any)?.pdf_url;
                                      if (url) window.open(url, "_blank");
                                      toast.success("PDF généré");
                                    } catch (err: any) {
                                      toast.error(err?.message || "Échec génération PDF");
                                    }
                                  }}
                                  title="Générer le bon de commande PDF"
                                  className="p-1.5 rounded hover:bg-blue-50"
                                  style={{ color: "#1C58D9" }}
                                >
                                  <FileDown size={14} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/commandes/nouvelle?duplicate=${o.rawId}`); }}
                                  title="Dupliquer cette commande"
                                  className="p-1.5 rounded hover:bg-sky-50"
                                  style={{ color: "#0369A1" }}
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: o.rawId, number: o.id }); }}
                                  title="Archiver cette commande (soft-delete)"
                                  className="p-1.5 rounded hover:bg-red-50"
                                  style={{ color: "#B91C1C" }}
                                >
                                  <Trash2 size={14} />
                                </button>
                                {(o.status === "cancelled" || o.status === "draft" || (o as any).isTest) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setHardDeleteTarget({ id: o.rawId, number: o.id, status: o.status }); }}
                                    title="Supprimer définitivement (irréversible)"
                                    className="p-1.5 rounded hover:bg-red-100"
                                    style={{ color: "#7F1D1D" }}
                                  >
                                    <Flame size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && o.lines.length > 0 && (
                            <tr key={`${o.rawId}-lines`}>
                              <td colSpan={15} className="px-0 py-0">
                                <div className="mx-4 mb-3 rounded-lg overflow-hidden" style={{ border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                                        {["Produit", "Vendeur Qogita", "Qté", "Prix HT", "Total HT", "Offre Qogita", "Délai", "Statut Qogita"].map(h => (
                                          <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {o.lines.map((line: any) => {
                                        const productName = line.products?.name || line.offer_label || line.manual_label || "—";
                                        const vendorName = line.vendors?.company_name || (line.vendor_id ? vendorLabelById.get(line.vendor_id) : null) || line.qogita_seller_fid || "—";
                                        const deliveryDays = line.offers?.delivery_days;
                                        const deliveryLabel = deliveryDays ? `${deliveryDays}j` : "5-10j ouvrables";
                                        const qogitaStatus = line.qogita_order_status || "pending";
                                        const statusColor = qogitaStatus === "confirmed" ? "#059669" : qogitaStatus === "shipped" ? "#7C3AED" : "#F59E0B";
                                        const lineQty = Number(line.quantity) || 0;
                                        const lineUnit = Number(line.unit_price_excl_vat) || 0;
                                        const lineTotal = Number(line.line_total_excl_vat ?? lineUnit * lineQty) || 0;
                                        return (
                                          <tr key={line.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                            <td className="px-3 py-2">
                                              <div className="flex items-center gap-2">
                                                {line.products?.image_url ? (
                                                  <img src={line.products.image_url} alt="" className="w-7 h-7 rounded object-contain bg-white" style={{ border: "1px solid #E2E8F0" }} />
                                                ) : (
                                                  <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: "#F1F5F9" }}><Package size={12} style={{ color: "#8B95A5" }} /></div>
                                                )}
                                                <div>
                                                  <span className="text-[11px] font-medium block" style={{ color: "#1D2530" }}>{productName}</span>
                                                  {line.products?.gtin && <span className="text-[9px] font-mono" style={{ color: "#8B95A5" }}>{line.products.gtin}</span>}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-[11px] font-mono" style={{ color: "#616B7C" }}>
                                              {vendorName}
                                            </td>
                                            <td className="px-3 py-2 text-[11px] font-bold" style={{ color: "#1D2530" }}>{line.quantity}</td>
                                            <td className="px-3 py-2 text-[11px] font-mono" style={{ color: "#1D2530" }}>{fmt(Number(line.unit_price_excl_vat))}&nbsp;€</td>
                                            <td className="px-3 py-2 text-[11px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(lineTotal)}&nbsp;€</td>
                                            <td className="px-3 py-2">
                                              {line.qogita_offer_qid ? (
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>{line.qogita_offer_qid}</span>
                                              ) : <span className="text-[10px]" style={{ color: "#8B95A5" }}>—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-[11px]" style={{ color: "#616B7C" }}>
                                              <div className="flex items-center gap-1">
                                                <Truck size={11} />
                                                {deliveryLabel}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
                                                {qogitaStatus}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                          {isExpanded && o.lines.length === 0 && (
                            <tr key={`${o.rawId}-empty`}>
                              <td colSpan={15} className="px-6 py-4 text-center text-[12px]" style={{ color: "#8B95A5" }}>
                                Aucune ligne de commande enregistrée.
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                    {filtered.length === 0 && selectedVendorIds.length > 0 && (
                      <tr>
                        <td colSpan={15} className="px-6 py-10 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Filter size={24} style={{ color: "#CBD5E1" }} />
                            <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>
                              Aucune commande ne correspond aux vendeurs sélectionnés.
                            </p>
                            <button
                              type="button"
                              onClick={() => setSelectedVendorIds([])}
                              className="px-3 py-1.5 rounded text-[12px] font-medium transition-colors hover:bg-blue-100"
                              style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA", border: "1px solid #BFDBFE" }}
                            >
                              Réinitialiser les filtres vendeurs
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filtered.length > 0 && (() => {
                    const tHT = filtered.reduce((a, o) => a + o.amountHT, 0);
                    const tTVA = filtered.reduce((a, o) => a + o.tva, 0);
                    const tTTC = filtered.reduce((a, o) => a + o.ttc, 0);
                    const tMargin = filtered.reduce((a, o) => a + (o.hasCost ? o.grossMarginEur : 0), 0);
                    const tMarginBase = filtered.reduce((a, o) => a + (o.hasCost ? o.amountHT : 0), 0);
                    const tMarginPct = tMarginBase > 0 ? (tMargin / tMarginBase) * 100 : 0;
                    const tCommission = filtered.reduce((a, o) => a + o.commissionEur, 0);
                    const tCommissionPct = tHT > 0 ? (tCommission / tHT) * 100 : 0;
                    return (
                      <tfoot>
                        <tr style={{ backgroundColor: "#F1F5F9", borderTop: "2px solid #CBD5E1" }}>
                          <td colSpan={2} className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#1D2530" }}>
                            Total · {filtered.length} commande{filtered.length > 1 ? "s" : ""}
                          </td>
                          <td colSpan={5}></td>
                          <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(tHT)}</td>
                          <td className="px-3 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{fmt(tTVA)}</td>
                          <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(tTTC)}</td>
                          <td className="px-3 py-3 font-mono">
                            {tMarginBase > 0 ? (
                              <div className="leading-tight">
                                <div className="text-[12px] font-bold" style={{ color: "#0E7490" }}>{fmt(tMargin)}</div>
                                <div className="text-[10px]" style={{ color: "#8B95A5" }}>{tMarginPct.toFixed(2)} %</div>
                              </div>
                            ) : <span className="text-[11px]" style={{ color: "#CBD5E1" }}>—</span>}
                          </td>
                          <td className="px-3 py-3 font-mono">
                            <div className="leading-tight">
                              <div className="text-[12px] font-bold" style={{ color: "#059669" }}>{fmt(tCommission)}</div>
                              <div className="text-[10px]" style={{ color: "#8B95A5" }}>{tCommissionPct.toFixed(2)} %</div>
                            </div>
                          </td>
                          <td colSpan={4}></td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "sla" && <AdminOrderSlaPanel />}

      {activeTab === "timeline" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Activité récente</h3>
          {timeline.map((tl, i) => (
            <div key={i} className="flex items-start gap-4 py-3" style={{ borderBottom: i < timeline.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <span className="text-[12px] font-mono shrink-0 w-12 pt-0.5" style={{ color: "#8B95A5" }}>{tl.time}</span>
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: timelineColors[tl.type] || "#8B95A5" }} />
              <div>
                <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{tl.event}</span>
                <p className="text-[11px] mt-0.5" style={{ color: "#8B95A5" }}>{tl.detail}</p>
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
                    <p className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{fmt(bp.avgBasket)} EUR</p>
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
              { range: "0-30 jours", color: "#059669", amount: displayOrders.filter(o => o.status === "pending" || o.status === "confirmed" || o.status === "processing").reduce((a, o) => a + o.ttc, 0) },
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

      <AlertDialog open={purgeOpen} onOpenChange={(o) => { setPurgeOpen(o); if (!o) { setPurgePreview(null); setConfirmToken(""); } }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Purge des commandes test — confirmation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-[13px]">
                {isProd && (
                  <div className="rounded-md p-3 border border-destructive/40 bg-destructive/5 text-destructive font-semibold">
                    ⚠️ Vous êtes sur l'environnement de production ({window.location.hostname}). Vérifiez deux fois avant de purger.
                  </div>
                )}
                {previewLoading && <div>Chargement de la prévisualisation…</div>}
                {!previewLoading && purgePreview && (
                  <>
                    <div>
                      Prévisualisation : <strong>{purgePreview.targets_count}</strong> commande
                      {purgePreview.targets_count > 1 ? "s" : ""} test seront supprimées
                      {typeof purgePreview.total_incl_vat === "number" && (
                        <> (total TTC <strong>{fmt(purgePreview.total_incl_vat)} €</strong>)</>
                      )}
                      .
                    </div>
                    {purgePreview.targets_count > 0 && (
                      <div className="max-h-48 overflow-auto rounded border border-border">
                        <table className="w-full text-[12px]">
                          <thead className="bg-muted">
                            <tr><th className="text-left px-2 py-1">N°</th><th className="text-left px-2 py-1">Statut</th><th className="text-right px-2 py-1">TTC</th><th className="text-left px-2 py-1">Date</th></tr>
                          </thead>
                          <tbody>
                            {purgePreview.targets.map((t) => (
                              <tr key={t.id} className="border-t border-border">
                                <td className="px-2 py-1 font-mono">{t.order_number}</td>
                                <td className="px-2 py-1">{t.status}</td>
                                <td className="px-2 py-1 text-right">{fmt(t.total_incl_vat)}</td>
                                <td className="px-2 py-1">{new Date(t.created_at).toLocaleDateString("fr-BE")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {purgePreview.targets_count > 0 && (
                      <div className="space-y-1 pt-2">
                        <label className="text-[12px] text-muted-foreground">
                          Pour confirmer, tapez exactement : <code className="px-1 bg-muted rounded">{REQUIRED_TOKEN}</code>
                        </label>
                        <input
                          type="text"
                          value={confirmToken}
                          onChange={(e) => setConfirmToken(e.target.value)}
                          autoFocus
                          className="w-full px-3 py-2 border border-border rounded-md text-[13px] outline-none focus:border-destructive"
                          placeholder={REQUIRED_TOKEN}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purging}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handlePurgeTestOrders(); }}
              disabled={purging || previewLoading || !purgePreview || purgePreview.targets_count === 0 || confirmToken !== REQUIRED_TOKEN}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purging ? "Suppression..." : `Supprimer définitivement${purgePreview ? ` ${purgePreview.targets_count}` : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la commande {deleteTarget?.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La commande sera marquée <b>annulée</b> et masquée de la liste. L'historique comptable et Stripe est conservé. Action réversible via la base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-[12px] font-semibold text-slate-600">Raison (optionnel)</label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded border text-[13px]"
              rows={2}
              placeholder="ex : commande de test, doublon, demande client…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleSoftDelete(); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hardDeleteTarget} onOpenChange={(o) => { if (!o) setHardDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Flame size={18} className="text-red-700" />
              Suppression définitive — {hardDeleteTarget?.number}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <b>irréversible</b>. La commande, ses lignes, sous-commandes, transferts et factures liées seront <b>définitivement supprimés</b> de la base.
              <br /><br />
              Autorisé uniquement pour les commandes <b>annulées, brouillons ou test</b>. Statut actuel : <b>{hardDeleteTarget?.status}</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hardDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleHardDelete(); }}
              disabled={hardDeleting}
              className="bg-red-800 hover:bg-red-900"
            >
              {hardDeleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
};

export default AdminCommandes;