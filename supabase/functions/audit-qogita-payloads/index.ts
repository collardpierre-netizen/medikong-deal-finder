// Audit v3 : inspection structurelle d'UN seul payload variant (sans filtrage)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await sb.from("qogita_config").select("key, value");
    const cfg: Record<string, string> = {};
    (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });

    const baseUrl = cfg.base_url || "https://api.qogita.com";
    const authRes = await fetch(`${baseUrl}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cfg.qogita_email, password: cfg.qogita_password }),
    });
    if (!authRes.ok) throw new Error(`Auth ${authRes.status}: ${await authRes.text()}`);
    const { accessToken } = await authRes.json();

    // 3 endpoints à tester pour comprendre la structure réelle
    const gtin = "0195950610741"; // Apple Watch (variant_qid renseigné)
    const variantQid = "307b325a27b1498695acbfe94ffe54a4";
    const offerQid = "6b34f12e-e0ea-4b00-aac8-f4ea9159c0c1";

    const endpoints = [
      { name: "variant_by_gtin", url: `${baseUrl}/variants/${gtin}/?country=BE` },
      { name: "variant_by_qid", url: `${baseUrl}/variants/${variantQid}/?country=BE` },
      { name: "variant_offers_list", url: `${baseUrl}/variants/${variantQid}/offers/?country=BE` },
    ];

    const out: any = {};
    for (const ep of endpoints) {
      const r = await fetch(ep.url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
      const text = await r.text();
      let payload: any = null;
      try { payload = JSON.parse(text); } catch {}
      out[ep.name] = {
        url: ep.url,
        status: r.status,
        top_level_keys: payload && typeof payload === "object" ? Object.keys(payload) : null,
        raw: payload,
      };
    }

    return new Response(JSON.stringify(out, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
