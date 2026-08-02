import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeVatBase, cagnotteVatModeLabel, loadCagnotteVatSettings } from "../_shared/cagnotte-vat.ts";

// Lazy-initialized singletons so tests can inject stubs before any handler runs.
let stripe: any = null;
let supabase: any = null;

function ensureDeps() {
  if (!stripe) {
    stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_dummy", { apiVersion: "2024-06-20" });
  }
  if (!supabase) {
    supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "http://localhost",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "service-role-dummy",
    );
  }
}

/** Test-only: replace internal stripe / supabase singletons with stubs. */
export function __setTestDeps(deps: { supabase?: any; stripe?: any }) {
  if (deps.supabase !== undefined) supabase = deps.supabase;
  if (deps.stripe !== undefined) stripe = deps.stripe;
}

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const WEBHOOK_SECRET_CONNECT = Deno.env.get("STRIPE_WEBHOOK_SECRET_CONNECT") ?? "";


Deno.serve(async (req) => {
  ensureDeps();
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
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET_CONNECT);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }
  }

  console.log("[stripe-webhook] Event received:", event.type);
  console.log(`Webhook event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Route SEPA/self-billing invoice sessions to the invoice handler
        if (session.metadata?.invoice_id) {
          await handleInvoiceCheckoutSucceeded(session);
        } else {
          await handleCheckoutSessionCompleted(session);
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.invoice_id) {
          await handleInvoiceCheckoutFailed(session);
        }
        break;
      }

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

async function emitOrderInvoices(orderId: string, paidAtIso: string): Promise<Array<{ label: string; url: string }>> {
  const links: Array<{ label: string; url: string }> = [];
  try {
    // Distinct vendors that have lines on this order
    const { data: vendorRows, error } = await supabase
      .from("order_lines")
      .select("vendor_id")
      .eq("order_id", orderId);
    if (error || !vendorRows) {
      console.error("[stripe-webhook] emitOrderInvoices: vendors fetch failed", error);
      return links;
    }
    const vendorIds = Array.from(new Set(vendorRows.map((r: any) => r.vendor_id).filter(Boolean)));

    for (const vendorId of vendorIds) {
      // Self-billing (buyer-facing)
      try {
        const { data: sb, error: sbErr } = await supabase.functions.invoke("emit-self-billing-invoice", {
          body: { order_id: orderId, vendor_id: vendorId, paid_at: paidAtIso },
        });
        if (sbErr) {
          console.error(`[stripe-webhook] self-billing failed vendor=${vendorId}`, sbErr);
        } else if (sb?.invoice_id) {
          const { data: signed } = await supabase.storage
            .from("invoices")
            .createSignedUrl(`${orderId}/self_billing-${vendorId}.pdf`, 60 * 60 * 24 * 7, { download: `${sb.invoice_number}.pdf` });
          if (signed?.signedUrl) {
            links.push({ label: `Facture ${sb.invoice_number}`, url: signed.signedUrl });
          }
        }
      } catch (e) {
        console.error(`[stripe-webhook] self-billing exception vendor=${vendorId}`, e);
      }
      // Commission (MediKong → vendor, NOT sent to buyer)
      try {
        const { error: comErr } = await supabase.functions.invoke("emit-commission-invoice", {
          body: { order_id: orderId, vendor_id: vendorId, paid_at: paidAtIso },
        });
        if (comErr) console.error(`[stripe-webhook] commission failed vendor=${vendorId}`, comErr);
      } catch (e) {
        console.error(`[stripe-webhook] commission exception vendor=${vendorId}`, e);
      }
    }
  } catch (e) {
    console.error("[stripe-webhook] emitOrderInvoices fatal", e);
  }
  return links;
}

async function sendBuyerOrderConfirmation(orderId: string) {
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, total_incl_vat, subtotal_excl_vat, vat_amount, cagnotte_used, payment_method, shipping_address, customer:customers!orders_customer_id_fkey(email, company_name)")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order) {
      console.error("[stripe-webhook] order-confirmation: order fetch failed", error);
      return;
    }
    const customer: any = order.customer;
    const recipientEmail = customer?.email;
    if (!recipientEmail) {
      console.warn(`[stripe-webhook] order-confirmation: no email for order ${orderId}`);
      return;
    }
    const { count: itemCount } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);

    const formatEUR = (n: number) =>
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
    const addr = order.shipping_address as any;
    const shippingAddress = addr && typeof addr === "object"
      ? [addr.line1 || addr.address_line1, addr.line2 || addr.address_line2, [addr.postal_code, addr.city].filter(Boolean).join(" "), addr.country || addr.country_code]
          .filter(Boolean).join(", ")
      : undefined;
    const paymentMethodLabel: Record<string, string> = {
      card: "Carte bancaire",
      sepa: "Virement SEPA",
      invoice: "Facture",
    };
    const customerName = customer?.company_name;

    // Generate invoices (self-billing + commission) and get download links for the buyer email
    const invoiceLinks = await emitOrderInvoices(orderId, new Date().toISOString());

    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "order-confirmation",
        recipientEmail,
        idempotencyKey: `order-confirmation-${orderId}`,
        templateData: {
          orderNumber: order.order_number,
          customerName,
          total: formatEUR(Number(order.total_incl_vat || 0)),
          itemCount: itemCount ?? 0,
          shippingAddress,
          paymentMethod: paymentMethodLabel[order.payment_method] || order.payment_method,
          invoiceLinks,
        },
      },
    });
    console.log(`[stripe-webhook] order-confirmation sent for ${orderId} (${invoiceLinks.length} invoice links)`);
  } catch (e) {
    console.error("[stripe-webhook] order-confirmation failed", e);
  }
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  ensureDeps();

  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.log("checkout.session.completed: no order_id in metadata, skipping");
    return;
  }
  const update: Record<string, unknown> = {
    status: "confirmed",
    payment_status: "paid",
    stripe_session_id: session.id,
    is_test: session.livemode === false,
  };
  if (typeof session.payment_intent === "string") {
    update.stripe_payment_intent_id = session.payment_intent;
  }
  const { error } = await supabase.from("orders").update(update).eq("id", orderId);
  if (error) {
    console.error("checkout.session.completed: order update failed", error);
  } else {
    console.log(`checkout.session.completed: order ${orderId} confirmed`);
    // Fan-out vendeurs : sub_orders + notif cloche + email "nouvelle commande"
    try {
      await supabase.functions.invoke("notify-vendors-new-order", { body: { orderId } });
    } catch (e) {
      console.error("[stripe-webhook] notify-vendors-new-order failed", e);
    }
    await sendBuyerOrderConfirmation(orderId);
  }

  // Parse vendor_breakdown
  const vendorBreakdown = JSON.parse(session.metadata?.vendor_breakdown || "[]");
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!paymentIntentId) {
    console.log("[stripe-webhook] No payment_intent on session, skipping transfers");
    return;
  }

  // Récupérer le charge ID depuis le payment_intent
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId = pi.latest_charge as string;

  for (const vb of vendorBreakdown) {
    // 1. Vérifier si un transfer existe déjà pour cette commande+vendor
    const { data: existing } = await supabase
      .from("order_transfers")
      .select("id, status, stripe_transfer_id")
      .eq("order_id", session.metadata.order_id)
      .eq("vendor_id", vb.vendor_id)
      .maybeSingle();

    if (existing && (
      existing.status === "completed" ||
      existing.stripe_transfer_id !== null
    )) {
      console.log(`[stripe-webhook] Transfer déjà géré pour vendor ${vb.vendor_id} (status=${existing.status}, tr_id=${existing.stripe_transfer_id}), skip retry`);
      continue;
    }

    // 2. Si existe en pending/failed, on retry, sinon on crée la ligne
    let transferRowId: string;
    if (existing) {
      transferRowId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("order_transfers")
        .insert({
          order_id: session.metadata.order_id,
          vendor_id: vb.vendor_id,
          amount: vb.transfer_amount,
          commission_amount: vb.commission_amount,
          commission_rate: vb.commission_rate,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertErr) {
        // Race: une autre instance vient de créer la ligne entre notre
        // SELECT et notre INSERT (grâce à la contrainte unique on évite
        // le doublon). On re-fetch et on skip.
        console.warn(`[stripe-webhook] Insert race, refetch:`, insertErr.code);
        const { data: refetched } = await supabase
          .from("order_transfers")
          .select("id, status")
          .eq("order_id", session.metadata.order_id)
          .eq("vendor_id", vb.vendor_id)
          .single();
        if (refetched?.status === "completed") continue;
        transferRowId = refetched!.id;
      } else {
        transferRowId = inserted.id;
      }
    }

    // 3. Appeler Stripe avec un idempotency_key déterministe
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: vb.transfer_amount,
          currency: "eur",
          destination: vb.stripe_account_id,
          transfer_group: `order_${session.metadata.order_id}`,
          source_transaction: chargeId,
          metadata: {
            order_id: session.metadata.order_id,
            order_number: session.metadata.order_number,
            vendor_id: vb.vendor_id,
          },
        },
        {
          idempotencyKey: `transfer_${session.metadata.order_id}_${vb.vendor_id}`,
        },
      );

      await supabase
        .from("order_transfers")
        .update({
          stripe_transfer_id: transfer.id,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transferRowId);

      console.log(`[stripe-webhook] Transfer ${transfer.id} OK pour vendor ${vb.vendor_id}`);
    } catch (err: any) {
      console.error(`[stripe-webhook] Transfer FAILED pour vendor ${vb.vendor_id}:`, err);

      // Re-fetch l'état actuel pour éviter écrasement destructif d'un
      // transfer déjà completed par une invocation parallèle
      const { data: current } = await supabase
        .from("order_transfers")
        .select("status, stripe_transfer_id")
        .eq("id", transferRowId)
        .single();

      if (current?.status === "completed" || current?.stripe_transfer_id) {
        console.warn(`[stripe-webhook] Erreur Stripe sur retry mais transfer déjà completed (tr_id=${current.stripe_transfer_id}). IGNORE l'erreur pour préserver l'état.`);
        continue;
      }

      await supabase
        .from("order_transfers")
        .update({
          status: "failed",
          error_message: err.message || String(err),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transferRowId);
    }
  }

  // 5. Génération factures vendor (post-transfers, non-bloquant)
  try {
    const { data: invoiceResult, error: invoiceErr } = await supabase.functions.invoke(
      "generate-vendor-invoices",
      { body: { order_id: session.metadata?.order_id, session_id: session.id } },
    );
    if (invoiceErr) {
      console.error(`[stripe-webhook] generate-vendor-invoices error:`, invoiceErr);
    } else {
      console.log(`[stripe-webhook] Generated ${invoiceResult?.total_invoices ?? 0} invoices for order ${session.metadata?.order_number}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] Invoice generation failed silently:`, err);
  }

  // 6. Décrémenter le stock des offers pour chaque order_line (atomic, non-bloquant)
  try {
    const { data: orderLines, error: linesErr } = await supabase
      .from("order_lines")
      .select("offer_id, quantity, product_id, vendor_id")
      .eq("order_id", session.metadata?.order_id);

    if (linesErr) {
      console.error(`[stripe-webhook] Stock: could not load order_lines:`, linesErr);
    } else {
      for (const line of orderLines || []) {
        if (!line.offer_id || !line.quantity) continue;
        const { data: stockResult, error: stockErr } = await supabase.rpc(
          "decrement_offer_stock",
          { p_offer_id: line.offer_id, p_quantity: line.quantity },
        );
        if (stockErr) {
          console.error(`[stripe-webhook] Stock decrement error for offer ${line.offer_id}:`, stockErr);
        } else if ((stockResult as any)?.success === false) {
          // Stock insuffisant détecté APRÈS le paiement (race condition).
          // → log et continue, le vendor pourra refund via refund-order-line.
          console.warn(`[stripe-webhook] Stock insufficient for offer ${line.offer_id}:`, stockResult);
        } else {
          console.log(`[stripe-webhook] Stock decremented for offer ${line.offer_id}: new=${(stockResult as any)?.new_stock}`);
        }
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] Stock decrement block failed silently:`, err);
  }
}

