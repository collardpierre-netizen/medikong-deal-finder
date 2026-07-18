import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fmtEurFromCents } from "@/lib/format-currency";
import { formatUpdatedAt } from "@/lib/format-date";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend, ComposedChart, Line, AreaChart, Area } from "recharts";
import {
  DollarSign, FileClock, CheckCircle2, AlertTriangle, Coins,
  Download, RefreshCw, FileText, Check, Ban, XCircle,
} from "lucide-react";

/**
 * /admin/commissions-revenus
 * Dashboard commissions MediKong : Trading + Marketplace, ventes manuelles + online.
 * Cycle facturation complet : backlog → facture → payée / en litige / annulée.
 */

type InvoiceType = "marketplace" | "trading";
type SalesChannel = "manual" | "online" | "mixed";
type InvoiceStatus = "to_invoice" | "invoiced" | "paid" | "disputed" | "cancelled";

interface KpiTotals {
  to_invoice_cents: number;
  invoiced_cents: number;
  paid_cents: number;
  disputed_cents: number;
  trading_cents: number;
  marketplace_cents: number;
  manual_cents: number;
  online_cents: number;
}

interface VendorRow {
  vendor_id: string;
  vendor_display_name: string;
  vendor_country_code: string | null;
  orders_count: number;
  lines_count: number;
  gmv_incl_vat_cents: number;
  revenue_excl_vat_cents: number;
  commission_trading_cents: number;
  commission_marketplace_cents: number;
  commission_total_cents: number;
  to_invoice_cents: number;
  invoiced_cents: number;
  paid_cents: number;
  disputed_cents: number;
}

interface TimeseriesRow {
  bucket_start: string;
  bucket_label: string;
  trading_cents: number;
  marketplace_cents: number;
  total_cents: number;
  cumulative_cents: number;
  orders_count: number;
}

