// @ts-nocheck — Deno runtime
// Point 3 (Sprint 3): Peppol retry job.
// Scans order_invoices where peppol_status = 'failed', peppol_last_attempt_at < now() - 1h,
// peppol_retry_count < 3, downloads the stored PDF, rebuilds the Falco metadata and re-submits.
// Auth: service_role (cron via pg_net) or admin caller.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  submitInvoiceToFalco,
  persistFalcoResult,
  isFalcoConfigured,
  logFalco,
  normalizeFalcoPeppolIdentifier,
  normalizeFalcoVatNumber,
  resolveFalcoPostalCode,
  type FalcoInvoiceMetadata,
  type FalcoLine,
  type FalcoTaxSubtotal,
} from "../_shared/falco-peppol.ts";
import { buildSelfBillingMandateMention } from "../_shared/invoice-pdf.ts";

const MAX_RETRIES = 3;
const RETRY_AFTER_MINUTES = 60;
const BATCH_LIMIT = 25;
const BUCKET = "invoices";

const MEDIKONG_SELLER = {
  name: "MediKong SRL",
  vat_number: "BE1005771323",
  address: { line1: "23 rue de la Procession", zip: "7822", city: "Ath", country: "BE" },
} as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

async function buildSelfBillingMetadata(supabase: any, invoice: any): Promise<{ pdfBytes: Uint8Array; metadata: FalcoInvoiceMetadata } | { error: string }> {
  const [{ data: order }, { data: vendor }] = await Promise.all([
    supabase.from("orders").select("id, order_number, created_at, customers:customers!orders_customer_id_fkey(company_name, email, vat_number, address_line1, city, postal_code, country_code)").eq("id", invoice.order_id).maybeSingle(),
    supabase.from("vendors").select("id, name, company_name, email, vat_number, peppol_id, address_line1, city, postal_code, country_code, mandate_signed_at").eq("id", invoice.vendor_id).maybeSingle(),
  ]);
  if (!order || !vendor) return { error: "order_or_vendor_not_found" };
  const { data: lines } = await supabase
    .from("order_lines")
    .select("quantity, unit_price_excl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat, manual_label, products(name)")
    .eq("order_id", invoice.order_id)
    .eq("vendor_id", invoice.vendor_id);
  if (!lines || lines.length === 0) return { error: "no_lines" };

  const { data: pdf, error: pdfErr } = await supabase.storage.from(BUCKET).download(invoice.pdf_path);
  if (pdfErr || !pdf) return { error: `pdf_download_failed: ${pdfErr?.message || "empty"}` };
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());

  const cust: any = order.customers || {};
  const bucket = new Map<number, { base: number; tax: number }>();
  for (const l of lines as any[]) {
    const rate = Number(l.vat_rate || 0);
    const base = Number(l.line_total_excl_vat || 0);
    const tax = Number(l.line_total_incl_vat || 0) - base;
    const b = bucket.get(rate) || { base: 0, tax: 0 };
    b.base += base; b.tax += tax;
    bucket.set(rate, b);
  }
  const tax_subtotals: FalcoTaxSubtotal[] = Array.from(bucket.entries()).map(([rate, v]) => ({
    tax_rate: rate.toFixed(1), base_amount: round2(v.base), tax_amount: round2(v.tax), tax_regime: { type: "standard" },
  }));
  const falcoLines: FalcoLine[] = (lines as any[]).map((l: any) => ({
    name: (l.manual_label || l.products?.name || "—").slice(0, 200),
    description: (l.manual_label || l.products?.name || "—").slice(0, 500),
    quantity: String(Number(l.quantity || 0)),
    unit_price: round2(Number(l.unit_price_excl_vat || 0)),
    tax_rate: Number(l.vat_rate || 0).toFixed(1),
    base_amount: round2(Number(l.line_total_excl_vat || 0)),
    tax_regime_type: "standard",
  }));

  const metadata: FalcoInvoiceMetadata = {
    document_type: "sale_invoice",
    document_date: (invoice.issued_at || new Date().toISOString()).slice(0, 10),
    due_date: (invoice.issued_at || new Date().toISOString()).slice(0, 10),
    number: invoice.invoice_number,
    buyer_reference: order.order_number || invoice.invoice_number,
    note: buildSelfBillingMandateMention(vendor, vendor.mandate_signed_at),
    sender: { name: MEDIKONG_SELLER.name, vat_number: MEDIKONG_SELLER.vat_number, address: { ...MEDIKONG_SELLER.address } },
    receiver: {
      name: vendor.company_name || vendor.name,
      vat_number: normalizeFalcoVatNumber(vendor.vat_number),
      peppol_identifier: normalizeFalcoPeppolIdentifier(vendor.peppol_id),
      contact: vendor.email ? { email: vendor.email } : undefined,
      address: {
        line1: vendor.address_line1 || "—",
        zip: resolveFalcoPostalCode(vendor),
        city: vendor.city || undefined,
        country: vendor.country_code || "BE",
      },
    },
    currency: "EUR",
    base_amount: round2(Number(invoice.amount_excl_vat || 0)),
    total_amount: round2(Number(invoice.amount_incl_vat || 0)),
    tax_subtotals,
    lines: falcoLines,
    send_peppol: true,
  };
  return { pdfBytes, metadata };
}

