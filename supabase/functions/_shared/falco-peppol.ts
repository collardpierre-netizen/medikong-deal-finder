// @ts-nocheck — Deno runtime
// Falco API helper: submit a PDF invoice + UBL metadata to Peppol via
// POST /invoices/imports/pdf (multipart/form-data).
// Docs: https://docs.falco-app.be/reference/post_invoices-imports-pdf.md
//
// Auth: two headers required — X-Falco-App-Secret (org-wide app secret) and
// X-Falco-Api-Key (per-client key). Both provided as edge-function secrets.
//
// Base URL selection:
//   FALCO_BASE_URL env override (recommended in production)
//   otherwise sandbox: https://api.sandbox.falco-app.be/v1

export type FalcoParty = {
  name: string;
  vat_number?: string | null;
  company_number?: string | null;
  peppol_identifier?: string | null;
  contact?: { name?: string; email?: string; phone?: string };
  address: {
    line1: string;
    zip?: string;
    city?: string;
    region?: string;
    country: string; // ISO2
  };
};

export type FalcoTaxSubtotal = {
  tax_rate: string;       // e.g. "21.0"
  base_amount: string;    // e.g. "1000.00"
  tax_amount: string;     // e.g. "210.00"
  tax_regime: { type: string; legal_exoneration_text?: string };
};

export type FalcoLine = {
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  base_amount: string;
  tax_regime_type: string;
  unit_of_measure?: string;
};

export type FalcoInvoiceMetadata = {
  document_type: "sale_invoice" | "sale_credit_note";
  document_date: string;    // YYYY-MM-DD
  due_date?: string;
  number: string;
  buyer_reference?: string;
  note?: string;
  sender: FalcoParty;
  receiver: FalcoParty;
  currency?: string;        // default EUR
  base_amount: string;
  total_amount: string;
  tax_subtotals: FalcoTaxSubtotal[];
  lines: FalcoLine[];
  send_peppol?: boolean;
  send_accounting?: boolean;
};

export type FalcoImportResult = {
  ok: boolean;
  http_status: number;
  document_id?: string;
  peppol_identifier?: string;
  peppol_status?: "submitted" | "failed";
  peppol_error?: string;
  raw?: unknown;
};

export function getFalcoConfig() {
  const appSecret = Deno.env.get("FALCO_APP_SECRET") || "";
  const apiKey = Deno.env.get("FALCO_API_KEY") || "";
  const baseUrl =
    Deno.env.get("FALCO_BASE_URL") || "https://api.sandbox.falco-app.be/v1";
  return { appSecret, apiKey, baseUrl };
}

export function isFalcoConfigured(): boolean {
  const { appSecret, apiKey } = getFalcoConfig();
  return Boolean(appSecret && apiKey);
}

/** One structured log line — safe to grep in Supabase edge-function logs. */
export function logFalco(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ tag: "falco", level, event, ts: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Submit PDF + metadata to Falco. Best-effort: never throws — returns structured result. */
export async function submitInvoiceToFalco(
  pdfBytes: Uint8Array,
  metadata: FalcoInvoiceMetadata,
  opts: { pdfFilename?: string; caller?: string; invoiceId?: string } = {},
): Promise<FalcoImportResult> {
  const { appSecret, apiKey, baseUrl } = getFalcoConfig();
  const caller = opts.caller || "unknown";
  const invoiceId = opts.invoiceId || null;
  const endpoint = "/invoices/imports/pdf";
  const environment = baseUrl.includes("sandbox") ? "sandbox" : "production";

  if (!appSecret || !apiKey) {
    logFalco("error", "credentials_missing", {
      caller,
      invoice_id: invoiceId,
      invoice_number: metadata.number,
      missing_secrets: [!apiKey && "FALCO_API_KEY", !appSecret && "FALCO_APP_SECRET"].filter(Boolean),
      environment,
    });
    return {
      ok: false,
      http_status: 0,
      peppol_status: "failed",
      peppol_error: "falco_credentials_missing",
    };
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([pdfBytes], { type: "application/pdf" }),
    opts.pdfFilename || `${metadata.number}.pdf`,
  );
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    "metadata.json",
  );

  const commonLog = {
    caller,
    invoice_id: invoiceId,
    invoice_number: metadata.number,
    document_type: metadata.document_type,
    environment,
    endpoint,
    base_url: baseUrl,
    pdf_bytes: pdfBytes.byteLength,
    total_amount: metadata.total_amount,
    currency: metadata.currency || "EUR",
    send_peppol: metadata.send_peppol ?? false,
  };

  logFalco("info", "request_start", commonLog);
  const startedAt = Date.now();

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "X-Falco-App-Secret": appSecret,
        "X-Falco-Api-Key": apiKey,
      },
      body: form,
    });

    const latencyMs = Date.now() - startedAt;
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    if (!res.ok) {
      const errMsg =
        (payload && typeof payload === "object" && (payload.detail || payload.title)) ||
        (typeof payload === "string" ? payload.slice(0, 500) : `HTTP ${res.status}`);
      logFalco("error", "request_failed", {
        ...commonLog,
        http_status: res.status,
        latency_ms: latencyMs,
        error: String(errMsg),
      });
      return {
        ok: false,
        http_status: res.status,
        peppol_status: "failed",
        peppol_error: String(errMsg),
        raw: payload,
      };
    }

    const doc = (payload || {}) as any;
    const peppol = doc.peppol_status || {};
    const peppolStatus = peppol.status;
    const peppolError = peppol.error_message;

    logFalco(peppolStatus === "failed" ? "warn" : "info", "request_success", {
      ...commonLog,
      http_status: res.status,
      latency_ms: latencyMs,
      document_id: doc.document_id,
      peppol_status: peppolStatus,
      peppol_identifier: peppol.peppol_identifier,
      peppol_error: peppolError,
    });

    return {
      ok: true,
      http_status: res.status,
      document_id: doc.document_id,
      peppol_identifier: peppol.peppol_identifier,
      peppol_status: peppolStatus,
      peppol_error: peppolError,
      raw: payload,
    };
  } catch (e) {
    const latencyMs = Date.now() - startedAt;
    const errStr = String((e as any)?.message || e);
    logFalco("error", "network_error", {
      ...commonLog,
      latency_ms: latencyMs,
      error: errStr,
    });
    return {
      ok: false,
      http_status: 0,
      peppol_status: "failed",
      peppol_error: `network_error: ${errStr}`,
    };

  }
}

/** Persist the outcome on order_invoices (best-effort). */
export async function persistFalcoResult(
  supabase: any,
  invoiceId: string,
  result: FalcoImportResult,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    peppol_last_attempt_at: nowIso,
    peppol_status: result.peppol_status || (result.ok ? "submitted" : "failed"),
    peppol_error: result.peppol_error || null,
  };
  if (result.document_id) patch.peppol_document_id = result.document_id;
  if (result.peppol_identifier) patch.peppol_identifier = result.peppol_identifier;
  if (result.ok && result.peppol_status === "submitted") patch.peppol_submitted_at = nowIso;

  const { error } = await supabase
    .from("order_invoices")
    .update(patch)
    .eq("id", invoiceId);
  if (error) {
    console.error("[falco] persistFalcoResult failed", error.message);
  }
}
