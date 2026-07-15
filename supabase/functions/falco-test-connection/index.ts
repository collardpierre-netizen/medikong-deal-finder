// @ts-nocheck — Deno runtime
// Admin-only Falco API connectivity test.
// Calls GET /organization/whoami using the configured secrets and returns
// a structured result — NEVER the secret values themselves.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { logFalco, getFalcoConfig, validateFalcoCredentials } from "../_shared/falco-peppol.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin gate
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json(401, { error: "unauthorized" });
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await user.auth.getClaims(token);
    const uid = claims?.claims?.sub;
    if (!uid) return json(401, { error: "unauthorized" });
    const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
    if (!adm) return json(403, { error: "forbidden" });

    // Sanitize header values: strip control chars, BOM, non-ASCII (avoid
    // "headers of RequestInit is not a valid ByteString" on copy-pasted secrets).
    const sanitize = (v: string) =>
      (v || "")
        .replace(/^\uFEFF/, "")
        .replace(/[\r\n\t\v\f\0]/g, "")
        // eslint-disable-next-line no-control-regex
        .replace(/[^\x20-\x7E]/g, "")
        .trim();
    // Trigger debug log in getFalcoConfig (length + prefix only).
    getFalcoConfig();
    const apiKey = sanitize(Deno.env.get("FALCO_API_KEY") || "");
    const appSecret = sanitize(Deno.env.get("FALCO_APP_SECRET") || "");
    const baseUrlRaw = sanitize(Deno.env.get("FALCO_BASE_URL") || "");
    const baseUrl = baseUrlRaw || "https://api.sandbox.falco-app.be/v1";
    const environment = baseUrl.includes("sandbox") ? "sandbox" : "production";

    const caller = "falco-test-connection";
    const endpoint = "/organization/whoami";

    if (!apiKey || !appSecret) {
      const missing = [!apiKey && "FALCO_API_KEY", !appSecret && "FALCO_APP_SECRET"].filter(Boolean);
      logFalco("error", "credentials_missing", { caller, environment, missing_secrets: missing });
      return json(200, {
        ok: false,
        reason: "missing_secrets",
        missing_secrets: missing,
        environment,
        base_url: baseUrl,
        message: `Secret(s) manquant(s) : ${missing.join(", ")}.`,
      });
    }

    const credCheck = validateFalcoCredentials(apiKey, appSecret);
    if (!credCheck.ok) {
      logFalco("error", "credentials_invalid_format", {
        caller,
        environment,
        code: credCheck.code,
        api_key_length: apiKey.length,
        app_secret_length: appSecret.length,
      });
      return json(200, {
        ok: false,
        reason: credCheck.code,
        environment,
        base_url: baseUrl,
        api_key_length: apiKey.length,
        app_secret_length: appSecret.length,
        message: credCheck.message,
      });
    }

    logFalco("info", "request_start", { caller, environment, endpoint, base_url: baseUrl, method: "GET" });
    const startedAt = Date.now();
    let httpStatus = 0;
    let rawBody = "";
    let responseHeaders: Record<string, string> = {};
    let payload: any = null;
    let networkError: string | null = null;

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "X-Falco-App-Secret": appSecret,
          "X-Falco-Api-Key": apiKey,
          "Accept": "application/json",
        },
      });
      httpStatus = res.status;
      responseHeaders = Object.fromEntries(res.headers.entries());
      rawBody = await res.text().catch(() => "");
      console.log("[falco-test-connection] Falco response status:", httpStatus);
      console.log("[falco-test-connection] Falco response body:", rawBody);
      console.log("[falco-test-connection] Falco response headers:", responseHeaders);
      try { payload = rawBody ? JSON.parse(rawBody) : null; } catch { payload = null; }
    } catch (e: any) {
      networkError = String(e?.message || e);
    }

    const latencyMs = Date.now() - startedAt;
    const ok = httpStatus >= 200 && httpStatus < 300;

    if (networkError) {
      logFalco("error", "network_error", { caller, environment, endpoint, latency_ms: latencyMs, error: networkError });
    } else if (!ok) {
      logFalco("error", "request_failed", { caller, environment, endpoint, http_status: httpStatus, latency_ms: latencyMs, error: rawBody.slice(0, 500) });
    } else {
      logFalco("info", "request_success", { caller, environment, endpoint, http_status: httpStatus, latency_ms: latencyMs });
    }


    // Extract public, non-secret organization info to show admins.
    let org: any = null;
    if (ok && payload && typeof payload === "object") {
      org = {
        name: payload.name || payload.organization_name || null,
        vat_number: payload.vat_number || null,
        peppol_identifier:
          payload.peppol_identifier ||
          payload?.peppol?.identifier ||
          null,
        country: payload.country || payload?.address?.country || null,
      };
    }

    let message = "";
    if (networkError) {
      message = `Erreur réseau : ${networkError}`;
    } else if (ok) {
      message = `Connexion Falco OK (${latencyMs} ms).`;
    } else if (httpStatus === 401 || httpStatus === 403) {
      message = `Authentification refusée (HTTP ${httpStatus}) — vérifier FALCO_API_KEY / FALCO_APP_SECRET.`;
    } else {
      message = `Échec Falco (HTTP ${httpStatus}).`;
    }

    return json(200, {
      ok,
      http_status: httpStatus,
      network_error: networkError,
      latency_ms: latencyMs,
      environment,
      base_url: baseUrl,
      endpoint: "/organization/whoami",
      organization: org,
      message,
      response_body: rawBody,
      response_headers: responseHeaders,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[falco-test-connection]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
