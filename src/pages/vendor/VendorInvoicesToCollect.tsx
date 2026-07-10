import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { formatPrice } from "@/data/mock";
import { useResyncOnReconnect } from "@/hooks/useResyncOnReconnect";

type Row = {
  id: string;
  order_id: string;
  payment_status: string;
  payment_due_date: string | null;
  subtotal_incl_vat: number;
  invoice_net_days: number | null;
  invoice_reminder_count: number;
  invoice_last_reminder_at: string | null;
  invoice_paid_at: string | null;
  created_at: string;
  orders: {
    order_number: string;
    customer_id: string;
    customers: { id: string; email: string; company_name: string; country_code: string } | null;
  } | null;
};

export default function VendorInvoicesToCollect() {
  const qc = useQueryClient();
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendor?.id;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-invoices-to-collect", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_orders")
        .select(`
          id, order_id, payment_status, payment_due_date, subtotal_incl_vat,
          invoice_net_days, invoice_reminder_count, invoice_last_reminder_at,
          invoice_paid_at, created_at,
          orders:order_id ( order_number, customer_id,
            customers:customer_id ( id, email, company_name, country_code )
          )
        `)
        .eq("vendor_id", vendorId!)
        .eq("payment_method", "invoice")
        .order("payment_due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    const invalidate = () => {
      if (cancelled) return;
      qc.invalidateQueries({ queryKey: ["vendor-invoices-to-collect", vendorId] });
    };
    const suffix = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const channel = supabase
      .channel(`vendor-invoices-${vendorId}-${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sub_orders", filter: `vendor_id=eq.${vendorId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_invoices", filter: `vendor_id=eq.${vendorId}` },
        invalidate,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") invalidate();
      });
    return () => {
      cancelled = true;
      void channel.unsubscribe().finally(() => {
        void supabase.removeChannel(channel);
      });
    };
  }, [vendorId, qc]);

  useResyncOnReconnect(
    [["vendor-invoices-to-collect", vendorId]],
    !!vendorId,
  );

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sub_orders")
        .update({ payment_status: "paid", invoice_paid_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marquée comme payée");
      qc.invalidateQueries({ queryKey: ["vendor-invoices-to-collect", vendorId] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.payment_status === "pending");
    const overdue = rows.filter((r) => r.payment_status === "overdue");
    const sum = (list: Row[]) => list.reduce((s, r) => s + Number(r.subtotal_incl_vat || 0), 0);
    return { pendingCount: pending.length, overdueCount: overdue.length, pendingAmt: sum(pending), overdueAmt: sum(overdue) };
  }, [rows]);

  if (isLoading) {
    return <div className="p-8 flex items-center gap-2 text-sm text-mk-sec"><Loader2 className="animate-spin" size={16} /> Chargement…</div>;
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mk-navy">Factures à encaisser</h1>
        <p className="text-sm text-mk-sec mt-1">Sous-commandes réglées par facture, en attente de paiement.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>En attente</CardDescription><CardTitle>{stats.pendingCount} · {formatPrice(stats.pendingAmt)} EUR</CardTitle></CardHeader>
        </Card>
        <Card className="border-destructive/40">
          <CardHeader className="pb-2"><CardDescription className="text-destructive">En retard</CardDescription><CardTitle className="text-destructive">{stats.overdueCount} · {formatPrice(stats.overdueAmt)} EUR</CardTitle></CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-sm text-mk-sec italic text-center">Aucune facture à encaisser.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-mk-alt text-mk-sec text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Commande</th>
                    <th className="px-3 py-2 text-left">Acheteur</th>
                    <th className="px-3 py-2 text-right">Montant TTC</th>
                    <th className="px-3 py-2 text-left">Échéance</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-left">Relances</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-mk-line">
                      <td className="px-3 py-2 font-mono text-xs text-mk-navy">{r.orders?.order_number}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-mk-navy">{r.orders?.customers?.company_name}</div>
                        <div className="text-[11px] text-mk-sec">{r.orders?.customers?.email}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatPrice(Number(r.subtotal_incl_vat))} EUR</td>
                      <td className="px-3 py-2">{r.payment_due_date ?? "—"}</td>
                      <td className="px-3 py-2">
                        {r.payment_status === "paid" && <Badge className="bg-mk-green text-white">Payée</Badge>}
                        {r.payment_status === "pending" && <Badge variant="secondary">En attente</Badge>}
                        {r.payment_status === "overdue" && <Badge variant="destructive"><AlertTriangle size={11} className="mr-1" />En retard</Badge>}
                      </td>
                      <td className="px-3 py-2 text-xs text-mk-sec">
                        <Mail size={11} className="inline mr-1" />{r.invoice_reminder_count}
                        {r.invoice_last_reminder_at && (
                          <div className="text-[10px]">{new Date(r.invoice_last_reminder_at).toLocaleDateString("fr-BE")}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.payment_status !== "paid" && (
                          <Button size="sm" variant="outline" onClick={() => markPaid.mutate(r.id)} disabled={markPaid.isPending}>
                            <CheckCircle2 size={13} className="mr-1" /> Marquer payée
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
