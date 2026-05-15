// Start a buyer impersonation session.
// Caller must be a super_admin. Returns a one-shot magic-link token_hash that the
// admin browser uses to swap its auth session for the target user's session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const adminUser = userRes?.user;
    if (!adminUser) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const target_user_id: string | undefined = body?.target_user_id;
    const reason: string | undefined = body?.reason;
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Super_admin gate via RPC + open session row.
    // IMPORTANT: call PostgREST directly so the admin JWT is definitely forwarded;
    // otherwise auth.uid() can be null inside the SECURITY DEFINER RPC.
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_buyer_impersonation`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _target_user_id: target_user_id, _reason: reason ?? null }),
    });
    const rpcText = await rpcRes.text();
    if (!rpcRes.ok) {
      let message = rpcText;
      try { message = JSON.parse(rpcText)?.message ?? rpcText; } catch { /* keep raw text */ }
      return new Response(JSON.stringify({ error: message }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sessionId = JSON.parse(rpcText);

    // Fetch target email
    const { data: targetRes, error: getErr } = await admin.auth.admin.getUserById(target_user_id);
    if (getErr || !targetRes?.user?.email) {
      return new Response(JSON.stringify({ error: "target user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const email = targetRes.user.email;

    // Generate a magiclink — we only need its hashed_token to verifyOtp client-side
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: linkErr?.message ?? "magiclink failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        email,
        token_hash: linkData.properties.hashed_token,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
