import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  clientIp,
  isUuid,
  rateLimitCheck,
  safeExtension,
  validateUploadBytes,
} from "../_shared/upload-guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_IMAGE_INDEX = 19; // products keep up to 20 images

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // --- Auth: must be an admin ---
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid_session" }, 401);

  const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: userData.user.id });
  if (isAdmin !== true) return json({ error: "admin_only" }, 403);

  // --- Rate limit per admin user (best-effort) ---
  const rl = rateLimitCheck(userData.user.id, {
    bucket: "upload-product-image",
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    return json(
      { error: "rate_limited", message: "Trop d'uploads, réessayez sous peu." },
      429,
      { "Retry-After": String(rl.retryAfterSec) },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { product_id, image_index, image_base64, content_type, ext, update_product } = body as {
    product_id?: unknown;
    image_index?: unknown;
    image_base64?: unknown;
    content_type?: unknown;
    ext?: unknown;
    update_product?: unknown;
  };

  // Path-traversal guard: product_id must be a UUID, image_index an int in range.
  if (!isUuid(product_id)) return json({ error: "invalid_product_id" }, 400);
  const normalizedIndex = Number.isInteger(image_index) ? Number(image_index) : 0;
  if (normalizedIndex < 0 || normalizedIndex > MAX_IMAGE_INDEX) {
    return json({ error: "invalid_image_index" }, 400);
  }
  if (typeof image_base64 !== "string" || image_base64.length === 0) {
    return json({ error: "missing_image_base64" }, 400);
  }
  // Hard cap on base64 payload (~ 4/3 of raw size).
  if (image_base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16) {
    return json({ error: "file_too_large" }, 413);
  }

  let bytes: Uint8Array;
  try {
    const binaryStr = atob(image_base64);
    bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  } catch {
    return json({ error: "invalid_base64" }, 400);
  }

  const declaredMime = typeof content_type === "string" ? content_type : null;
  const check = validateUploadBytes(bytes, {
    maxBytes: MAX_IMAGE_BYTES,
    kind: "image",
    declaredMime,
  });
  if (!check.ok) return json({ error: check.code, message: check.message }, check.status);

  const safeExt = safeExtension(typeof ext === "string" ? ext : check.mime.split("/")[1], "jpg");
  const filePath = `${product_id}/${normalizedIndex}.${safeExt}`;

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error: uploadErr } = await supabase.storage
    .from("product-images")
    .upload(filePath, bytes, { contentType: check.mime, upsert: true });
  if (uploadErr) return json({ error: "upload_failed", message: uploadErr.message }, 500);

  const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(filePath);

  if (update_product === true) {
    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("image_urls")
      .eq("id", product_id)
      .maybeSingle();
    if (productErr) return json({ error: "db_read_failed", message: productErr.message }, 500);

    const imageUrls = Array.isArray(product?.image_urls) ? [...product.image_urls] : [];
    imageUrls[normalizedIndex] = publicUrl;
    const cleanedUrls = imageUrls.filter(
      (url): url is string => typeof url === "string" && url.trim().length > 0,
    );

    const { error: updateErr } = await supabase
      .from("products")
      .update({
        image_url: cleanedUrls[0] ?? publicUrl,
        image_urls: cleanedUrls.length > 0 ? cleanedUrls : [publicUrl],
      })
      .eq("id", product_id);
    if (updateErr) return json({ error: "db_update_failed", message: updateErr.message }, 500);
  }

  return json({ url: publicUrl, updated: update_product === true });
});
