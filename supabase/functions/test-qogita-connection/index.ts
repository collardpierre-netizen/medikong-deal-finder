import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email et mot de passe requis" }), { status: 400, headers: corsHeaders });
    }

    const res = await fetch("https://api.qogita.com/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.accessToken) {
      return new Response(JSON.stringify({ error: `Connexion échouée (${res.status})`, detail: data }), { status: 401, headers: corsHeaders });
    }

    // Save token + email in qogita_config
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const now = new Date().toISOString();
    await sb.from("qogita_config").upsert({ key: "bearer_token", value: data.accessToken, updated_at: now }, { onConflict: "key" });
    await sb.from("qogita_config").upsert({ key: "qogita_email", value: email, updated_at: now }, { onConflict: "key" });
    await sb.from("qogita_config").upsert({ key: "qogita_password", value: password, updated_at: now }, { onConflict: "key" });

    return new Response(JSON.stringify({ success: true, accessToken: data.accessToken }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
