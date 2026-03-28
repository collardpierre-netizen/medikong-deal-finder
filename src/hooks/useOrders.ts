import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrderInput {
  shippingAddress: string;
  paymentMethod: string;
  subtotal: number;
  total: number;
}

export function useCreateOrder() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: OrderInput) => {
      if (!user) throw new Error("Non authentifié");
      // Find or create customer
      const { data: customer } = await supabase.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!customer) throw new Error("Profil client non trouvé");

      const { data: order, error } = await supabase.from("orders").insert({
        customer_id: customer.id,
        shipping_address: { line1: input.shippingAddress },
        billing_address: { line1: input.shippingAddress },
        payment_method: input.paymentMethod as any,
        subtotal_excl_vat: input.subtotal,
        vat_amount: input.total - input.subtotal,
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
