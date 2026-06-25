// Teste les credentials Qogita actuellement stockés dans qogita_config
// et enregistre le résultat dans qogita_connection_tests (historique).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";
import { maybeDecrypt } from "../_shared/qogita-creds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: corsHeaders });
  }
  const testedBy: string | null = guard.via === "admin" ? (guard.userId ?? null) : null;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const startedAt = Date.now();
  let success = false;
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;
  let email: string | null = null;
  let configUpdatedAt: string | null = null;

  try {
    const { data: rows, error } = await sb
      .from("qogita_config")
      .select("key, value, updated_at")
      .in("key", ["qogita_email", "qogita_password", "base_url"]);
    if (error) throw error;

    const cfg: Record<string, { value: string; updated_at: string }> = {};
    (rows || []).forEach((r: any) => { cfg[r.key] = { value: r.value, updated_at: r.updated_at }; });

    email = cfg.qogita_email?.value ?? null;
    const password = cfg.qogita_password?.value ?? null;
    const baseUrl = cfg.base_url?.value ?? "https://api.qogita.com";
    configUpdatedAt = cfg.qogita_password?.updated_at ?? cfg.qogita_email?.updated_at ?? null;

    if (!email || !password) {
      errorMessage = "qogita_email ou qogita_password manquant dans qogita_config";
    } else {
      const res = await fetch(`${baseUrl}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      httpStatus = res.status;
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.accessToken) {
        success = true;
        // Rafraîchir le bearer en cache
        await sb.from("qogita_config").upsert(
          { key: "bearer_token", value: body.accessToken, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      } else {
        errorMessage = body?.detail
          ? (typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail))
          : `HTTP ${res.status}`;
      }
    }
  } catch (e: any) {
    errorMessage = e?.message ?? String(e);
  }

  const latency = Date.now() - startedAt;

  // Log historique (best effort)
  await sb.from("qogita_connection_tests").insert({
    tested_by: testedBy,
    tested_email_masked: maskEmail(email),
    success,
    http_status: httpStatus,
    latency_ms: latency,
    error_message: errorMessage,
    source: "admin_ui",
  });

  return new Response(JSON.stringify({
    success,
    http_status: httpStatus,
    latency_ms: latency,
    error_message: errorMessage,
    tested_email_masked: maskEmail(email),
    config_updated_at: configUpdatedAt,
  }), { headers: corsHeaders, status: success ? 200 : 200 });
});
