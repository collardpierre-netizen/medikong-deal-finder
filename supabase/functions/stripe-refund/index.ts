import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, vendor_id, amount_cents, reason } = await req.json();

    if (!order_id || !amount_cents || amount_cents <= 0) {
      return new Response(JSON.stringify({ error: "Paramètres invalides" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order
    const { data: order } = await supabase
      .from("orders")
      .select("id, stripe_payment_intent_id")
      .eq("id", order_id)
      .single();

    if (!order?.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: "Commande sans PaymentIntent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the charge from PI
    const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    const chargeId = pi.latest_charge as string;

    if (!chargeId) {
      return new Response(JSON.stringify({ error: "Aucun paiement trouvé" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create refund on the charge
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amount_cents,
      reason: "requested_by_customer",
      metadata: {
        order_id,
        vendor_id: vendor_id || "all",
        admin_user: caller.id,
        reason: reason || "",
      },
    });

    // If vendor-specific, reverse the transfer
    if (vendor_id) {
      const { data: transfer } = await supabase
        .from("order_transfers")
        .select("stripe_transfer_id, amount, commission_rate")
        .eq("order_id", order_id)
        .eq("vendor_id", vendor_id)
        .eq("status", "completed")
        .maybeSingle();

      if (transfer?.stripe_transfer_id) {
        // Calculate reversal proportional to refund
        const commRate = Number(transfer.commission_rate);
        const reversalAmount = Math.round(amount_cents * (1 - commRate));

        try {
          await stripe.transfers.createReversal(transfer.stripe_transfer_id, {
            amount: reversalAmount,
            metadata: {
              order_id,
              refund_id: refund.id,
            },
          });

          await supabase
            .from("order_transfers")
            .update({ status: "reversed" })
            .eq("order_id", order_id)
            .eq("vendor_id", vendor_id);
        } catch (err) {
          console.error("Transfer reversal failed:", err);
        }
      }
    }

    // Update order status
    await supabase.from("orders").update({
      payment_status: "refunded",
    }).eq("id", order_id);

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "refund_created",
      module: "stripe",
      user_id: caller.id,
      detail: `Remboursement de ${amount_cents / 100}€ pour commande ${order_id}${vendor_id ? ` (vendeur ${vendor_id})` : ""}`,
    });

    return new Response(
      JSON.stringify({ success: true, refund_id: refund.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stripe refund error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
