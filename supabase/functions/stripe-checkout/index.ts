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
        const commissionCents = Math.round(subtotalCents * Number(commRate) / 100);
        const transferCents = subtotalCents - commissionCents;
        if (transferCents < 0) throw new Error(`Negative transfer_amount: ${transferCents}`);

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

    if (action === "create-checkout-session") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, order_number, total_incl_vat, customer_id, stripe_session_id, stripe_payment_intent_id")
        .eq("id", order_id)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Commande introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // IDOR check : caller must own this order via customers.auth_user_id
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("id, auth_user_id")
        .eq("id", order.customer_id)
        .maybeSingle();

      if (custErr || !customer || customer.auth_user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Accès refusé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If a session already exists, return it (avoid duplicates)
      if (order.stripe_session_id) {
        try {
          const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
          if (existing && existing.url && existing.status === "open") {
            return new Response(
              JSON.stringify({ url: existing.url, session_id: existing.id }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (e) {
          console.warn("Existing session retrieval failed, creating a new one:", e);
        }
      }

      // Load order lines with product info + offer_id (needed for cart validation)
      const { data: lines } = await supabase
        .from("order_lines")
        .select("offer_id, vendor_id, product_id, quantity, unit_price_incl_vat, line_total_incl_vat, product:products(name)")
        .eq("order_id", order_id);

      if (!lines || lines.length === 0) {
        return new Response(JSON.stringify({ error: "Commande sans articles" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Server-side cart validation (MOQ, stock, vendor MOV, recalculated tier prices)
      const { validateCart } = await import("../_shared/validate-cart.ts");
      const cartItems = lines
        .filter((l: any) => l.offer_id)
        .map((l: any) => ({ offer_id: l.offer_id as string, quantity: Number(l.quantity) }));
      const validation = await validateCart(supabase, cartItems);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "cart_validation_failed", validation }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Use RECALCULATED prices from validation (protect against client tampering)
      const validatedByOffer = new Map(validation.items.map((v) => [v.offer_id, v]));
      const productNameByOffer = new Map<string, string>();
      for (const l of lines) {
        productNameByOffer.set(l.offer_id, (l as any).product?.name || `Produit ${l.product_id}`);
      }

      // Vendor breakdown from validated prices
      const vendorTotals: Record<string, number> = {};
      for (const v of validation.items) {
        vendorTotals[v.vendor_id] = (vendorTotals[v.vendor_id] || 0) + v.total_incl_vat;
      }
      const vendorIds = Object.keys(vendorTotals);
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, stripe_account_id, commission_rate, stripe_charges_enabled")
        .in("id", vendorIds);
      const vendorMap = new Map(vendors?.map((v) => [v.id, v]) || []);
      const vendorBreakdown = vendorIds.map((vid) => {
        const vendor = vendorMap.get(vid);
        const subtotalCents = Math.round(vendorTotals[vid] * 100);
        const commRate = vendor?.commission_rate ?? defaultCommission;
        const commissionCents = Math.round(subtotalCents * Number(commRate) / 100);
        const transferCents = subtotalCents - commissionCents;
        if (transferCents < 0) throw new Error(`Negative transfer_amount: ${transferCents}`);
        return {
          vendor_id: vid,
          stripe_account_id: vendor?.stripe_account_id || null,
          subtotal: subtotalCents,
          commission_rate: Number(commRate),
          commission_amount: commissionCents,
          transfer_amount: transferCents,
        };
      });

      // Build Stripe line_items from VALIDATED prices
      const lineItems = validation.items.map((v) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: productNameByOffer.get(v.offer_id) || `Produit ${v.product_id}`,
            metadata: { product_id: String(v.product_id) },
          },
          unit_amount: Math.round(v.unit_price_incl_vat * 100),
        },
        quantity: v.quantity,
      }));

      const origin =
        req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
        "https://dev.medikong.pro";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: lineItems,
        success_url: `${origin}/confirmation?order=${order.order_number}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout`,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          platform: "medikong",
          vendor_breakdown: JSON.stringify(vendorBreakdown),
        },
        payment_intent_data: {
          transfer_group: `order_${order.id}`,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            platform: "medikong",
            vendor_breakdown: JSON.stringify(vendorBreakdown),
          },
        },
      });

      // Persist session id (and PI id if already linked) + flag test si Stripe en mode test
      const update: Record<string, unknown> = {
        stripe_session_id: session.id,
        is_test: session.livemode === false,
      };
      if (typeof session.payment_intent === "string") {
        update.stripe_payment_intent_id = session.payment_intent;
      }
      await supabase.from("orders").update(update).eq("id", order_id);

      return new Response(
        JSON.stringify({ url: session.url, session_id: session.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
