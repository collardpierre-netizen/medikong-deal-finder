// Refund (cancel or partial) a vendor order line via shared magic-link token.
// No JWT: secured by vendor_order_tokens.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { getVendorPublicName } from "../_shared/vendor-display.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-requested-with, accept, accept-language",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin, Access-Control-Request-Headers",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function reject(status: number, code: string, ctx: Record<string, unknown> = {}) {
  console.warn(`[refund_order_line.${status}] error=${code} ctx=${JSON.stringify(ctx)}`);
  return json(status, { error: code, ...ctx });
}

type Action = "cancel" | "partial";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const requested = req.headers.get("Access-Control-Request-Headers");
    const headers: Record<string, string> = { ...corsHeaders };
    if (requested) headers["Access-Control-Allow-Headers"] = requested;
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      token,
      line_id,
      action,
      quantity_to_refund,
      reason,
    } = body as {
      token?: string;
      line_id?: string;
      action?: Action;
      quantity_to_refund?: number;
      reason?: string;
    };

    const tokenPreview = typeof token === "string" && token.length > 0
      ? `${token.slice(0, 6)}…(${token.length})`
      : null;
    const baseCtx = { action, line_id: line_id ?? null, token_preview: tokenPreview };

    if (!token || !line_id || !action) {
      return reject(400, "missing_params", {
        ...baseCtx,
        missing: { token: !token, line_id: !line_id, action: !action },
      });
    }
    if (action !== "cancel" && action !== "partial") {
      return reject(400, "invalid_action", { ...baseCtx, received_action: action });
    }
    if (action === "partial") {
      if (typeof quantity_to_refund !== "number" || !Number.isInteger(quantity_to_refund) || quantity_to_refund < 1) {
        return reject(400, "invalid_quantity_to_refund", { ...baseCtx, quantity_to_refund });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1) Token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("vendor_order_tokens")
      .select("order_id, vendor_id, sub_order_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (tokenErr) {
      console.error(`[refund_order_line.500] token_lookup_failed: ${tokenErr.message}`);
      return json(500, { error: tokenErr.message });
    }
    if (!tokenRow) return reject(401, "invalid_token", baseCtx);
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return reject(410, "token_expired", { ...baseCtx, expires_at: tokenRow.expires_at });
    }

    // 2) Line ownership
    const { data: line, error: lineErr } = await supabase
      .from("order_lines")
      .select(
        "id, order_id, vendor_id, offer_id, product_id, quantity, quantity_shipped, fulfillment_status, unit_price_excl_vat, unit_price_incl_vat, line_total_excl_vat, line_total_incl_vat, refunded_amount_incl_vat",
      )
      .eq("id", line_id)
      .eq("order_id", tokenRow.order_id)
      .eq("vendor_id", tokenRow.vendor_id)
      .maybeSingle();
    if (lineErr) {
      console.error(`[refund_order_line.500] line_lookup_failed: ${lineErr.message}`);
      return json(500, { error: lineErr.message });
    }
    if (!line) return reject(403, "forbidden", baseCtx);

    const currentStatus = String(line.fulfillment_status);
    if (currentStatus === "cancelled") return reject(400, "already_cancelled", baseCtx);
    if (currentStatus === "delivered") return reject(400, "cannot_refund_delivered", baseCtx);
    if (!["pending", "processing", "shipped"].includes(currentStatus)) {
      return reject(400, "invalid_status_for_refund", { ...baseCtx, status: currentStatus });
    }

    // 3) Amount math
    const totalQty = Number(line.quantity || 0);
    const unitInclVat = Number(line.unit_price_incl_vat || 0);
    const lineTotalInclVat = Number(line.line_total_incl_vat || 0);
    const alreadyRefunded = Number(line.refunded_amount_incl_vat || 0);

    let qtyToRefund: number;
    if (action === "cancel") {
      qtyToRefund = totalQty;
    } else {
      qtyToRefund = quantity_to_refund as number;
      if (qtyToRefund >= totalQty) {
        return reject(400, "partial_qty_must_be_less_than_total", {
          ...baseCtx, quantity_to_refund: qtyToRefund, line_quantity: totalQty,
        });
      }
    }

    // Refund amount in EUR (numeric like line_total_incl_vat).
    const refundAmountInclVat = Math.round(qtyToRefund * unitInclVat * 100) / 100;
    if (refundAmountInclVat <= 0) {
      return reject(400, "refund_amount_zero", { ...baseCtx, refundAmountInclVat });
    }
    if (alreadyRefunded + refundAmountInclVat > lineTotalInclVat + 0.005) {
      return reject(400, "refund_exceeds_line_total", {
        ...baseCtx,
        already_refunded: alreadyRefunded,
        refund_requested: refundAmountInclVat,
        line_total_incl_vat: lineTotalInclVat,
      });
    }

    // 4) Order / PaymentIntent
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, stripe_payment_intent_id, total_incl_vat, customer_id")
      .eq("id", tokenRow.order_id)
      .maybeSingle();
    if (orderErr) return json(500, { error: orderErr.message });
    if (!order) return reject(404, "order_not_found", baseCtx);
    if (!order.stripe_payment_intent_id) {
      return reject(400, "no_payment_intent", { ...baseCtx, order_id: order.id });
    }

    // 5) Stripe refund (idempotent)
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[refund_order_line.500] STRIPE_SECRET_KEY missing");
      return json(500, { error: "stripe_not_configured" });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const amountCents = Math.round(refundAmountInclVat * 100);
    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: order.stripe_payment_intent_id,
          amount: amountCents,
          reason: "requested_by_customer",
          metadata: {
            order_id: order.id,
            order_number: order.order_number ?? "",
            order_line_id: line.id,
            vendor_id: String(line.vendor_id),
            action,
            quantity_refunded: String(qtyToRefund),
            reason: reason || "vendor_cancel",
          },
        },
        { idempotencyKey: `refund_${line.id}_${qtyToRefund}` },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[refund_order_line.500] stripe_refund_failed: ${msg}`);
      return json(502, { error: "stripe_refund_failed", details: msg });
    }

    const nowIso = new Date().toISOString();

    // 6) Update order_lines
    const linePatch: Record<string, unknown> = {
      refunded_amount_incl_vat: Math.round((alreadyRefunded + refundAmountInclVat) * 100) / 100,
      stripe_refund_id: refund.id,
      updated_at: nowIso,
    };
    if (action === "cancel") {
      linePatch.fulfillment_status = "cancelled";
      linePatch.quantity_shipped = 0;
      linePatch.cancellation_reason = reason ?? null;
      linePatch.cancelled_at = nowIso;
    } else {
      // partial : on garde le status courant (typiquement shipped) — la quantité réellement livrée
      // est totalQty - qtyToRefund.
      linePatch.quantity_shipped = totalQty - qtyToRefund;
    }

    const { error: updErr } = await supabase
      .from("order_lines")
      .update(linePatch)
      .eq("id", line.id);
    if (updErr) {
      console.error(`[refund_order_line.500] line_update_failed: ${updErr.message}`);
      return json(500, { error: updErr.message });
    }

    // 7) Re-créditer le stock
    let stockResult: any = null;
    if (line.offer_id) {
      const { data: incData, error: incErr } = await supabase.rpc("increment_offer_stock", {
        p_offer_id: line.offer_id,
        p_quantity: qtyToRefund,
      });
      if (incErr) {
        console.error(`[refund_order_line] stock increment error for ${line.offer_id}: ${incErr.message}`);
      } else {
        stockResult = incData;
      }
    }

    // 8) Recalcul sub_order status
    if (tokenRow.sub_order_id) {
      const { data: vendorLines, error: vlErr } = await supabase
        .from("order_lines")
        .select("fulfillment_status")
        .eq("order_id", tokenRow.order_id)
        .eq("vendor_id", tokenRow.vendor_id);
      if (vlErr) {
        console.error(`[refund_order_line] sub_order recompute: lines fetch failed: ${vlErr.message}`);
      } else if (vendorLines && vendorLines.length > 0) {
        const allCancelled = vendorLines.every((l) => String(l.fulfillment_status) === "cancelled");
        if (allCancelled) {
          const { error: subErr } = await supabase
            .from("sub_orders")
            .update({ status: "cancelled", updated_at: nowIso })
            .eq("id", tokenRow.sub_order_id);
          if (subErr) {
            console.error(`[refund_order_line] sub_order update failed: ${subErr.message}`);
          }
        }
        // Mix cancelled/shipped : on laisse le statut existant tel quel (le sub_order vit toujours).
      }
    }

    // 9) Notifications (best-effort, ne bloque pas la réponse)
    try {
      const { data: customer } = order.customer_id
        ? await supabase
            .from("customers")
            .select("email")
            .eq("id", order.customer_id)
            .maybeSingle()
        : { data: null };

      // 🔒 Anonymisation vendeur : ne JAMAIS sélectionner vendor.name / company_name.
      // Le rendu acheteur (email order-line-refunded-customer) passe toujours par
      // getVendorPublicName — cf. memory "Vendor Anonymity Guardrail".
      const { data: vendor } = await supabase
        .from("vendors")
        .select("display_code")
        .eq("id", line.vendor_id)
        .maybeSingle();

      const { data: product } = line.product_id
        ? await supabase
            .from("products")
            .select("name")
            .eq("id", line.product_id)
            .maybeSingle()
        : { data: null };

      const vendorName = getVendorPublicName({ display_code: vendor?.display_code ?? null });
      const productName = product?.name || "votre article";
      const templateData = {
        orderNumber: order.order_number || "",
        orderId: order.id,
        vendorName,
        vendorId: line.vendor_id,
        productName,
        lineId: line.id,
        action,
        quantityRefunded: qtyToRefund,
        quantityOrdered: totalQty,
        refundAmountEur: refundAmountInclVat,
        stripeRefundId: refund.id,
        reason: reason || null,
      };

      if (customer?.email) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "order-line-refunded-customer",
            recipientEmail: customer.email,
            idempotencyKey: `refund-customer-${line.id}-${qtyToRefund}`,
            templateData,
          },
        });
      } else {
        console.warn(`[refund_order_line] no customer email for order ${order.id}, skip customer notif`);
      }

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "order-line-refunded-admin",
          recipientEmail: "pcoll@medikong.pro",
          idempotencyKey: `refund-admin-${line.id}-${qtyToRefund}`,
          templateData,
        },
      });
    } catch (e) {
      console.error(`[refund_order_line] notifications failed silently: ${e instanceof Error ? e.message : e}`);
    }

    return json(200, {
      success: true,
      refund: {
        stripe_refund_id: refund.id,
        amount_refunded: refundAmountInclVat,
        currency: "eur",
      },
      line: {
        id: line.id,
        new_fulfillment_status: action === "cancel" ? "cancelled" : currentStatus,
        new_quantity_shipped: action === "cancel" ? 0 : totalQty - qtyToRefund,
      },
      stock: stockResult
        ? { offer_id: line.offer_id, new_stock: (stockResult as any)?.new_stock ?? null }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[refund_order_line.500] unhandled: ${msg}`);
    return json(500, { error: msg });
  }
});
