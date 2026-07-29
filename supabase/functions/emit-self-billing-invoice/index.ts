// @ts-nocheck — Deno runtime
// Generate & store the self-billing invoice (marketplace issues in the name of the vendor to the buyer).
// Payload: { order_id, vendor_id, paid_at? }
// Auth: service_role only (called by stripe-webhook) or admin caller.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { buildSelfBillingPdf, buildSelfBillingMandateMention } from "../_shared/invoice-pdf.ts";
import {
  submitInvoiceToFalco,
  persistFalcoResult,
  isFalcoConfigured,
  normalizeFalcoPeppolIdentifier,
  normalizeFalcoVatNumber,
  resolveFalcoPostalCode,
  type FalcoLine,
  type FalcoTaxSubtotal,
} from "../_shared/falco-peppol.ts";

// MediKong SRL = legal issuer of every self-billing invoice on the marketplace.
// Point 1 (Sprint 3): unified Peppol sender for all self-billing dispatches.
const MEDIKONG_SELLER = {
  name: "MediKong SRL",
  vat_number: "BE1005771323",
  address: {
    line1: "23 rue de la Procession",
    zip: "7822",
    city: "Ath",
    country: "BE",
  },
} as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "invoices";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authz: service_role (webhook) or admin
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "___");
    if (!isServiceRole) {
      const token = authHeader.replace("Bearer ", "");
      const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await user.auth.getClaims(token);
      const uid = claims?.claims?.sub;
      if (!uid) return json(401, { error: "unauthorized" });
      const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!adm) return json(403, { error: "forbidden" });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id as string;
    const vendorId = body?.vendor_id as string;
    const paidAtInput = body?.paid_at ? new Date(body.paid_at) : new Date();
    if (!orderId || !vendorId) return json(400, { error: "order_id_and_vendor_id_required" });

    // Idempotency
    const { data: existing } = await supabase
      .from("order_invoices")
      .select("id, pdf_path, invoice_number, status")
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId)
      .eq("type", "self_billing")
      .maybeSingle();
    if (existing && existing.pdf_path && existing.status !== "failed") {
      return json(200, { ok: true, idempotent: true, invoice_id: existing.id, invoice_number: existing.invoice_number });
    }

    const [{ data: order }, { data: vendor }] = await Promise.all([
      supabase.from("orders").select("id, order_number, created_at, status, customer_id, customers:customers!orders_customer_id_fkey(company_name, email, vat_number, address_line1, city, postal_code, country_code)").eq("id", orderId).maybeSingle(),
      supabase.from("vendors").select("id, name, company_name, email, vat_number, peppol_id, address_line1, city, postal_code, country_code, mandate_signed_at").eq("id", vendorId).maybeSingle(),
    ]);
    if (!order) return json(404, { error: "order_not_found" });
    if (!vendor) return json(404, { error: "vendor_not_found" });

    const { data: lines, error: lErr } = await supabase
      .from("order_lines")
      .select("quantity, unit_price_excl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat, manual_label, products(name)")
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId);
    if (lErr) return json(500, { error: "lines_fetch_failed", details: lErr.message });
    if (!lines || lines.length === 0) return json(400, { error: "no_lines_for_vendor" });

    const shortVendor = vendorId.replace(/-/g, "").slice(0, 6).toUpperCase();
    const invoiceNumber = `MK-SB-${order.order_number}-${shortVendor}`;
    const subtotal = lines.reduce((a: number, l: any) => a + Number(l.line_total_excl_vat || 0), 0);
    const totalTtc = lines.reduce((a: number, l: any) => a + Number(l.line_total_incl_vat || 0), 0);
    const vatAmt = totalTtc - subtotal;

    const pdfBytes = buildSelfBillingPdf({
      order,
      vendor,
      customer: order.customers || {},
      lines: lines.map((l: any) => ({
        name: l.manual_label || l.products?.name || "—",
        quantity: Number(l.quantity),
        unit_price_excl_vat: Number(l.unit_price_excl_vat),
        vat_rate: Number(l.vat_rate),
        line_total_excl_vat: Number(l.line_total_excl_vat),
        line_total_incl_vat: Number(l.line_total_incl_vat),
      })),
      invoiceNumber,
      paidAt: paidAtInput,
      mandateSignedAt: vendor.mandate_signed_at,
      isDraft: String(order.status || "").toLowerCase() === "draft",
    });

    const pdfPath = `${orderId}/self_billing-${vendorId}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return json(500, { error: "upload_failed", details: upErr.message });

    const { data: upserted, error: dbErr } = await supabase
      .from("order_invoices")
      .upsert({
        order_id: orderId,
        vendor_id: vendorId,
        type: "self_billing",
        invoice_number: invoiceNumber,
        status: "generated",
        amount_excl_vat: subtotal,
        vat_amount: vatAmt,
        amount_incl_vat: totalTtc,
        pdf_path: pdfPath,
        issued_at: new Date().toISOString(),
        paid_at: paidAtInput.toISOString(),
      }, { onConflict: "order_id,vendor_id,type" })
      .select("id, invoice_number")
      .single();
    if (dbErr) return json(500, { error: "invoice_insert_failed", details: dbErr.message });

    // Best-effort Peppol dispatch via Falco.
    let peppol: any = { attempted: false };
    const falcoApiKey = (Deno.env.get("FALCO_API_KEY") || "").trim();
    const falcoAppSecret = (Deno.env.get("FALCO_APP_SECRET") || "").trim();
    if (!falcoApiKey || !falcoAppSecret) {
      const missing = [!falcoApiKey && "FALCO_API_KEY", !falcoAppSecret && "FALCO_APP_SECRET"].filter(Boolean).join(", ");
      const msg = `Peppol non envoyé : secret(s) manquant(s) — ${missing}. Ajoutez-le(s) dans Cloud → Secrets.`;
      console.error("[emit-self-billing-invoice][falco]", msg);
      await persistFalcoResult(supabase, upserted.id, {
        ok: false, http_status: 0, peppol_status: "failed", peppol_error: msg,
      });
      peppol = { attempted: false, ok: false, error: msg, missing_secrets: missing.split(", ") };
    } else if (isFalcoConfigured()) {
      try {
        const cust: any = order.customers || {};
        const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

        // Aggregate tax subtotals by rate (mix of 6% meds / 21% OTC possible).
        const bucket = new Map<number, { base: number; tax: number }>();
        for (const l of lines as any[]) {
          const rate = Number(l.vat_rate || 0);
          const base = Number(l.line_total_excl_vat || 0);
          const tax = Number(l.line_total_incl_vat || 0) - base;
          const b = bucket.get(rate) || { base: 0, tax: 0 };
          b.base += base;
          b.tax += tax;
          bucket.set(rate, b);
        }
        const taxSubtotals: FalcoTaxSubtotal[] = Array.from(bucket.entries()).map(([rate, v]) => ({
          tax_rate: rate.toFixed(1),
          base_amount: round2(v.base),
          tax_amount: round2(v.tax),
          tax_regime: { type: "standard" },
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

        const mandateMention = buildSelfBillingMandateMention(vendor, vendor.mandate_signed_at);
        const falcoRes = await submitInvoiceToFalco(pdfBytes, {
          document_type: "sale_invoice",
          document_date: new Date().toISOString().slice(0, 10),
          due_date: new Date().toISOString().slice(0, 10),
          number: invoiceNumber,
          buyer_reference: order.order_number || invoiceNumber,
          // Point 1: mandate mention required by BE self-billing regulation, embedded in UBL note.
          note: mandateMention,
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
          base_amount: round2(subtotal),
          total_amount: round2(totalTtc),
          tax_subtotals: taxSubtotals,
          lines: falcoLines,
          send_peppol: true,
        }, { pdfFilename: `${invoiceNumber}.pdf`, caller: "emit-self-billing-invoice", invoiceId: upserted.id });

        await persistFalcoResult(supabase, upserted.id, falcoRes);
        peppol = {
          attempted: true,
          ok: falcoRes.ok,
          status: falcoRes.peppol_status,
          document_id: falcoRes.document_id,
          error: falcoRes.peppol_error,
        };
      } catch (e) {
        console.error("[emit-self-billing-invoice][falco]", e);
        await persistFalcoResult(supabase, upserted.id, {
          ok: false, http_status: 0,
          peppol_status: "failed",
          peppol_error: String((e as any)?.message || e),
        });
        peppol = { attempted: true, ok: false, error: String((e as any)?.message || e) };
      }
    }

    return json(200, {
      ok: true,
      invoice_id: upserted.id,
      invoice_number: upserted.invoice_number,
      pdf_path: pdfPath,
      peppol,
    });
  } catch (e) {
    console.error("[emit-self-billing-invoice]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
