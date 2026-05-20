// Returns a short-lived signed URL for a media_assets file (and its thumbnail).
//
// Access control:
// - We query media_assets via the caller's JWT (or anon if no token). RLS on
//   media_assets enforces visibility (public/authenticated/premium) + admin
//   bypass via the existing policies. If the SELECT returns no row, the caller
//   has no right to access the asset → 403.
// - We then mint a 60s signed URL using the service role (the bucket is private).
// - We log the access in media_downloads (best-effort).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "media-assets";
const SIGNED_URL_TTL_SECONDS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Parse asset_id from query or body
  let assetId: string | null = null;
  try {
    if (req.method === "GET") {
      assetId = new URL(req.url).searchParams.get("asset_id");
    } else {
      const body = await req.json();
      assetId = body?.asset_id ?? null;
    }
  } catch {
    /* fallthrough */
  }
  if (!assetId) return json({ error: "Missing asset_id" }, 400);

  // Caller-context client (respects RLS on media_assets)
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });

  const { data: asset, error: assetErr } = await callerClient
    .from("media_assets")
    .select("id, file_path, thumbnail_path, visibility, is_active, mime_type")
    .eq("id", assetId)
    .maybeSingle();

  if (assetErr) return json({ error: assetErr.message }, 500);
  if (!asset || !asset.is_active) {
    return json({ error: "Not found or access denied" }, 403);
  }

  // Mint signed URL with service role
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(asset.file_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) return json({ error: signErr?.message ?? "Sign failed" }, 500);

  let thumbnail_url: string | null = null;
  if (asset.thumbnail_path) {
    const { data: signedThumb } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(asset.thumbnail_path, SIGNED_URL_TTL_SECONDS);
    thumbnail_url = signedThumb?.signedUrl ?? null;
  }

  // Log download (best-effort) — only when caller is authenticated
  try {
    const { data: userData } = await callerClient.auth.getUser();
    const profileId = userData?.user?.id ?? null;
    await admin.from("media_downloads").insert({
      media_asset_id: asset.id,
      profile_id: profileId,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent") || null,
      referrer: req.headers.get("referer") || null,
      country_code: req.headers.get("cf-ipcountry") || req.headers.get("x-country-code") || null,
    });
  } catch (logErr) {
    console.warn("media_downloads log failed:", (logErr as Error).message);
  }

  return json({
    asset_id: asset.id,
    url: signed.signedUrl,
    thumbnail_url,
    mime_type: asset.mime_type,
    expires_in: SIGNED_URL_TTL_SECONDS,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
