import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";


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
  customerInfo?: {
    company: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export function useCreateOrder() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: OrderInput) => {
      if (!user) throw new Error("Non authentifié");
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: {
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress,
          paymentMethod: input.paymentMethod,
          customerInfo: input.customerInfo,
          items: (input.items || []).map((i) => ({
            offer_id: i.offer_id,
            product_id: i.product_id,
            quantity: i.quantity,
          })),
        },
      });
      if (error) {
        // Edge function returned a non-2xx — surface the server payload if present
        const ctx: any = (error as any).context;
        let serverMsg: string | undefined;
        try {
          const body = await ctx?.json?.();
          if (body?.error === "no_vendor_eligible_for_invoice") {
            serverMsg =
              "Paiement sur facture non disponible pour cette commande (aucun fournisseur éligible). Merci de choisir « Carte bancaire ».";
          } else {
            serverMsg = body?.error || (body?.validation ? "Panier invalide" : undefined);
          }
        } catch (_) {
          // ignore
        }
        throw new Error(serverMsg || error.message || "Création de commande impossible");
      }
      if (!data?.id) throw new Error(data?.error || "Création de commande impossible");
      return data as { id: string; order_number: string };
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
      const { data: orderLines } = await supabase
        .from("order_lines")
        .select("*, products:product_id(name, gtin, cnk_code, sku), vendors:vendor_id(name, slug, display_code)")
        .eq("order_id", orderId);
      const items = (orderLines || []).map((l: any) => ({
        ...l,
        product_name: l.products?.name,
        product_gtin: l.products?.gtin,
        product_cnk: l.products?.cnk_code,
        product_sku: l.products?.sku,
        vendor_name: l.vendors?.name,
        vendor_slug: l.vendors?.slug,
        vendor_display_code: l.vendors?.display_code,
      }));
      // Fallback legacy order_items if no order_lines
      if (items.length === 0) {
        const { data: legacy } = await supabase.from("order_items" as any).select("*").eq("order_id", orderId);
        return { ...data, items: legacy || [] };
      }
      return { ...data, items };
    },
  });
}
