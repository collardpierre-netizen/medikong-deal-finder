// Log a QR/link scan and return campaign metadata to redirect on.
// POST { slug: string, visitor_id: string, code?: string, referrer?: string, ua?: string }
// Response: { ok, campaign?: {id, landing_path, utm_source, utm_medium, utm_campaign, utm_content, code?}, expired?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uaFamily(ua: string | undefined | null): string {
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
  if (clean.includes(":")) {
    const parts = clean.split(":");
    return parts.slice(0, 4).join(":") + "::0";
  }
  return null;
}

function refHost(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try { return new URL(ref).host; } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "invalid_json" }); }
  const slug = String(body?.slug ?? "").trim();
  const visitorId = String(body?.visitor_id ?? "").trim() || null;
  const codeParam = body?.code ? String(body.code).trim() : null;
  if (!slug) return json(400, { ok: false, error: "missing_slug" });

  const { data: campaign } = await supabase
    .from("tracking_campaigns")
    .select("id, landing_path, utm_source, utm_medium, utm_campaign, utm_content, status, starts_at, ends_at, default_activation_code_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!campaign) return json(200, { ok: true, expired: true, campaign: null });

  const now = Date.now();
  const expired =
    campaign.status !== "active" ||
    (campaign.starts_at && new Date(campaign.starts_at).getTime() > now) ||
    (campaign.ends_at && new Date(campaign.ends_at).getTime() < now);

  // Resolve code: explicit ?k= first, then default
  let resolvedCodeId: string | null = null;
  let resolvedCodeText: string | null = null;
  if (codeParam) {
    const { data: c } = await supabase
      .from("activation_codes")
      .select("id, code, is_active, expires_at")
      .ilike("code", codeParam)
      .maybeSingle();
    if (c && c.is_active && (!c.expires_at || new Date(c.expires_at).getTime() > now)) {
      resolvedCodeId = c.id;
      resolvedCodeText = c.code;
    }
  } else if (campaign.default_activation_code_id) {
    const { data: c } = await supabase
      .from("activation_codes")
      .select("id, code, is_active, expires_at")
      .eq("id", campaign.default_activation_code_id)
      .maybeSingle();
    if (c && c.is_active && (!c.expires_at || new Date(c.expires_at).getTime() > now)) {
      resolvedCodeId = c.id;
      resolvedCodeText = c.code;
    }
  }

  const ipHeader = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip");
  const ua = req.headers.get("user-agent") ?? body?.ua ?? null;
  const family = uaFamily(ua);

  // Log scan (best-effort — never block redirect)
  try {
    if (!expired) {
      await supabase.from("tracking_events").insert({
        campaign_id: campaign.id,
        code_id: resolvedCodeId,
        event_type: "scan",
        visitor_id: visitorId,
        ip_prefix: truncateIp(ipHeader),
        ua_family: family,
        referrer_host: refHost(body?.referrer ?? req.headers.get("referer")),
        meta: {},
      });
    }
  } catch (e) {
    console.error("track-scan log error", e);
  }

  return json(200, {
    ok: true,
    expired: !!expired,
    campaign: expired ? null : {
      id: campaign.id,
      landing_path: campaign.landing_path,
      utm_source: campaign.utm_source,
      utm_medium: campaign.utm_medium,
      utm_campaign: campaign.utm_campaign,
      utm_content: campaign.utm_content,
      code: resolvedCodeText,
      code_id: resolvedCodeId,
    },
  });
});
