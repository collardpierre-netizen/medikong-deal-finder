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

export function normalizeFalcoVatNumber(value?: string | null): string | undefined {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return normalized || undefined;
}

export function normalizeFalcoPeppolIdentifier(value?: string | null): string | undefined {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return normalized || undefined;
}

export function resolveFalcoPostalCode(party: any): string | undefined {
  const explicit = String(party?.postal_code || party?.zip || "").trim();
  if (explicit) return explicit;
  const fromAddress = String(party?.address_line1 || party?.address?.line1 || "").match(/\b\d{4}\b/);
  return fromAddress?.[0];
}

/**
 * Strip characters that break fetch()'s ByteString header validation:
 * removes ALL control chars (incl. CR/LF/TAB/NUL) and any non-ASCII byte
 * (smart quotes, BOM, NBSP, …) that can leak in via copy-paste of secrets.
 */
function sanitizeHeaderValue(v: string): string {
  return (v || "")
    .replace(/^\uFEFF/, "")            // BOM
    .replace(/[\r\n\t\v\f\0]/g, "")    // control whitespace
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, "")      // non-printable / non-ASCII
    .trim();
}

const STRIP_CTRL_RE = /[\r\n\s\u0000-\u001F\u007F-\u009F]/g;

export function getFalcoConfig() {
  const appSecret = (Deno.env.get("FALCO_APP_SECRET") ?? "").replace(STRIP_CTRL_RE, "");
  const apiKey = (Deno.env.get("FALCO_API_KEY") ?? "").replace(STRIP_CTRL_RE, "");
  const baseUrl =
    (Deno.env.get("FALCO_BASE_URL") ?? "").replace(STRIP_CTRL_RE, "") ||
    "https://api.sandbox.falco-app.be/v1";

  if (!appSecret.startsWith("as_") || appSecret.length < 10) {
    throw new Error(
      `FALCO_APP_SECRET invalide — longueur: ${appSecret.length}, prefix: ${appSecret.substring(0, 4)}`,
    );
  }
  if (!apiKey.startsWith("sk_") || apiKey.length < 10) {
    throw new Error(
      `FALCO_API_KEY invalide — longueur: ${apiKey.length}, prefix: ${apiKey.substring(0, 4)}`,
    );
  }
  return { appSecret, apiKey, baseUrl };
}

export function isFalcoConfigured(): boolean {
  try {
    const { appSecret, apiKey } = getFalcoConfig();
    return Boolean(appSecret && apiKey);
  } catch {
    return false;
  }
}

/**
 * Falco API key must match `sk_{env}_{id}_{secret}` where env is `live` or `test`.
 * App secret must match `as_{env}_{id}_{secret}` where env is `live` or `test`.
 * Returns null when valid, or an error code
 * suitable for logging / returning to the caller (never leaks the secret).
 */
export const FALCO_API_KEY_PATTERN = /^sk_(live|test)_[A-Za-z0-9]+_[A-Za-z0-9]+$/;
// FALCO_APP_SECRET : validation loose côté client, format exact validé par Falco.
export const isValidAppSecret = (v: string) => v.trim().startsWith("as_") && v.trim().length > 10;

