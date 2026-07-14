// @ts-nocheck — Deno runtime
// Admin-only status check for the Falco/Peppol integration.
// Returns booleans about which env vars are present + selected environment,
// NEVER the secret values themselves.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin gate
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json(401, { error: "unauthorized" });
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await user.auth.getClaims(token);
    const uid = claims?.claims?.sub;
    if (!uid) return json(401, { error: "unauthorized" });
    const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
    if (!adm) return json(403, { error: "forbidden" });

    const apiKey = (Deno.env.get("FALCO_API_KEY") || "").trim();
    const appSecret = (Deno.env.get("FALCO_APP_SECRET") || "").trim();
    const baseUrlRaw = (Deno.env.get("FALCO_BASE_URL") || "").trim();
    const baseUrl = baseUrlRaw || "https://api.sandbox.falco-app.be/v1";
    const environment = baseUrl.includes("sandbox") ? "sandbox" : "production";

    const missing: string[] = [];
    if (!apiKey) missing.push("FALCO_API_KEY");
    if (!appSecret) missing.push("FALCO_APP_SECRET");

    return json(200, {
      integration: "falco-peppol",
      active: missing.length === 0,
      api_key_configured: Boolean(apiKey),
      app_secret_configured: Boolean(appSecret),
      base_url_overridden: Boolean(baseUrlRaw),
      base_url: baseUrl,
      environment,
      missing_secrets: missing,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[falco-status]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
