// @ts-nocheck — Deno runtime
// Non-blocking : vérifie l'accès à la commande et retourne un JWT HS256 court (5 min)
// signé avec ORDER_PDF_TOKEN_SECRET. Le front l'utilise ensuite pour appeler
// `fetch-order-pdf-payload` puis génère le PDF côté navigateur (jsPDF).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TTL_SECONDS = 300; // 5 min

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlJson(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}
async function signHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const data = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return `${data}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secret = Deno.env.get("ORDER_PDF_TOKEN_SECRET");
    if (!secret) return json({ error: "server_misconfigured" }, 500);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (authErr || !userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;
    if (!orderId || typeof orderId !== "string") return json({ error: "order_id required" }, 400);

    const admin = createClient(url, service);

    // Scope admin ?
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    let scope: "admin" | "vendor" | null = isAdmin ? "admin" : null;

    if (!scope) {
      // Scope vendeur : vérifie que l'utilisateur possède un vendor présent dans les lignes
      const { data: myVendors } = await admin
        .from("vendors")
        .select("id")
        .eq("auth_user_id", userId);
      const vendorIds = (myVendors ?? []).map((v: any) => v.id);
      if (vendorIds.length) {
        const { count } = await admin
          .from("order_lines")
          .select("id", { count: "exact", head: true })
          .eq("order_id", orderId)
          .in("vendor_id", vendorIds);
        if ((count ?? 0) > 0) scope = "vendor";
      }
    }

    if (!scope) return json({ error: "forbidden" }, 403);

    // Sanity : la commande existe
    const { data: order } = await admin.from("orders").select("id").eq("id", orderId).maybeSingle();
    if (!order) return json({ error: "order_not_found" }, 404);

    const now = Math.floor(Date.now() / 1000);
    const token = await signHS256(
      { sub: userId, order_id: orderId, scope, iat: now, exp: now + TTL_SECONDS },
      secret,
    );

    return json({ token, expires_at: now + TTL_SECONDS, scope });
  } catch (e) {
    console.error("issue-order-pdf-token error", e);
    return json({ error: "internal" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
