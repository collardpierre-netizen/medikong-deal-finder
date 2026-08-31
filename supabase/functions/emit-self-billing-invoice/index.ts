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
} from "../_shared/falco-peppol.ts";
import {
  getPeppolPrimaryFlow,
  vendorCopyGoesToPeppol,
  buildOrderInvoicePayloadParts,
  buildVendorCopyFalcoMetadata,
  assertPayloadMatchesInvoice,
  archivePeppolPayload,
  sha256Hex,
  logPeppolEvent,
} from "../_shared/peppol-flow.ts";


// MediKong SRL = legal issuer of every self-billing invoice on the marketplace.
// Point 1 (Sprint 3): unified Peppol sender for all self-billing dispatches.
const MEDIKONG_SELLER = {
  name: "MediKong SRL",
  vat_number: "BE1005771323",
  address: {
    line1: "23 rue de la Procession",
    zip: "7822",
    city: "Meslin-l'Évêque",
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

    // ── Orchestration Peppol (cf. PEPPOL_PRIMARY_FLOW).
    const primaryFlow = await getPeppolPrimaryFlow(supabase);
    const parts = buildOrderInvoicePayloadParts(lines as any[]);

    // FLUX A — double vendeur.
    let peppol: any = { attempted: false, primary_flow: primaryFlow };
    const falcoApiKey = (Deno.env.get("FALCO_API_KEY") || "").trim();
    const falcoAppSecret = (Deno.env.get("FALCO_APP_SECRET") || "").trim();

    if (!vendorCopyGoesToPeppol(primaryFlow)) {
      // Flux A rétrogradé en email + portail vendeur : tracé, jamais silencieux.
      await supabase.from("peppol_transmissions").insert({
        document_type: "order_invoice",
        order_invoice_id: upserted.id,
        flow: "vendor_copy",
        sender_kind: "medikong",
        sender_name_snapshot: MEDIKONG_SELLER.name,
        sender_vat_snapshot: MEDIKONG_SELLER.vat_number,
        receiver_kind: "vendor",
        receiver_id: vendor.id,
        receiver_peppol_id: vendor.peppol_id ?? null,
        receiver_name_snapshot: vendor.company_name || vendor.name,
        receiver_vat_snapshot: vendor.vat_number ?? null,
        channel: "email",
        status: "sent",
        submitted_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        pdf_storage_path: pdfPath,
      });
      await logPeppolEvent(supabase, "vendor_copy_downgraded_to_email", {
        targetId: upserted.id,
        detail: `PEPPOL_PRIMARY_FLOW=${primaryFlow}`,
        metadata: { vendor_id: vendor.id },
      });
      peppol = { attempted: false, downgraded_to_email: true, primary_flow: primaryFlow };
    } else if (!falcoApiKey || !falcoAppSecret) {
      const missing = [!falcoApiKey && "FALCO_API_KEY", !falcoAppSecret && "FALCO_APP_SECRET"].filter(Boolean).join(", ");
      const msg = `Peppol non envoyé : secret(s) manquant(s) — ${missing}. Ajoutez-le(s) dans Cloud → Secrets.`;
      console.error("[emit-self-billing-invoice][falco]", msg);
      await persistFalcoResult(supabase, upserted.id, {
        ok: false, http_status: 0, peppol_status: "failed", peppol_error: msg,
      });
      peppol = { attempted: false, ok: false, error: msg, missing_secrets: missing.split(", "), primary_flow: primaryFlow };
    } else if (isFalcoConfigured()) {
      try {
        // ── Contrôle de cohérence BLOQUANT (entiers, tolérance 0) avant tout appel réseau.
        const coherence = assertPayloadMatchesInvoice(parts, {
          amount_excl_vat: subtotal,
          vat_amount: vatAmt,
          amount_incl_vat: totalTtc,
        });
        if (!coherence.ok) {
          await persistFalcoResult(supabase, upserted.id, {
            ok: false, http_status: 0, peppol_status: "failed", peppol_error: coherence.error,
          });
          await logPeppolEvent(supabase, "vendor_copy_totals_mismatch", {
            targetId: upserted.id,
            detail: coherence.error,
            metadata: { vendor_id: vendor.id, stage: "pre_network_coherence" },
          });
          peppol = { attempted: false, ok: false, error: coherence.error, primary_flow: primaryFlow };
        } else {
        const mandateMention = buildSelfBillingMandateMention(vendor, vendor.mandate_signed_at);
        const metadata = buildVendorCopyFalcoMetadata({
          invoiceNumber,
          documentDate: new Date().toISOString().slice(0, 10),
          dueDate: new Date().toISOString().slice(0, 10),
          buyerReference: order.order_number || invoiceNumber,
          // Point 1: mandate mention required by BE self-billing regulation, embedded in UBL note.
          note: mandateMention,
          vendor,
          baseAmount: subtotal,
          totalAmount: totalTtc,
          parts,
        });

        // ── Archivage de ce qui est transmis (succès comme échec).
        const archive = await archivePeppolPayload(supabase, {
          flow: "vendor_copy",
          orderId: orderId,
          invoiceId: upserted.id,
          metadata,
        });
        const pdfSha = await sha256Hex(pdfBytes);

        const falcoRes = await submitInvoiceToFalco(pdfBytes, metadata, {
          pdfFilename: `${invoiceNumber}.pdf`,
          caller: "emit-self-billing-invoice",
          invoiceId: upserted.id,
        });

        await persistFalcoResult(supabase, upserted.id, falcoRes);
        const nowIso = new Date().toISOString();
        const txRow = {
          document_type: "order_invoice",
          order_invoice_id: upserted.id,
          flow: "vendor_copy",
          sender_kind: "medikong",
          sender_name_snapshot: MEDIKONG_SELLER.name,
          sender_vat_snapshot: MEDIKONG_SELLER.vat_number,
          receiver_kind: "vendor",
          receiver_id: vendor.id,
          receiver_peppol_id: vendor.peppol_id ?? null,
          receiver_name_snapshot: vendor.company_name || vendor.name,
          receiver_vat_snapshot: vendor.vat_number ?? null,
          channel: "peppol",
          status: falcoRes.ok ? "sent" : "failed",
          peppol_document_id: falcoRes.document_id ?? null,
          falco_import_id: falcoRes.document_id ?? null,
          payload_storage_path: archive.payload_storage_path,
          payload_sha256: archive.payload_sha256,
          pdf_storage_path: pdfPath,
          pdf_sha256: pdfSha,
          submitted_at: falcoRes.ok ? nowIso : null,
          last_attempt_at: nowIso,
          last_error: falcoRes.ok ? null : (falcoRes.peppol_error || `http_${falcoRes.http_status}`),
        };
        // Index unique partiel (order_invoice_id, flow, channel) → pas d'upsert PostgREST :
        // on met à jour la ligne existante, sinon on insère.
        const { data: existingTx } = await supabase
          .from("peppol_transmissions")
          .select("id")
          .eq("order_invoice_id", upserted.id)
          .eq("flow", "vendor_copy")
          .eq("channel", "peppol")
          .neq("status", "cancelled")
          .maybeSingle();
        if (existingTx?.id) {
          await supabase.from("peppol_transmissions").update(txRow).eq("id", existingTx.id);
        } else {
          await supabase.from("peppol_transmissions").insert(txRow);
        }


        peppol = {
          attempted: true,
          ok: falcoRes.ok,
          status: falcoRes.peppol_status,
          document_id: falcoRes.document_id,
          error: falcoRes.peppol_error,
          payload_sha256: archive.payload_sha256,
          primary_flow: primaryFlow,
        };
        }
      } catch (e) {
        console.error("[emit-self-billing-invoice][falco]", e);
        await persistFalcoResult(supabase, upserted.id, {
          ok: false, http_status: 0,
          peppol_status: "failed",
          peppol_error: String((e as any)?.message || e),
        });
        peppol = { attempted: true, ok: false, error: String((e as any)?.message || e), primary_flow: primaryFlow };
      }
    }


    // FLUX B — facture acheteur (best-effort : n'échoue jamais l'émission).
    let buyerPeppol: any = { attempted: true };
    try {
      const { data: bRes, error: bErr } = await supabase.functions.invoke("send-order-invoice-peppol", {
        body: { order_invoice_id: upserted.id },
      });
      buyerPeppol = bErr ? { attempted: true, ok: false, error: bErr.message ?? String(bErr) } : bRes;
    } catch (e) {
      buyerPeppol = { attempted: true, ok: false, error: String((e as any)?.message || e) };
    }

    return json(200, {
      ok: true,
      invoice_id: upserted.id,
      invoice_number: upserted.invoice_number,
      pdf_path: pdfPath,
      primary_flow: primaryFlow,
      peppol,
      buyer_peppol: buyerPeppol,
    });

  } catch (e) {
    console.error("[emit-self-billing-invoice]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
