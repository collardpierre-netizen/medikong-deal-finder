// @ts-nocheck — Deno runtime
// Poll Falco /documents (paginated list) and reconcile order_invoices.peppol_status
// when Falco reports a new state. Falco has no webhook — this is the recommended
// approach per Falco support. Cron runs hourly; can also be triggered manually
// from /admin/finances via the "Rafraîchir statuts Peppol" button.
//
// Auth: service_role, CRON secret, or admin JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { getFalcoConfig, logFalco } from "../_shared/falco-peppol.ts";

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

// Map Falco `peppol_send_status` values to our order_invoices.peppol_status column.
// Falco enum: not_sent | success | failure | rejected
const STATUS_MAP: Record<string, string> = {
  not_sent: "submitted",
  success: "sent",
  failure: "failed",
  rejected: "rejected",
  // legacy / passthrough
  submitted: "submitted",
  sent: "sent",
  failed: "failed",
};

function normalizeStatus(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  return STATUS_MAP[s] ?? s;
}

function extractDoc(doc: any): { id: string | null; status: string | null; error: string | null } {
  const id = doc?.id ? String(doc.id) : null;
  const status = normalizeStatus(doc?.peppol_send_status ?? doc?.status);
  let error: string | null = null;
  if (Array.isArray(doc?.events)) {
    const failure = [...doc.events]
      .reverse()
      .find((e: any) => e?.type === "peppol_send_failure");
    if (failure) error = failure?.message || failure?.details || `peppol_send_failure @ ${failure?.date || "?"}`;
  }
  return { id, status, error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: service_role, CRON secret, or admin JWT.
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const cronSecret = (Deno.env.get("CRON_SHARED_SECRET") || "").trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    const isCronCaller = !!cronSecret && bearer === cronSecret;
    const isServiceRole = !!serviceRole && bearer === serviceRole;

    if (!isCronCaller && !isServiceRole) {
      if (!bearer || bearer === anonKey) {
        return json(401, { error: "unauthorized" });
      }
      const user = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await user.auth.getClaims(bearer);
      const uid = claims?.claims?.sub;
      if (!uid) return json(401, { error: "unauthorized" });
      const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!adm) return json(403, { error: "forbidden" });
    }

    let cfg;
    try {
      cfg = getFalcoConfig();
    } catch (e: any) {
      return json(400, { ok: false, error: "falco_not_configured", details: e?.message });
    }

    // Route confirmée par le support Falco : /v1/documents/sales (pagination page/page_size).
    const url = `${cfg.baseUrl}/documents/sales?page=0&page_size=200&sort_by=created_at&sort_direction=desc`;
    const started = Date.now();
    const res = await fetch(url, {
      headers: {
        "X-Falco-Api-Key": cfg.apiKey,
        "X-Falco-App-Secret": cfg.appSecret,
        Accept: "application/json",
      },
    });
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    if (!res.ok) {
      logFalco("error", "poll_list_failed", {
        http_status: res.status,
        latency_ms: Date.now() - started,
        payload: typeof payload === "string" ? payload.slice(0, 300) : payload,
      });
      return json(502, {
        ok: false,
        error: "falco_list_failed",
        http_status: res.status,
        details: payload,
      });
    }

    const documents: any[] =
      (Array.isArray(payload) && payload) ||
      (Array.isArray((payload as any)?.documents) && (payload as any).documents) ||
      (Array.isArray((payload as any)?.data) && (payload as any).data) ||
      [];

    let checked = 0;
    let updated = 0;
    let unmatched = 0;
    const changes: Array<{ document_id: string; from: string | null; to: string }> = [];

    for (const raw of documents) {
      const { id, status, error } = extractDoc(raw);
      if (!id || !status) continue;
      checked++;

      const { data: inv } = await supabase
        .from("order_invoices")
        .select("id, peppol_status")
        .eq("peppol_document_id", id)
        .maybeSingle();

      if (!inv) {
        unmatched++;
        continue;
      }
      const current = String(inv.peppol_status || "").toLowerCase();
      if (current === status.toLowerCase()) continue;

      const patch: Record<string, unknown> = {
        peppol_status: status,
        peppol_error: error,
      };


      const { error: updErr } = await supabase
        .from("order_invoices")
        .update(patch)
        .eq("id", inv.id);
      if (updErr) {
        logFalco("error", "poll_update_failed", { invoice_id: inv.id, error: updErr.message });
        continue;
      }
      updated++;
      changes.push({ document_id: id, from: inv.peppol_status || null, to: status });
    }

    logFalco("info", "poll_done", {
      latency_ms: Date.now() - started,
      documents_returned: documents.length,
      checked,
      updated,
      unmatched,
    });

    return json(200, {
      ok: true,
      documents_returned: documents.length,
      checked,
      updated,
      unmatched,
      changes,
    });
  } catch (error: any) {
    console.error("poll-peppol-status error:", error);
    return json(200, { ok: false, error: error?.message, stack: error?.stack });
  }
});
