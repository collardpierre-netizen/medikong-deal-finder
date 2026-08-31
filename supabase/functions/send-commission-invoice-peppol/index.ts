// @ts-nocheck — Deno runtime
// Send a `commission_invoices` row to Peppol via Falco.
// Payload: { invoice_id: string, force?: boolean }
// Auth: service_role or admin JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  submitInvoiceToFalco, isFalcoConfigured,
  normalizeFalcoPeppolIdentifier, normalizeFalcoVatNumber, resolveFalcoPostalCode,
  markFalcoInvoicePaid, logFalco,
  type FalcoInvoiceMetadata,
} from "../_shared/falco-peppol.ts";

const BUCKET = "invoices";
const MEDIKONG_SELLER = {
  name: "MediKong SRL",
  vat_number: "BE1005771323",
  address: { line1: "23 rue de la Procession", zip: "7822", city: "Meslin-l'Évêque", country: "BE" },
} as const;

const TERMINAL_OK = new Set(["accepted", "delivered", "sent"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

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

    if (!isFalcoConfigured()) return json(400, { ok: false, error: "falco_not_configured" });

    const body = await req.json().catch(() => ({}));
    const invoiceId = body?.invoice_id as string;
    const force = body?.force === true;
    if (!invoiceId) return json(400, { error: "invoice_id_required" });

    let { data: inv } = await supabase.from("commission_invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!inv) return json(404, { error: "invoice_not_found" });

    // Auto-generate PDF if missing.
    if (!inv.pdf_path) {
      const { error: pdfErr } = await supabase.functions.invoke("generate-commission-invoice-pdf", {
        body: { invoice_id: invoiceId },
      });
      if (pdfErr) {
        console.error(`internal_invoke_failed: generate-commission-invoice-pdf — ${pdfErr.message ?? pdfErr}`);
        return json(502, { error: "pdf_generate_failed", details: pdfErr.message ?? String(pdfErr) });
      }
      const refetch = await supabase.from("commission_invoices").select("*").eq("id", invoiceId).maybeSingle();
      inv = refetch.data;
      if (!inv?.pdf_path) return json(400, { error: "pdf_still_missing" });
    }

    if (!force && TERMINAL_OK.has(String(inv.peppol_status || "").toLowerCase())) {
      return json(409, { ok: false, error: "already_sent", peppol_status: inv.peppol_status });
    }

    const { data: vendor } = await supabase.from("vendors")
      .select("id, name, company_name, vat_number, peppol_id, address_line1, city, postal_code, country_code")
      .eq("id", inv.vendor_id).maybeSingle();
    if (!vendor) return json(404, { error: "vendor_not_found" });

    const vendorIsBE = String(vendor.country_code || "").toUpperCase() === "BE";
    if (vendorIsBE && !vendor.peppol_id) {
      await supabase.from("commission_invoices").update({
        peppol_status: "blocked_missing_id",
        peppol_error: "Peppol ID manquant pour ce vendeur.",
        peppol_last_attempt_at: new Date().toISOString(),
      }).eq("id", inv.id);
      return json(422, { ok: false, error: "blocked_missing_peppol_id" });
    }

    const { data: order } = inv.order_id
      ? await supabase.from("orders").select("order_number").eq("id", inv.order_id).maybeSingle()
      : { data: null };
    const { data: pdf, error: pdfErr } = await supabase.storage.from(BUCKET).download(inv.pdf_path);
    if (pdfErr || !pdf) return json(500, { error: "pdf_download_failed", details: pdfErr?.message });
    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());

    const commissionHt = Number(inv.commission_excl_vat_cents || 0) / 100;
    const vat = Number(inv.vat_cents || 0) / 100;
    const commissionTtc = Number(inv.total_incl_vat_cents || 0) / 100;
    const buyerRef = order?.order_number || inv.invoice_number || inv.id.slice(0, 8);

    const metadata: FalcoInvoiceMetadata = {
      document_type: "sale_invoice",
      document_date: (inv.invoiced_at || inv.created_at || new Date().toISOString()).slice(0, 10),
      due_date: (inv.due_date || inv.invoiced_at || new Date().toISOString()).slice(0, 10),
      number: inv.invoice_number,
      buyer_reference: buyerRef,
      note: `MediKong marketplace commission (${inv.type}) — ${inv.orders_count} commande(s) / ${inv.lines_count} ligne(s).`,
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
      tax_subtotals: [{
        tax_rate: Number(inv.vat_rate || 21).toFixed(1),
        base_amount: round2(commissionHt),
        tax_amount: round2(vat),
        tax_regime: { type: "standard" },
      }],
      lines: [{
        name: `Commission MediKong (${inv.type})`,
        description: `Commission période ${inv.period_start} → ${inv.period_end}`,
        quantity: "1",
        unit_price: round2(commissionHt),
        tax_rate: Number(inv.vat_rate || 21).toFixed(1),
        base_amount: round2(commissionHt),
        tax_regime_type: "standard",
      }],
      send_peppol: true,
    };

    const falcoRes = await submitInvoiceToFalco(pdfBytes, metadata, {
      pdfFilename: `${inv.invoice_number}.pdf`,
      caller: "send-commission-invoice-peppol",
      invoiceId: inv.id,
    });

    await supabase.from("commission_invoices").update({
      peppol_status: falcoRes.peppol_status || (falcoRes.ok ? "sent" : "failed"),
      peppol_document_id: falcoRes.document_id ?? null,
      peppol_error: falcoRes.peppol_error ?? null,
      peppol_last_attempt_at: new Date().toISOString(),
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

    return json(falcoRes.ok ? 200 : 502, {
      ok: falcoRes.ok,
      invoice_id: inv.id,
      peppol_status: falcoRes.peppol_status,
      document_id: falcoRes.document_id,
      error: falcoRes.peppol_error,
    });
  } catch (e) {
    console.error("[send-commission-invoice-peppol]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
