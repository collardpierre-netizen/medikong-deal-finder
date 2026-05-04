import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
