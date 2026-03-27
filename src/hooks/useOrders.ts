import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrderInput {
  shippingAddress: string;
  shippingMethod: string;
  shippingCost: number;
  paymentMethod: string;
  subtotal: number;
  total: number;
  items: {
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

      // Generate order number
      const { data: orderNum } = await supabase.rpc("generate_order_number");
      const orderNumber = orderNum || `MK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;

      // Insert order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          shipping_address: input.shippingAddress,
          shipping_method: input.shippingMethod,
          shipping_cost: input.shippingCost,
          payment_method: input.paymentMethod,
          subtotal: input.subtotal,
          total: input.total,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Order items are now tracked differently - skip for now
      // In future, create an order_items table or embed items in orders

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
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
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
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (error) throw error;

      return { ...order, items: [] };
    },
  });
}
