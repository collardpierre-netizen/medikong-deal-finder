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
      // Vue acheteur : expose uniquement les colonnes non sensibles (pas de coût/marge/commission vendeur)
      const { data: orderLines } = await supabase
        .from("buyer_order_lines_v" as any)
        .select("*")
        .eq("order_id", orderId);
      const lines = ((orderLines as any[]) || []);
      const productIds = Array.from(new Set(lines.map((l) => l.product_id).filter(Boolean)));
      const vendorIds = Array.from(new Set(lines.map((l) => l.vendor_id).filter(Boolean)));
      const [{ data: prods }, { data: vends }] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id, name, gtin, cnk_code, sku").in("id", productIds)
          : Promise.resolve({ data: [] as any[] } as any),
        vendorIds.length
          ? supabase.from("vendors_public" as any).select("id, name, slug, display_code").in("id", vendorIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const prodMap = new Map(((prods as any[]) || []).map((p) => [p.id, p]));
      const vendMap = new Map(((vends as any[]) || []).map((v) => [v.id, v]));
      const items = lines.map((l: any) => ({
        ...l,
        product_name: prodMap.get(l.product_id)?.name,
        product_gtin: prodMap.get(l.product_id)?.gtin,
        product_cnk: prodMap.get(l.product_id)?.cnk_code,
        product_sku: prodMap.get(l.product_id)?.sku,
        vendor_name: vendMap.get(l.vendor_id)?.name,
        vendor_slug: vendMap.get(l.vendor_id)?.slug,
        vendor_display_code: vendMap.get(l.vendor_id)?.display_code,
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
