import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BALOOH_VENDOR_ID = "b3aa8188-7584-47eb-9b5f-fd50e33ec569";

export interface OrderItemInput {
  offer_id: string;
  product_id: string;
  quantity: number;
  unit_price_excl_vat: number;
  unit_price_incl_vat: number;
  vat_rate?: number;
}

export interface OrderInput {
  shippingAddress: string;
  billingAddress?: string;
  shippingMethod?: string;
  shippingCost?: number;
  paymentMethod: string;
  subtotal: number;
  total: number;
  items?: OrderItemInput[];
}

export function useCreateOrder() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: OrderInput) => {
      if (!user) throw new Error("Non authentifié");
      const { data: customer } = await supabase.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!customer) throw new Error("Profil client non trouvé");

      const vatAmount = input.total - input.subtotal;
      const orderNumber = `MK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      const { data: order, error } = await supabase.from("orders").insert({
        order_number: orderNumber,
        customer_id: customer.id,
        shipping_address: { line1: input.shippingAddress } as any,
        billing_address: { line1: input.billingAddress || input.shippingAddress } as any,
        payment_method: (input.paymentMethod === "Carte bancaire" ? "card" : input.paymentMethod === "Virement SEPA" ? "bank_transfer" : "invoice") as any,
        subtotal_excl_vat: input.subtotal,
        vat_amount: vatAmount > 0 ? vatAmount : 0,
        total_incl_vat: input.total,
      }).select().single();
      if (error) throw error;

      if (input.items && input.items.length > 0) {
        // Fetch offer details including vendor info
        const offerIds = input.items.map(i => i.offer_id).filter(Boolean);
        const { data: offers } = offerIds.length > 0
          ? await supabase.from("offers").select("id, vendor_id, qogita_offer_qid, qogita_seller_fid, qogita_base_price").in("id", offerIds)
          : { data: [] };

        const offerMap = new Map((offers || []).map(o => [o.id, o]));

        // Fetch vendor types for routing
        const vendorIds = [...new Set((offers || []).map(o => o.vendor_id))];
        const { data: vendors } = vendorIds.length > 0
          ? await supabase.from("vendors").select("id, type").in("id", vendorIds)
          : { data: [] };
        const vendorTypeMap = new Map((vendors || []).map(v => [v.id, v.type]));

        // Insert order_items (legacy)
        const orderItems = input.items.map(item => {
          const offerRef = offerMap.get(item.offer_id);
          return {
            order_id: order.id,
            offer_id: item.offer_id || null,
            product_id: item.product_id || null,
            quantity: item.quantity,
            unit_price_excl_vat: item.unit_price_excl_vat,
            unit_price_incl_vat: item.unit_price_incl_vat,
            vat_rate: item.vat_rate ?? 0.21,
            line_total_excl_vat: item.unit_price_excl_vat * item.quantity,
            line_total_incl_vat: item.unit_price_incl_vat * item.quantity,
            qogita_offer_qid: offerRef?.qogita_offer_qid || null,
            qogita_seller_fid: offerRef?.qogita_seller_fid || null,
            qogita_base_price: offerRef?.qogita_base_price || null,
          };
        });

        const { error: itemsError } = await supabase.from("order_items" as any).insert(orderItems as any);
        if (itemsError) console.error("Error inserting order_items:", itemsError);

        // Insert order_lines with vendor routing
        const orderLines = input.items.map(item => {
          const offerRef = offerMap.get(item.offer_id);
          const vendorId = offerRef?.vendor_id;
          const vendorType = vendorId ? vendorTypeMap.get(vendorId) : null;
          const isQogitaVirtual = vendorType === "qogita_virtual";

          return {
            order_id: order.id,
            offer_id: item.offer_id,
            product_id: item.product_id,
            vendor_id: isQogitaVirtual ? BALOOH_VENDOR_ID : vendorId,
            quantity: item.quantity,
            unit_price_excl_vat: item.unit_price_excl_vat,
            unit_price_incl_vat: item.unit_price_incl_vat,
            vat_rate: item.vat_rate ?? 21,
            line_total_excl_vat: item.unit_price_excl_vat * item.quantity,
            line_total_incl_vat: item.unit_price_incl_vat * item.quantity,
            fulfillment_type: isQogitaVirtual ? "qogita" : "vendor_direct",
            fulfillment_status: "pending",
            qogita_order_status: "pending",
            qogita_offer_qid: offerRef?.qogita_offer_qid || null,
            qogita_seller_fid: offerRef?.qogita_seller_fid || null,
            cost_price: offerRef?.qogita_base_price || null,
          } as any;
        });

        const { error: linesError } = await supabase.from("order_lines").insert(orderLines);
        if (linesError) console.error("Error inserting order_lines:", linesError);
      }

      return order;
    },
  });
}

export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useOrderDetail(orderId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["order", orderId],
    enabled: !!user && !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (error) throw error;
      const { data: orderItems } = await supabase.from("order_items" as any).select("*").eq("order_id", orderId);
      return { ...data, items: orderItems || [] };
    },
  });
}
