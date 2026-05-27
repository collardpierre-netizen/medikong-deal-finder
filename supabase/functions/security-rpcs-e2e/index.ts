// Stub edge function — required so that this directory can host an
// `index.test.ts` runnable via the `supabase--test_edge_functions` tool
// (the tool expects each test to live inside a function directory).
//
// This function is intentionally NOT meant to be invoked in production.
// It always returns 410 Gone so that, if accidentally deployed and called,
// no data is exposed and no side-effects occur.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ error: "test-only function, not callable" }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
