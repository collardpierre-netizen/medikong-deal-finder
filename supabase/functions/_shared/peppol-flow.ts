// @ts-nocheck — Deno runtime
// Shared helpers for the Peppol flows (A = vendor copy, B = buyer invoice, C = commission).
// Nothing here builds UBL: Falco generates it from our PDF + JSON metadata.

import {
  normalizeFalcoPeppolIdentifier,
  normalizeFalcoVatNumber,
  resolveFalcoPostalCode,
  logFalco,
  type FalcoLine,
  type FalcoTaxSubtotal,
} from "./falco-peppol.ts";

export type PeppolPrimaryFlow = "buyer_invoice" | "vendor_copy" | "both";
export const PEPPOL_PRIMARY_FLOW_SETTING_KEY = "peppol_primary_flow";
export const PEPPOL_PRIMARY_FLOW_DEFAULT: PeppolPrimaryFlow = "vendor_copy";

const VALID_FLOWS: PeppolPrimaryFlow[] = ["buyer_invoice", "vendor_copy", "both"];

/**
 * Resolve PEPPOL_PRIMARY_FLOW without redeployment:
 *   1. admin_settings.peppol_primary_flow (editable from the admin UI)
 *   2. env PEPPOL_PRIMARY_FLOW
 *   3. default 'vendor_copy' (= current production behaviour, zero change)
 */
export async function getPeppolPrimaryFlow(supabase: any): Promise<PeppolPrimaryFlow> {
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("value_json")
      .eq("key", PEPPOL_PRIMARY_FLOW_SETTING_KEY)
      .maybeSingle();
    const raw = data?.value_json;
    const candidate = typeof raw === "string" ? raw : raw?.value;
    if (VALID_FLOWS.includes(candidate)) return candidate as PeppolPrimaryFlow;
  } catch (_e) {
    // fall through to env / default
  }
  const envValue = (Deno.env.get("PEPPOL_PRIMARY_FLOW") || "").trim();
  if (VALID_FLOWS.includes(envValue as PeppolPrimaryFlow)) return envValue as PeppolPrimaryFlow;
  return PEPPOL_PRIMARY_FLOW_DEFAULT;
}

export function vendorCopyGoesToPeppol(flow: PeppolPrimaryFlow): boolean {
  return flow === "vendor_copy" || flow === "both";
}
export function buyerInvoiceGoesToPeppol(flow: PeppolPrimaryFlow): boolean {
  return flow === "buyer_invoice" || flow === "both";
}

// ───────────────────────── directory status mapping ─────────────────────────
export type DirectoryStatus = "unknown" | "found" | "not_found" | "error";

/**
 * Single source of truth for mapping a check-peppol-directory response
 * to customers.peppol_directory_status.
 */
export function mapDirectoryStatus(res: any): DirectoryStatus {
  if (!res || res.ok !== true) return "error";
  if (res.registered === true) return "found";
  return "not_found";
}

// ───────────────────────── hashing / canonical payload ─────────────────────────
function sortValue(value: any): any {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, k) => {
        acc[k] = sortValue(value[k]);
        return acc;
      }, {});
  }
  return value;
}

/** Deterministic serialization (keys sorted) — what we archive & hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

export async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ───────────────────────── amount helpers ─────────────────────────
export const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export type OrderInvoicePayloadParts = {
  lines: FalcoLine[];
  tax_subtotals: FalcoTaxSubtotal[];
  base_amount: number;
  total_amount: number;
};

/**
 * Build the Falco `lines` + `tax_subtotals` for a self-billing invoice from the
 * order lines. Shared by emit-self-billing-invoice (flow A), retry job and
 * send-order-invoice-peppol (flow B) so both flows mirror the same PDF.
 */
export function buildOrderInvoicePayloadParts(orderLines: any[]): OrderInvoicePayloadParts {
  const bucket = new Map<number, { base: number; tax: number }>();
  let base = 0;
  let total = 0;
  for (const l of orderLines) {
    const rate = Number(l.vat_rate || 0);
    const lineBase = Number(l.line_total_excl_vat || 0);
    const lineTtc = Number(l.line_total_incl_vat || 0);
    const tax = lineTtc - lineBase;
    base += lineBase;
    total += lineTtc;
    const b = bucket.get(rate) || { base: 0, tax: 0 };
    b.base += lineBase;
    b.tax += tax;
    bucket.set(rate, b);
  }

  const tax_subtotals: FalcoTaxSubtotal[] = Array.from(bucket.entries()).map(([rate, v]) => ({
    tax_rate: rate.toFixed(1),
    base_amount: round2(v.base),
    tax_amount: round2(v.tax),
    tax_regime: { type: "standard" },
  }));

  const lines: FalcoLine[] = orderLines.map((l: any) => ({
    name: (l.manual_label || l.products?.name || "—").slice(0, 200),
    description: (l.manual_label || l.products?.name || "—").slice(0, 500),
    quantity: String(Number(l.quantity || 0)),
    unit_price: round2(Number(l.unit_price_excl_vat || 0)),
    tax_rate: Number(l.vat_rate || 0).toFixed(1),
    base_amount: round2(Number(l.line_total_excl_vat || 0)),
    tax_regime_type: "standard",
  }));

  return { lines, tax_subtotals, base_amount: base, total_amount: total };
}

