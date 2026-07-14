// @ts-nocheck — Deno runtime
// Generate & store the commission invoice (MediKong → vendor) for a given order.
// Payload: { order_id, vendor_id, gmv_excl_vat?, commission_rate?, paid_at? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { buildCommissionPdf } from "../_shared/invoice-pdf.ts";
import {
  submitInvoiceToFalco,
  persistFalcoResult,
  isFalcoConfigured,
} from "../_shared/falco-peppol.ts";

// MediKong legal seller identity (Balooh SRL) — used as sender on commission invoices.
const MK_SELLER = {
  name: "Balooh SRL",
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

    // Authz: service_role or admin
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
    if (!orderId || !vendorId) return json(400, { error: "order_id_and_vendor_id_required" });
    const paidAt = body?.paid_at ? new Date(body.paid_at) : new Date();

    // Idempotency
    const { data: existing } = await supabase
      .from("order_invoices")
      .select("id, pdf_path, invoice_number, status")
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId)
      .eq("type", "commission")
      .maybeSingle();
    if (existing && existing.pdf_path && existing.status !== "failed") {
      return json(200, { ok: true, idempotent: true, invoice_id: existing.id, invoice_number: existing.invoice_number });
    }

    // Resolve order + vendor + lines + rate
    const [{ data: order }, { data: vendor }, { data: lines }] = await Promise.all([
      supabase.from("orders").select("id, order_number, created_at").eq("id", orderId).maybeSingle(),
      supabase.from("vendors").select("id, name, company_name, vat_number, address_line1, city, postal_code, country_code, commission_rate").eq("id", vendorId).maybeSingle(),
      supabase.from("order_lines").select("line_total_excl_vat, commission_rate, commission_amount").eq("order_id", orderId).eq("vendor_id", vendorId),
    ]);
    if (!order) return json(404, { error: "order_not_found" });
    if (!vendor) return json(404, { error: "vendor_not_found" });
    if (!lines || lines.length === 0) return json(400, { error: "no_lines_for_vendor" });

    const gmvExclVat = Number(body?.gmv_excl_vat)
      || lines.reduce((a: number, l: any) => a + Number(l.line_total_excl_vat || 0), 0);

    // Prefer explicit body rate; else the effective rate from order_lines (fallback to vendor.commission_rate)
    let commissionRate = Number(body?.commission_rate);
    if (!Number.isFinite(commissionRate) || commissionRate <= 0) {
      const lineRates = lines.map((l: any) => Number(l.commission_rate)).filter((n: number) => Number.isFinite(n) && n > 0);
      commissionRate = lineRates.length
        ? lineRates.reduce((a: number, b: number) => a + b, 0) / lineRates.length
        : Number(vendor.commission_rate || 0);
    }

    const shortVendor = vendorId.replace(/-/g, "").slice(0, 6).toUpperCase();
    const invoiceNumber = `MK-COM-${order.order_number}-${shortVendor}`;

    const { pdf, commissionHt, vat, commissionTtc } = buildCommissionPdf({
      order, vendor, gmvExclVat, commissionRate, invoiceNumber, paidAt,
    });

    const pdfPath = `${orderId}/commission-${vendorId}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return json(500, { error: "upload_failed", details: upErr.message });

    const { data: upserted, error: dbErr } = await supabase
      .from("order_invoices")
      .upsert({
        order_id: orderId,
        vendor_id: vendorId,
        type: "commission",
        invoice_number: invoiceNumber,
        status: "generated",
        amount_excl_vat: commissionHt,
        vat_amount: vat,
        amount_incl_vat: commissionTtc,
        pdf_path: pdfPath,
        issued_at: new Date().toISOString(),
        paid_at: paidAt.toISOString(),
      }, { onConflict: "order_id,vendor_id,type" })
      .select("id, invoice_number")
      .single();
    if (dbErr) return json(500, { error: "invoice_insert_failed", details: dbErr.message });

    return json(200, {
      ok: true,
      invoice_id: upserted.id,
      invoice_number: upserted.invoice_number,
      commission_ht: commissionHt,
      vat, commission_ttc: commissionTtc,
      commission_rate: commissionRate,
      pdf_path: pdfPath,
    });
  } catch (e) {
    console.error("[emit-commission-invoice]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
