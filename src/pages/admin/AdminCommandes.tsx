import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import AdminOrderSlaPanel from "@/components/admin/AdminOrderSlaPanel";
import { useI18n } from "@/contexts/I18nContext";
import { useOrders } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShoppingCart, TrendingUp, Clock, CreditCard, Truck,
  Search, Filter, Download, ChevronDown, ChevronRight, Package, Trash2, AlertTriangle,
} from "lucide-react";

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"list" | "timeline" | "aging" | "buyers" | "sla">("list");
  const [hideDeleted, setHideDeleted] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; number: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: slaCount } = useQuery({
    queryKey: ["admin-sla-count"],
    queryFn: async () => {
      const { data } = await supabase.rpc("admin_sla_open_alerts_count" as any);
      return (data as any)?.[0] || { total: 0, warnings: 0, criticals: 0 };
    },
    refetchInterval: 60_000,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hideTest, setHideTest] = useState(true);
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

  const orders = ordersData.map(o => ({
    id: o.order_number,
    rawId: o.id,
    refPO: "—",
    buyer: (o.customers as any)?.company_name || "—",
    buyerType: (o.customers as any)?.customer_type || "pharmacy",
    seller: "—",
    amountHT: Number(o.subtotal_excl_vat) || 0,
    tva: Number(o.vat_amount) || 0,
    ttc: Number(o.total_incl_vat) || 0,
    paymentTerms: o.payment_method || "invoice",
    dueDate: o.payment_due_date ? new Date(o.payment_due_date).toLocaleDateString("fr-BE") : "—",
    status: o.status as "pending" | "confirmed" | "shipped" | "delivered" | "cancelled",
    isTest: Boolean((o as any).is_test),
    hiddenFromList: Boolean((o as any).hidden_from_list),
    date: new Date(o.created_at).toLocaleDateString("fr-BE"),
    lines: ((o as any).order_lines || []) as any[],
  }));

  const visibleOrders = hideDeleted ? orders.filter(o => !o.hiddenFromList) : orders;
  const displayOrders = hideTest ? visibleOrders.filter(o => !o.isTest) : visibleOrders;
  const testCount = visibleOrders.filter(o => o.isTest).length;
  const deletedCount = orders.filter(o => o.hiddenFromList).length;

  const filtered = displayOrders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.buyer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByStatus = (s: string) => s === "all" ? displayOrders.length : displayOrders.filter((o) => o.status === s).length;

  const gmvDay = displayOrders.reduce((a, o) => a + o.amountHT, 0);
  const avgBasket = displayOrders.length > 0 ? Math.round(gmvDay / displayOrders.length) : 0;

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

  const timeline = displayOrders.slice(0, 6).map(o => ({
    time: new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }),
    event: `${o.status === "pending" ? "Nouvelle commande" : o.status === "confirmed" ? "Commande confirmée" : o.status === "shipped" ? "Expédition" : o.status === "delivered" ? "Livraison confirmée" : "Annulation"} ${o.id}`,
    detail: `${o.buyer} — ${fmt(o.ttc)} EUR TTC`,
    type: o.status,
  }));

  const timelineColors: Record<string, string> = {
    confirmed: "#1B5BDA", shipped: "#7C3AED", pending: "#F59E0B", delivered: "#059669", cancelled: "#EF4343",
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
          <button className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: "#1B5BDA" }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
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
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}><Filter size={14} /> Filtres</button>
          </div>

          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                      <th className="px-2 py-3 w-8"></th>
                      {["ID / Réf PO", "Acheteur", "Type", "Lignes", "HT", "TVA", "TTC", "Paiement", "Statut", ""].map((h) => (
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
                            <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(o.amountHT)}</td>
                            <td className="px-3 py-3 text-[11px] font-mono" style={{ color: "#8B95A5" }}>{fmt(o.tva)}</td>
                            <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(o.ttc)}</td>
                            <td className="px-3 py-3 text-[11px]" style={{ color: "#616B7C" }}>{o.paymentTerms}</td>
                            <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: o.rawId, number: o.id }); }}
                                title="Archiver cette commande (soft-delete)"
                                className="p-1.5 rounded hover:bg-red-50"
                                style={{ color: "#B91C1C" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && o.lines.length > 0 && (
                            <tr key={`${o.rawId}-lines`}>
                              <td colSpan={10} className="px-0 py-0">
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
                                        const productName = line.products?.name || "—";
                                        const vendorName = line.vendors?.company_name || line.qogita_seller_fid || "—";
                                        const deliveryDays = line.offers?.delivery_days;
                                        const deliveryLabel = deliveryDays ? `${deliveryDays}j` : "5-10j ouvrables";
                                        const qogitaStatus = line.qogita_order_status || "pending";
                                        const statusColor = qogitaStatus === "confirmed" ? "#059669" : qogitaStatus === "shipped" ? "#7C3AED" : "#F59E0B";
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
                                            <td className="px-3 py-2 text-[11px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(Number(line.line_total_excl_vat))}&nbsp;€</td>
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
                              <td colSpan={10} className="px-6 py-4 text-center text-[12px]" style={{ color: "#8B95A5" }}>
                                Aucune ligne de commande enregistrée.
                              </td>
                            </tr>
                          )}
                        </>
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
                        <> (total TTC <strong>{Number(purgePreview.total_incl_vat).toLocaleString("fr-BE", { minimumFractionDigits: 2 })} €</strong>)</>
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
                                <td className="px-2 py-1 text-right">{Number(t.total_incl_vat).toLocaleString("fr-BE", { minimumFractionDigits: 2 })}</td>
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
    </div>
  );
};

export default AdminCommandes;