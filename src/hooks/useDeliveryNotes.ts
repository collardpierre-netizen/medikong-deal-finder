import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryStatusRow = {
  order_line_id: string;
  vendor_id: string | null;
  product_name: string | null;
  cnk_code: string | null;
  gtin: string | null;
  quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  backorder_status: "open" | "cancelled" | "undeliverable" | null;
  backorder_note: string | null;
};

export type DeliveryNoteLine = {
  id: string;
  order_line_id: string;
  quantity: number;
};

export type DeliveryNote = {
  id: string;
  order_id: string;
  vendor_id: string | null;
  document_number: string | null;
  status: "issued" | "cancelled";
  carrier: string | null;
  tracking_number: string | null;
  note: string | null;
  issued_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  delivery_note_lines: DeliveryNoteLine[];
};

export const BACKORDER_LABELS: Record<string, string> = {
  open: "Reliquat ouvert",
  cancelled: "Reliquat annulé",
  undeliverable: "Non livrable",
};

export function useOrderDeliveryStatus(orderId?: string) {
  return useQuery({
    queryKey: ["order-delivery-status", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<DeliveryStatusRow[]> => {
      const { data, error } = await supabase.rpc("get_order_delivery_status" as any, { _order_id: orderId });
      if (error) throw error;
      return (data as unknown as DeliveryStatusRow[]) || [];
    },
  });
}

export function useOrderDeliveryNotes(orderId?: string) {
  return useQuery({
    queryKey: ["order-delivery-notes", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<DeliveryNote[]> => {
      const { data, error } = await supabase
        .from("delivery_notes" as any)
        .select("*, delivery_note_lines(id, order_line_id, quantity)")
        .eq("order_id", orderId!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as DeliveryNote[]) || [];
    },
  });
}

const ERRORS: Record<string, string> = {
  quantity_exceeds_remaining: "Quantité supérieure au reliquat disponible.",
  no_lines: "Sélectionnez au moins une ligne à livrer.",
  forbidden_line: "Cette ligne appartient à un autre fournisseur.",
  unauthorized: "Action non autorisée.",
  line_not_in_order: "Ligne introuvable dans cette commande.",
  order_not_found: "Commande introuvable.",
};
export const deliveryErrorMessage = (msg?: string): string => {
  if (!msg) return "Opération impossible";
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key] : msg;
};

function useInvalidate(orderId?: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["order-delivery-status", orderId] });
    qc.invalidateQueries({ queryKey: ["order-delivery-notes", orderId] });
  };
}

export function useCreateDeliveryNote(orderId?: string) {
  const invalidate = useInvalidate(orderId);
  return useMutation({
    mutationFn: async (input: {
      lines: { order_line_id: string; quantity: number }[];
      carrier?: string;
      tracking_number?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase.rpc("create_delivery_note" as any, {
        _order_id: orderId,
        _lines: input.lines as any,
        _carrier: input.carrier || null,
        _tracking_number: input.tracking_number || null,
        _note: input.note || null,
      });
      if (error) throw new Error(deliveryErrorMessage(error.message));
      return data as unknown as string;
    },
    onSuccess: invalidate,
  });
}

export function useCancelDeliveryNote(orderId?: string) {
  const invalidate = useInvalidate(orderId);
  return useMutation({
    mutationFn: async (input: { id: string; reason?: string }) => {
      const { error } = await supabase.rpc("cancel_delivery_note" as any, {
        _delivery_note_id: input.id,
        _reason: input.reason || null,
      });
      if (error) throw new Error(deliveryErrorMessage(error.message));
    },
    onSuccess: invalidate,
  });
}

export function useSetBackorderStatus(orderId?: string) {
  const invalidate = useInvalidate(orderId);
  return useMutation({
    mutationFn: async (input: { order_line_id: string; status: string | null; note?: string }) => {
      const { error } = await supabase.rpc("set_order_line_backorder_status" as any, {
        _order_line_id: input.order_line_id,
        _status: input.status,
        _note: input.note || null,
      });
      if (error) throw new Error(deliveryErrorMessage(error.message));
    },
    onSuccess: invalidate,
  });
}
