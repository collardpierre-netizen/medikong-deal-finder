// @ts-nocheck — Deno runtime
// Emit a Peppol credit note for an existing order_invoices row via Falco.
// Body: { invoice_id: string, reason?: string }
// Auth: service_role or admin JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { getFalcoConfig, isFalcoConfigured, logFalco } from "../_shared/falco-peppol.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    let issuedBy: string | null = null;
    let issuedByEmail: string | null = null;
    if (bearer !== serviceRole) {
      const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await user.auth.getClaims(bearer);
      const uid = claims?.claims?.sub;
      if (!uid) return json(401, { error: "unauthorized" });
      const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!adm) return json(403, { error: "forbidden" });
      issuedBy = uid;
      issuedByEmail = (claims?.claims?.email as string) || null;
    }

    if (!isFalcoConfigured()) return json(400, { ok: false, error: "falco_not_configured" });

    const body = await req.json().catch(() => ({}));
    const invoiceId = body?.invoice_id as string;
    const invoiceType = (body?.invoice_type === "commission" ? "commission" : "order") as "order" | "commission";
    const reason = (body?.reason as string) || "Annulation — avoir émis depuis MediKong";
    if (!invoiceId) return json(400, { error: "invoice_id_required" });

    const invoiceTable = invoiceType === "commission" ? "commission_invoices" : "order_invoices";
    const numberColumn = invoiceType === "commission" ? "invoice_number" : "invoice_number";
    const { data: inv, error: invErr } = await supabase
      .from(invoiceTable)
      .select(`id, ${numberColumn}, peppol_document_id, peppol_status`)
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr || !inv) return json(404, { error: "invoice_not_found" });

    if (!inv.peppol_document_id) {
      return json(422, { ok: false, error: "no_peppol_document", hint: "Facture jamais transmise à Falco." });
    }
    const status = String(inv.peppol_status || "").toLowerCase();
    if (!["sent", "submitted"].includes(status)) {
      return json(422, { ok: false, error: "invalid_status", hint: `peppol_status=${status} — avoir possible uniquement sur 'sent' ou 'submitted'.` });
    }

    const cfg = getFalcoConfig();
    const started = Date.now();
    const url = `${cfg.baseUrl}/documents/${inv.peppol_document_id}/credit-note`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Falco-Api-Key": cfg.apiKey,
        "X-Falco-App-Secret": cfg.appSecret,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        reason,
        date: new Date().toISOString().split("T")[0],
      }),
    });
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    if (!res.ok) {
      logFalco("error", "credit_note_failed", {
        invoice_id: inv.id,
        http_status: res.status,
        latency_ms: Date.now() - started,
        payload: typeof payload === "string" ? payload.slice(0, 500) : payload,
      });
      return json(502, {
        ok: false,
        error: "falco_credit_note_failed",
        http_status: res.status,
        details: payload,
      });
    }

    logFalco("info", "credit_note_ok", {
      invoice_id: inv.id,
      original_document_id: inv.peppol_document_id,
      latency_ms: Date.now() - started,
    });

    return json(200, {
      ok: true,
      invoice_id: inv.id,
      original_document_id: inv.peppol_document_id,
      credit_note: payload,
    });
  } catch (e: any) {
    console.error("[issue-peppol-credit-note]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