/**
 * Blocking consistency check: the payload MUST reconcile with the invoice already
 * issued as PDF. Tolerance = 1 cent (rounding of per-line values).
 */
export function assertPayloadMatchesInvoice(
  parts: OrderInvoicePayloadParts,
  invoice: { amount_excl_vat: any; vat_amount: any; amount_incl_vat: any },
): { ok: true } | { ok: false; error: string } {
  const linesSum = parts.lines.reduce((a, l) => a + Number(l.base_amount), 0);
  const taxBase = parts.tax_subtotals.reduce((a, t) => a + Number(t.base_amount), 0);
  const taxSum = parts.tax_subtotals.reduce((a, t) => a + Number(t.tax_amount), 0);
  const invBase = Number(invoice.amount_excl_vat || 0);
  const invVat = Number(invoice.vat_amount || 0);
  const invTotal = Number(invoice.amount_incl_vat || 0);
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.01;

  if (!near(linesSum, invBase)) {
    return { ok: false, error: `lines_base_mismatch: lignes=${round2(linesSum)} facture=${round2(invBase)}` };
  }
  if (!near(taxBase, invBase)) {
    return { ok: false, error: `tax_base_mismatch: tva_base=${round2(taxBase)} facture=${round2(invBase)}` };
  }
  if (!near(taxSum, invVat)) {
    return { ok: false, error: `vat_mismatch: tva=${round2(taxSum)} facture=${round2(invVat)}` };
  }
  if (!near(invBase + invVat, invTotal)) {
    return { ok: false, error: `total_mismatch: HT+TVA=${round2(invBase + invVat)} TTC=${round2(invTotal)}` };
  }
  return { ok: true };
}

// ───────────────────────── party helpers ─────────────────────────
/** Legal identity of the vendor (never the anonymised marketplace label). */
export function vendorLegalName(vendor: any): string {
  return vendor?.company_name || vendor?.name || "—";
}

export function vendorFalcoParty(vendor: any) {
  return {
    name: vendorLegalName(vendor),
    vat_number: normalizeFalcoVatNumber(vendor?.vat_number),
    peppol_identifier: normalizeFalcoPeppolIdentifier(vendor?.peppol_id),
    contact: vendor?.email ? { email: vendor.email } : undefined,
    address: {
      line1: vendor?.address_line1 || "—",
      zip: resolveFalcoPostalCode(vendor),
      city: vendor?.city || undefined,
      country: vendor?.country_code || "BE",
    },
  };
}

export function customerFalcoParty(customer: any) {
  return {
    name: customer?.company_name || customer?.email || "—",
    vat_number: normalizeFalcoVatNumber(customer?.vat_number),
    peppol_identifier: normalizeFalcoPeppolIdentifier(customer?.peppol_id),
    contact: (customer?.einvoicing_email || customer?.email)
      ? { email: customer.einvoicing_email || customer.email }
      : undefined,
    address: {
      line1: customer?.address_line1 || "—",
      zip: resolveFalcoPostalCode(customer),
      city: customer?.city || undefined,
      country: customer?.country_code || "BE",
    },
  };
}

// ───────────────────────── audit logging ─────────────────────────
export type PeppolAuditAction =
  | "buyer_peppol_submitted"
  | "buyer_peppol_failed"
  | "buyer_email_fallback"
  | "buyer_peppol_delivered"
  | "vendor_copy_downgraded_to_email"
  | "peppol_directory_checked";

export async function logPeppolEvent(
  supabase: any,
  action: PeppolAuditAction,
  opts: { targetId?: string | null; detail?: string; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      action,
      module: "peppol",
      detail: opts.detail ?? null,
      target_type: "order_invoice",
      target_id: opts.targetId ?? null,
      entity_type: "peppol_transmission",
      entity_id: opts.targetId ?? null,
      metadata: opts.metadata ?? {},
    });
  } catch (e) {
    logFalco("warn", "audit_log_failed", { action, error: String((e as any)?.message || e) });
  }
}
