// Admin-only upload to private bucket "media-library" with SHA-256 dedup.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import {
  clientIp,
  rateLimitCheck,
  safeExtension,
  safeSegment,
  validateUploadBytes,
} from "../_shared/upload-guards.ts";

const BUCKET = "media-library";
const MAX_BYTES = 20 * 1024 * 1024; // 20 Mo

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
  const userId = userData.user.id;

  const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: userId });
  if (isAdmin !== true) return json({ error: "admin_only" }, 403);

  const rl = rateLimitCheck(clientIp(req) + ":" + userId, {
    bucket: "media-library-upload",
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) },
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return json({ error: "invalid_multipart", message: (e as Error).message }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "missing_file" }, 400);

  const folder = safeSegment(String(form.get("folder") ?? "general"), 60) || "general";
  const title = (form.get("title") as string | null)?.trim() || null;
  const alt_text = (form.get("alt_text") as string | null)?.trim() || null;
  const description = (form.get("description") as string | null)?.trim() || null;
  const tagsRaw = (form.get("tags") as string | null) ?? "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 20);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUploadBytes(bytes, {
    kind: "image",
    maxBytes: MAX_BYTES,
    declaredMime: file.type,
  });
  if (!validation.ok) return json({ error: validation.code, message: validation.message }, validation.status);
  const mime = validation.mime;

  // SHA-256 dedup
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: existing } = await admin
    .from("media_library")
    .select("id, storage_path, filename, mime_type, size_bytes, width, height, sha256, title, alt_text, folder, tags")
    .eq("sha256", sha256)
    .maybeSingle();
  if (existing) {
    return json({ ok: true, media: existing, duplicate: true });
  }

  // Detect dimensions (best effort)
  let width: number | null = null;
  let height: number | null = null;
  try {
    const img = await Image.decode(bytes);
    width = img.width;
    height = img.height;
  } catch (_) {
    // ignore
  }

  const id = crypto.randomUUID();
  const baseName = safeSegment(file.name.replace(/\.[^.]+$/, ""), 60) || "image";
  const extName = safeExtension(mime.split("/")[1], "bin");
  const storagePath = `${folder}/${id}-${baseName}.${extName}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upErr) return json({ error: "upload_failed", message: upErr.message }, 500);

  const { data: row, error: insErr } = await admin
    .from("media_library")
    .insert({
      id,
      storage_path: storagePath,
      filename: file.name,
      mime_type: mime,
      size_bytes: bytes.byteLength,
      width,
      height,
      sha256,
      title,
      alt_text,
      description,
      folder,
      tags,
      uploaded_by: userId,
    })
    .select("id, storage_path, filename, mime_type, size_bytes, width, height, sha256, title, alt_text, folder, tags")
    .single();

  if (insErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return json({ error: "db_insert_failed", message: insErr.message }, 500);
  }

  return json({ ok: true, media: row, duplicate: false });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
