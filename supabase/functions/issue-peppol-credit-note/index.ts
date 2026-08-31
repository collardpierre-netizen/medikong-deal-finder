// @ts-nocheck — Deno runtime
// Emit a Peppol credit note for an existing order_invoices row.
// Falco has no dedicated credit-note endpoint: we send a PDF credit note
// (negative amounts, document_type = sale_credit_note) through the same
// /invoices/imports/pdf entry point as regular invoices. Confirmed by Falco.
//
// Body: { invoice_id: string, invoice_type?: "order" | "commission", reason?: string }
// Auth: service_role or admin JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  submitInvoiceToFalco,
  isFalcoConfigured,
  logFalco,
  normalizeFalcoPeppolIdentifier,
  normalizeFalcoVatNumber,
  resolveFalcoPostalCode,
  type FalcoInvoiceMetadata,
  type FalcoLine,
  type FalcoTaxSubtotal,
} from "../_shared/falco-peppol.ts";
import { buildCreditNotePdf } from "../_shared/invoice-pdf.ts";

const MEDIKONG_SELLER = {
  name: "MediKong SRL",
  vat_number: "BE1005771323",
  address: { line1: "23 rue de la Procession", zip: "7822", city: "Meslin-l'Évêque", country: "BE" },
} as const;

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

