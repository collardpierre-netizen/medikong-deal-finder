// @ts-nocheck — Deno runtime
// Falco Peppol webhook receiver.
// Falco POSTs status transitions here; we update order_invoices.peppol_status
// keyed by peppol_document_id.
//
// Expected payload (tolerant to nesting variants):
//   { document_id, status: 'sent'|'failed'|'rejected'|'submitted', error?, ... }
// or { data: { document_id, status, error_message } }
//
// Optional security: set FALCO_WEBHOOK_SECRET as an edge-function secret and
// configure the same value in the Falco dashboard. When set, requests must
// carry it in the `X-Falco-Signature` (or `X-Webhook-Secret`) header.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { logFalco } from "../_shared/falco-peppol.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-falco-signature, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Accepted Peppol statuses we persist (mapped to our column values).
const STATUS_MAP: Record<string, "sent" | "failed" | "rejected" | "submitted"> = {
  sent: "sent",
  delivered: "sent",
  accepted: "sent",
  success: "sent",
  submitted: "submitted",
  pending: "submitted",
  in_progress: "submitted",
  failed: "failed",
  error: "failed",
  rejected: "rejected",
  refused: "rejected",
};

function extract(payload: any): { document_id?: string; status?: string; error?: string | null } {
  const p = payload || {};
  const inner = p.data && typeof p.data === "object" ? p.data : p;
  const document_id =
    p.document_id || p.documentId || inner.document_id || inner.documentId ||
    p.id || inner.id;
  const rawStatus =
    p.status || p.event || inner.status || inner.event ||
    inner.peppol_status?.status || p.peppol_status?.status;
  const error =
    p.error || p.error_message || inner.error || inner.error_message ||
    inner.peppol_status?.error_message || p.peppol_status?.error_message ||
    null;
  return {
    document_id: document_id ? String(document_id) : undefined,
    status: rawStatus ? String(rawStatus).toLowerCase() : undefined,
    error: error ? String(error) : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    // Optional shared-secret validation. No-op if secret not configured.
    const expected = (Deno.env.get("FALCO_WEBHOOK_SECRET") || "").trim();
    if (expected) {
      const provided =
        (req.headers.get("x-falco-signature") || req.headers.get("x-webhook-secret") || "").trim();
      if (!provided || provided !== expected) {
        logFalco("warn", "webhook_unauthorized", { has_header: Boolean(provided) });
        return json(401, { error: "invalid_signature" });
      }
    }

    const rawBody = await req.text();
    let payload: any = null;
    try { payload = JSON.parse(rawBody); } catch { /* keep null */ }
    if (!payload || typeof payload !== "object") {
      logFalco("error", "webhook_bad_payload", { size: rawBody.length });
      return json(400, { error: "invalid_json" });
    }

    const { document_id, status, error } = extract(payload);
    if (!document_id) {
      logFalco("error", "webhook_missing_document_id", { keys: Object.keys(payload) });
      return json(400, { error: "document_id_required" });
    }
    if (!status || !STATUS_MAP[status]) {
      logFalco("warn", "webhook_unknown_status", { document_id, status });
      return json(200, { ok: false, ignored: true, reason: "unknown_status", status });
    }

    const mapped = STATUS_MAP[status];
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      peppol_status: mapped,
      peppol_error: mapped === "failed" || mapped === "rejected" ? (error || `peppol_${mapped}`) : null,
      peppol_last_attempt_at: nowIso,
    };
    if (mapped === "sent") patch.peppol_sent_at = nowIso;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try full patch first; if peppol_sent_at column doesn't exist, retry without it.
    let { data, error: dbErr } = await supabase
      .from("order_invoices")
      .update(patch)
      .eq("peppol_document_id", document_id)
      .select("id, invoice_number, peppol_status");
    if (dbErr && String(dbErr.message).includes("peppol_sent_at")) {
      delete (patch as any).peppol_sent_at;
      ({ data, error: dbErr } = await supabase
        .from("order_invoices")
        .update(patch)
        .eq("peppol_document_id", document_id)
        .select("id, invoice_number, peppol_status"));
    }
    if (dbErr) {
      logFalco("error", "webhook_update_failed", { document_id, error: dbErr.message });
      return json(500, { error: "update_failed", details: dbErr.message });
    }

    const matched = (data || []).length;
    logFalco(matched === 0 ? "warn" : "info", "webhook_processed", {
      document_id,
      status: mapped,
      matched,
      invoice_ids: (data || []).map((r: any) => r.id),
    });

    return json(200, {
      ok: true,
      matched,
      status: mapped,
      invoices: (data || []).map((r: any) => ({ id: r.id, invoice_number: r.invoice_number, peppol_status: r.peppol_status })),
    });
  } catch (e) {
    console.error("[falco-webhook]", e);
    return json(500, { error: "internal_error", details: String((e as any)?.message || e) });
  }
});
