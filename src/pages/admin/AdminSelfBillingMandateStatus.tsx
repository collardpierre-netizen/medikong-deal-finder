// Écran admin : état du mandat de facturation par fournisseur et raison pour
// laquelle une facture « au nom et pour le compte de » a été émise ou bloquée.
// Lecture seule — aucune donnée n'est modifiée depuis cet écran.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatUpdatedAt } from "@/lib/format-date";
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";

const PAID_ORDERS_LIMIT = 300;

type VendorRow = {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  mandate_signed_at: string | null;
  self_billing_enabled: boolean | null;
};

type OrderRow = { id: string; order_number: string | null; payment_method: string | null; created_at: string };

type Outcome = "emitted" | "blocked_no_mandate" | "blocked_disabled" | "blocked_pending";

type CaseRow = {
  vendor_id: string;
  order_id: string;
  order_number: string | null;
  payment_method: string | null;
  created_at: string;
  outcome: Outcome;
  invoice_number: string | null;
  reason: string;
};

const OUTCOME_META: Record<Outcome, { label: string; reason: string; tone: string; icon: typeof CheckCircle2 }> = {
  emitted: {
    label: "Émise",
    reason: "Mandat signé et facturation activée : la facture a été émise au nom et pour le compte du fournisseur.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  blocked_no_mandate: {
    label: "Bloquée",
    reason: "Mandat de facturation non signé par le fournisseur : émission interdite en son nom.",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    icon: AlertTriangle,
  },
  blocked_disabled: {
    label: "Bloquée",
    reason: "Facturation au nom et pour le compte désactivée pour ce fournisseur.",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    icon: AlertTriangle,
  },
  blocked_pending: {
    label: "Non émise",
    reason: "Mandat signé et facturation activée, mais aucune facture n'existe encore pour cette commande.",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    icon: XCircle,
  },
};