const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth
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

    if (invoiceType !== "order") {
      // Le flux commission utilise le même moteur mais réutilise send-commission-invoice-peppol
      // pour la persistance. On documente le refus explicite plutôt qu'un fallback silencieux.
      return json(400, {
        ok: false,
        error: "unsupported_invoice_type",
        hint: "Seul invoice_type='order' est supporté par cette fonction.",
      });
    }

    // ── 1. Load invoice + related order/vendor/customer/lines ────────────────
    const { data: inv, error: invErr } = await supabase
      .from("order_invoices")
      .select("id, order_id, vendor_id, invoice_number, issued_at, peppol_document_id, peppol_status, credit_note_peppol_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr || !inv) return json(404, { error: "invoice_not_found" });

    if (!inv.peppol_document_id) {
      return json(422, { ok: false, error: "no_peppol_document", hint: "Facture jamais transmise à Falco." });
    }
    const status = String(inv.peppol_status || "").toLowerCase();
    if (!["sent", "submitted"].includes(status)) {
      return json(422, {
        ok: false,
        error: "invalid_status",
        hint: `peppol_status=${status} — avoir possible uniquement sur 'sent' ou 'submitted'.`,
      });
    }
    if (inv.credit_note_peppol_id) {
      return json(409, {
        ok: false,
        error: "already_credited",
        credit_note_peppol_id: inv.credit_note_peppol_id,
      });
    }

    const [{ data: order }, { data: vendor }] = await Promise.all([
      supabase.from("orders").select(
        "id, order_number, created_at, customers:customers!orders_customer_id_fkey(company_name, email, vat_number, address_line1, city, postal_code, country_code)"
      ).eq("id", inv.order_id).maybeSingle(),
      supabase.from("vendors").select(
        "id, name, company_name, email, vat_number, peppol_id, address_line1, city, postal_code, country_code, mandate_signed_at"
      ).eq("id", inv.vendor_id).maybeSingle(),
    ]);
    if (!order || !vendor) return json(404, { error: "order_or_vendor_not_found" });

    const { data: lines } = await supabase
      .from("order_lines")
      .select("quantity, unit_price_excl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat, manual_label, products(name)")
      .eq("order_id", inv.order_id)
      .eq("vendor_id", inv.vendor_id);
    if (!lines || lines.length === 0) return json(422, { error: "no_lines_to_credit" });

    // ── 2. Build credit note PDF ─────────────────────────────────────────────
    const creditNoteNumber = `${inv.invoice_number}-CN`;
    const issuedAt = new Date();
    const pdfLines = (lines as any[]).map((l: any) => ({
      name: l.manual_label || l.products?.name || "—",
      quantity: Number(l.quantity || 0),
      unit_price_excl_vat: Number(l.unit_price_excl_vat || 0),
      vat_rate: Number(l.vat_rate || 0),
      line_total_excl_vat: Number(l.line_total_excl_vat || 0),
      line_total_incl_vat: Number(l.line_total_incl_vat || 0),
    }));
    const { pdf, baseAmount, vatAmount, totalAmount } = buildCreditNotePdf({
      originalInvoiceNumber: inv.invoice_number,
      creditNoteNumber,
      reason,
      issuedAt,
      seller: {
        company_name: MEDIKONG_SELLER.name,
        address_line1: MEDIKONG_SELLER.address.line1,
        postal_code: MEDIKONG_SELLER.address.zip,
        city: MEDIKONG_SELLER.address.city,
        country_code: MEDIKONG_SELLER.address.country,
        vat_number: MEDIKONG_SELLER.vat_number,
      },
      buyer: vendor,
      order,
      lines: pdfLines,
    });

    // ── 3. Build Falco metadata (sale_credit_note, negative amounts) ─────────
    const bucket = new Map<number, { base: number; tax: number }>();
    for (const l of pdfLines) {
      const rate = l.vat_rate;
      const b = bucket.get(rate) || { base: 0, tax: 0 };
      b.base += -Math.abs(l.line_total_excl_vat);
      b.tax += -(Math.abs(l.line_total_incl_vat) - Math.abs(l.line_total_excl_vat));
      bucket.set(rate, b);
    }
    const tax_subtotals: FalcoTaxSubtotal[] = Array.from(bucket.entries()).map(([rate, v]) => ({
      tax_rate: rate.toFixed(1),
      base_amount: round2(v.base),
      tax_amount: round2(v.tax),
      tax_regime: { type: "standard" },
    }));
    const falcoLines: FalcoLine[] = pdfLines.map((l) => ({
      name: l.name.slice(0, 200),
      description: l.name.slice(0, 500),
      quantity: String(-Math.abs(l.quantity)),
      unit_price: round2(l.unit_price_excl_vat),
      tax_rate: l.vat_rate.toFixed(1),
      base_amount: round2(-Math.abs(l.line_total_excl_vat)),
      tax_regime_type: "standard",
    }));

    const metadata: FalcoInvoiceMetadata = {
      document_type: "sale_credit_note",
      document_date: issuedAt.toISOString().slice(0, 10),
      number: creditNoteNumber,
      buyer_reference: order.order_number || inv.invoice_number,
      note: `Annulation de la facture ${inv.invoice_number} — ${reason}`,
      sender: {
        name: MEDIKONG_SELLER.name,
        vat_number: MEDIKONG_SELLER.vat_number,
        address: { ...MEDIKONG_SELLER.address },
      },
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
      base_amount: round2(baseAmount),
      total_amount: round2(totalAmount),
      tax_subtotals,
      lines: falcoLines,
      send_peppol: true,
    };

    // ── 4. Submit to Falco via /invoices/imports/pdf ─────────────────────────
    const started = Date.now();
    const falcoRes = await submitInvoiceToFalco(pdf, metadata, {
      pdfFilename: `${creditNoteNumber}.pdf`,
      caller: "issue-peppol-credit-note",
      invoiceId: inv.id,
    });

    if (!falcoRes.ok) {
      logFalco("error", "credit_note_import_failed", {
        invoice_id: inv.id,
        latency_ms: Date.now() - started,
        http_status: falcoRes.http_status,
        error: falcoRes.peppol_error,
      });
      return json(502, {
        ok: false,
        error: "falco_credit_note_import_failed",
        http_status: falcoRes.http_status,
        details: falcoRes.peppol_error,
        raw: falcoRes.raw,
      });
    }

    const creditDocId = falcoRes.document_id || null;
    logFalco("info", "credit_note_ok", {
      invoice_id: inv.id,
      original_document_id: inv.peppol_document_id,
      credit_note_document_id: creditDocId,
      latency_ms: Date.now() - started,
    });

    // ── 5. Persist on order_invoices + history table ─────────────────────────
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      peppol_status: "credited",
      credited_at: nowIso,
      peppol_last_attempt_at: nowIso,
    };
    if (creditDocId) patch.credit_note_peppol_id = creditDocId;
    const { error: updErr } = await supabase.from("order_invoices").update(patch).eq("id", inv.id);
    if (updErr) logFalco("error", "credit_note_persist_failed", { invoice_id: inv.id, error: updErr.message });

    const { error: histErr } = await supabase.from("peppol_credit_notes").insert({
      invoice_id: inv.id,
      invoice_type: "order",
      invoice_number: inv.invoice_number,
      reason,
      falco_original_document_id: inv.peppol_document_id,
      falco_credit_note_id: creditDocId,
      falco_payload: falcoRes.raw ?? null,
      issued_by: issuedBy,
      issued_by_email: issuedByEmail,
    });
    if (histErr) console.error("[issue-peppol-credit-note] history_insert_failed", histErr);

    return json(200, {
      ok: true,
      invoice_id: inv.id,
      original_document_id: inv.peppol_document_id,
      credit_note_document_id: creditDocId,
      credit_note_number: creditNoteNumber,
      base_amount: baseAmount,
      total_amount: totalAmount,
    });
  } catch (e: any) {
    console.error("[issue-peppol-credit-note]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
