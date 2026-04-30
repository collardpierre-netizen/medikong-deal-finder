import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface DispatchSummary {
  rfq_id: string;
  vendors_targeted: number;
  new_dispatches: number;
  duplicates_skipped: number;
}

export interface RfqDispatchRow {
  id: string;
  rfq_id: string;
  vendor_id: string;
  status:
    | "dispatched"
    | "viewed"
    | "reminded"
    | "responded"
    | "declined"
    | "expired";
  reason:
    | "product_offer"
    | "brand_interest"
    | "manufacturer_interest"
    | "product_interest"
    | "manual";
  dispatched_at: string;
  email_opened_at: string | null;
  email_clicked_at: string | null;
  viewed_at: string | null;
  reminded_at: string | null;
  responded_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
}

/** Buyer/admin: trigger the routing engine for an existing RFQ. */
export function useDispatchRfq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rfq_id: string): Promise<DispatchSummary> => {
      const { data, error } = await supabase.functions.invoke("dispatch-rfq", {
        body: { rfq_id },
      });
      if (error) throw error;
      return data as DispatchSummary;
    },
    onSuccess: (_, rfq_id) => {
      qc.invalidateQueries({ queryKey: ["rfq-dispatch-log", rfq_id] });
      qc.invalidateQueries({ queryKey: ["rfq", rfq_id] });
      qc.invalidateQueries({ queryKey: ["my-rfqs"] });
    },
  });
}

/** Buyer/admin/vendor read-side: track dispatch & responses for a RFQ. RLS handles visibility. */
export function useRfqDispatchLog(rfq_id: string | null | undefined) {
  return useQuery({
    queryKey: ["rfq-dispatch-log", rfq_id],
    enabled: !!rfq_id,
    queryFn: async (): Promise<RfqDispatchRow[]> => {
      const { data, error } = await supabase
        .from("rfq_dispatch_log")
        .select(
          "id, rfq_id, vendor_id, status, reason, dispatched_at, email_opened_at, email_clicked_at, viewed_at, reminded_at, responded_at, declined_at, expired_at"
        )
        .eq("rfq_id", rfq_id!)
        .order("dispatched_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RfqDispatchRow[];
    },
    staleTime: 15_000,
  });
}

/** Aggregated funnel counters for a RFQ (derived client-side from dispatch rows). */
export function useRfqDispatchSummary(rfq_id: string | null | undefined) {
  const { data, ...rest } = useRfqDispatchLog(rfq_id);
  const rows = data ?? [];
  const summary = {
    targeted: rows.length,
    opened: rows.filter((r) => !!r.email_opened_at).length,
    clicked: rows.filter((r) => !!r.email_clicked_at).length,
    viewed: rows.filter((r) => !!r.viewed_at).length,
    reminded: rows.filter((r) => r.status === "reminded" || !!r.reminded_at).length,
    responded: rows.filter((r) => r.status === "responded").length,
    declined: rows.filter((r) => r.status === "declined").length,
    expired: rows.filter((r) => r.status === "expired").length,
  };
  return { ...rest, data: rows, summary };
}
