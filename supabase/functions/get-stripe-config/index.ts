// Returns the Stripe publishable key to the frontend.
// Safe to expose: pk_test_/pk_live_ keys are publishable by design.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";
  return new Response(
    JSON.stringify({ publishableKey }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
