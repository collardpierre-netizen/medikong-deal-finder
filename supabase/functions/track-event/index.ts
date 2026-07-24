// Log a funnel event (visit, signup_started, signup_completed, activated, first_purchase, code_redeemed).
// POST { slug?: string, campaign_id?: string, code?: string, event_type: string, visitor_id?: string, meta?: object }
// Auth: reads Authorization Bearer to attach user_id when available.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED = new Set([
  "visit", "signup_started", "signup_completed", "activated", "first_purchase", "code_redeemed",
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uaFamily(ua: string | null): string {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview/.test(s)) return "bot";
  if (/mobile|iphone|android|ipad/.test(s)) return "mobile";
  return "desktop";
}

function truncateIp(ip: string | null): string | null {
  if (!ip) return null;
  const clean = ip.split(",")[0].trim();
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "invalid_json" }); }

  const eventType = String(body?.event_type ?? "");
  if (!ALLOWED.has(eventType)) return json(400, { ok: false, error: "invalid_event_type" });

  // Resolve campaign by slug if provided
  let campaignId: string | null = body?.campaign_id ?? null;
  if (!campaignId && body?.slug) {
    const { data } = await service
      .from("tracking_campaigns")
      .select("id")
      .eq("slug", String(body.slug))
      .maybeSingle();
    campaignId = data?.id ?? null;
  }

  // Resolve code
  let codeId: string | null = null;
  if (body?.code) {
    const { data } = await service
      .from("activation_codes")
      .select("id")
      .ilike("code", String(body.code))
      .maybeSingle();
    codeId = data?.id ?? null;
  }

  // Resolve user from JWT
  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7);
    try {
      const { data: userData } = await service.auth.getUser(token);
      userId = userData.user?.id ?? null;
    } catch { /* ignore */ }
  }

  try {
    await service.from("tracking_events").insert({
      campaign_id: campaignId,
      code_id: codeId,
      event_type: eventType,
      visitor_id: body?.visitor_id ? String(body.visitor_id) : null,
      user_id: userId,
      ip_prefix: truncateIp(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip")),
      ua_family: uaFamily(req.headers.get("user-agent")),
      referrer_host: null,
      meta: body?.meta && typeof body.meta === "object" ? body.meta : {},
    });
  } catch (e) {
    console.error("track-event insert error", e);
    return json(200, { ok: false, error: "log_failed" });
  }

  return json(200, { ok: true });
});
