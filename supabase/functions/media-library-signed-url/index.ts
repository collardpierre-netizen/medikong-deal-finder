// Return a short-lived signed URL for a media-library file. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "media-library";
const TTL_SECONDS = 60 * 10; // 10 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid_session" }, 401);

  const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: userData.user.id });
  if (isAdmin !== true) return json({ error: "admin_only" }, 403);

  let body: { media_ids?: string[]; ttl_seconds?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const ids = Array.isArray(body.media_ids) ? body.media_ids.slice(0, 200) : [];
  if (ids.length === 0) return json({ error: "missing_media_ids" }, 400);

  const ttl = Math.min(Math.max(Number(body.ttl_seconds) || TTL_SECONDS, 60), 3600);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: rows, error } = await admin
    .from("media_library")
    .select("id, storage_path")
    .in("id", ids);
  if (error) return json({ error: error.message }, 500);

  const results: Record<string, string | null> = {};
  await Promise.all(
    (rows ?? []).map(async (r: { id: string; storage_path: string }) => {
      const { data, error: sErr } = await admin.storage.from(BUCKET).createSignedUrl(r.storage_path, ttl);
      results[r.id] = sErr || !data ? null : data.signedUrl;
    }),
  );

  return json({ ok: true, urls: results, expires_in: ttl });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
