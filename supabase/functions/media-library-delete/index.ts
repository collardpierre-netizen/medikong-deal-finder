// Admin-only: delete a media-library entry (row + storage object + links).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "media-library";

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

  let body: { media_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const mediaId = String(body.media_id ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaId))
    return json({ error: "invalid_media_id" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row, error: rowErr } = await admin
    .from("media_library")
    .select("id, storage_path")
    .eq("id", mediaId)
    .maybeSingle();
  if (rowErr) return json({ error: rowErr.message }, 500);
  if (!row) return json({ error: "not_found" }, 404);

  await admin.storage.from(BUCKET).remove([row.storage_path]);
  const { error: delErr } = await admin.from("media_library").delete().eq("id", mediaId);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