interface BacklogRow {
  order_line_id: string;
  order_id: string;
  order_number: string;
  order_created_at: string;
  order_status: string;
  vendor_id: string;
  vendor_display_name: string;
  sales_channel: SalesChannel;
  type: InvoiceType;
  commission_basis: string;
  commission_rate: number | null;
  gmv_incl_vat_cents: number;
  revenue_excl_vat_cents: number;
  commission_excl_vat_cents: number;
  period_month: string;
  age_days: number;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  vendor_id: string;
  order_id: string | null;
  type: InvoiceType;
  sales_channel: SalesChannel;
  status: InvoiceStatus;
  lines_count: number;
  gmv_incl_vat_cents: number;
  revenue_excl_vat_cents: number;
  commission_excl_vat_cents: number;
  vat_rate: number;
  vat_cents: number;
  total_incl_vat_cents: number;
  vendor_country_code: string | null;
  invoiced_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  dispute_reason: string | null;
  created_at: string;
  vendors?: { name: string | null; company_name: string | null } | null;
  orders?: { order_number: string | null } | null;
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  to_invoice: "À facturer",
  invoiced: "Facturée",
  paid: "Payée",
  disputed: "En litige",
  cancelled: "Annulée",
};
const STATUS_COLOR: Record<InvoiceStatus, string> = {
  to_invoice: "bg-orange-100 text-orange-800",
  invoiced: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  disputed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-700",
};

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function monthEnd(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function toISODate(d: Date) { return d.toISOString().slice(0, 10); }

export default function AdminCommissionsRevenus() {
  const qc = useQueryClient();
  const [periodStart, setPeriodStart] = useState(toISODate(monthStart()));
  const [periodEnd, setPeriodEnd] = useState(toISODate(monthEnd()));
  const [filterType, setFilterType] = useState<"all" | InvoiceType>("all");
  const [filterChannel, setFilterChannel] = useState<"all" | SalesChannel>("all");
  const [filterOrderStatus, setFilterOrderStatus] = useState<"all" | "validated" | "draft">("all");
  const [bucket, setBucket] = useState<"day" | "week" | "month" | "quarter">("month");
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  // Dialog states
  const [markInvoicedOpen, setMarkInvoicedOpen] = useState<InvoiceRow | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState<InvoiceRow | null>(null);
  const [disputeOpen, setDisputeOpen] = useState<InvoiceRow | null>(null);

  const typeArg = filterType === "all" ? null : filterType;
  const channelArg = filterChannel === "all" ? null : filterChannel;

  // ---------- KPIs ----------
  const kpisQ = useQuery({
    queryKey: ["commrev-kpis", periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_commission_dashboard_kpis", {
        _period_start: periodStart, _period_end: periodEnd,
      });
      if (error) throw error;
      return (data as any)?.totals as KpiTotals;
    },
  });

  // ---------- By vendor ----------
  const byVendorQ = useQuery({
    queryKey: ["commrev-by-vendor", periodStart, periodEnd, typeArg, channelArg],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_commission_by_vendor", {
        _period_start: periodStart, _period_end: periodEnd,
        _type: typeArg as any, _channel: channelArg as any,
      });
      if (error) throw error;
      return (data ?? []) as VendorRow[];
    },
  });

  // ---------- Timeseries (jour / semaine / mois / trimestre) ----------
  const seriesQ = useQuery({
    queryKey: ["commrev-timeseries", periodStart, periodEnd, bucket, typeArg, channelArg],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_commission_timeseries", {
        _from: periodStart, _to: periodEnd,
        _bucket: bucket,
        _type: typeArg as any, _channel: channelArg as any,
      });
      if (error) throw error;
      return (data ?? []) as TimeseriesRow[];
    },
  });

  // ---------- Backlog ----------
  const backlogQ = useQuery({
    queryKey: ["commrev-backlog", periodStart, periodEnd, typeArg, channelArg],
    queryFn: async () => {
      let q = supabase
        .from("admin_commission_backlog_v")
        .select("*")
        .gte("order_created_at", periodStart)
        .lte("order_created_at", periodEnd + "T23:59:59.999Z")
        .order("order_created_at", { ascending: false })
        .limit(500);
      if (typeArg) q = q.eq("type", typeArg);
      if (channelArg) q = q.eq("sales_channel", channelArg);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BacklogRow[];
    },
  });

  // ---------- Invoices ----------
  const invoicesQ = useQuery({
    queryKey: ["commrev-invoices", periodStart, periodEnd, typeArg, channelArg],
    queryFn: async () => {
      let q = supabase
        .from("commission_invoices")
        .select("*, vendors(name, company_name), orders(order_number)")
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd + "T23:59:59.999Z")
        .order("created_at", { ascending: false })
        .limit(500);
      if (typeArg) q = q.eq("type", typeArg);
      if (channelArg) q = q.eq("sales_channel", channelArg);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });

  // ---------- Mutations ----------
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["commrev-kpis"] });
    qc.invalidateQueries({ queryKey: ["commrev-by-vendor"] });
    qc.invalidateQueries({ queryKey: ["commrev-by-month"] });
    qc.invalidateQueries({ queryKey: ["commrev-backlog"] });
    qc.invalidateQueries({ queryKey: ["commrev-invoices"] });
  };

  const createInvoiceM = useMutation({
    mutationFn: async () => {
      const rows = (backlogQ.data ?? []).filter(r => selectedLines.has(r.order_line_id));
      if (rows.length === 0) throw new Error("Aucune ligne sélectionnée");
      // Grouper par (vendor_id, order_id, type)
      const groups = new Map<string, BacklogRow[]>();
      for (const r of rows) {
        const k = `${r.vendor_id}::${r.order_id}::${r.type}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r);
      }
      let count = 0;
      for (const [k, list] of groups) {
        const [vendorId, orderId, type] = k.split("::");
        const { error } = await supabase.rpc("admin_create_commission_invoice", {
          _vendor_id: vendorId, _order_id: orderId, _type: type as any,
          _order_line_ids: list.map(x => x.order_line_id),
        });
        if (error) throw error;
        count++;
      }
      return count;
    },
    onSuccess: (n) => {
      toast.success(`${n} facture(s) commission créée(s)`);
      setSelectedLines(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur création facture"),
  });

  const markInvoicedM = useMutation({
    mutationFn: async ({ id, dueDate }: { id: string; dueDate?: string }) => {
      const { error } = await supabase.rpc("admin_mark_commission_invoiced", {
        _invoice_id: id, _due_date: dueDate ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marquée comme facturée"); invalidate(); setMarkInvoicedOpen(null); },
    onError: (e: any) => toast.error(e?.message),
  });

  const markPaidM = useMutation({
    mutationFn: async ({ id, ref }: { id: string; ref?: string }) => {
      const { error } = await supabase.rpc("admin_mark_commission_paid", {
        _invoice_id: id, _payment_reference: ref ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marquée comme payée"); invalidate(); setMarkPaidOpen(null); },
    onError: (e: any) => toast.error(e?.message),
  });

  const disputeM = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("admin_mark_commission_disputed", {
        _invoice_id: id, _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marquée en litige"); invalidate(); setDisputeOpen(null); },
    onError: (e: any) => toast.error(e?.message),
  });

  const cancelM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_cancel_commission_invoice", {
        _invoice_id: id, _reason: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Facture annulée"); invalidate(); },
    onError: (e: any) => toast.error(e?.message),
  });

  const totals = kpisQ.data;

  const monthChart = useMemo(() => {
    return (byMonthQ.data ?? []).map(r => ({
      month: r.period_month,
      trading: r.trading_cents / 100,
      marketplace: r.marketplace_cents / 100,
    }));
  }, [byMonthQ.data]);

  const DRAFT_STATUSES = new Set(["draft", "brouillon", "pending", "en_attente"]);
  const filteredBacklog = useMemo(() => {
    const rows = backlogQ.data ?? [];
    if (filterOrderStatus === "all") return rows;
    const wantDraft = filterOrderStatus === "draft";
    return rows.filter(r => {
      const isDraft = DRAFT_STATUSES.has(String(r.order_status ?? "").toLowerCase());
      return wantDraft ? isDraft : !isDraft;
    });
  }, [backlogQ.data, filterOrderStatus]);

  const backlogSelectedAmount = useMemo(() => {
    return filteredBacklog
      .filter(r => selectedLines.has(r.order_line_id))
      .reduce((s, r) => s + r.commission_excl_vat_cents, 0);
  }, [filteredBacklog, selectedLines]);

  const exportVendorCsv = () => {
    const rows = byVendorQ.data ?? [];
    const header = ["Vendeur", "Pays", "Commandes", "Lignes", "GMV TTC", "CA HTVA", "Trading", "Marketplace", "Total commission", "À facturer", "Facturé", "Payé", "En litige"];
    const csv = [header.join(",")].concat(rows.map(r => [
      `"${(r.vendor_display_name ?? "").replace(/"/g, '""')}"`,
      r.vendor_country_code ?? "",
      r.orders_count, r.lines_count,
      (r.gmv_incl_vat_cents / 100).toFixed(2),
      (r.revenue_excl_vat_cents / 100).toFixed(2),
      (r.commission_trading_cents / 100).toFixed(2),
      (r.commission_marketplace_cents / 100).toFixed(2),
      (r.commission_total_cents / 100).toFixed(2),
      (r.to_invoice_cents / 100).toFixed(2),
      (r.invoiced_cents / 100).toFixed(2),
      (r.paid_cents / 100).toFixed(2),
      (r.disputed_cents / 100).toFixed(2),
    ].join(","))).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `commissions-vendeurs-${periodStart}-${periodEnd}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AdminTopBar title="Commissions & Revenus" subtitle="Trading · Marketplace · Manuel · Online — facturation & suivi" />

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Barre de filtres */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-[#616B7C]">Du</Label>
            <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs text-[#616B7C]">Au</Label>
            <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs text-[#616B7C]">Type</Label>
            <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="trading">Trading (100% marge)</SelectItem>
                <SelectItem value="marketplace">Marketplace (% CA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-[#616B7C]">Statut cmd (backlog)</Label>
            <Select value={filterOrderStatus} onValueChange={v => setFilterOrderStatus(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="validated">Validées uniquement</SelectItem>
                <SelectItem value="draft">Brouillons uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-[#616B7C]">Canal</Label>
            <Select value={filterChannel} onValueChange={v => setFilterChannel(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="online">En ligne</SelectItem>
                <SelectItem value="manual">Manuelle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => { setPeriodStart(toISODate(monthStart())); setPeriodEnd(toISODate(monthEnd())); }}>
              Mois courant
            </Button>
            <Button variant="outline" size="sm" onClick={() => invalidate()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Rafraîchir
            </Button>
            <Button variant="outline" size="sm" onClick={exportVendorCsv}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard icon={FileClock} label="À facturer" value={fmtEurFromCents(totals?.to_invoice_cents ?? 0)}
            iconColor="#EA580C" iconBg="#FFF7ED" />
          <KpiCard icon={FileText} label="Facturé" value={fmtEurFromCents(totals?.invoiced_cents ?? 0)}
            iconColor="#1B5BDA" iconBg="#EFF6FF" />
          <KpiCard icon={CheckCircle2} label="Payé" value={fmtEurFromCents(totals?.paid_cents ?? 0)}
            iconColor="#059669" iconBg="#ECFDF5" />
          <KpiCard icon={AlertTriangle} label="En litige" value={fmtEurFromCents(totals?.disputed_cents ?? 0)}
            iconColor="#DC2626" iconBg="#FEF2F2" />
          <KpiCard icon={DollarSign} label="Total commission période"
            value={fmtEurFromCents((totals?.trading_cents ?? 0) + (totals?.marketplace_cents ?? 0))}
            iconColor="#7C3AED" iconBg="#F5F3FF" />
        </div>

        {/* Split Trading / Marketplace / Manuel / Online */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Coins} label="Trading (100% marge)" value={fmtEurFromCents(totals?.trading_cents ?? 0)}
            iconColor="#7C3AED" iconBg="#F5F3FF" />
          <KpiCard icon={Coins} label="Marketplace (% CA)" value={fmtEurFromCents(totals?.marketplace_cents ?? 0)}
            iconColor="#F59E0B" iconBg="#FFFBEB" />
          <KpiCard icon={Coins} label="Ventes manuelles" value={fmtEurFromCents(totals?.manual_cents ?? 0)}
            iconColor="#0891B2" iconBg="#ECFEFF" />
          <KpiCard icon={Coins} label="Ventes en ligne" value={fmtEurFromCents(totals?.online_cents ?? 0)}
            iconColor="#1B5BDA" iconBg="#EFF6FF" />
        </div>

        {/* Chart mensuel */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5">
          <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Commissions par mois — 12 mois glissants</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ReTooltip formatter={(v: number) => `${v.toFixed(2)} EUR`} />
                <Legend />
                <Bar dataKey="trading" stackId="a" fill="#7C3AED" name="Trading" />
                <Bar dataKey="marketplace" stackId="a" fill="#F59E0B" name="Marketplace" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Onglets */}
        <Tabs defaultValue="backlog" className="w-full">
          <TabsList>
            <TabsTrigger value="backlog">
              Backlog ({filteredBacklog.length}{filterOrderStatus !== "all" && backlogQ.data ? ` / ${backlogQ.data.length}` : ""})
            </TabsTrigger>
            <TabsTrigger value="vendors">Par vendeur ({byVendorQ.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="invoices">Factures ({invoicesQ.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* --- BACKLOG --- */}
          <TabsContent value="backlog">
            <div className="bg-white border border-[#E2E8F0] rounded-[10px]">
              <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="text-sm text-[#616B7C]">
                  {selectedLines.size} ligne(s) sélectionnée(s) — {fmtEurFromCents(backlogSelectedAmount)}
                </div>
                <Button
                  size="sm"
                  disabled={selectedLines.size === 0 || createInvoiceM.isPending}
                  onClick={() => createInvoiceM.mutate()}
                >
                  {createInvoiceM.isPending ? "Création…" : `Créer facture(s) commission`}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC] text-xs uppercase text-[#616B7C]">
                    <tr>
                      <th className="p-2 w-8">
                        <Checkbox
                          checked={filteredBacklog.length > 0 && filteredBacklog.every(r => selectedLines.has(r.order_line_id))}
                          onCheckedChange={(v) => {
                            if (v) setSelectedLines(new Set(filteredBacklog.map(r => r.order_line_id)));
                            else setSelectedLines(new Set());
                          }}
                        />
                      </th>
                      <th className="p-2 text-left">Commande</th>
                      <th className="p-2 text-left">Statut</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Vendeur</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Canal</th>
                      <th className="p-2 text-right">GMV TTC</th>
                      <th className="p-2 text-right">Commission HT</th>
                      <th className="p-2 text-right">Âge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBacklog.map(r => (
                      <tr key={r.order_line_id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedLines.has(r.order_line_id)}
                            onCheckedChange={(v) => {
                              const s = new Set(selectedLines);
                              if (v) s.add(r.order_line_id); else s.delete(r.order_line_id);
                              setSelectedLines(s);
                            }}
                          />
                        </td>
                        <td className="p-2"><a href={`/admin/commandes/${r.order_number}`} className="text-[#1B5BDA] hover:underline">{r.order_number}</a></td>
                        <td className="p-2">
                          {DRAFT_STATUSES.has(String(r.order_status ?? "").toLowerCase())
                            ? <Badge className="bg-orange-100 text-orange-800">Brouillon</Badge>
                            : <Badge className="bg-green-100 text-green-800">Validée</Badge>}
                        </td>
                        <td className="p-2">{formatUpdatedAt(r.order_created_at)}</td>
                        <td className="p-2">{r.vendor_display_name}</td>
                        <td className="p-2">
                          <Badge className={r.type === "trading" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"}>
                            {r.type === "trading" ? "Trading" : "Marketplace"}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline">{r.sales_channel === "manual" ? "Manuelle" : "En ligne"}</Badge>
                        </td>
                        <td className="p-2 text-right tabular-nums">{fmtEurFromCents(r.gmv_incl_vat_cents)}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{fmtEurFromCents(r.commission_excl_vat_cents)}</td>
                        <td className="p-2 text-right text-xs text-[#616B7C]">{Math.round(r.age_days)}j</td>
                      </tr>
                    ))}
                    {filteredBacklog.length === 0 && (
                      <tr><td colSpan={10} className="p-8 text-center text-[#8B95A5]">Aucune ligne dans le backlog sur la période.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* --- VENDORS --- */}
          <TabsContent value="vendors">
            <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs uppercase text-[#616B7C]">
                  <tr>
                    <th className="p-2 text-left">Vendeur</th>
                    <th className="p-2 text-right">Cmd</th>
                    <th className="p-2 text-right">GMV TTC</th>
                    <th className="p-2 text-right">CA HTVA</th>
                    <th className="p-2 text-right">Trading</th>
                    <th className="p-2 text-right">Marketplace</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">À facturer</th>
                    <th className="p-2 text-right">Facturé</th>
                    <th className="p-2 text-right">Payé</th>
                    <th className="p-2 text-right">En litige</th>
                  </tr>
                </thead>
                <tbody>
                  {(byVendorQ.data ?? []).map(r => (
                    <tr key={r.vendor_id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="p-2 font-medium">
                        {r.vendor_display_name}
                        {r.vendor_country_code && <span className="ml-1 text-xs text-[#8B95A5]">({r.vendor_country_code})</span>}
                      </td>
                      <td className="p-2 text-right tabular-nums">{r.orders_count}</td>
                      <td className="p-2 text-right tabular-nums">{fmtEurFromCents(r.gmv_incl_vat_cents)}</td>
                      <td className="p-2 text-right tabular-nums">{fmtEurFromCents(r.revenue_excl_vat_cents)}</td>
                      <td className="p-2 text-right tabular-nums text-purple-700">{fmtEurFromCents(r.commission_trading_cents)}</td>
                      <td className="p-2 text-right tabular-nums text-amber-700">{fmtEurFromCents(r.commission_marketplace_cents)}</td>
                      <td className="p-2 text-right tabular-nums font-semibold">{fmtEurFromCents(r.commission_total_cents)}</td>
                      <td className="p-2 text-right tabular-nums text-orange-600">{fmtEurFromCents(r.to_invoice_cents)}</td>
                      <td className="p-2 text-right tabular-nums text-blue-700">{fmtEurFromCents(r.invoiced_cents)}</td>
                      <td className="p-2 text-right tabular-nums text-green-700">{fmtEurFromCents(r.paid_cents)}</td>
                      <td className="p-2 text-right tabular-nums text-red-700">{fmtEurFromCents(r.disputed_cents)}</td>
                    </tr>
                  ))}
                  {byVendorQ.data?.length === 0 && (
                    <tr><td colSpan={11} className="p-8 text-center text-[#8B95A5]">Aucune commission sur la période.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* --- INVOICES --- */}
          <TabsContent value="invoices">
            <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs uppercase text-[#616B7C]">
                  <tr>
                    <th className="p-2 text-left">N°</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Vendeur</th>
                    <th className="p-2 text-left">Commande</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Canal</th>
                    <th className="p-2 text-left">Statut</th>
                    <th className="p-2 text-right">HT</th>
                    <th className="p-2 text-right">TVA</th>
                    <th className="p-2 text-right">TTC</th>
                    <th className="p-2 text-left">Échéance</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoicesQ.data ?? []).map(inv => {
                    const vname = inv.vendors?.company_name || inv.vendors?.name || inv.vendor_id.slice(0, 8);
                    return (
                      <tr key={inv.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="p-2 font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                        <td className="p-2 text-xs">{formatUpdatedAt(inv.created_at)}</td>
                        <td className="p-2">{vname}</td>
                        <td className="p-2 text-xs">
                          {inv.orders?.order_number ? <a href={`/admin/commandes/${inv.orders.order_number}`} className="text-[#1B5BDA] hover:underline">{inv.orders.order_number}</a> : "—"}
                        </td>
                        <td className="p-2">
                          <Badge className={inv.type === "trading" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"}>
                            {inv.type === "trading" ? "Trading" : "Marketplace"}
                          </Badge>
                        </td>
                        <td className="p-2"><Badge variant="outline">{inv.sales_channel === "manual" ? "Manuelle" : "En ligne"}</Badge></td>
                        <td className="p-2"><Badge className={STATUS_COLOR[inv.status]}>{STATUS_LABEL[inv.status]}</Badge></td>
                        <td className="p-2 text-right tabular-nums">{fmtEurFromCents(inv.commission_excl_vat_cents)}</td>
                        <td className="p-2 text-right tabular-nums text-xs">{fmtEurFromCents(inv.vat_cents)} <span className="text-[#8B95A5]">({inv.vat_rate}%)</span></td>
                        <td className="p-2 text-right tabular-nums font-semibold">{fmtEurFromCents(inv.total_incl_vat_cents)}</td>
                        <td className="p-2 text-xs">{inv.due_date ?? "—"}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            {inv.status === "to_invoice" && (
                              <Button size="sm" variant="outline" onClick={() => setMarkInvoicedOpen(inv)} title="Marquer facturée">
                                <FileText className="w-3 h-3" />
                              </Button>
                            )}
                            {(inv.status === "invoiced" || inv.status === "disputed") && (
                              <Button size="sm" variant="outline" onClick={() => setMarkPaidOpen(inv)} title="Marquer payée">
                                <Check className="w-3 h-3" />
                              </Button>
                            )}
                            {inv.status !== "cancelled" && inv.status !== "paid" && (
                              <Button size="sm" variant="outline" onClick={() => setDisputeOpen(inv)} title="En litige">
                                <AlertTriangle className="w-3 h-3" />
                              </Button>
                            )}
                            {inv.status !== "cancelled" && inv.status !== "paid" && (
                              <Button size="sm" variant="outline" onClick={() => { if (confirm("Annuler cette facture ?")) cancelM.mutate(inv.id); }} title="Annuler">
                                <XCircle className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {invoicesQ.data?.length === 0 && (
                    <tr><td colSpan={12} className="p-8 text-center text-[#8B95A5]">Aucune facture commission sur la période.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: mark invoiced */}
      <Dialog open={!!markInvoicedOpen} onOpenChange={(o) => !o && setMarkInvoicedOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer comme facturée</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#616B7C]">
              Facture <span className="font-mono">{markInvoicedOpen?.invoice_number}</span> — {fmtEurFromCents(markInvoicedOpen?.total_incl_vat_cents ?? 0)} TTC
            </p>
            <div>
              <Label className="text-xs">Date d'échéance (défaut : J+30)</Label>
              <Input type="date" id="due-date-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkInvoicedOpen(null)}>Annuler</Button>
            <Button onClick={() => {
              const el = document.getElementById("due-date-input") as HTMLInputElement;
              markInvoicedM.mutate({ id: markInvoicedOpen!.id, dueDate: el?.value || undefined });
            }}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: mark paid */}
      <Dialog open={!!markPaidOpen} onOpenChange={(o) => !o && setMarkPaidOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer comme payée</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#616B7C]">
              Facture <span className="font-mono">{markPaidOpen?.invoice_number}</span> — {fmtEurFromCents(markPaidOpen?.total_incl_vat_cents ?? 0)} TTC
            </p>
            <div>
              <Label className="text-xs">Référence paiement (optionnel)</Label>
              <Input id="pay-ref-input" placeholder="Ex : VIR-2026-0817" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidOpen(null)}>Annuler</Button>
            <Button onClick={() => {
              const el = document.getElementById("pay-ref-input") as HTMLInputElement;
              markPaidM.mutate({ id: markPaidOpen!.id, ref: el?.value || undefined });
            }}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: dispute */}
      <Dialog open={!!disputeOpen} onOpenChange={(o) => !o && setDisputeOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passer en litige</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#616B7C]">
              Facture <span className="font-mono">{disputeOpen?.invoice_number}</span>
            </p>
            <div>
              <Label className="text-xs">Motif du litige</Label>
              <Textarea id="dispute-reason-input" placeholder="Ex : commande contestée par le vendeur…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => {
              const el = document.getElementById("dispute-reason-input") as HTMLTextAreaElement;
              if (!el?.value) return toast.error("Motif requis");
              disputeM.mutate({ id: disputeOpen!.id, reason: el.value });
            }}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
