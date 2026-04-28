import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VEmptyState } from "@/components/vendor/ui/VEmptyState";
import { ShoppingCart, PackageCheck, Loader2, ChevronDown, ChevronUp, Truck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  offer_id: string;
  vendor_id: string;
  quantity: number;
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
}

interface OrderWithLines {
  order_id: string;
  order_number: string;
  order_status: string;
  order_date: string;
  shipping_address: any;
  lines: (OrderLine & { product_name: string; product_image: string | null })[];
}

const statusConfig: Record<string, { label: string; color: "info" | "success" | "warning" | "default" }> = {
  pending: { label: "En attente", color: "warning" },
  processing: { label: "En cours", color: "info" },
  forwarded: { label: "Transmis au fournisseur", color: "success" },
  shipped: { label: "Expédié", color: "info" },
  delivered: { label: "Livré", color: "success" },
  cancelled: { label: "Annulé", color: "default" },
};

export default function VendorOrders() {
  const vendorQuery = useCurrentVendor();
  const vendorId = vendorQuery.data?.id;
  const queryClient = useQueryClient();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["vendor-order-lines", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      // Fetch order_lines for this vendor
      const { data: lines, error } = await supabase
        .from("order_lines")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("order_id", { ascending: false });

      if (error) throw error;
      if (!lines || lines.length === 0) return [];

      // Get unique order IDs and product IDs
      const orderIds = [...new Set(lines.map(l => l.order_id))];
      const productIds = [...new Set(lines.map(l => l.product_id))];

      // Fetch orders and products in parallel
      const [ordersRes, productsRes] = await Promise.all([
        supabase.from("orders").select("id, order_number, status, created_at, shipping_address").in("id", orderIds),
        supabase.from("products").select("id, name, image_url").in("id", productIds),
      ]);

      const orderMap = new Map((ordersRes.data || []).map(o => [o.id, o]));
      const productMap = new Map((productsRes.data || []).map(p => [p.id, p]));

      // Group lines by order
      const grouped = new Map<string, OrderWithLines>();
      for (const line of lines) {
        const order = orderMap.get(line.order_id);
        if (!order) continue;

        if (!grouped.has(line.order_id)) {
          grouped.set(line.order_id, {
            order_id: line.order_id,
            order_number: order.order_number,
            order_status: order.status,
            order_date: order.created_at,
            shipping_address: order.shipping_address,
            lines: [],
          });
        }

        const product = productMap.get(line.product_id);
        grouped.get(line.order_id)!.lines.push({
          ...line,
          product_name: product?.name || "Produit inconnu",
          product_image: product?.image_url || null,
        });
      }

      return Array.from(grouped.values()).sort(
        (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );
    },
  });

  const markForwarded = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase
        .from("order_lines")
        .update({ fulfillment_status: "forwarded" as any, qogita_order_status: "forwarded" })
        .eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-order-lines"] });
      toast.success("Marqué comme transmis au fournisseur");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Commandes</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {orders.length} commande{orders.length > 1 ? "s" : ""} · {orders.reduce((s, o) => s + o.lines.length, 0)} ligne{orders.reduce((s, o) => s + o.lines.length, 0) > 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const isExpanded = expandedOrder === order.order_id;
          const totalHT = order.lines.reduce((s, l) => s + l.line_total_excl_vat, 0);
          const hasQogita = order.lines.some(l => l.fulfillment_type === "qogita");
          const allForwarded = order.lines.filter(l => l.fulfillment_type === "qogita").every(l => l.fulfillment_status === "forwarded");

          return (
            <VCard key={order.order_id} className="overflow-hidden">
              {/* Order header */}
              <button
                onClick={() => setExpandedOrder(isExpanded ? null : order.order_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ShoppingCart size={18} className="text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{order.order_number}</span>
                      {hasQogita && (
                        <VBadge color={allForwarded ? "success" : "warning"}>
                          {allForwarded ? "Fournisseur transmis" : "À transmettre au fournisseur"}
                        </VBadge>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {format(new Date(order.order_date), "dd MMM yyyy à HH:mm", { locale: fr })} · {order.lines.length} article{order.lines.length > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">€{totalHT.toFixed(2)} HT</span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Shipping address */}
                  <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Truck size={14} />
                    <span>Livraison : {formatAddress(order.shipping_address)}</span>
                  </div>

                  {/* Lines */}
                  <div className="divide-y divide-border">
                    {order.lines.map((line) => {
                      const status = statusConfig[line.fulfillment_status] || statusConfig.pending;
                      const isQogita = line.fulfillment_type === "qogita";
                      const canForward = isQogita && line.fulfillment_status === "pending";

                      return (
                        <div key={line.id} className="px-4 py-3 flex items-start gap-3">
                          {/* Product image */}
                          <div className="w-10 h-10 rounded bg-muted/30 shrink-0 overflow-hidden">
                            {line.product_image ? (
                              <img src={line.product_image} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <PackageCheck size={16} />
                              </div>
                            )}
                          </div>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-foreground truncate">{line.product_name}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Qté: {line.quantity} · €{line.unit_price_excl_vat.toFixed(2)} HT/u · Total: €{line.line_total_excl_vat.toFixed(2)} HT
                            </div>

                            {/* Centralized supplier details - visible only for centralized lines */}
                            {isQogita && (
                              <div className="mt-1.5 p-2 rounded bg-muted/30 text-[11px] space-y-0.5">
                                <div className="font-semibold text-muted-foreground">Détails fournisseur :</div>
                                {line.qogita_seller_fid && (
                                  <div>Vendeur : <span className="font-mono text-foreground">{line.qogita_seller_fid}</span></div>
                                )}
                                {line.qogita_offer_qid && (
                                  <div>Réf. offre : <span className="font-mono text-foreground">{line.qogita_offer_qid}</span></div>
                                )}
                                {line.cost_price != null && (
                                  <div>Prix d'achat : <span className="font-semibold text-foreground">€{line.cost_price.toFixed(2)}</span></div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Status + action */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <VBadge color={status.color}>{status.label}</VBadge>
                            {canForward && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2"
                                disabled={markForwarded.isPending}
                                onClick={() => markForwarded.mutate(line.id)}
                              >
                                {markForwarded.isPending ? (
                                  <Loader2 size={12} className="animate-spin mr-1" />
                                ) : (
                                  <ExternalLink size={12} className="mr-1" />
                                )}
                                Transmis au fournisseur
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </VCard>
          );
        })}
      </div>
    </div>
  );
}