export default function AdminSelfBillingMandateStatus() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-self-billing-mandate-status"],
    queryFn: async () => {
      const { data: orders, error: ordErr } = await supabase
        .from("orders")
        .select("id, order_number, payment_method, created_at")
        .eq("payment_status", "paid")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(PAID_ORDERS_LIMIT);
      if (ordErr) throw ordErr;
      const orderList = (orders || []) as OrderRow[];
      const orderIds = orderList.map((o) => o.id);

      const [linesRes, invoicesRes, vendorsRes] = await Promise.all([
        orderIds.length
          ? supabase.from("order_lines").select("order_id, vendor_id").in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length
          ? supabase
              .from("order_invoices")
              .select("order_id, vendor_id, invoice_number, issued_at, created_at")
              .eq("type", "self_billing")
              .in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("vendors")
          .select("id, name, company_name, email, mandate_signed_at, self_billing_enabled")
          .order("name", { ascending: true }),
      ]);
      if (linesRes.error) throw linesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (vendorsRes.error) throw vendorsRes.error;

      const vendors = (vendorsRes.data || []) as VendorRow[];
      const vendorMap = new Map(vendors.map((v) => [v.id, v]));
      const orderMap = new Map(orderList.map((o) => [o.id, o]));

      const invoiceByKey = new Map<string, any>();
      for (const inv of (invoicesRes.data || []) as any[]) {
        invoiceByKey.set(`${inv.order_id}:${inv.vendor_id}`, inv);
      }

      const pairs = new Set<string>();
      for (const line of (linesRes.data || []) as any[]) {
        if (line.vendor_id && orderMap.has(line.order_id)) pairs.add(`${line.order_id}:${line.vendor_id}`);
      }

      const cases: CaseRow[] = [];
      for (const key of pairs) {
        const [orderId, vendorId] = key.split(":");
        const order = orderMap.get(orderId)!;
        const vendor = vendorMap.get(vendorId);
        const invoice = invoiceByKey.get(key);
        let outcome: Outcome;
        if (invoice) outcome = "emitted";
        else if (vendor && vendor.self_billing_enabled === false) outcome = "blocked_disabled";
        else if (!vendor?.mandate_signed_at) outcome = "blocked_no_mandate";
        else outcome = "blocked_pending";
        cases.push({
          vendor_id: vendorId,
          order_id: orderId,
          order_number: order.order_number,
          payment_method: order.payment_method,
          created_at: order.created_at,
          outcome,
          invoice_number: invoice?.invoice_number ?? null,
          reason: OUTCOME_META[outcome].reason,
        });
      }
      cases.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      return { vendors, cases };
    },
  });

  const vendorRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cases = data?.cases || [];
    return (data?.vendors || [])
      .map((v) => {
        const own = cases.filter((c) => c.vendor_id === v.id);
        return {
          vendor: v,
          cases: own,
          emitted: own.filter((c) => c.outcome === "emitted").length,
          blocked: own.filter((c) => c.outcome !== "emitted").length,
        };
      })
      .filter((row) => {
        if (onlyIssues && row.blocked === 0) return false;
        if (!q) return true;
        const v = row.vendor;
        return `${v.company_name ?? ""} ${v.name ?? ""} ${v.email ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.blocked - a.blocked || b.emitted - a.emitted);
  }, [data, search, onlyIssues]);

  const totals = useMemo(() => {
    const cases = data?.cases || [];
    return {
      emitted: cases.filter((c) => c.outcome === "emitted").length,
      blocked: cases.filter((c) => c.outcome !== "emitted").length,
    };
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            État des mandats et émissions au nom du fournisseur
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Pour chaque fournisseur : état du mandat de facturation, activation du mode « au nom et pour le compte de »,
            et raison pour laquelle la facture de chaque commande payée a été émise ou bloquée. Écran de lecture seule —
            l'activation se règle sur l'écran Facturation mandat.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/facturation-mandat">
            Gérer l'activation
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Factures émises</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.emitted}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Émissions bloquées</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.blocked}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mandats manquants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {(data?.vendors || []).filter((v) => !v.mandate_signed_at).length}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Rechercher un fournisseur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Switch id="only-issues" checked={onlyIssues} onCheckedChange={setOnlyIssues} />
          <Label htmlFor="only-issues" className="text-sm">
            Fournisseurs avec au moins un blocage
          </Label>
        </div>
        <Button
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-self-billing-mandate-status"] })}
        >
          Rafraîchir
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          Lecture impossible : {(error as any)?.message}
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!isLoading &&
        vendorRows.map(({ vendor, cases, emitted, blocked }) => {
          const hasMandate = !!vendor.mandate_signed_at;
          const enabled = vendor.self_billing_enabled !== false;
          return (
            <Card key={vendor.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{vendor.company_name || vendor.name || vendor.id}</CardTitle>
                    {vendor.email && <p className="text-xs text-muted-foreground">{vendor.email}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        hasMandate
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }
                    >
                      {hasMandate
                        ? `Mandat signé le ${formatUpdatedAt(vendor.mandate_signed_at as string)}`
                        : "Mandat manquant"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        enabled
                          ? "border-slate-200 bg-slate-50 text-slate-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }
                    >
                      {enabled ? "Facturation activée" : "Facturation désactivée"}
                    </Badge>
                    <Badge variant="outline">{emitted} émise(s)</Badge>
                    {blocked > 0 && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        {blocked} bloquée(s)
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {cases.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">
                    Aucune commande payée sur les {PAID_ORDERS_LIMIT} dernières commandes encaissées.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Commande</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Facture</TableHead>
                        <TableHead>Raison</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cases.map((c) => {
                        const meta = OUTCOME_META[c.outcome];
                        const Icon = meta.icon;
                        return (
                          <TableRow key={`${c.order_id}:${c.vendor_id}`}>
                            <TableCell>
                              <Link
                                to={`/admin/commandes/${c.order_id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {c.order_number || c.order_id.slice(0, 8)}
                              </Link>
                              <div className="text-xs text-muted-foreground">{formatUpdatedAt(c.created_at)}</div>
                            </TableCell>
                            <TableCell className="text-sm">{c.payment_method || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={meta.tone}>
                                <Icon className="mr-1 h-3.5 w-3.5" />
                                {meta.label}
                              </Badge>
                              {c.invoice_number && (
                                <div className="mt-1 text-xs text-muted-foreground">{c.invoice_number}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.reason}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}

      {!isLoading && vendorRows.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun fournisseur ne correspond à ces filtres.</p>
      )}
    </div>
  );
}
