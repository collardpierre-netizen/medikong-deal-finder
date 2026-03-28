import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrderInput {
  shippingAddress: string;
  shippingMethod?: string;
  shippingCost?: number;
  paymentMethod: string;
  subtotal: number;
  total: number;
  items?: {
    product_id: string;
    product_name: string;
    product_brand: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
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
        billing_address: { line1: input.shippingAddress } as any,
        payment_method: (input.paymentMethod === "Carte bancaire" ? "card" : input.paymentMethod === "Virement SEPA" ? "bank_transfer" : "invoice") as any,
        subtotal_excl_vat: input.subtotal,
        vat_amount: vatAmount > 0 ? vatAmount : 0,
        total_incl_vat: input.total,
      }).select().single();
      if (error) throw error;
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
      return { ...data, items: [] };
    },
  });
}