/**
 * Flux B — SEPA Bank Transfer (customer_balance), UN SEUL PI pour le total panier.
 * Le PI n'a pas de transfer_data.destination. Après réception du virement, on
 * reconstruit les splits par vendeur depuis order_lines + vendors, puis on crée
 * N Transfers séparés (un par vendeur éligible Stripe Connect). La commission
 * MediKong = ce qui reste sur la plateforme (total_ttc - Σ net_cents transférés).
 * Idempotence via order_transfers (contrainte unique order_id+vendor_id) et
 * idempotency_key Stripe `bt_transfer_<order_id>_<vendor_id>`.
 */
async function handleBankTransferSucceeded(pi: Stripe.PaymentIntent) {
  ensureDeps();
  const orderId = pi.metadata?.order_id as string;
  if (!orderId) {
    console.warn(`[bank_transfer] PI ${pi.id} sans order_id, skip`);
    return;
  }

  const defaultCommission = parseFloat(Deno.env.get("DEFAULT_COMMISSION_RATE") || "0.20");
  const latestCharge = (pi.latest_charge as string | null) ?? null;

  // Reconstruit les splits depuis la DB (source de vérité, évite la limite
  // 500 chars des metadata Stripe pour paniers multi-vendeurs).
  const { data: lines, error: linesErr } = await supabase
    .from("order_lines")
    .select("vendor_id, line_total_excl_vat, line_total_incl_vat, stripe_payment_intent_id")
    .eq("order_id", orderId)
    .eq("stripe_payment_intent_id", pi.id);

  if (linesErr || !lines || lines.length === 0) {
    console.error(`[bank_transfer] Aucune order_line liée au PI ${pi.id} pour order ${orderId}`, linesErr);
  } else {
    // Group by vendor
    const byVendor = new Map<string, { ttc: number; ht: number }>();
    for (const l of lines as any[]) {
      if (!l.vendor_id) continue;
      const agg = byVendor.get(l.vendor_id) ?? { ttc: 0, ht: 0 };
      agg.ttc += Math.round(Number(l.line_total_incl_vat) * 100);
      agg.ht += Math.round(Number(l.line_total_excl_vat) * 100);
      byVendor.set(l.vendor_id, agg);
    }

    const vendorIds = Array.from(byVendor.keys());
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, stripe_account_id, commission_rate, stripe_charges_enabled")
      .in("id", vendorIds);
    const vendorMap = new Map<string, any>((vendors || []).map((v: any) => [v.id, v]));

    for (const [vendorId, agg] of byVendor.entries()) {
      const vendor = vendorMap.get(vendorId);
      if (!vendor?.stripe_account_id || !vendor?.stripe_charges_enabled) {
        console.warn(`[bank_transfer] Vendor ${vendorId} sans Stripe Connect actif, skip transfer`);
        continue;
      }
      const commRate = Number(vendor?.commission_rate ?? defaultCommission);
      const commissionCents = Math.round(agg.ht * commRate);
      const transferAmount = agg.ttc - commissionCents;
      if (transferAmount <= 0) {
        console.warn(`[bank_transfer] transfer_amount<=0 pour vendor ${vendorId}, skip`);
        continue;
      }

      // Idempotence DB via order_transfers (unique order_id+vendor_id)
      const { data: existing } = await supabase
        .from("order_transfers")
        .select("id, status, stripe_transfer_id")
        .eq("order_id", orderId)
        .eq("vendor_id", vendorId)
        .maybeSingle();

      if (existing?.stripe_transfer_id || existing?.status === "completed") {
        console.log(`[bank_transfer] Transfer déjà présent pour order ${orderId} vendor ${vendorId}, skip`);
        continue;
      }

      let rowId = existing?.id as string | undefined;
      if (!rowId) {
        const { data: inserted, error: insertErr } = await supabase
          .from("order_transfers")
          .insert({
            order_id: orderId,
            vendor_id: vendorId,
            amount: transferAmount,
            commission_amount: commissionCents,
            commission_rate: commRate,
            status: "pending",
          })
          .select("id")
          .single();
        if (insertErr) {
          console.warn(`[bank_transfer] insert race, refetch:`, insertErr.code);
          const { data: refetched } = await supabase
            .from("order_transfers")
            .select("id, status")
            .eq("order_id", orderId)
            .eq("vendor_id", vendorId)
            .single();
          if (refetched?.status === "completed") continue;
          rowId = refetched?.id;
        } else {
          rowId = inserted.id;
        }
      }

      try {
        const transferPayload: any = {
          amount: transferAmount,
          currency: "eur",
          destination: vendor.stripe_account_id,
          metadata: {
            order_id: orderId,
            vendor_id: vendorId,
            billing_model: "mandataire",
            payment_method: "bank_transfer",
          },
        };
        // source_transaction requiert le charge id du PI virement (dispo dès succeeded)
        if (latestCharge) transferPayload.source_transaction = latestCharge;

        const transfer = await stripe.transfers.create(transferPayload, {
          idempotencyKey: `bt_transfer_${orderId}_${vendorId}`,
        });

        if (rowId) {
          await supabase
            .from("order_transfers")
            .update({
              stripe_transfer_id: transfer.id,
              status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", rowId);
        }
        console.log(`[bank_transfer] Transfer ${transfer.id} OK order=${orderId} vendor=${vendorId} (${transferAmount}c)`);
      } catch (err: any) {
        console.error(`[bank_transfer] Transfer FAILED order=${orderId} vendor=${vendorId}:`, err);
        if (rowId) {
          // Re-fetch avant écrasement destructif
          const { data: current } = await supabase
            .from("order_transfers")
            .select("status, stripe_transfer_id")
            .eq("id", rowId)
            .single();
          if (current?.status === "completed" || current?.stripe_transfer_id) {
            console.warn(`[bank_transfer] Erreur Stripe sur retry mais transfer déjà completed (tr_id=${current.stripe_transfer_id}), IGNORE`);
            continue;
          }
          await supabase
            .from("order_transfers")
            .update({
              status: "failed",
              error_message: err?.message || String(err),
              updated_at: new Date().toISOString(),
            })
            .eq("id", rowId);
        }
      }
    }
  }

  // Marque la commande payée + fan-out vendeurs + confirmation acheteur
  await supabase.from("orders").update({
    status: "confirmed",
    payment_status: "paid",
  }).eq("id", orderId);
  try {
    await supabase.functions.invoke("notify-vendors-new-order", { body: { orderId } });
  } catch (e) {
    console.error("[bank_transfer] notify-vendors-new-order failed", e);
  }
  await sendBuyerOrderConfirmation(orderId);
}


async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.order_id;
  if (!orderId) {
    console.log("No order_id in PI metadata, skipping");
    return;
  }

  // ===== Flux B : SEPA Bank Transfer (customer_balance) =====
  // PI créé sans transfer_data.destination → on crée le Transfer vers le
  // connected account du vendeur ici, après confirmation du virement.
  if (pi.metadata?.transfer_pending === "true") {
    await handleBankTransferSucceeded(pi);
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
    const commissionAmount = Math.round(vb.subtotal * commRate / 100);
    const transferAmount = vb.subtotal - commissionAmount;
    if (transferAmount < 0) throw new Error(`Negative transfer_amount: ${transferAmount}`);

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
  // Fan-out vendeurs : sub_orders + notif cloche + email "nouvelle commande"
  try {
    await supabase.functions.invoke("notify-vendors-new-order", { body: { orderId } });
  } catch (e) {
    console.error("[stripe-webhook] notify-vendors-new-order failed", e);
  }
  await sendBuyerOrderConfirmation(orderId);
}

export async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  ensureDeps();

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

/**
 * Invoice paid via Stripe Checkout (SEPA `customer_balance` created by
 * `create-invoice-sepa-checkout`). Marks the `order_invoices` row paid, cascades
 * the payment_status to the parent order when all invoices are paid, and
 * triggers a Stripe Connect Transfer to the vendor (net = TTC - commission
 * HTVA × commission_rate), reusing `order_transfers` for idempotency.
 */
export async function handleInvoiceCheckoutSucceeded(session: Stripe.Checkout.Session) {
  ensureDeps();
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) return;

  // 1) Idempotence : si déjà paid, skip.
  const { data: invoice, error: invErr } = await supabase
    .from("order_invoices")
    .select("id, order_id, vendor_id, status, amount_excl_vat, amount_incl_vat, invoice_number, type")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !invoice) {
    console.error(`[stripe-webhook][invoice] fetch failed ${invoiceId}`, invErr);
    return;
  }
  const paidAtIso = new Date().toISOString();

  if (invoice.status !== "paid") {
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
    const { error: updErr } = await supabase
      .from("order_invoices")
      .update({
        status: "paid",
        paid_at: paidAtIso,
        payment_amount_received: session.amount_total != null ? session.amount_total / 100 : invoice.amount_incl_vat,
        payment_method_received: "sepa_bank_transfer",
        payment_reference: paymentIntentId ?? session.id,
        updated_at: paidAtIso,
      })
      .eq("id", invoiceId)
      .neq("status", "paid");
    if (updErr) {
      console.error(`[stripe-webhook][invoice] update paid failed ${invoiceId}`, updErr);
    } else {
      console.log(`[stripe-webhook][invoice] ${invoice.invoice_number ?? invoiceId} → paid`);
    }
  }

  // 2) Cascade sur orders : si toutes les factures self_billing de la commande
  //    sont paid, marque la commande payée.
  if (invoice.order_id) {
    const { data: siblings } = await supabase
      .from("order_invoices")
      .select("id, status")
      .eq("order_id", invoice.order_id)
      .eq("type", "self_billing");
    const allPaid = (siblings ?? []).length > 0 && siblings!.every((s: any) => s.status === "paid");
    if (allPaid) {
      const { error: ordErr } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
        })
        .eq("id", invoice.order_id)
        .neq("payment_status", "paid");
      if (ordErr) {
        console.error(`[stripe-webhook][invoice] order cascade failed ${invoice.order_id}`, ordErr);
      }
    }
  }

  // 3) Reversement Stripe Connect (best-effort, idempotent via order_transfers).
  if (!invoice.order_id || !invoice.vendor_id) {
    console.log(`[stripe-webhook][invoice] no order/vendor, skip transfer for ${invoiceId}`);
    return;
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, stripe_account_id, commission_rate, stripe_charges_enabled")
    .eq("id", invoice.vendor_id)
    .maybeSingle();
  if (!vendor?.stripe_account_id || !vendor?.stripe_charges_enabled) {
    console.warn(`[stripe-webhook][invoice] vendor ${invoice.vendor_id} sans Stripe Connect actif, skip transfer`);
    return;
  }

  const defaultCommission = parseFloat(Deno.env.get("DEFAULT_COMMISSION_RATE") || "0.20");
  const commRate = Number(vendor.commission_rate ?? defaultCommission);
  const htCents = Math.round(Number(invoice.amount_excl_vat || 0) * 100);
  const ttcCents = Math.round(Number(invoice.amount_incl_vat || 0) * 100);
  const commissionCents = Math.round(htCents * commRate);
  const transferAmount = ttcCents - commissionCents;
  if (transferAmount <= 0) {
    console.warn(`[stripe-webhook][invoice] transfer_amount<=0 order=${invoice.order_id} vendor=${invoice.vendor_id}, skip`);
    return;
  }

  // Idempotence : ne pas re-transférer si order_transfers déjà completed pour ce couple.
  const { data: existing } = await supabase
    .from("order_transfers")
    .select("id, status, stripe_transfer_id")
    .eq("order_id", invoice.order_id)
    .eq("vendor_id", invoice.vendor_id)
    .maybeSingle();
  if (existing?.stripe_transfer_id || existing?.status === "completed") {
    console.log(`[stripe-webhook][invoice] transfer déjà présent order=${invoice.order_id} vendor=${invoice.vendor_id}, skip`);
    return;
  }

  let rowId = existing?.id as string | undefined;
  if (!rowId) {
    const { data: inserted, error: insertErr } = await supabase
      .from("order_transfers")
      .insert({
        order_id: invoice.order_id,
        vendor_id: invoice.vendor_id,
        amount: transferAmount,
        commission_amount: commissionCents,
        commission_rate: commRate,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertErr) {
      const { data: refetched } = await supabase
        .from("order_transfers")
        .select("id, status")
        .eq("order_id", invoice.order_id)
        .eq("vendor_id", invoice.vendor_id)
        .maybeSingle();
      if (refetched?.status === "completed") return;
      rowId = refetched?.id;
    } else {
      rowId = inserted.id;
    }
  }

  // Récupère le charge id (source_transaction) depuis le PaymentIntent
  let latestCharge: string | null = null;
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      latestCharge = (pi.latest_charge as string) ?? null;
    } catch (e) {
      console.warn(`[stripe-webhook][invoice] PI retrieve failed`, e);
    }
  }

  try {
    const transferPayload: any = {
      amount: transferAmount,
      currency: "eur",
      destination: vendor.stripe_account_id,
      metadata: {
        order_id: invoice.order_id,
        vendor_id: invoice.vendor_id,
        invoice_id: invoiceId,
        billing_model: "mandataire",
        payment_method: "sepa_bank_transfer",
      },
    };
    if (latestCharge) transferPayload.source_transaction = latestCharge;

    const transfer = await stripe.transfers.create(transferPayload, {
      idempotencyKey: `invoice_transfer_${invoiceId}`,
    });
    if (rowId) {
      await supabase
        .from("order_transfers")
        .update({
          stripe_transfer_id: transfer.id,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);
    }
    console.log(`[stripe-webhook][invoice] Transfer ${transfer.id} OK invoice=${invoiceId} (${transferAmount}c)`);
  } catch (err: any) {
    console.error(`[stripe-webhook][invoice] Transfer FAILED invoice=${invoiceId}:`, err);
    if (rowId) {
      const { data: current } = await supabase
        .from("order_transfers")
        .select("status, stripe_transfer_id")
        .eq("id", rowId)
        .single();
      if (current?.status !== "completed" && !current?.stripe_transfer_id) {
        await supabase
          .from("order_transfers")
          .update({
            status: "failed",
            error_message: err?.message || String(err),
            updated_at: new Date().toISOString(),
          })
          .eq("id", rowId);
      }
    }
  }
}

export async function handleInvoiceCheckoutFailed(session: Stripe.Checkout.Session) {
  ensureDeps();
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) return;
  await supabase
    .from("order_invoices")
    .update({
      error_message: `Paiement SEPA échoué (session ${session.id})`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .neq("status", "paid");
  await supabase.from("audit_logs").insert({
    action: "invoice_payment_failed",
    module: "stripe",
    detail: `Checkout session ${session.id} échouée pour invoice ${invoiceId}`,
  });
}
