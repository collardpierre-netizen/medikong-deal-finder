/**
 * Human-readable Stripe payment status derived from
 * `orders.payment_method`, `orders.payment_status`, and `orders.stripe_payment_intent_id`.
 *
 * Only meaningful for card/Stripe payments. For other payment methods (invoice, bank transfer…)
 * this returns `null` — callers should hide the badge.
 */

export type StripePaymentState = "confirmed" | "pending" | "failed";

export interface StripePaymentStatus {
  state: StripePaymentState;
  label: string;
  tone: "success" | "warning" | "danger";
  hint: string;
}

interface OrderLike {
  payment_method?: string | null;
  payment_status?: string | null;
  stripe_payment_intent_id?: string | null;
}

export function resolveStripePaymentStatus(order: OrderLike | null | undefined): StripePaymentStatus | null {
  if (!order) return null;
  const method = (order.payment_method ?? "").toLowerCase();
  const isCard = method === "card" || method === "stripe";
  if (!isCard) return null;

  const status = (order.payment_status ?? "").toLowerCase();
  const hasPI = !!order.stripe_payment_intent_id;

  if (status === "paid" && hasPI) {
    return {
      state: "confirmed",
      label: "Confirmé",
      tone: "success",
      hint: "Paiement carte confirmé par Stripe.",
    };
  }
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return {
      state: "failed",
      label: "Échec",
      tone: "danger",
      hint: hasPI
        ? "Le PaymentIntent Stripe a échoué ou été annulé."
        : "Le paiement carte n'a pas abouti.",
    };
  }
  return {
    state: "pending",
    label: "Confirmation en attente",
    tone: "warning",
    hint: hasPI
      ? "PaymentIntent créé, confirmation Stripe non reçue."
      : "Aucun PaymentIntent Stripe rattaché à cette commande.",
  };
}
