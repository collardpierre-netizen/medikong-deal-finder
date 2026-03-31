import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const WEBHOOK_SECRET_CONNECT = Deno.env.get("STRIPE_WEBHOOK_SECRET_CONNECT")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;

  // Try platform webhook secret first, then connect
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch {
    try {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET_CONNECT);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }
  }

  console.log(`Webhook event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "transfer.created":
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case "transfer.reversed":
        await handleTransferReversed(event.data.object as Stripe.Transfer);
        break;

      case "payout.failed":
        await handlePayoutFailed(event.data.object as any);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling ${event.type}:`, error);
    // Return 200 to prevent Stripe from retrying
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.order_id;
  if (!orderId) {
    console.log("No order_id in PI metadata, skipping");
    return;
  }

  const breakdownStr = pi.metadata?.vendor_breakdown;
  if (!breakdownStr) {
    console.log("No vendor_breakdown in PI metadata");
    // Just update order status
    await supabase.from("orders").update({
      status: "confirmed",
      payment_status: "paid",
    }).eq("id", orderId);
    return;
  }

  const breakdown = JSON.parse(breakdownStr) as Array<{
    vendor_id: string;
    stripe_account_id: string | null;
    subtotal: number;
    commission_rate: number;
    commission_amount: number;
    transfer_amount: number;
  }>;

  // Get the latest charge for source_transaction
  const latestCharge = pi.latest_charge as string;

  for (const vb of breakdown) {
    // Idempotency: check if transfer already exists
    const { data: existing } = await supabase
      .from("order_transfers")
      .select("id")
      .eq("order_id", orderId)
      .eq("vendor_id", vb.vendor_id)
      .maybeSingle();

    if (existing) {
      console.log(`Transfer already exists for order ${orderId} vendor ${vb.vendor_id}`);
      continue;
    }

    // Re-verify commission from DB
    const { data: vendor } = await supabase
      .from("vendors")
      .select("stripe_account_id, commission_rate")
      .eq("id", vb.vendor_id)
      .single();

    const stripeAccountId = vendor?.stripe_account_id || vb.stripe_account_id;
    const commRate = Number(vendor?.commission_rate ?? vb.commission_rate);
    const commissionAmount = Math.round(vb.subtotal * commRate);
    const transferAmount = vb.subtotal - commissionAmount;

    let stripeTransferId: string | null = null;

    if (stripeAccountId && transferAmount > 0) {
      try {
        const transfer = await stripe.transfers.create({
          amount: transferAmount,
          currency: "eur",
          destination: stripeAccountId,
          source_transaction: latestCharge,
          metadata: {
            order_id: orderId,
            vendor_id: vb.vendor_id,
            commission_rate: commRate.toString(),
            commission_amount: commissionAmount.toString(),
          },
        });
        stripeTransferId = transfer.id;
      } catch (err) {
        console.error(`Transfer failed for vendor ${vb.vendor_id}:`, err);
      }
    }

    // Record transfer
    await supabase.from("order_transfers").insert({
      order_id: orderId,
      vendor_id: vb.vendor_id,
      stripe_transfer_id: stripeTransferId,
      amount: transferAmount,
      commission_amount: commissionAmount,
      commission_rate: commRate,
      status: stripeTransferId ? "completed" : "pending",
    });
  }

  // Update order status
  await supabase.from("orders").update({
    status: "confirmed",
    payment_status: "paid",
  }).eq("id", orderId);
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.order_id;
  if (!orderId) return;

  await supabase.from("orders").update({
    payment_status: "failed",
    admin_notes: `Paiement échoué: ${pi.last_payment_error?.message || "erreur inconnue"}`,
  }).eq("id", orderId);

  // Audit log
  await supabase.from("audit_logs").insert({
    action: "payment_failed",
    module: "stripe",
    detail: `PaymentIntent ${pi.id} échoué pour commande ${orderId}: ${pi.last_payment_error?.message}`,
  });
}

async function handleAccountUpdated(account: Stripe.Account) {
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const onboardingComplete = chargesEnabled && payoutsEnabled;

  await supabase
    .from("vendors")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_onboarding_complete: onboardingComplete,
    })
    .eq("stripe_account_id", account.id);

  console.log(`Account ${account.id} updated: charges=${chargesEnabled}, payouts=${payoutsEnabled}`);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;

  // Find order by PI id
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();

  if (!order) return;

  const isFullRefund = charge.amount_refunded >= charge.amount;

  await supabase.from("orders").update({
    payment_status: isFullRefund ? "refunded" : "refunded",
    status: isFullRefund ? "cancelled" : "confirmed",
  }).eq("id", order.id);

  await supabase.from("audit_logs").insert({
    action: "charge_refunded",
    module: "stripe",
    detail: `Charge ${charge.id} remboursée (${charge.amount_refunded / 100}€) pour commande ${order.id}`,
  });
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const orderId = transfer.metadata?.order_id;
  const vendorId = transfer.metadata?.vendor_id;
  if (!orderId || !vendorId) return;

  await supabase
    .from("order_transfers")
    .update({ status: "completed", stripe_transfer_id: transfer.id })
    .eq("order_id", orderId)
    .eq("vendor_id", vendorId);
}

async function handleTransferReversed(transfer: Stripe.Transfer) {
  if (!transfer.id) return;

  await supabase
    .from("order_transfers")
    .update({ status: "reversed" })
    .eq("stripe_transfer_id", transfer.id);

  await supabase.from("audit_logs").insert({
    action: "transfer_reversed",
    module: "stripe",
    detail: `Transfer ${transfer.id} inversé`,
  });
}

async function handlePayoutFailed(payout: any) {
  await supabase.from("audit_logs").insert({
    action: "payout_failed",
    module: "stripe",
    detail: `Payout ${payout.id} échoué: ${payout.failure_message || "raison inconnue"} pour compte ${payout.destination || "inconnu"}`,
  });
}
