import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminOrderRefund() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [refundAmounts, setRefundAmounts] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");

  const { data: order } = useQuery({
    queryKey: ["admin-order-refund", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total_incl_vat, payment_status, stripe_payment_intent_id")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["admin-order-lines-refund", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select("id, product_id, vendor_id, quantity, unit_price_incl_vat, line_total_incl_vat")
        .eq("order_id", orderId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors-refund"],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id, name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-refund", orderId],
    queryFn: async () => {
      const ids = lines.map(l => l.product_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("products").select("id, name").in("id", ids);
      return data || [];
    },
    enabled: lines.length > 0,
  });

  const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
  const productMap = new Map(products.map(p => [p.id, p.name]));

  // Group lines by vendor
  const grouped = lines.reduce((acc: Record<string, typeof lines>, line) => {
    (acc[line.vendor_id] = acc[line.vendor_id] || []).push(line);
    return acc;
  }, {});

  const refundMutation = useMutation({
    mutationFn: async ({ vendor_id, amount_cents }: { vendor_id: string; amount_cents: number }) => {
      const { data, error } = await supabase.functions.invoke("stripe-refund", {
        body: { order_id: orderId, vendor_id, amount_cents, reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Remboursement effectué");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  if (!order) return null;

  return (
    <div>
      <AdminTopBar title={`Remboursement — ${order.order_number}`} subtitle="Remboursement partiel par vendeur" />

      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#1B5BDA" }}>
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: "#E2E8F0" }}>
        <div className="flex gap-6 text-sm">
          <div><span style={{ color: "#8B95A5" }}>Total:</span> <strong>{Number(order.total_incl_vat).toFixed(2)} €</strong></div>
          <div><span style={{ color: "#8B95A5" }}>Statut paiement:</span> <Badge variant="outline" className="text-[10px]">{order.payment_status}</Badge></div>
          <div><span style={{ color: "#8B95A5" }}>Stripe PI:</span> <code className="text-[10px]">{order.stripe_payment_intent_id || "—"}</code></div>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "#8B95A5" }}>
          Motif du remboursement
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: "#E2E8F0" }}
          placeholder="Raison du remboursement..."
        />
      </div>

      {Object.entries(grouped).map(([vendorId, vendorLines]) => {
        const vendorTotal = vendorLines.reduce((s, l) => s + Number(l.line_total_incl_vat), 0);
        return (
          <div key={vendorId} className="bg-white rounded-xl border mb-4 overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC" }}>
              <span className="text-sm font-semibold" style={{ color: "#1D2530" }}>
                {vendorMap.get(vendorId) || vendorId}
              </span>
              <span className="text-sm font-bold" style={{ color: "#1B5BDA" }}>{vendorTotal.toFixed(2)} €</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Produit</TableHead>
                  <TableHead className="text-[11px]">Qté</TableHead>
                  <TableHead className="text-[11px]">Prix unit.</TableHead>
                  <TableHead className="text-[11px]">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorLines.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-[12px]">{productMap.get(l.product_id) || l.product_id}</TableCell>
                    <TableCell className="text-[12px]">{l.quantity}</TableCell>
                    <TableCell className="text-[12px]">{Number(l.unit_price_incl_vat).toFixed(2)} €</TableCell>
                    <TableCell className="text-[12px]">{Number(l.line_total_incl_vat).toFixed(2)} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-3 flex items-center gap-3 border-t" style={{ borderColor: "#E2E8F0" }}>
              <label className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Montant à rembourser (€):</label>
              <input
                type="number"
                min={0}
                max={vendorTotal}
                step={0.01}
                value={refundAmounts[vendorId] || ""}
                onChange={(e) => setRefundAmounts(prev => ({ ...prev, [vendorId]: parseFloat(e.target.value) }))}
                className="w-28 px-2 py-1 text-sm border rounded"
                style={{ borderColor: "#E2E8F0" }}
              />
              <button
                onClick={() => {
                  const amt = refundAmounts[vendorId];
                  if (!amt || amt <= 0) return toast.error("Montant invalide");
                  refundMutation.mutate({ vendor_id: vendorId, amount_cents: Math.round(amt * 100) });
                }}
                disabled={refundMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white flex items-center gap-1"
                style={{ backgroundColor: "#EF4343" }}
              >
                {refundMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                Rembourser
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
