import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks data-quality issues from the client side and reports them to the
 * `offer_data_quality_logs` table via the `log_offer_data_issue` RPC.
 *
 * Reports are deduped per session (in-memory Set) to avoid spamming the RPC
 * when the same product is re-rendered or scrolled through.
 */
const reportedKeys = new Set<string>();

export type OfferDataIssue =
  | "missing_moq"
  | "missing_price"
  | "missing_stock";

export function reportOfferDataIssue(params: {
  productId?: string | null;
  offerId?: string | null;
  issue: OfferDataIssue;
  details?: Record<string, unknown>;
}): void {
  const { productId, offerId, issue, details } = params;
  if (!issue) return;
  if (!productId && !offerId) return;

  const key = `${issue}:${productId || ""}:${offerId || ""}`;
  if (reportedKeys.has(key)) return;
  reportedKeys.add(key);

  // Fire-and-forget. Failure must never break the UI.
  void supabase
    .rpc("log_offer_data_issue", {
      _product_id: productId ?? null,
      _offer_id: offerId ?? null,
      _issue_code: issue,
      _details: (details ?? {}) as never,
    })
    .then(({ error }) => {
      if (error) {
        // Console only — silent for end users.
        // eslint-disable-next-line no-console
        console.warn("[data-quality] log RPC failed", { issue, productId, offerId, error });
      }
    });
}
