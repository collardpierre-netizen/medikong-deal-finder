import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";
import { encryptPassword } from "../_shared/qogita-creds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: corsHeaders });
  }

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

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.accessToken) {
      const detail = data?.detail
        ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))
        : data?.message ?? `HTTP ${res.status}`;
      return new Response(
        JSON.stringify({
          error: `Connexion Qogita refusée (${res.status}) : ${detail}`,
          http_status: res.status,
          qogita_detail: detail,
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const now = new Date().toISOString();
    const encryptedPassword = await encryptPassword(password);
    await sb.from("qogita_config").upsert({ key: "bearer_token", value: data.accessToken, updated_at: now }, { onConflict: "key" });
    await sb.from("qogita_config").upsert({ key: "qogita_email", value: email, updated_at: now }, { onConflict: "key" });
    await sb.from("qogita_config").upsert({ key: "qogita_password", value: encryptedPassword, updated_at: now }, { onConflict: "key" });

    // Do NOT leak the Qogita access token to the caller.
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
