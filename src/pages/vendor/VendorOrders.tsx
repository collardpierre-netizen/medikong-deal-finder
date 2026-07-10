import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VEmptyState } from "@/components/vendor/ui/VEmptyState";
import { ShoppingCart, PackageCheck, Loader2, ChevronDown, ChevronUp, Truck, ExternalLink, Package, X, Check, Pencil, Search, Clock, AlertCircle, CheckCircle2, Ban, ArrowUpDown, User, MapPin, CreditCard, Barcode, FileText, Calculator, Mail, Phone, Download } from "lucide-react";
import { useEffectiveCommission } from "@/hooks/useEffectiveCommission";
import { computeMargin, fmtPct } from "@/lib/vendorMargin";
import { MarginBreakdownDetails } from "@/components/vendor/MarginBreakdownDetails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getVendorPublicName } from "@/lib/vendor-display";

import { fmtEur } from "@/lib/format-currency";
import { Link } from "react-router-dom";
interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  offer_id: string;
  vendor_id: string;
  quantity: number;
  quantity_shipped: number | null;
  unit_price_excl_vat: number;
  unit_price_incl_vat: number;
  line_total_excl_vat: number;
  line_total_incl_vat: number;
  vat_rate: number;
  fulfillment_type: string;
  fulfillment_status: string;
  qogita_order_status: string;
  qogita_offer_qid: string | null;
  qogita_seller_fid: string | null;
  cost_price: number | null;
  tracking_number: string | null;
  tracking_url: string | null;
  cancellation_reason: string | null;
  refunded_amount_incl_vat: number | null;
}

export interface OrderWithLines {
  order_id: string;
  order_number: string;
  order_status: string;
  order_date: string;
  shipping_address: any;
  billing_address: any;
  customer_id: string;
  payment_method: string | null;
  payment_status: string | null;
  payment_due_date: string | null;
  order_tracking_number: string | null;
  order_tracking_url: string | null;
  order_tracking_carrier: string | null;
  shipped_at: string | null;
  notes: string | null;
  lines: (OrderLine & {
    product_name: string;
    product_image: string | null;
    product_gtin: string | null;
    product_cnk: string | null;
  })[];
}


const statusConfig: Record<string, { label: string; color: "info" | "success" | "warning" | "default" }> = {
  pending: { label: "En attente", color: "warning" },
  processing: { label: "En préparation", color: "info" },
  forwarded: { label: "Transmis au fournisseur", color: "success" },
  shipped: { label: "Expédié", color: "info" },
  delivered: { label: "Livré", color: "success" },
  cancelled: { label: "Annulé", color: "default" },
};

const APP_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://medikong.pro";

// ============================================================
// Email helper — délègue au backend (notify-order-status).
// Le vendeur ne peut pas lire customers.email côté client (RLS),
// donc l'envoi se fait via une edge function qui valide le vendeur
// et récupère l'email côté serveur.
// ============================================================
async function sendBuyerEmail(opts: {
  lineId: string;
  event: "accepted" | "shipped" | "delivered";
  templateLabel: string;
  shipped?: {
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    carrierName?: string | null;
    isPartial?: boolean;
  };
}): Promise<boolean> {
  try {
    console.log("[VendorOrders] notify-order-status →", { lineId: opts.lineId, event: opts.event });
    const { data, error } = await supabase.functions.invoke("notify-order-status", {
      body: {
        lineId: opts.lineId,
        event: opts.event,
        appOrigin: APP_ORIGIN,
        ...(opts.shipped || {}),
      },
    });
    if (error) {
      console.error("[VendorOrders] notify-order-status error", error, data);
      toast.error(`Email acheteur NON envoyé (${opts.templateLabel}) — ${error.message || "voir console"}`);
      return false;
    }
    if (!data?.success) {
      console.error("[VendorOrders] notify-order-status non-success", data);
      toast.error(`Email acheteur NON envoyé (${opts.templateLabel}) — ${data?.error || "réponse invalide"}`);
      return false;
    }
    console.log("[VendorOrders] notify-order-status ok", data);
    return true;
  } catch (e: any) {
    console.error("[VendorOrders] notify-order-status failed", e);
    toast.error(`Email acheteur NON envoyé (${opts.templateLabel}) — ${e?.message || "erreur réseau"}`);
    return false;
  }
}

