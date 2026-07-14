// Endpoint admin : relance notify-vendors-new-order pour une commande donnée.
// Vérifie que l'appelant est admin (via has_role) puis invoque en service-role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Validate JWT and admin role using caller's token
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await asCaller.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });

    const { data: isAdmin, error: roleErr } = await asCaller.rpc("is_admin");
    if (roleErr || !isAdmin) return json(403, { error: "Forbidden — admin only" });

    // 2) Parse body
    let payload: { orderId?: unknown };
    try { payload = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
    const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
    if (!orderId) return json(400, { error: "orderId required" });

    // 3) Invoke notify-vendors-new-order with service-role
    const asService = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await asService.functions.invoke("notify-vendors-new-order", {
      body: { orderId },
    });
    if (error) {
      const ctx: any = (error as any).context;
      let detail: string | undefined;
      try { detail = await ctx?.text?.(); } catch { /* ignore */ }
      return json(502, { error: error.message ?? "notify failed", detail });
    }
    return json(200, { ok: true, result: data });
  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Unknown error" });
  }
});
