// RFQ tracking endpoint
// - GET ?t=<token>&e=email_opened    -> 1x1 transparent gif
// - GET ?t=<token>&e=email_clicked&u=<destination_url> -> 302 redirect
// Marks the rfq_dispatch_log row via the SECURITY DEFINER RPC `rfq_track_event`.
// Public (anon) endpoint — token is the only secret needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TRANSPARENT_GIF = Uint8Array.from([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,0x00,0x00,0x00,
  0xff,0xff,0xff,0x21,0xf9,0x04,0x01,0x00,0x00,0x00,0x00,0x2c,0x00,0x00,0x00,0x00,
  0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,0x01,0x00,0x3b,
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const event = url.searchParams.get("e") ?? "email_opened";
  const dest = url.searchParams.get("u");

  if (!UUID_RE.test(token) || !["email_opened", "email_clicked", "viewed"].includes(event)) {
    return new Response("Bad request", { status: 400, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  // Best-effort, never block the user
  admin.rpc("rfq_track_event", { _token: token, _event: event }).then(({ error }) => {
    if (error) console.error("rfq_track_event failed", error.message);
  });

  if (event === "email_clicked" && dest) {
    try {
      const target = new URL(dest);
      // Only allow https redirects
      if (target.protocol === "https:") {
        return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target.toString() } });
      }
    } catch {/* fallthrough */}
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
});