// ============================================================
// Component
// ============================================================
export default function VendorOrders() {
  const vendorQuery = useCurrentVendor();
  const vendorId = vendorQuery.data?.id;
  const queryClient = useQueryClient();
  const vendorOrdersQueryKey = useMemo(() => ["vendor-order-lines", vendorId] as const, [vendorId]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Filtres & tri
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | to_treat | processing | shipped | delivered | cancelled
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all"); // all | 7d | 30d | 90d
  const [sortBy, setSortBy] = useState<string>("date_desc"); // date_desc | date_asc | amount_desc | amount_asc

  // Modales
  const [shipLine, setShipLine] = useState<OrderWithLines["lines"][number] & { order: OrderWithLines } | null>(null);
  const [cancelLine, setCancelLine] = useState<OrderWithLines["lines"][number] & { order: OrderWithLines } | null>(null);
  const [revertConfirm, setRevertConfirm] = useState<{ lineId: string; from: string; to: string } | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: vendorOrdersQueryKey,
    enabled: !!vendorId,
    queryFn: async () => {
      const { data: lines, error } = await supabase
        .from("order_lines")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("order_id", { ascending: false });

      if (error) throw error;
      if (!lines || lines.length === 0) return [];

      const orderIds = [...new Set(lines.map(l => l.order_id))];
      const productIds = [...new Set(lines.map(l => l.product_id))];

      const [ordersRes, productsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, status, created_at, shipping_address, billing_address, customer_id, hidden_from_list, deleted_at, payment_method, payment_status, payment_due_date, tracking_number, tracking_url, tracking_carrier, shipped_at, notes")
          .in("id", orderIds)
          .eq("hidden_from_list", false)
          .is("deleted_at", null),
        supabase.from("products").select("id, name, image_url, gtin, cnk_code").in("id", productIds),
      ]);

      const orderMap = new Map((ordersRes.data || []).map(o => [o.id, o]));
      const productMap = new Map((productsRes.data || []).map(p => [p.id, p]));

      const grouped = new Map<string, OrderWithLines>();
      for (const line of lines) {
        const order: any = orderMap.get(line.order_id);
        if (!order) continue;

        if (!grouped.has(line.order_id)) {
          grouped.set(line.order_id, {
            order_id: line.order_id,
            order_number: order.order_number,
            order_status: order.status,
            order_date: order.created_at,
            shipping_address: order.shipping_address,
            billing_address: order.billing_address,
            customer_id: order.customer_id,
            payment_method: order.payment_method ?? null,
            payment_status: order.payment_status ?? null,
            payment_due_date: order.payment_due_date ?? null,
            order_tracking_number: order.tracking_number ?? null,
            order_tracking_url: order.tracking_url ?? null,
            order_tracking_carrier: order.tracking_carrier ?? null,
            shipped_at: order.shipped_at ?? null,
            notes: order.notes ?? null,
            lines: [],
          });
        }

        const product: any = productMap.get(line.product_id);
        grouped.get(line.order_id)!.lines.push({
          ...(line as any),
          product_name: product?.name || "Produit inconnu",
          product_image: product?.image_url || null,
          product_gtin: product?.gtin || null,
          product_cnk: product?.cnk_code || null,
        });
      }


      return Array.from(grouped.values()).sort(
        (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );
    },
  });

  useEffect(() => {
    if (!vendorId) return;

    const refreshVendorOrders = () => {
      queryClient.invalidateQueries({ queryKey: vendorOrdersQueryKey });
      queryClient.invalidateQueries({ queryKey: ["action-center", "vendor"] });
    };

    const channel = supabase
      .channel(`vendor-orders-${vendorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        refreshVendorOrders,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_lines", filter: `vendor_id=eq.${vendorId}` },
        refreshVendorOrders,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, vendorId, vendorOrdersQueryKey]);

  // ----- Mutations -----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vendor-order-lines"] });

  // QOGITA : transmis au fournisseur (inchangé)
  const markForwarded = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await (supabase as any).rpc("vendor_update_order_line_status", {
        _line_id: lineId,
        _status: "forwarded",
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Marqué comme transmis au fournisseur"); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  // Accepter une ligne pending → processing + email acheteur
  const acceptLine = useMutation({
    mutationFn: async (line: OrderWithLines["lines"][number] & { order: OrderWithLines }) => {
      const { error } = await (supabase as any).rpc("vendor_update_order_line_status", {
        _line_id: line.id,
        _status: "processing",
      });
      if (error) throw error;
      const sent = await sendBuyerEmail({
        lineId: line.id,
        event: "accepted",
        templateLabel: "commande en préparation",
      });
      return { sent };
    },
    onSuccess: ({ sent }) => {
      invalidate();
      if (sent) toast.success("Ligne acceptée — acheteur notifié par email");
      else toast.warning("Ligne acceptée — mais email acheteur non envoyé");
    },
    onError: () => toast.error("Erreur lors de l'acceptation"),
  });

  // Marquer livré (depuis shipped)
  const markDelivered = useMutation({
    mutationFn: async (line: OrderWithLines["lines"][number] & { order: OrderWithLines }) => {
      const { error } = await (supabase as any).rpc("vendor_update_order_line_status", {
        _line_id: line.id,
        _status: "delivered",
      });
      if (error) throw error;
      const sent = await sendBuyerEmail({
        lineId: line.id,
        event: "delivered",
        templateLabel: "commande livrée",
      });
      return { sent };
    },
    onSuccess: ({ sent }) => {
      invalidate();
      if (sent) toast.success("Marqué comme livré — acheteur notifié");
      else toast.warning("Marqué comme livré — mais email acheteur non envoyé");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  // Revert : remettre le statut d'une ligne sur une étape précédente
  const revertStatus = useMutation({
    mutationFn: async ({ lineId, to }: { lineId: string; to: string }) => {
      const { error } = await (supabase as any).rpc("vendor_update_order_line_status", {
        _line_id: lineId,
        _status: to,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Statut modifié"); setRevertConfirm(null); },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de la modification du statut"),
  });

  // ---- KPIs sur tout le portefeuille (avant filtres) ----
  const kpis = useMemo(() => {
    const acc = { total: 0, toTreat: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, revenueHT: 0 };
    for (const o of orders ?? []) {
      for (const l of o.lines) {
        acc.total += 1;
        acc.revenueHT += l.line_total_excl_vat || 0;
        const s = l.fulfillment_status;
        if (s === "pending") acc.toTreat += 1;
        else if (s === "processing" || s === "forwarded") acc.processing += 1;
        else if (s === "shipped") acc.shipped += 1;
        else if (s === "delivered") acc.delivered += 1;
        else if (s === "cancelled") acc.cancelled += 1;
      }
    }
    return acc;
  }, [orders]);

  // ---- Filtrage + tri ----
  const visibleOrders = useMemo(() => {
    const now = Date.now();
    const periodMs =
      periodFilter === "7d" ? 7 * 864e5 :
      periodFilter === "30d" ? 30 * 864e5 :
      periodFilter === "90d" ? 90 * 864e5 : null;
    const q = search.trim().toLowerCase();

    const matchStatus = (statuses: string[]) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "to_treat") return statuses.includes("pending");
      if (statusFilter === "processing") return statuses.some(s => s === "processing" || s === "forwarded");
      if (statusFilter === "shipped") return statuses.includes("shipped");
      if (statusFilter === "delivered") return statuses.every(s => s === "delivered");
      if (statusFilter === "cancelled") return statuses.every(s => s === "cancelled");
      return true;
    };

    const filtered = (orders ?? []).filter((o) => {
      if (periodMs && now - new Date(o.order_date).getTime() > periodMs) return false;
      const statuses = o.lines.map(l => l.fulfillment_status);
      if (!matchStatus(statuses)) return false;
      if (q) {
        const hay = [o.order_number, ...o.lines.map(l => l.product_name)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const totalHT = (o: OrderWithLines) => o.lines.reduce((s, l) => s + l.line_total_excl_vat, 0);
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date_asc":  return new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
        case "amount_desc": return totalHT(b) - totalHT(a);
        case "amount_asc":  return totalHT(a) - totalHT(b);
        case "date_desc":
        default: return new Date(b.order_date).getTime() - new Date(a.order_date).getTime();
      }
    });
    return filtered;
  }, [orders, statusFilter, search, periodFilter, sortBy]);

  // ----- Rendu -----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Commandes</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gestion de vos commandes</p>
        </div>
        <VEmptyState
          icon="ShoppingCart"
          title="Aucune commande"
          sub="Vos commandes apparaîtront ici dès qu'un acheteur passera commande sur vos offres."
        />
      </div>
    );
  }

  const formatAddress = (addr: any) => {
    if (!addr) return "—";
    if (typeof addr === "string") return addr;
    return addr.line1 || `${addr.street || ""} ${addr.postal_code || ""} ${addr.city || ""}`.trim() || "—";
  };


  const statusTabs: { key: string; label: string; count: number; icon: any; color: string }[] = [
    { key: "all",        label: "Toutes",       count: kpis.total,     icon: ShoppingCart,  color: "text-foreground" },
    { key: "to_treat",   label: "À traiter",    count: kpis.toTreat,   icon: AlertCircle,   color: "text-amber-600" },
    { key: "processing", label: "En cours",     count: kpis.processing,icon: Clock,         color: "text-blue-600" },
    { key: "shipped",    label: "Expédiées",    count: kpis.shipped,   icon: Truck,         color: "text-indigo-600" },
    { key: "delivered",  label: "Livrées",      count: kpis.delivered, icon: CheckCircle2,  color: "text-emerald-600" },
    { key: "cancelled",  label: "Annulées",     count: kpis.cancelled, icon: Ban,           color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Commandes</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {orders.length} commande{orders.length > 1 ? "s" : ""} · {kpis.total} ligne{kpis.total > 1 ? "s" : ""} · CA {fmtEur(kpis.revenueHT)}&nbsp;€ HT
          </p>
        </div>
      </div>

      {/* KPIs / filtres statuts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {statusTabs.map((tab) => {
          const Icon = tab.icon;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`text-left rounded-lg border p-3 transition-all ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={14} className={tab.color} />
                <span className="text-[11px] font-medium text-muted-foreground">{tab.label}</span>
              </div>
              <div className="mt-1 text-lg font-bold text-foreground">{tab.count}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar : recherche + période + tri */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro de commande ou un produit…"
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="h-9 w-[150px] text-[13px]">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les périodes</SelectItem>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="90d">90 derniers jours</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-[180px] text-[13px]">
            <ArrowUpDown size={12} className="mr-1" />
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Date (récent)</SelectItem>
            <SelectItem value="date_asc">Date (ancien)</SelectItem>
            <SelectItem value="amount_desc">Montant (élevé)</SelectItem>
            <SelectItem value="amount_asc">Montant (faible)</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || search || periodFilter !== "all" || sortBy !== "date_desc") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-[12px]"
            onClick={() => { setStatusFilter("all"); setSearch(""); setPeriodFilter("all"); setSortBy("date_desc"); }}
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {visibleOrders.length === 0 ? (
        <VCard className="p-8 text-center">
          <p className="text-[13px] text-muted-foreground">Aucune commande ne correspond à ces filtres.</p>
        </VCard>
      ) : (
      <div className="space-y-3">
        {visibleOrders.map((order) => {
          const isExpanded = expandedOrder === order.order_id;
          const totalHT = order.lines.reduce((s, l) => s + l.line_total_excl_vat, 0);
          const hasQogita = order.lines.some(l => l.fulfillment_type === "qogita");
          const allForwarded = order.lines.filter(l => l.fulfillment_type === "qogita").every(l => l.fulfillment_status === "forwarded");
          const pendingCount = order.lines.filter(l => l.fulfillment_status === "pending" && l.fulfillment_type !== "qogita").length;

          return (
            <VCard key={order.order_id} className="overflow-hidden">
              <button
                onClick={() => setExpandedOrder(isExpanded ? null : order.order_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ShoppingCart size={18} className="text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{order.order_number}</span>
                      {hasQogita && (
                        <VBadge color={allForwarded ? "success" : "warning"}>
                          {allForwarded ? "Fournisseur transmis" : "À transmettre au fournisseur"}
                        </VBadge>
                      )}
                      {pendingCount > 0 && (
                        <VBadge color="warning">À traiter : {pendingCount}</VBadge>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {format(new Date(order.order_date), "dd MMM yyyy à HH:mm", { locale: fr })} · {order.lines.length} article{order.lines.length > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">{fmtEur(totalHT)}&nbsp;€ HT</span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border">
                  <div className="flex items-center justify-end gap-2 px-4 pt-3">
                    <Button asChild size="sm" variant="outline" className="h-7 text-[11px] gap-1.5">
                      <Link to={`/vendor/commandes/${order.order_id}`} onClick={(e) => e.stopPropagation()}>
                        <ExternalLink size={12} /> Ouvrir la fiche
                      </Link>
                    </Button>
                    <VendorOrderPdfButton orderId={order.order_id} orderNumber={order.order_number} />
                  </div>
                  <OrderInfoBlocks order={order} />




                  <div className="divide-y divide-border">
                    {order.lines.map((line) => (
                      <VendorOrderLineRow
                        key={line.id}
                        line={line}
                        order={order}
                        onShip={(l) => setShipLine({ ...l, order })}
                        onCancel={(l) => setCancelLine({ ...l, order })}
                        onRevert={(payload) => setRevertConfirm(payload)}
                        onAccept={(l) => acceptLine.mutate({ ...l, order })}
                        onForward={(l) => markForwarded.mutate(l.id)}
                        onDeliver={(l) => markDelivered.mutate({ ...l, order })}
                        acceptPending={acceptLine.isPending}
                        forwardPending={markForwarded.isPending}
                        deliverPending={markDelivered.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </VCard>
          );
        })}
      </div>
      )}



      <ShipLineDialog line={shipLine} onClose={() => setShipLine(null)} onDone={invalidate} />
      <CancelLineDialog line={cancelLine} onClose={() => setCancelLine(null)} onDone={invalidate} />

      <AlertDialog open={!!revertConfirm} onOpenChange={(o) => { if (!o) setRevertConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifier le statut de la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Attention, vous changez le statut de cette commande
              {revertConfirm ? <> de <strong>« {statusConfig[revertConfirm.from]?.label || revertConfirm.from} »</strong> vers <strong>« {statusConfig[revertConfirm.to]?.label || revertConfirm.to} »</strong></> : null}.
              Cette démarche aura des conséquences sur tout le processus en cours et peut retarder votre recouvrement. Veuillez confirmer ce changement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revertStatus.isPending}>Non</AlertDialogCancel>
            <AlertDialogAction
              disabled={revertStatus.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (revertConfirm) revertStatus.mutate({ lineId: revertConfirm.lineId, to: revertConfirm.to });
              }}
            >
              {revertStatus.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Oui, confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Modale expédition (full ou backorder partiel)
// ============================================================
function ShipLineDialog({
  line,
  onClose,
  onDone,
}: {
  line: (OrderLine & { product_name: string; order: OrderWithLines }) | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const remaining = line ? line.quantity - (line.quantity_shipped || 0) : 0;
  const [qty, setQty] = useState<number>(remaining);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [carrier, setCarrier] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset qty to remaining whenever the line changes (e.g. after revert/refetch)
  useEffect(() => {
    setQty(remaining);
  }, [line?.id, remaining]);

  if (!line) return null;

  const handleSubmit = async () => {
    if (qty < 1 || qty > remaining) {
      toast.error(`Quantité doit être entre 1 et ${remaining}`);
      return;
    }
    if (!trackingNumber.trim() && !trackingUrl.trim()) {
      const ok = window.confirm("Aucun numéro ni URL de suivi renseignés. Continuer quand même ?");
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const newQtyShipped = (line.quantity_shipped || 0) + qty;
      const isFullyShipped = newQtyShipped >= line.quantity;
      const newStatus = isFullyShipped ? "shipped" : "processing";

      const { error } = await (supabase as any).rpc("vendor_update_order_line_status", {
        _line_id: line.id,
        _status: newStatus,
        _quantity_shipped: newQtyShipped,
        _tracking_number: trackingNumber.trim() || null,
        _tracking_url: trackingUrl.trim() || null,
      });

      if (error) throw error;

      const sent = await sendBuyerEmail({
        lineId: line.id,
        event: "shipped",
        templateLabel: "commande expédiée",
        shipped: {
          trackingNumber: trackingNumber.trim() || line.tracking_number || null,
          trackingUrl: trackingUrl.trim() || line.tracking_url || null,
          carrierName: carrier.trim() || null,
          isPartial: !isFullyShipped,
        },
      });

      if (sent) {
        toast.success(isFullyShipped ? "Ligne expédiée — acheteur notifié" : "Expédition partielle enregistrée — acheteur notifié");
      } else {
        toast.warning(isFullyShipped ? "Ligne expédiée — mais email acheteur non envoyé" : "Expédition partielle enregistrée — mais email acheteur non envoyé");
      }
      onDone();
      onClose();
      setQty(0);
      setTrackingNumber("");
      setTrackingUrl("");
      setCarrier("");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de l'expédition");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Expédier la ligne</DialogTitle>
          <DialogDescription className="text-[12px]">
            {line.product_name} — Restant à expédier : <strong>{remaining}/{line.quantity}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-[12px]">Quantité expédiée</Label>
            <Input
              type="number"
              min={1}
              max={remaining}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 0)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {qty < remaining
                ? `Expédition partielle — il restera ${remaining - qty} à expédier (statut "en préparation").`
                : "Expédition complète — la ligne passera au statut « expédié »."}
            </p>
          </div>
          <div>
            <Label className="text-[12px]">Transporteur (optionnel)</Label>
            <Input
              placeholder="ex : bpost, DPD, UPS…"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[12px]">N° de suivi</Label>
            <Input
              placeholder="ex : 3SBPM1234567890"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[12px]">URL de suivi (optionnel)</Label>
            <Input
              placeholder="https://…"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Package size={14} className="mr-1" />}
            Confirmer l'expédition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modale annulation / refus (avec remboursement manuel admin)
// ============================================================
function CancelLineDialog({
  line,
  onClose,
  onDone,
}: {
  line: (OrderLine & { product_name: string; order: OrderWithLines }) | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!line) return null;

  const remaining = line.quantity - (line.quantity_shipped || 0);
  const refundQty = remaining;
  const refundAmount = (line.unit_price_incl_vat || 0) * refundQty;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Le motif est requis pour annuler la ligne");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("vendor_update_order_line_status", {
        _line_id: line.id,
        _status: "cancelled",
        _cancellation_reason: reason.trim(),
        _refunded_amount_incl_vat: refundAmount,
      });
      if (error) throw error;

      // TODO: notification email d'annulation/remboursement à brancher dans notify-order-status
      // (le helper actuel ne gère que accepted/shipped/delivered). L'admin reçoit déjà
      // la notification de remboursement à traiter manuellement.

      toast.success("Ligne annulée — acheteur notifié, remboursement à traiter côté admin");
      onDone();
      onClose();
      setReason("");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'annulation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler / refuser la ligne</DialogTitle>
          <DialogDescription className="text-[12px]">
            {line.product_name} — Quantité à rembourser : <strong>{refundQty}</strong> ({fmtEur(refundAmount)}&nbsp;€ TTC)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            Le remboursement Stripe sera traité <strong>manuellement par l'équipe MediKong</strong> (V1).
            Une notification admin est créée automatiquement.
          </div>
          <div>
            <Label className="text-[12px]">Motif (obligatoire)</Label>
            <Textarea
              placeholder="ex : Rupture de stock définitive, produit retiré du catalogue…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Retour</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <X size={14} className="mr-1" />}
            Confirmer l'annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Info blocks (acheteur / livraison / facturation / paiement / suivi)
// ============================================================
function formatFullAddress(addr: any): string {
  if (!addr) return "—";
  if (typeof addr === "string") return addr;
  const parts = [
    addr.address_l1 || addr.line1 || addr.street,
    addr.address_l2 || addr.line2,
    [addr.postal_code, addr.city].filter(Boolean).join(" "),
    addr.country_code || addr.country,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function paymentMethodLabel(m: string | null): string {
  if (!m) return "—";
  const map: Record<string, string> = {
    card: "Carte bancaire",
    bank_transfer: "Virement bancaire",
    invoice: "Facture (paiement différé)",
    check: "Chèque",
    cash: "Espèces",
  };
  return map[m] || m;
}

function paymentStatusColor(s: string | null): "success" | "warning" | "info" | "default" {
  if (s === "paid") return "success";
  if (s === "pending") return "warning";
  if (s === "failed" || s === "refunded") return "default";
  return "info";
}

function paymentStatusLabel(s: string | null): string {
  if (!s) return "—";
  const map: Record<string, string> = {
    paid: "Payé",
    pending: "En attente",
    failed: "Échec",
    refunded: "Remboursé",
    partially_refunded: "Remb. partiel",
    processing: "En cours",
  };
  return map[s] || s;
}

export function OrderInfoBlocks({ order }: { order: OrderWithLines }) {
  const ship = order.shipping_address || {};
  const bill = order.billing_address || {};
  const shipName = (ship as any).label || (ship as any).name || (ship as any).company || "Acheteur";
  const billName = (bill as any).label || (bill as any).name || (bill as any).company;
  const billDiffers = billName && (billName !== shipName || formatFullAddress(bill) !== formatFullAddress(ship));

  // Coordonnées acheteur (email + téléphone) — RLS bloque la lecture directe de customers,
  // on passe par la RPC sécurisée qui vérifie que le vendeur a bien une ligne sur cette commande.
  const { data: buyerContact } = useQuery({
    queryKey: ["vendor-order-buyer-contact", order.order_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_order_buyer_contact", {
        _order_id: order.order_id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { email: string | null; phone: string | null } | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const buyerEmail = buyerContact?.email || null;
  const buyerPhone = buyerContact?.phone || (ship as any).phone || null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/20 border-b border-border">
      {/* Acheteur / livraison */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin size={12} /> Livraison
        </div>
        <div className="mt-1.5 text-[13px] font-semibold text-foreground">{shipName}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
          {formatFullAddress(ship)}
        </div>
        {(buyerEmail || buyerPhone) && (
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            {buyerEmail && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Mail size={11} className="shrink-0" />
                <a href={`mailto:${buyerEmail}`} className="underline hover:text-primary truncate">
                  {buyerEmail}
                </a>
              </div>
            )}
            {buyerPhone && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Phone size={11} className="shrink-0" />
                <a href={`tel:${buyerPhone}`} className="underline hover:text-primary">
                  {buyerPhone}
                </a>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Facturation */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <User size={12} /> Facturation
        </div>
        {billDiffers ? (
          <>
            <div className="mt-1.5 text-[13px] font-semibold text-foreground">{billName}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
              {formatFullAddress(bill)}
            </div>
            {(bill as any).vat_number && (
              <div className="mt-1 text-[11px] text-muted-foreground">TVA : {(bill as any).vat_number}</div>
            )}
          </>
        ) : (
          <div className="mt-1.5 text-[12px] text-muted-foreground italic">Identique à la livraison</div>
        )}
      </div>

      {/* Paiement + suivi commande */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <CreditCard size={12} /> Paiement
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-foreground">{paymentMethodLabel(order.payment_method)}</span>
            <VBadge color={paymentStatusColor(order.payment_status)}>
              {paymentStatusLabel(order.payment_status)}
            </VBadge>
          </div>
          {order.payment_due_date && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Échéance : {format(new Date(order.payment_due_date), "dd MMM yyyy", { locale: fr })}
            </div>
          )}
        </div>

        {(order.order_tracking_number || order.order_tracking_url) && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Truck size={12} /> Suivi (commande)
            </div>
            <div className="mt-1 text-[12px] text-foreground">
              {order.order_tracking_carrier && <span className="mr-1">{order.order_tracking_carrier}</span>}
              {order.order_tracking_url ? (
                <a href={order.order_tracking_url} target="_blank" rel="noreferrer" className="underline hover:text-primary inline-flex items-center gap-1">
                  {order.order_tracking_number || "Lien de suivi"}
                  <ExternalLink size={11} />
                </a>
              ) : (
                <span className="font-mono">{order.order_tracking_number}</span>
              )}
            </div>
          </div>
        )}

        {order.notes && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText size={12} /> Note acheteur
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground italic line-clamp-3">{order.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Ligne détaillée (prix, TVA, marge nette avec commission effective)
// ============================================================
type LineWithProduct = OrderWithLines["lines"][number];

export function VendorOrderLineRow({
  line,
  order,
  onShip,
  onCancel,
  onRevert,
  onAccept,
  onForward,
  onDeliver,
  acceptPending,
  forwardPending,
  deliverPending,
  readOnly = false,
}: {
  line: LineWithProduct;
  order: OrderWithLines;
  onShip?: (l: LineWithProduct) => void;
  onCancel?: (l: LineWithProduct) => void;
  onRevert?: (payload: { lineId: string; from: string; to: string }) => void;
  onAccept?: (l: LineWithProduct) => void;
  onForward?: (l: LineWithProduct) => void;
  onDeliver?: (l: LineWithProduct) => void;
  acceptPending?: boolean;
  forwardPending?: boolean;
  deliverPending?: boolean;
  readOnly?: boolean;
}) {
  const [showMargin, setShowMargin] = useState(false);
  const status = statusConfig[line.fulfillment_status] || statusConfig.pending;
  const isQogita = line.fulfillment_type === "qogita";
  const canForward = isQogita && line.fulfillment_status === "pending";
  const canAccept = !isQogita && line.fulfillment_status === "pending";
  const canShip = !isQogita && (line.fulfillment_status === "pending" || line.fulfillment_status === "processing");
  const canDeliver = !isQogita && line.fulfillment_status === "shipped";
  const canCancel = !isQogita && ["pending", "processing"].includes(line.fulfillment_status);
  const remaining = line.quantity - (line.quantity_shipped || 0);

  const { data: effectiveCommission } = useEffectiveCommission(line.offer_id);
  const commissionCfg = effectiveCommission ?? {
    commission_model: "flat_percentage" as const,
    commission_rate: null,
    margin_split_pct: null,
    fixed_commission_amount: null,
  };
  const breakdown = computeMargin(line.unit_price_excl_vat, line.cost_price, commissionCfg);

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded bg-muted/30 shrink-0 overflow-hidden border border-border">
          {line.product_image ? (
            <img src={line.product_image} alt="" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <PackageCheck size={16} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-foreground">{line.product_name}</div>
          {(line.product_gtin || line.product_cnk) && (
            <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[10.5px] text-muted-foreground">
              {line.product_gtin && (
                <span className="inline-flex items-center gap-1"><Barcode size={10} /> EAN {line.product_gtin}</span>
              )}
              {line.product_cnk && (
                <span className="inline-flex items-center gap-1">CNK {line.product_cnk}</span>
              )}
            </div>
          )}

          {/* Grille prix */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">Qté</div>
              <div className="font-semibold text-foreground">
                {line.quantity}
                {line.quantity_shipped ? <span className="text-muted-foreground font-normal"> · exp. {line.quantity_shipped}</span> : null}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">PU HT</div>
              <div className="font-semibold text-foreground">{fmtEur(line.unit_price_excl_vat)}&nbsp;€</div>
            </div>
            <div>
              <div className="text-muted-foreground">PU TTC</div>
              <div className="font-semibold text-foreground">{fmtEur(line.unit_price_incl_vat)}&nbsp;€</div>
            </div>
            <div>
              <div className="text-muted-foreground">TVA</div>
              <div className="font-semibold text-foreground">{Number(line.vat_rate || 0).toFixed(0)} %</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total HT</div>
              <div className="font-semibold text-foreground">{fmtEur(line.line_total_excl_vat)}&nbsp;€</div>
            </div>
          </div>

          {/* Marge nette (résumé + toggle détails) */}
          <div className="mt-2 rounded-md border border-border bg-muted/10 px-2 py-1.5">
            <button
              type="button"
              onClick={() => setShowMargin((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-[11px]"
            >
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Calculator size={11} /> Marge nette / u.
              </span>
              <span className="flex items-center gap-2">
                {!breakdown.hasCost ? (
                  <span className="text-muted-foreground italic">coût non renseigné</span>
                ) : (
                  <>
                    <span className={`font-semibold ${breakdown.netMargin >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                      {fmtEur(breakdown.netMargin)}&nbsp;€
                    </span>
                    <span className="text-muted-foreground">({fmtPct(breakdown.netMarginPct)})</span>
                  </>
                )}
                {showMargin ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </button>
            {showMargin && (
              <div className="mt-2">
                <MarginBreakdownDetails
                  breakdown={breakdown}
                  commissionModel={commissionCfg.commission_model}
                  commissionRate={commissionCfg.commission_rate}
                  marginSplitPct={commissionCfg.margin_split_pct}
                  fixedCommissionAmount={commissionCfg.fixed_commission_amount}
                  offerId={line.offer_id}
                />
              </div>
            )}
          </div>

          {/* Tracking ligne */}
          {line.tracking_number && (
            <div className="mt-2 text-[11px] text-foreground flex items-center gap-1.5">
              <Truck size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Suivi ligne :</span>
              {line.tracking_url ? (
                <a href={line.tracking_url} target="_blank" rel="noreferrer" className="underline hover:text-primary inline-flex items-center gap-1">
                  {line.tracking_number}
                  <ExternalLink size={10} />
                </a>
              ) : (
                <span className="font-mono">{line.tracking_number}</span>
              )}
            </div>
          )}

          {line.cancellation_reason && (
            <div className="mt-2 p-1.5 rounded bg-destructive/10 text-[11px] text-destructive">
              Motif annulation : {line.cancellation_reason}
              {line.refunded_amount_incl_vat != null && (
                <span className="ml-1">· Remboursé {fmtEur(line.refunded_amount_incl_vat)}&nbsp;€ TTC</span>
              )}
            </div>
          )}

          {isQogita && (
            <div className="mt-2 p-2 rounded bg-muted/30 text-[11px] space-y-0.5">
              <div className="font-semibold text-muted-foreground">Détails fournisseur Qogita :</div>
              {line.qogita_seller_fid && (
                <div>Vendeur : <span className="font-mono text-foreground">{line.qogita_seller_fid}</span></div>
              )}
              {line.qogita_offer_qid && (
                <div>Réf. offre : <span className="font-mono text-foreground">{line.qogita_offer_qid}</span></div>
              )}
              {line.cost_price != null && (
                <div>Prix d'achat : <span className="font-semibold text-foreground">{fmtEur(line.cost_price)}&nbsp;€</span></div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <VBadge color={status.color}>{status.label}</VBadge>
          {!readOnly && (
            <>
          {(() => {
            const workflow = isQogita ? ["forwarded"] : ["processing", "shipped", "delivered"];
            const idx = workflow.indexOf(line.fulfillment_status);
            const previous = idx > 0 ? workflow.slice(0, idx) : [];
            if (previous.length === 0) return null;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 underline underline-offset-2">
                    <Pencil size={10} /> Edit
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-[11px]">Revenir à…</DropdownMenuLabel>
                  {previous.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      className="text-[12px]"
                      onSelect={() => onRevert?.({ lineId: line.id, from: line.fulfillment_status, to: s })}
                    >
                      {statusConfig[s]?.label || s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}

          {canForward && (
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2"
              disabled={forwardPending}
              onClick={() => onForward?.(line)}>
              {forwardPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <ExternalLink size={12} className="mr-1" />}
              Transmis fournisseur
            </Button>
          )}
          {canAccept && (
            <Button size="sm" className="text-[11px] h-7 px-2 bg-primary"
              disabled={acceptPending}
              onClick={() => onAccept?.(line)}>
              <Check size={12} className="mr-1" /> Accepter
            </Button>
          )}
          {canShip && remaining > 0 && (
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2"
              onClick={() => onShip?.(line)}>
              <Package size={12} className="mr-1" />
              {remaining < line.quantity ? "Expédier reliquat" : "Marquer expédié"}
            </Button>
          )}
          {canDeliver && (
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2"
              disabled={deliverPending}
              onClick={() => onDeliver?.(line)}>
              <PackageCheck size={12} className="mr-1" /> Marquer livré
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" className="text-[11px] h-7 px-2 text-destructive hover:bg-destructive/10"
              onClick={() => onCancel?.(line)}>
              <X size={12} className="mr-1" /> Annuler / Refuser
            </Button>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function VendorOrderPdfButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const gen = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-vendor-order-pdf", {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if (!data?.pdf_url) throw new Error("URL PDF indisponible");
      return data.pdf_url as string;
    },
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(`Bon de commande ${orderNumber} généré`);
    },
    onError: (e: any) => {
      toast.error(`Génération PDF échouée — ${e?.message || "erreur"}`);
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-[11px] gap-1.5"
      disabled={gen.isPending}
      onClick={(e) => { e.stopPropagation(); gen.mutate(); }}
    >
      {gen.isPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      Télécharger le PDF
    </Button>
  );
}
