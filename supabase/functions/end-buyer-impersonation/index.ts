// Close a buyer impersonation session row.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const body = await req.json().catch(() => ({}));
    const session_id: string | undefined = body?.session_id;
    const ended_reason: string | undefined = body?.ended_reason;
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RPC must run with the admin's JWT so auth.uid() resolves inside SECURITY DEFINER.
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/end_buyer_impersonation`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _session_id: session_id, _ended_reason: ended_reason ?? "manual" }),
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
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
