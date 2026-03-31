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

    // Verify caller is authenticated vendor or admin
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

    const { action, vendor_id, origin } = await req.json();

    if (action === "create-account") {
      // Get vendor info
      const { data: vendor, error: vendorErr } = await supabase
        .from("vendors")
        .select("id, name, email, country_code, stripe_account_id")
        .eq("id", vendor_id)
        .single();

      if (vendorErr || !vendor) {
        return new Response(JSON.stringify({ error: "Vendeur introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let accountId = vendor.stripe_account_id;

      // Create Express account if not exists
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: vendor.country_code?.toUpperCase() || "BE",
          email: vendor.email || undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "company",
          metadata: {
            vendor_id: vendor.id,
            platform: "medikong",
          },
        });

        accountId = account.id;

        await supabase
          .from("vendors")
          .update({ stripe_account_id: accountId })
          .eq("id", vendor.id);
      }

      // Create Account Link
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/vendor/stripe-onboarding/refresh?vendor_id=${vendor.id}`,
        return_url: `${origin}/vendor/stripe-onboarding/success?vendor_id=${vendor.id}`,
        type: "account_onboarding",
      });

      return new Response(
        JSON.stringify({ url: accountLink.url, account_id: accountId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh-link") {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("stripe_account_id")
        .eq("id", vendor_id)
        .single();

      if (!vendor?.stripe_account_id) {
        return new Response(JSON.stringify({ error: "Compte Stripe introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accountLink = await stripe.accountLinks.create({
        account: vendor.stripe_account_id,
        refresh_url: `${origin}/vendor/stripe-onboarding/refresh?vendor_id=${vendor_id}`,
        return_url: `${origin}/vendor/stripe-onboarding/success?vendor_id=${vendor_id}`,
        type: "account_onboarding",
      });

      return new Response(
        JSON.stringify({ url: accountLink.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check-status") {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled")
        .eq("id", vendor_id)
        .single();

      if (!vendor?.stripe_account_id) {
        return new Response(
          JSON.stringify({ onboarded: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch latest from Stripe
      const account = await stripe.accounts.retrieve(vendor.stripe_account_id);
      const chargesEnabled = account.charges_enabled ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;
      const onboardingComplete = chargesEnabled && payoutsEnabled;

      // Update DB
      await supabase
        .from("vendors")
        .update({
          stripe_charges_enabled: chargesEnabled,
          stripe_payouts_enabled: payoutsEnabled,
          stripe_onboarding_complete: onboardingComplete,
        })
        .eq("id", vendor_id);

      return new Response(
        JSON.stringify({
          onboarded: onboardingComplete,
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          account_id: vendor.stripe_account_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe Connect error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
