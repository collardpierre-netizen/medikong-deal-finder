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
    const defaultCommission = parseFloat(Deno.env.get("DEFAULT_COMMISSION_RATE") || "0.20");

    // Verify auth
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

    const body = await req.json();
    const { action, order_id } = body;

    if (action === "create-payment-intent") {

      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get order with lines
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, total_incl_vat, customer_id, stripe_payment_intent_id")
        .eq("id", order_id)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Commande introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If already has a PI, return its client_secret
      if (order.stripe_payment_intent_id) {
        const existingPI = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
        return new Response(
          JSON.stringify({ client_secret: existingPI.client_secret }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get order lines grouped by vendor
      const { data: lines } = await supabase
        .from("order_lines")
        .select("vendor_id, line_total_incl_vat")
        .eq("order_id", order_id);

      if (!lines || lines.length === 0) {
        return new Response(JSON.stringify({ error: "Commande sans articles" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by vendor
      const vendorTotals: Record<string, number> = {};
      for (const line of lines) {
        vendorTotals[line.vendor_id] = (vendorTotals[line.vendor_id] || 0) + Number(line.line_total_incl_vat);
      }

      // Get vendor Stripe info
      const vendorIds = Object.keys(vendorTotals);
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, stripe_account_id, commission_rate, stripe_charges_enabled")
        .in("id", vendorIds);

      const vendorMap = new Map(vendors?.map(v => [v.id, v]) || []);

      // Build vendor breakdown
      const vendorBreakdown = vendorIds.map(vid => {
        const vendor = vendorMap.get(vid);
        const subtotalEur = vendorTotals[vid];
        const subtotalCents = Math.round(subtotalEur * 100);
        const commRate = vendor?.commission_rate ?? defaultCommission;
        const commissionCents = Math.round(subtotalCents * Number(commRate));
        const transferCents = subtotalCents - commissionCents;

        return {
          vendor_id: vid,
          stripe_account_id: vendor?.stripe_account_id || null,
          subtotal: subtotalCents,
          commission_rate: Number(commRate),
          commission_amount: commissionCents,
          transfer_amount: transferCents,
        };
      });

      const totalCents = Math.round(Number(order.total_incl_vat) * 100);

      // Create PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: "eur",
        metadata: {
          order_id: order_id,
          platform: "medikong",
          vendor_breakdown: JSON.stringify(vendorBreakdown),
        },
      });

      // Save PI id on order
      await supabase
        .from("orders")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          client_secret: paymentIntent.client_secret,
          payment_intent_id: paymentIntent.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
