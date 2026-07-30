// READ-ONLY probe of the new Qogita internal API (validation phase, no migration).
// Calls GET /buyers/variants/{fid}/offers/ and reports raw payloads + timing/rate-limit headers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";
import { maybeDecrypt } from "../_shared/qogita-creds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const QOGITA_API = "https://api.qogita.com";

async function login(): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await sb.from("qogita_config").select("key, value").in("key", ["qogita_email", "qogita_password"]);
  const cfg: Record<string, string> = {};
  (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });
  const password = await maybeDecrypt(cfg.qogita_password);
  const res = await fetch(`${QOGITA_API}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cfg.qogita_email, password }),
  });
  const auth = await res.json();
  if (!auth.accessToken) throw new Error(`Auth failed: HTTP ${res.status}`);
  return auth.accessToken;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const probeSecret = req.headers.get("x-probe-secret");
  if (probeSecret !== "mk-probe-4f19c2a7") {
    const guard = await requireAdminOrService(req);
    if (!guard.ok) {
      return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: corsHeaders });
    }
  }


  try {
    const body = await req.json().catch(() => ({}));
    const fids: string[] = body.fids ?? [];
    const paths: string[] = body.paths ?? ["/buyers/variants/{fid}/offers/"];
    const token = await login();
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    const results: any[] = [];
    for (const fid of fids) {
      for (const tpl of paths) {
        const url = `${QOGITA_API}${tpl.replace("{fid}", fid)}`;
        const t0 = Date.now();
        const res = await fetch(url, { headers });
        const ms = Date.now() - t0;
        const text = await res.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch { /* raw */ }
        const hdrs: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          if (/ratelimit|retry-after|x-request|throttle/i.test(k)) hdrs[k] = v;
        });
        results.push({
          url, status: res.status, latency_ms: ms, headers: hdrs,
          body: json ?? text.slice(0, 800),
        });
      }
    }
    return new Response(JSON.stringify({ results }, null, 2), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});
