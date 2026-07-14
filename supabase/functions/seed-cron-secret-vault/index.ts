// Admin-only: copies the CRON_SHARED_SECRET env var into Supabase Vault
// under the name `cron_shared_secret` so that pg_cron jobs can read it
// via vault.decrypted_secrets without hardcoding the value in SQL.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VAULT_SECRET_NAME = "cron_shared_secret";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) return json(guard.status, { error: guard.error });

  const secretValue = (Deno.env.get("CRON_SHARED_SECRET") ?? "").trim();
  if (!secretValue) return json(400, { error: "CRON_SHARED_SECRET env var not configured" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("upsert_cron_shared_secret", {
      _name: VAULT_SECRET_NAME,
      _secret: secretValue,
    });
    if (error) return json(500, { error: "vault_upsert_failed", details: error.message });

    return json(200, {
      ok: true,
      vault_secret_name: VAULT_SECRET_NAME,
      vault_secret_id: data,
      via: guard.via,
    });
  } catch (e) {
    console.error("[seed-cron-secret-vault]", e);
    return json(500, { error: "internal_error", details: String((e as any)?.message || e) });
  }
});
