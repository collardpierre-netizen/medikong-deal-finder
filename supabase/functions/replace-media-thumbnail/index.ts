// Admin-only: replace/upload thumbnail of an existing media_assets row,
// without touching the main file. Accepts multipart/form-data with:
//   - asset_id (uuid, required)
//   - thumbnail (File, required, image/*)
// Deletes the previous thumbnail (if any) from the bucket after a successful upload.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "media-assets";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

  const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: userData.user.id });
  if (isAdmin !== true) return json({ error: "Admin only" }, 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return json({ error: `Invalid multipart body: ${(e as Error).message}` }, 400);
  }

  const asset_id = String(form.get("asset_id") ?? "").trim();
  const thumbnail = form.get("thumbnail");
  if (!asset_id) return json({ error: "Missing 'asset_id'" }, 400);
  if (!(thumbnail instanceof File) || thumbnail.size === 0)
    return json({ error: "Missing 'thumbnail' file" }, 400);
  if (!(thumbnail.type || "").startsWith("image/"))
    return json({ error: "Thumbnail must be an image" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: asset, error: getErr } = await admin
    .from("media_assets")
    .select("id, brand_id, manufacturer_id, thumbnail_path")
    .eq("id", asset_id)
    .maybeSingle();
  if (getErr) return json({ error: getErr.message }, 500);
  if (!asset) return json({ error: "Asset not found" }, 404);

  const ownerScope = asset.brand_id ? "brand" : "manufacturer";
  const ownerId = asset.brand_id ?? asset.manufacturer_id;
  const newUuid = crypto.randomUUID();
  const extMatch = /\.([a-z0-9]+)$/i.exec(thumbnail.name);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const newPath = `${ownerScope}/${ownerId}/${newUuid}-thumb.${ext}`;

  const buf = new Uint8Array(await thumbnail.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET).upload(newPath, buf, {
    contentType: thumbnail.type || "image/jpeg",
    upsert: false,
  });
  if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

  const { error: updErr } = await admin
    .from("media_assets")
    .update({ thumbnail_path: newPath })
    .eq("id", asset_id);
  if (updErr) {
    await admin.storage.from(BUCKET).remove([newPath]);
    return json({ error: `DB update failed: ${updErr.message}` }, 500);
  }

  // Best-effort cleanup of previous thumbnail
  if (asset.thumbnail_path && asset.thumbnail_path !== newPath) {
    await admin.storage.from(BUCKET).remove([asset.thumbnail_path]);
  }

  return json({ ok: true, thumbnail_path: newPath });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
