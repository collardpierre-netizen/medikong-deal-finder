// Admin-only multipart upload to the private "media-assets" bucket.
// - Uploads the main file under <brand|manufacturer>/<uuid>/<filename>
// - For images: auto-generates a 400×400 thumbnail (imagescript, pure Deno)
// - For PDF/video: thumbnail must be uploaded manually by admin (MVP)
// - INSERTs the media_assets row with all metadata
//
// IMPORTANT: This function validates admin in code. verify_jwt=true is set
// in config.toml so the platform also enforces a valid session before reaching us.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const BUCKET = "media-assets";
const THUMB_SIZE = 400;
const ALLOWED_ASSET_TYPES = ["catalogue", "affiche", "video", "fiche", "brochure"] as const;
const ALLOWED_LANGS = ["fr", "nl", "en", "de"] as const;
const ALLOWED_VISIBILITY = ["public", "authenticated", "premium"] as const;

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
  const userId = userData.user.id;

  const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: userId });
  if (isAdmin !== true) return json({ error: "Admin only" }, 403);

  // Parse multipart form
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return json({ error: `Invalid multipart body: ${(e as Error).message}` }, 400);
  }

  const file = form.get("file");
  const thumbnailFile = form.get("thumbnail"); // optional, for video/pdf
  const brand_id = (form.get("brand_id") as string) || null;
  const manufacturer_id = (form.get("manufacturer_id") as string) || null;
  const asset_type = String(form.get("asset_type") ?? "");
  const language = String(form.get("language") ?? "fr");
  const visibility = String(form.get("visibility") ?? "authenticated");
  const title = String(form.get("title") ?? "").trim();
  const description = (form.get("description") as string) || null;
  const tagsRaw = (form.get("tags") as string) || "";
  const sort_order = Number(form.get("sort_order") ?? 0);
  const duration_seconds = form.get("duration_seconds")
    ? Number(form.get("duration_seconds"))
    : null;
  const page_count = form.get("page_count") ? Number(form.get("page_count")) : null;

  // Validation
  if (!(file instanceof File)) return json({ error: "Missing 'file' field" }, 400);
  if (!title) return json({ error: "Missing 'title'" }, 400);
  if (!ALLOWED_ASSET_TYPES.includes(asset_type as any))
    return json({ error: `asset_type must be one of ${ALLOWED_ASSET_TYPES.join(", ")}` }, 400);
  if (!ALLOWED_LANGS.includes(language as any))
    return json({ error: `language must be one of ${ALLOWED_LANGS.join(", ")}` }, 400);
  if (!ALLOWED_VISIBILITY.includes(visibility as any))
    return json({ error: `visibility must be one of ${ALLOWED_VISIBILITY.join(", ")}` }, 400);
  if ((brand_id && manufacturer_id) || (!brand_id && !manufacturer_id))
    return json({ error: "Exactly one of brand_id / manufacturer_id is required" }, 400);

  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // Storage path: <owner-scope>/<owner-id>/<uuid>-<safe-filename>
  const ownerScope = brand_id ? "brand" : "manufacturer";
  const ownerId = brand_id ?? manufacturer_id;
  const assetUuid = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const filePath = `${ownerScope}/${ownerId}/${assetUuid}-${safeName}`;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Upload main file
  const fileBuf = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(filePath, fileBuf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

  // Thumbnail handling
  let thumbnail_path: string | null = null;
  try {
    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      // Admin provided a manual thumbnail (video / PDF / override)
      const thumbBuf = new Uint8Array(await thumbnailFile.arrayBuffer());
      const thumbPath = `${ownerScope}/${ownerId}/${assetUuid}-thumb.${ext(thumbnailFile.name) || "jpg"}`;
      const { error: thErr } = await admin.storage
        .from(BUCKET)
        .upload(thumbPath, thumbBuf, {
          contentType: thumbnailFile.type || "image/jpeg",
          upsert: false,
        });
      if (!thErr) thumbnail_path = thumbPath;
    } else if (file.type.startsWith("image/")) {
      // Auto-generate 400×400 thumbnail for images
      const img = await Image.decode(fileBuf);
      const ratio = img.width / img.height;
      let w = THUMB_SIZE;
      let h = THUMB_SIZE;
      if (ratio > 1) h = Math.round(THUMB_SIZE / ratio);
      else w = Math.round(THUMB_SIZE * ratio);
      img.resize(w, h);
      const thumbBytes = await img.encodeJPEG(82);
      const thumbPath = `${ownerScope}/${ownerId}/${assetUuid}-thumb.jpg`;
      const { error: thErr } = await admin.storage
        .from(BUCKET)
        .upload(thumbPath, thumbBytes, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (!thErr) thumbnail_path = thumbPath;
    }
    // PDF / video without manual thumbnail → thumbnail_path stays null (admin can update later)
  } catch (thErr) {
    console.warn("Thumbnail generation failed (non-fatal):", (thErr as Error).message);
  }

  // Insert DB row
  const { data: row, error: insErr } = await admin
    .from("media_assets")
    .insert({
      brand_id,
      manufacturer_id,
      asset_type,
      language,
      visibility,
      title,
      description,
      file_path: filePath,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      thumbnail_path,
      duration_seconds,
      page_count,
      tags,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      created_by: userId,
    })
    .select("id, file_path, thumbnail_path")
    .single();

  if (insErr) {
    // Best-effort cleanup of the uploaded file
    await admin.storage.from(BUCKET).remove([filePath, ...(thumbnail_path ? [thumbnail_path] : [])]);
    return json({ error: `DB insert failed: ${insErr.message}` }, 500);
  }

  return json({ ok: true, asset: row });
});

function ext(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
