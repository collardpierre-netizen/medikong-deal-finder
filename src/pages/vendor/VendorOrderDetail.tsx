import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { Button } from "@/components/ui/button";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { fmtEur } from "@/lib/format-currency";

import {
  OrderInfoBlocks,
  VendorOrderLineRow,
  VendorOrderPdfButton,
  type OrderWithLines,
} from "./VendorOrders";

const statusLabel: Record<string, { label: string; color: "info" | "success" | "warning" | "default" }> = {
  pending: { label: "Nouvelle", color: "warning" },
  processing: { label: "En préparation", color: "info" },
  shipped: { label: "Expédiée", color: "info" },
  delivered: { label: "Livrée", color: "success" },
  cancelled: { label: "Annulée", color: "default" },
};

export default function VendorOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const vendorQuery = useCurrentVendor();
  const vendorId = vendorQuery.data?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-order-detail", vendorId, id],
    enabled: !!vendorId && !!id,
    queryFn: async (): Promise<OrderWithLines | null> => {
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, created_at, shipping_address, billing_address, customer_id, hidden_from_list, deleted_at, payment_method, payment_status, payment_due_date, tracking_number, tracking_url, tracking_carrier, shipped_at, notes",
        )
        .eq("id", id!)
        .maybeSingle();
      if (oErr) throw oErr;
      if (!order) return null;

      const { data: lines, error: lErr } = await supabase
        .from("order_lines")
        .select("*")
        .eq("order_id", id!)
        .eq("vendor_id", vendorId!);
      if (lErr) throw lErr;
      if (!lines || lines.length === 0) return null;

      const productIds = [...new Set(lines.map((l: any) => l.product_id).filter(Boolean))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, image_url, gtin, cnk_code")
        .in("id", productIds);
      const productMap = new Map((products || []).map((p: any) => [p.id, p]));

      return {
        order_id: order.id,
        order_number: order.order_number,
        order_status: order.status,
        order_date: order.created_at,
        shipping_address: order.shipping_address,
        billing_address: order.billing_address,
        customer_id: order.customer_id,
        payment_method: (order as any).payment_method ?? null,
        payment_status: (order as any).payment_status ?? null,
        payment_due_date: (order as any).payment_due_date ?? null,
        order_tracking_number: (order as any).tracking_number ?? null,
        order_tracking_url: (order as any).tracking_url ?? null,
        order_tracking_carrier: (order as any).tracking_carrier ?? null,
        shipped_at: (order as any).shipped_at ?? null,
        notes: (order as any).notes ?? null,
        lines: lines.map((l: any) => {
          const p: any = productMap.get(l.product_id);
          return {
            ...l,
            product_name: p?.name ?? "Article",
            product_image: p?.image_url ?? null,
            product_gtin: p?.gtin ?? null,
            product_cnk: p?.cnk_code ?? null,
          };
        }),
      };
    },
  });

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5">
      <Link to="/vendor/orders">
        <ArrowLeft size={14} />
        Retour à la liste
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {backLink}
        <VCard className="p-10 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </VCard>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        {backLink}
        <VCard className="p-8 text-center text-sm text-muted-foreground">
          Cette commande n'existe pas ou ne contient aucune ligne rattachée à votre compte.
        </VCard>
      </div>
    );
  }

  const order = data;
  const totalHT = order.lines.reduce((a, l) => a + (Number(l.line_total_excl_vat) || 0), 0);
  const status = statusLabel[order.order_status] || statusLabel.pending;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {backLink}
        <VendorOrderPdfButton orderId={order.order_id} orderNumber={order.order_number} />
      </div>

      <VCard className="overflow-hidden">
        <div className="p-4 flex items-center justify-between gap-3 flex-wrap border-b border-border bg-muted/10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-foreground">Commande {order.order_number}</h1>
              <VBadge color={status.color}>{status.label}</VBadge>
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {format(new Date(order.order_date), "dd MMM yyyy à HH:mm", { locale: fr })} · {order.lines.length}{" "}
              article{order.lines.length > 1 ? "s" : ""}
            </div>
          </div>
          <div className="text-sm font-bold text-foreground">{fmtEur(totalHT)}&nbsp;€ HT</div>
        </div>

        <OrderInfoBlocks order={order} />

        <div className="divide-y divide-border">
          {order.lines.map((line) => (
            <VendorOrderLineRow key={line.id} line={line} order={order} readOnly />
          ))}
        </div>

        <div className="p-4 border-t border-border bg-muted/10 text-[11px] text-muted-foreground">
          Pour accepter, expédier, livrer ou annuler une ligne, retournez à la{" "}
          <Link to="/vendor/orders" className="underline hover:text-primary">
            liste des commandes
          </Link>
          .
        </div>
      </VCard>
    </div>
  );
}
