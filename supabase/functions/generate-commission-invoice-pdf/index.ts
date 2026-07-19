// @ts-nocheck — Deno runtime
// Generate & store the PDF for a `commission_invoices` row (dashboard commissions).
// Payload: { invoice_id: string, force?: boolean }
// Auth: service_role or admin JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { buildCommissionPdf } from "../_shared/invoice-pdf.ts";

const BUCKET = "invoices";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
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
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (bearer !== serviceRole) {
      const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const { data: inv, error: invErr } = await supabase
      .from("commission_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr) return json(500, { error: "invoice_query_failed", details: invErr.message });
    if (!inv) return json(404, { error: "invoice_not_found" });

    if (inv.pdf_path && !force) {
      return json(200, { ok: true, idempotent: true, invoice_id: inv.id, pdf_path: inv.pdf_path });
    }

    const [{ data: vendor }, { data: order }, { data: lines }] = await Promise.all([
      supabase.from("vendors").select("id, name, company_name, vat_number, peppol_id, address_line1, city, postal_code, country_code")
        .eq("id", inv.vendor_id).maybeSingle(),
      inv.order_id
        ? supabase.from("orders").select("id, order_number, created_at").eq("id", inv.order_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("commission_invoice_lines").select("*").eq("commission_invoice_id", inv.id),
    ]);
    if (!vendor) return json(404, { error: "vendor_not_found" });

    const baseHt = Number(inv.revenue_excl_vat_cents || 0) / 100;
    const commissionHt = Number(inv.commission_excl_vat_cents || 0) / 100;
    const rate = baseHt > 0 ? (commissionHt / baseHt) * 100 : Number(lines?.[0]?.commission_rate ?? 0);

    const orderForPdf = order || {
      order_number: `${lines?.length ?? 0} ligne(s) — période ${inv.period_start} → ${inv.period_end}`,
      created_at: inv.created_at,
    };

    const { pdf } = buildCommissionPdf({
      order: orderForPdf,
      vendor,
      gmvExclVat: baseHt,
      commissionRate: rate,
      invoiceNumber: inv.invoice_number || `MK-COM-${inv.id.slice(0, 8)}`,
      paidAt: inv.invoiced_at ? new Date(inv.invoiced_at) : new Date(),
    });

    const pdfPath = `commission-invoices/${inv.id}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return json(500, { error: "upload_failed", details: upErr.message });

    const { error: dbErr } = await supabase.from("commission_invoices")
      .update({ pdf_path: pdfPath, pdf_generated_at: new Date().toISOString() })
      .eq("id", inv.id);
    if (dbErr) return json(500, { error: "invoice_update_failed", details: dbErr.message });

    return json(200, { ok: true, invoice_id: inv.id, pdf_path: pdfPath });
  } catch (e) {
    console.error("[generate-commission-invoice-pdf]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
