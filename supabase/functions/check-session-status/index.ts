import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeVatBaseSafe, cagnotteVatModeLabel, loadCagnotteVatSettings, formatEurBe } from "../_shared/cagnotte-vat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Non autorisé" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return json(401, { error: "Non autorisé" });
    }

    let payload: { session_id?: unknown };
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: "JSON invalide" });
    }
    const sessionId = typeof payload.session_id === "string" ? payload.session_id.trim() : "";
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return json(400, { error: "session_id invalide" });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, status, payment_status, customer_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (orderErr) {
      return json(500, { error: "Lecture commande impossible", details: orderErr.message });
    }
    if (!order) {
      return json(404, { error: "Commande introuvable pour cette session" });
    }

    // IDOR : vérifier que la commande appartient au caller via customers.auth_user_id
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("auth_user_id")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (custErr || !customer || customer.auth_user_id !== caller.id) {
      return json(403, { error: "Accès refusé" });
    }

    const stripePaymentStatus = session.payment_status; // 'paid' | 'unpaid' | 'no_payment_required'
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    let nextStatus = order.status;
    let nextPaymentStatus = order.payment_status;

    if (stripePaymentStatus === "paid" && order.payment_status !== "paid") {
      const { data: updated, error: updErr } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          stripe_payment_intent_id: paymentIntentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .select("status, payment_status")
        .single();
      if (updErr) {
        return json(500, { error: "Mise à jour commande impossible", details: updErr.message });
      }
      nextStatus = updated.status;
      nextPaymentStatus = updated.payment_status;
      // Fan-out vendeurs : sub_orders + notif cloche + email "nouvelle commande" (best-effort)
      try {
        await supabase.functions.invoke("notify-vendors-new-order", { body: { orderId: order.id } });
      } catch (e) {
        console.error("[check-session-status] notify-vendors-new-order failed", e);
      }
      // Email de confirmation acheteur (best-effort, idempotent via idempotencyKey)
      try {
        const { data: fullOrder } = await supabase
          .from("orders")
          .select("id, order_number, total_incl_vat, subtotal_excl_vat, vat_amount, cagnotte_used, payment_method, shipping_address, customer:customers!orders_customer_id_fkey(email, company_name)")
          .eq("id", order.id)
          .maybeSingle();
        const customerRow: any = (fullOrder as any)?.customer;
        const recipientEmail = customerRow?.email;
        if (recipientEmail) {
          const { count: itemCount } = await supabase
            .from("order_items")
            .select("id", { count: "exact", head: true })
            .eq("order_id", order.id);
          const formatEUR = formatEurBe;
          const addr: any = (fullOrder as any)?.shipping_address;
          const shippingAddress = addr && typeof addr === "object"
            ? [addr.line1 || addr.address_line1, addr.line2 || addr.address_line2, [addr.postal_code, addr.city].filter(Boolean).join(" "), addr.country || addr.country_code]
                .filter(Boolean).join(", ")
            : undefined;
          const paymentMethodLabel: Record<string, string> = {
            card: "Carte bancaire",
            sepa: "Virement SEPA",
            invoice: "Facture",
          };
          // Récapitulatif cagnotte / TVA (uniquement si de la cagnotte a été appliquée)
          const cagnotteUsed = Number((fullOrder as any)?.cagnotte_used || 0);
          let cagnotteData: Record<string, string> = {};
          if (cagnotteUsed > 0) {
            const { vatMode, vatRate } = await loadCagnotteVatSettings(supabase);
            const subtotalHt = Number((fullOrder as any)?.subtotal_excl_vat || 0);
            const rawVat = Number((fullOrder as any)?.vat_amount);
            const b = computeVatBaseSafe(
              subtotalHt,
              cagnotteUsed,
              vatMode,
              vatRate,
              Number.isFinite(rawVat) ? rawVat : undefined,
            );
            cagnotteData = {
              cagnotteUsed: formatEUR(cagnotteUsed),
              subtotalHt: formatEUR(subtotalHt),
              vatBase: formatEUR(b.vat_base),
              vatAmount: formatEUR(b.vat_amount),
              vatBaseHint: b.vat_mode === "discount"
                ? "HT net (sous-total − cagnotte)"
                : "HT plein (la cagnotte est un moyen de paiement)",
              vatModeLabel: cagnotteVatModeLabel(b.vat_mode),
              netToPay: formatEUR(b.net_to_pay),
            };
          }
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "order-confirmation",
              recipientEmail,
              idempotencyKey: `order-confirmation-${order.id}`,
              templateData: {
                orderNumber: (fullOrder as any)?.order_number,
                customerName: customerRow?.company_name,
                total: formatEUR(Number((fullOrder as any)?.total_incl_vat || 0)),
                itemCount: itemCount ?? 0,
                shippingAddress,
                paymentMethod: paymentMethodLabel[(fullOrder as any)?.payment_method] || (fullOrder as any)?.payment_method,
                ...cagnotteData,
              },
            },
          });
        }
      } catch (e) {
        console.error("[check-session-status] order-confirmation failed", e);
      }
    }

    // Fallback : si la commande est payée mais qu'aucun sub_order n'a été créé
    // (webhook Stripe manqué), on rejoue le fan-out vendeurs ici. Idempotent
    // côté RPC fanout_order_to_vendors + email (idempotencyKey par sub_order).
    if (nextPaymentStatus === "paid") {
      try {
        const { count: subCount } = await supabase
          .from("sub_orders")
          .select("id", { count: "exact", head: true })
          .eq("order_id", order.id);
        if ((subCount ?? 0) === 0) {
          console.log("[check-session-status] no sub_orders found, replaying vendor fan-out", order.id);
          await supabase.functions.invoke("notify-vendors-new-order", { body: { orderId: order.id } });
        }
      } catch (e) {
        console.error("[check-session-status] vendor fan-out fallback failed", e);
      }
    }

    return json(200, {
      order_id: order.id,
      order_number: order.order_number,
      payment_status: nextPaymentStatus,
      status: nextStatus,
      stripe_payment_status: stripePaymentStatus,
    });
  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Erreur inconnue" });
  }
});