async function buildCommissionMetadata(supabase: any, invoice: any): Promise<{ pdfBytes: Uint8Array; metadata: FalcoInvoiceMetadata } | { error: string }> {
  const [{ data: order }, { data: vendor }] = await Promise.all([
    supabase.from("orders").select("id, order_number").eq("id", invoice.order_id).maybeSingle(),
    supabase.from("vendors").select("id, name, company_name, vat_number, peppol_id, address_line1, city, postal_code, country_code").eq("id", invoice.vendor_id).maybeSingle(),
  ]);
  if (!order || !vendor) return { error: "order_or_vendor_not_found" };
  const { data: pdf, error: pdfErr } = await supabase.storage.from(BUCKET).download(invoice.pdf_path);
  if (pdfErr || !pdf) return { error: `pdf_download_failed: ${pdfErr?.message || "empty"}` };
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());

  const commissionHt = Number(invoice.amount_excl_vat || 0);
  const vat = Number(invoice.vat_amount || 0);
  const commissionTtc = Number(invoice.amount_incl_vat || 0);

  const metadata: FalcoInvoiceMetadata = {
    document_type: "sale_invoice",
    document_date: (invoice.issued_at || new Date().toISOString()).slice(0, 10),
    due_date: (invoice.issued_at || new Date().toISOString()).slice(0, 10),
    number: invoice.invoice_number,
    buyer_reference: order.order_number || invoice.invoice_number,
    note: `MediKong marketplace commission (retry) for order ${order.order_number}.`,
    sender: { name: MEDIKONG_SELLER.name, vat_number: MEDIKONG_SELLER.vat_number, address: { ...MEDIKONG_SELLER.address } },
    receiver: {
      name: vendor.company_name || vendor.name,
      vat_number: normalizeFalcoVatNumber(vendor.vat_number),
      peppol_identifier: normalizeFalcoPeppolIdentifier(vendor.peppol_id),
      address: {
        line1: vendor.address_line1 || "—",
        zip: resolveFalcoPostalCode(vendor),
        city: vendor.city || undefined,
        country: vendor.country_code || "BE",
      },
    },
    currency: "EUR",
    base_amount: round2(commissionHt),
    total_amount: round2(commissionTtc),
    tax_subtotals: [{ tax_rate: "21.0", base_amount: round2(commissionHt), tax_amount: round2(vat), tax_regime: { type: "standard" } }],
    lines: [{
      name: "Commission marketplace MediKong",
      description: `Commission commande ${order.order_number}`,
      quantity: "1",
      unit_price: round2(commissionHt),
      tax_rate: "21.0",
      base_amount: round2(commissionHt),
      tax_regime_type: "standard",
    }],
    send_peppol: true,
  };
  return { pdfBytes, metadata };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: require Bearer CRON_SHARED_SECRET (used by pg_cron), OR service_role, OR admin JWT.
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const cronSecret = (Deno.env.get("CRON_SHARED_SECRET") || "").trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    const isCronCaller = !!cronSecret && bearer === cronSecret;
    const isServiceRole = !!serviceRole && bearer === serviceRole;

    if (!isCronCaller && !isServiceRole) {
      // Fallback: allow admin user JWT (but reject anon key / missing).
      if (!bearer || bearer === anonKey) {
        return json(401, { error: "unauthorized", hint: "missing_or_invalid_cron_secret" });
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

    if (!isFalcoConfigured()) {
      logFalco("error", "retry_skipped", { reason: "falco_not_configured" });
      return json(200, { ok: false, scanned: 0, retried: 0, error: "falco_not_configured" });
    }

    const cutoff = new Date(Date.now() - RETRY_AFTER_MINUTES * 60 * 1000).toISOString();
    const { data: candidates, error: qErr } = await supabase
      .from("order_invoices")
      .select("id, order_id, vendor_id, type, invoice_number, pdf_path, amount_excl_vat, vat_amount, amount_incl_vat, issued_at, peppol_retry_count")
      .eq("peppol_status", "failed")
      .lt("peppol_last_attempt_at", cutoff)
      .lt("peppol_retry_count", MAX_RETRIES)
      .not("pdf_path", "is", null)
      .order("peppol_last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_LIMIT);
    if (qErr) return json(500, { error: "query_failed", details: qErr.message });

    const results: any[] = [];
    for (const inv of candidates || []) {
      const built = inv.type === "commission"
        ? await buildCommissionMetadata(supabase, inv)
        : await buildSelfBillingMetadata(supabase, inv);

      if ("error" in built) {
        // Count attempt but keep failed; log reason.
        await supabase.from("order_invoices").update({
          peppol_retry_count: (inv.peppol_retry_count || 0) + 1,
          peppol_last_attempt_at: new Date().toISOString(),
          peppol_error: `retry_build_failed: ${built.error}`,
        }).eq("id", inv.id);
        logFalco("error", "retry_build_failed", { invoice_id: inv.id, type: inv.type, error: built.error });
        results.push({ id: inv.id, ok: false, error: built.error });
        continue;
      }

      const falcoRes = await submitInvoiceToFalco(built.pdfBytes, built.metadata, {
        pdfFilename: `${inv.invoice_number}.pdf`,
        caller: "retry-peppol-failed",
        invoiceId: inv.id,
      });
      await persistFalcoResult(supabase, inv.id, falcoRes);
      // Always bump retry counter.
      await supabase.from("order_invoices").update({
        peppol_retry_count: (inv.peppol_retry_count || 0) + 1,
      }).eq("id", inv.id);

      results.push({
        id: inv.id,
        type: inv.type,
        ok: falcoRes.ok,
        peppol_status: falcoRes.peppol_status,
        attempt: (inv.peppol_retry_count || 0) + 1,
        error: falcoRes.peppol_error,
      });
    }

    logFalco("info", "retry_batch_done", {
      scanned: (candidates || []).length,
      succeeded: results.filter((r) => r.ok && r.peppol_status !== "failed").length,
      failed: results.filter((r) => !r.ok || r.peppol_status === "failed").length,
    });

    return json(200, {
      ok: true,
      scanned: (candidates || []).length,
      results,
      cutoff,
      max_retries: MAX_RETRIES,
    });
  } catch (e) {
    console.error("[retry-peppol-failed]", e);
    return json(500, { error: "internal_error", details: String((e as any)?.message || e) });
  }
});
