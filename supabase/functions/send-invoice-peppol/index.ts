// @ts-nocheck — Deno runtime
// Send a single stored invoice (self-billing or commission) to Peppol via Falco, targeted by invoice_id.
// Payload: { invoice_id: string, force?: boolean }
//   - Refuses to re-send if peppol_status is already 'accepted' / 'delivered' unless force=true.
// Auth: service_role, admin JWT, or shared CRON secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  submitInvoiceToFalco,
  persistFalcoResult,
  isFalcoConfigured,
  getFalcoConfig,
  logFalco,
  normalizeFalcoPeppolIdentifier,
  normalizeFalcoVatNumber,
  resolveFalcoPostalCode,
  checkPeppolReceiverRegistered,
  markFalcoInvoicePaid,
  type FalcoInvoiceMetadata,
  type FalcoLine,
  type FalcoTaxSubtotal,
} from "../_shared/falco-peppol.ts";
import { buildSelfBillingMandateMention } from "../_shared/invoice-pdf.ts";

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

// Statuses that mean "already delivered to Peppol network": don't re-send without explicit force.
const TERMINAL_OK_STATUSES = new Set(["accepted", "delivered", "sent"]);

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
    note: `MediKong marketplace commission for order ${order.order_number}.`,
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
        return json(401, { error: "unauthorized", hint: "missing_bearer_or_admin_jwt" });
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

    const body = await req.json().catch(() => ({}));
    const invoiceId = body?.invoice_id as string;
    const force = body?.force === true;
    if (!invoiceId) return json(400, { error: "invoice_id_required" });

    if (!isFalcoConfigured()) {
      logFalco("error", "send_skipped", { reason: "falco_not_configured", invoice_id: invoiceId });
      return json(400, { ok: false, error: "falco_not_configured", hint: "Configure FALCO_API_KEY and FALCO_APP_SECRET." });
    }

    let { data: inv, error: invErr } = await supabase
      .from("order_invoices")
      .select("id, order_id, vendor_id, type, invoice_number, pdf_path, amount_excl_vat, vat_amount, amount_incl_vat, issued_at, peppol_status, peppol_retry_count")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr) return json(500, { error: "invoice_query_failed", details: invErr.message });
    if (!inv) return json(404, { error: "invoice_not_found" });

    // Auto-regenerate PDF if missing (invoice row exists but pdf_path is null).
    if (!inv.pdf_path) {
      const emitFn = inv.type === "commission" ? "emit-commission-invoice" : "emit-self-billing-invoice";
      logFalco("warn", "pdf_missing_auto_regenerate", { invoice_id: inv.id, type: inv.type, emit_fn: emitFn });
      // Mark row as failed so the emit function actually regenerates (it early-returns when pdf_path exists AND status != 'failed').
      await supabase.from("order_invoices").update({ status: "failed" }).eq("id", inv.id);
      const { data: emitPayload, error: emitErr } = await supabase.functions.invoke(emitFn, {
        body: { order_id: inv.order_id, vendor_id: inv.vendor_id },
      });
      if (emitErr) {
        console.error(`internal_invoke_failed: ${emitFn} — ${emitErr.message ?? emitErr}`);
        return json(502, { error: "invoice_pdf_regenerate_failed", details: emitErr.message ?? String(emitErr) });
      }
      const refetch = await supabase
        .from("order_invoices")
        .select("id, order_id, vendor_id, type, invoice_number, pdf_path, amount_excl_vat, vat_amount, amount_incl_vat, issued_at, peppol_status, peppol_retry_count")
        .eq("id", invoiceId)
        .maybeSingle();
      inv = refetch.data as any;
      if (!inv?.pdf_path) return json(400, { error: "invoice_pdf_missing", hint: "PDF regeneration ran but pdf_path still null." });
    }

    if (!force && TERMINAL_OK_STATUSES.has(String(inv.peppol_status || "").toLowerCase())) {
      return json(409, {
        ok: false,
        error: "already_sent",
        peppol_status: inv.peppol_status,
        hint: "Pass { force: true } to re-send.",
      });
    }

    // Guard: Belgian vendor must have a peppol_id — refuse to submit otherwise.
    const { data: vendorCheck } = await supabase
      .from("vendors")
      .select("id, country_code, peppol_id, company_name")
      .eq("id", inv.vendor_id)
      .maybeSingle();
    const vendorIsBE = String(vendorCheck?.country_code || "").toUpperCase() === "BE";
    if (vendorIsBE && !vendorCheck?.peppol_id) {
      await supabase
        .from("order_invoices")
        .update({
          peppol_status: "blocked_missing_id",
          peppol_error: "Peppol ID manquant pour ce vendeur — compléter sa fiche.",
          peppol_last_attempt_at: new Date().toISOString(),
        })
        .eq("id", inv.id);
      logFalco("warn", "send_blocked_missing_peppol_id", {
        invoice_id: inv.id,
        vendor_id: inv.vendor_id,
        vendor_name: vendorCheck?.company_name || null,
      });
      return json(422, {
        ok: false,
        error: "blocked_missing_peppol_id",
        vendor_id: inv.vendor_id,
        hint: "Ajoutez le Peppol ID (0208:BEXXXXXXXXXXX) sur la fiche du vendeur avant d'envoyer.",
      });
    }

    // Guard Peppol Directory désactivé (Option A) : on laisse Falco gérer les
    // erreurs de livraison. Si le destinataire n'existe pas sur le réseau
    // Peppol, Falco renverra une erreur qui sera persistée en peppol_status='failed'
    // avec le message dans peppol_error via persistFalcoResult().


    const built = inv.type === "commission"
      ? await buildCommissionMetadata(supabase, inv)
      : await buildSelfBillingMetadata(supabase, inv);

    if ("error" in built) {
      await supabase.from("order_invoices").update({
        peppol_last_attempt_at: new Date().toISOString(),
        peppol_error: `send_build_failed: ${built.error}`,
      }).eq("id", inv.id);
      logFalco("error", "send_build_failed", { invoice_id: inv.id, type: inv.type, error: built.error });
      return json(422, { ok: false, error: "build_failed", details: built.error });
    }

    const cfg = getFalcoConfig();
    console.log("[send-invoice-peppol] config:", {
      appSecretPrefix: cfg.appSecret.substring(0, 6),
      appSecretLength: cfg.appSecret.length,
      apiKeyPrefix: cfg.apiKey.substring(0, 6),
      baseUrl: cfg.baseUrl,
    });

    const falcoRes = await submitInvoiceToFalco(built.pdfBytes, built.metadata, {
      pdfFilename: `${inv.invoice_number}.pdf`,
      caller: "send-invoice-peppol",
      invoiceId: inv.id,
    });
    await persistFalcoResult(supabase, inv.id, falcoRes);
    await supabase.from("order_invoices").update({
      peppol_retry_count: (inv.peppol_retry_count || 0) + 1,
    }).eq("id", inv.id);

    // NOTE: markFalcoInvoicePaid désactivé — la route /documents/{id}/payments
    // renvoie 404 (route non confirmée par Falco). Le "best-effort" masquait
    // silencieusement l'erreur. À réactiver quand Falco aura confirmé la route.
    if (falcoRes.ok && falcoRes.document_id) {
      logFalco("info", "mark_paid_suspended", {
        invoice_id: inv.id,
        document_id: falcoRes.document_id,
        reason: "awaiting_falco_route_confirmation",
      });
    }

    logFalco("info", "send_done", {
      invoice_id: inv.id,
      type: inv.type,
      ok: falcoRes.ok,
      peppol_status: falcoRes.peppol_status,
      document_id: falcoRes.document_id,
    });

    return json(falcoRes.ok ? 200 : 502, {
      ok: falcoRes.ok,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      type: inv.type,
      peppol_status: falcoRes.peppol_status,
      document_id: falcoRes.document_id,
      http_status: falcoRes.http_status,
      error: falcoRes.peppol_error,
    });
  } catch (error) {
    console.error("send-invoice-peppol error:", error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
