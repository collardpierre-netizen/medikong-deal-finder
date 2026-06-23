// Vendor-callable edge function to save SendCloud credentials.
// Credentials are encrypted at rest with SENDCLOUD_ENC_KEY (AES-GCM).
// The cleartext keys never round-trip through the client read path.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptSecret } from "../_shared/secret-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ENC_KEY = Deno.env.get("SENDCLOUD_ENC_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // Verify the calling user via their JWT
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: { action?: string; vendor_id?: string; public_key?: string; secret_key?: string; mark_connected?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (body.action !== "save") {
    return json({ success: false, error: "Unknown action" }, 400);
  }
  if (!body.vendor_id || !body.public_key || !body.secret_key) {
    return json({ success: false, error: "vendor_id, public_key and secret_key are required" }, 400);
  }
  if (body.public_key.length > 256 || body.secret_key.length > 256) {
    return json({ success: false, error: "Key too long" }, 400);
  }
  if (!ENC_KEY) {
    return json({ success: false, error: "Encryption key not configured" }, 500);
  }

  // Ownership check: caller must be the vendor owner OR an admin.
  const { data: vendorRow, error: vErr } = await admin
    .from("vendors")
    .select("id, auth_user_id")
    .eq("id", body.vendor_id)
    .maybeSingle();
  if (vErr || !vendorRow) {
    return json({ success: false, error: "Vendor not found" }, 404);
  }

  if (vendorRow.auth_user_id !== userId) {
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = adminRow?.is_active && ["super_admin", "admin"].includes(adminRow.role as string);
    if (!isAdmin) {
      return json({ success: false, error: "Forbidden" }, 403);
    }
  }

  let publicCipher: string;
  let secretCipher: string;
  try {
    publicCipher = await encryptSecret(body.public_key, ENC_KEY);
    secretCipher = await encryptSecret(body.secret_key, ENC_KEY);
  } catch (e) {
    return json({ success: false, error: `Encryption failed: ${(e as Error).message}` }, 500);
  }

  const { error: upErr } = await admin
    .from("vendor_sendcloud_credentials")
    .upsert(
      {
        vendor_id: body.vendor_id,
        public_key_cipher: publicCipher,
        secret_key_cipher: secretCipher,
        is_connected: body.mark_connected === true,
        last_verified_at: body.mark_connected === true ? new Date().toISOString() : null,
      } as any,
      { onConflict: "vendor_id" },
    );
  if (upErr) {
    return json({ success: false, error: upErr.message }, 500);
  }

  return json({ success: true });
});