export function validateFalcoCredentials(
  apiKey: string,
  appSecret: string,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!apiKey) {
    return { ok: false, code: "api_key_missing", message: "FALCO_API_KEY is not set." };
  }
  if (!FALCO_API_KEY_PATTERN.test(apiKey)) {
    return {
      ok: false,
      code: "api_key_format_invalid",
      message: "FALCO_API_KEY format invalid (expected sk_{env}_{id}_{secret}).",
    };
  }
  if (!appSecret) {
    return { ok: false, code: "app_secret_missing", message: "FALCO_APP_SECRET is not set." };
  }
  if (!isValidAppSecret(appSecret)) {
    return {
      ok: false,
      code: "app_secret_format_invalid",
      message: "FALCO_APP_SECRET doit commencer par 'as_' et être suffisamment long.",
    };
  }
  return { ok: true };
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

  const credCheck = validateFalcoCredentials(apiKey, appSecret);
  if (!credCheck.ok) {
    logFalco("error", "credentials_invalid_format", {
      caller,
      invoice_id: invoiceId,
      invoice_number: metadata.number,
      code: credCheck.code,
      api_key_length: apiKey.length,
      app_secret_length: appSecret.length,
      environment,
    });
    return {
      ok: false,
      http_status: 0,
      peppol_status: "failed",
      peppol_error: `falco_${credCheck.code}`,
    };
  }


  const form = new FormData();
  form.append(
    "file",
    new Blob([pdfBytes], { type: "application/pdf" }),
    opts.pdfFilename || `${metadata.number}.pdf`,
  );
  form.append("metadata", JSON.stringify(metadata));

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
      const problem = payload && typeof payload === "object" ? payload as any : null;
      const errMsg =
        (problem && [problem.code, problem.title, problem.detail].filter(Boolean).join(" — ")) ||
        (problem && JSON.stringify(problem).slice(0, 500)) ||
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
    logFalco("error", "persist_failed", { invoice_id: invoiceId, error: error.message });
  } else {
    logFalco("info", "persist_ok", {
      invoice_id: invoiceId,
      peppol_status: patch.peppol_status,
      has_document_id: Boolean(patch.peppol_document_id),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Peppol receiver capability check (SMP discovery via Peppol Directory)
// ────────────────────────────────────────────────────────────────────────────
export type PeppolReceiverCheck = {
  registered: boolean;              // safe to send (found + doc type not explicitly unsupported)
  found_in_directory: boolean;      // participant listed in peppoldirectory
  document_type_supported?: boolean;// undefined = not exposed by directory (can't tell)
  message?: string;                 // human-readable reason when registered=false
  raw?: unknown;
};

/**
 * Best-effort pre-send check that the Peppol receiver is discoverable and
 * (when the directory exposes it) supports the Peppol BIS Billing 3.0 invoice
 * document type. Uses the public Peppol Directory JSON API — no auth needed.
 *
 * Returns registered=true when in doubt (directory reachable but doc types
 * not listed) to avoid false negatives blocking legitimate sends.
 */
export async function checkPeppolReceiverRegistered(
  peppolIdentifier?: string | null,
): Promise<PeppolReceiverCheck> {
  const id = normalizeFalcoPeppolIdentifier(peppolIdentifier || "");
  if (!id || !id.includes(":")) {
    return {
      registered: false,
      found_in_directory: false,
      message: "Identifiant Peppol invalide (attendu scheme:value, ex. 0208:BE0404014205).",
    };
  }
  const [scheme, ...rest] = id.split(":");
  const value = rest.join(":");
  const participant = `iso6523-actorid-upis::${scheme}:${value}`;
  const url = `https://directory.peppol.eu/search/1.0/json?participant=${encodeURIComponent(participant)}`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // Directory unreachable → do NOT block (fail-open). Falco will still gate.
      logFalco("warn", "peppol_directory_unavailable", { http_status: res.status, participant });
      return {
        registered: true,
        found_in_directory: false,
        message: `Peppol Directory indisponible (HTTP ${res.status}) — envoi tenté sans pré-vérification.`,
      };
    }
    const data = (await res.json().catch(() => null)) as any;
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    const hit = matches.find((m: any) => {
      const pid = m?.participantID || m?.participantId || {};
      return (
        String(pid?.scheme || "").toLowerCase() === scheme.toLowerCase() &&
        String(pid?.value || "").toLowerCase() === value.toLowerCase()
      );
    });
    if (!hit) {
      return {
        registered: false,
        found_in_directory: false,
        message: `Le destinataire ${scheme}:${value} n'est pas enregistré sur Peppol (absent de peppoldirectory.eu). Demandez au vendeur d'enregistrer son entreprise auprès d'un Access Point Peppol pour recevoir des factures.`,
        raw: data,
      };
    }

    // Optional: check that Peppol BIS Billing 3.0 invoice doc type is supported.
    const docTypes = Array.isArray(hit?.docTypes) ? hit.docTypes : [];
    let documentTypeSupported: boolean | undefined = undefined;
    if (docTypes.length > 0) {
      documentTypeSupported = docTypes.some((d: any) => {
        const v = String(d?.value || d?.id || "").toLowerCase();
        return v.includes("invoice") || v.includes("billing") || v.includes("crediтnote") || v.includes("creditnote");
      });
    }
    if (documentTypeSupported === false) {
      return {
        registered: false,
        found_in_directory: true,
        document_type_supported: false,
        message: `Destinataire enregistré sur Peppol mais ne supporte pas les factures (Peppol BIS Billing 3.0). Demandez au vendeur d'activer la réception des factures auprès de son Access Point.`,
        raw: hit,
      };
    }
    return {
      registered: true,
      found_in_directory: true,
      document_type_supported: documentTypeSupported,
      raw: hit,
    };
  } catch (e) {
    // Network error → fail-open (do not block a legitimate send).
    logFalco("warn", "peppol_directory_network_error", {
      participant,
      error: String((e as any)?.message || e),
    });
    return {
      registered: true,
      found_in_directory: false,
      message: "Peppol Directory injoignable — envoi tenté sans pré-vérification.",
    };
  }
}
