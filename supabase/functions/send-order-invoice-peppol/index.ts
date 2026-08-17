// @ts-nocheck — Deno runtime
// FLUX B — transmission de la facture de vente à l'ACHETEUR sur le réseau Peppol.
// Payload: { order_invoice_id: uuid, force?: boolean }
// Auth: service_role or admin JWT.
//
// Ne modifie ni emit-self-billing-invoice, ni les colonnes peppol_* de
// order_invoices (qui appartiennent au flux A / double vendeur).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  submitInvoiceToFalco,
  isFalcoConfigured,
  logFalco,
  type FalcoInvoiceMetadata,
} from "../_shared/falco-peppol.ts";
import { buildSelfBillingMandateMention } from "../_shared/invoice-pdf.ts";
import {
  getPeppolPrimaryFlow,
  buyerInvoiceGoesToPeppol,
  buildOrderInvoicePayloadParts,
  assertPayloadMatchesInvoice,
  customerFalcoParty,
  vendorFalcoParty,
  archivePeppolPayload,
  sha256Hex,
  round2,
  mapDirectoryStatus,
  logPeppolEvent,
} from "../_shared/peppol-flow.ts";

const BUCKET = "invoices";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ACTIVE_STATUSES = ["sending", "sent", "delivered"];

async function emailFallback(supabase: any, invoice: any, reason: string) {
  let emailOk = false;
  let emailError: string | null = null;
  try {
    const { error } = await supabase.functions.invoke("send-invoices-email", {
      body: { order_id: invoice.order_id },
    });
    if (error) emailError = error.message ?? String(error);
    else emailOk = true;
  } catch (e) {
    emailError = String((e as any)?.message || e);
  }

  const { data: row } = await supabase
    .from("peppol_transmissions")
    .insert({
      document_type: "order_invoice",
      order_invoice_id: invoice.id,
      flow: "buyer_invoice",
      sender_kind: "vendor",
      receiver_kind: "customer",
      receiver_id: invoice.__customer_id,
      receiver_name_snapshot: invoice.__customer?.company_name ?? null,
      receiver_vat_snapshot: invoice.__customer?.vat_number ?? null,
      receiver_peppol_id: invoice.__customer?.peppol_id ?? null,
      channel: "email",
      status: emailOk ? "sent" : "failed",
      last_error: emailOk ? null : `email_fallback_failed: ${emailError} (${reason})`,
      submitted_at: emailOk ? new Date().toISOString() : null,
      last_attempt_at: new Date().toISOString(),
      pdf_storage_path: invoice.pdf_path ?? null,
    })
    .select("id")
    .maybeSingle();

  await logPeppolEvent(supabase, "buyer_email_fallback", {
    targetId: invoice.id,
    detail: reason,
    metadata: { transmission_id: row?.id ?? null, email_ok: emailOk, email_error: emailError },
  });

  return { channel: "email", status: emailOk ? "sent" : "failed", transmission_id: row?.id ?? null, reason, email_error: emailError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── auth: service_role or admin
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    let actorUserId: string | null = null;
    if (bearer !== serviceRole) {
      if (!bearer || bearer === anonKey) return json(401, { error: "unauthorized" });
      const user = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await user.auth.getClaims(bearer);
      const uid = claims?.claims?.sub;
      if (!uid) return json(401, { error: "unauthorized" });
      const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!adm) return json(403, { error: "forbidden" });
      actorUserId = String(uid);
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.order_invoice_id || "").trim();
    const force = body?.force === true;
    // Campagne de tests sandbox (LOT 3) : permet de jouer le Flux B sans jamais
    // toucher à la valeur persistée de peppol_primary_flow. Réservé aux
    // enregistrements de test (garde en dur sur customers.is_test).
    const forceFlow = String(body?.force_flow || "").trim();
    if (forceFlow && forceFlow !== "buyer_invoice") {
      return json(400, { error: "force_flow_invalid", details: "only 'buyer_invoice' is supported" });
    }
    if (!invoiceId) return json(400, { error: "order_invoice_id_required" });

    // ── load invoice + order + vendor + customer
    const { data: invoice } = await supabase
      .from("order_invoices")
      .select("id, order_id, vendor_id, invoice_number, status, type, pdf_path, amount_excl_vat, vat_amount, amount_incl_vat, issued_at")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return json(404, { error: "invoice_not_found" });
    if (!invoice.invoice_number) return json(400, { error: "invoice_number_missing" });
    if (String(invoice.status || "").toLowerCase() === "draft") return json(400, { error: "invoice_is_draft" });
    if (!invoice.pdf_path) return json(400, { error: "pdf_missing" });

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, customer_id")
      .eq("id", invoice.order_id)
      .maybeSingle();
    if (!order?.customer_id) return json(400, { error: "order_or_customer_missing" });

    const [{ data: customer }, { data: vendor }] = await Promise.all([
      supabase.from("customers")
        .select("id, company_name, email, vat_number, address_line1, city, postal_code, country_code, payment_terms_days, peppol_id, peppol_directory_status, einvoicing_channel, einvoicing_email, is_test")
        .eq("id", order.customer_id).maybeSingle(),
      supabase.from("vendors")
        .select("id, name, company_name, email, vat_number, address_line1, city, postal_code, country_code, mandate_signed_at")
        .eq("id", invoice.vendor_id).maybeSingle(),
    ]);
    if (!customer) return json(404, { error: "customer_not_found" });
    if (!vendor) return json(404, { error: "vendor_not_found" });

    invoice.__customer = customer;
    invoice.__customer_id = customer.id;

    // ── garde force_flow : uniquement sur un client marqué de test, et journalisée.
    if (forceFlow) {
      if (customer.is_test !== true) {
        return json(403, { error: "force_flow_requires_test_customer" });
      }
      await logPeppolEvent(supabase, "buyer_peppol_force_flow_used", {
        targetId: invoice.id,
        detail: `force_flow=${forceFlow} (client de test)`,
        metadata: {
          actor_user_id: actorUserId,
          via: actorUserId ? "admin" : "service_role",
          customer_id: customer.id,
          invoice_number: invoice.invoice_number,
        },
      });
    }


    // ── idempotence (garde la plus importante du lot)
    const { data: existing } = await supabase
      .from("peppol_transmissions")
      .select("id, status, channel, peppol_document_id")
      .eq("order_invoice_id", invoice.id)
      .eq("flow", "buyer_invoice")
      .in("status", ACTIVE_STATUSES);

    if (existing && existing.length > 0) {
      if (!force) {
        return json(200, {
          ok: true,
          already_sent: true,
          transmissions: existing,
        });
      }
      await supabase
        .from("peppol_transmissions")
        .update({ status: "cancelled" })
        .in("id", existing.map((r: any) => r.id));
    }

    // force_flow n'écrit jamais le réglage persisté : override en mémoire uniquement.
    const primaryFlow = forceFlow ? forceFlow : await getPeppolPrimaryFlow(supabase);

    // ── résolution du canal
    let channel: "peppol" | "email" = "email";
    let reason = "no_peppol_id";
    let directoryStatus = String(customer.peppol_directory_status || "unknown");

    if (!buyerInvoiceGoesToPeppol(primaryFlow)) {
      reason = `primary_flow_${primaryFlow}`;
    } else if (!customer.peppol_id) {
      reason = "no_peppol_id";
    } else if (customer.einvoicing_channel === "email") {
      reason = "channel_email_only";
    } else if (directoryStatus === "found") {
      channel = "peppol";
    } else if (directoryStatus === "unknown" || directoryStatus === "error") {
      // lookup à la volée
      let lookup: any = null;
      try {
        const { data, error } = await supabase.functions.invoke("check-peppol-directory", {
          body: { peppol_id: customer.peppol_id },
        });
        lookup = error ? { ok: false, error: error.message } : data;
      } catch (e) {
        lookup = { ok: false, error: String((e as any)?.message || e) };
      }
      directoryStatus = mapDirectoryStatus(lookup);
      await supabase.from("customers").update({
        peppol_directory_status: directoryStatus,
        peppol_last_checked_at: new Date().toISOString(),
        peppol_verified_at: directoryStatus === "found" ? new Date().toISOString() : null,
      }).eq("id", customer.id);
      await logPeppolEvent(supabase, "peppol_directory_checked", {
        targetId: invoice.id,
        detail: `${customer.peppol_id} → ${directoryStatus}`,
        metadata: { lookup },
      });
      if (directoryStatus === "found") channel = "peppol";
      else reason = `directory_${directoryStatus}`;
    } else {
      reason = "directory_not_found";
    }

    if (channel === "email") {
      const fallback = await emailFallback(supabase, invoice, reason);
      return json(200, { ok: true, primary_flow: primaryFlow, ...fallback });
    }

    if (!isFalcoConfigured()) {
      const fallback = await emailFallback(supabase, invoice, "falco_not_configured");
      return json(200, { ok: true, primary_flow: primaryFlow, ...fallback });
    }

    // ── payload : miroir exact du PDF déjà émis
    const { data: orderLines, error: lErr } = await supabase
      .from("order_lines")
      .select("quantity, unit_price_excl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat, manual_label, products(name)")
      .eq("order_id", invoice.order_id)
      .eq("vendor_id", invoice.vendor_id);
    if (lErr) return json(500, { error: "lines_fetch_failed", details: lErr.message });
    if (!orderLines || orderLines.length === 0) return json(400, { error: "no_lines_for_vendor" });

    const parts = buildOrderInvoicePayloadParts(orderLines as any[]);

    // ── PDF (téléchargé avant le contrôle : on archive aussi les échecs)
    const { data: pdf, error: pdfErr } = await supabase.storage.from(BUCKET).download(invoice.pdf_path);
    if (pdfErr || !pdf) return json(500, { error: "pdf_download_failed", details: pdfErr?.message });
    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
    const pdfSha = await sha256Hex(pdfBytes);

    const coherence = assertPayloadMatchesInvoice(parts, invoice);
    if (!coherence.ok) {
      // Échec AVANT tout appel réseau : on ne transmet jamais un document incohérent.
      const failedArchive = await archivePeppolPayload(supabase, {
        flow: "buyer_invoice",
        orderId: invoice.order_id,
        invoiceId: invoice.id,
        metadata: {
          stage: "pre_network_coherence",
          error: coherence.error,
          lines: parts.lines,
          tax_subtotals: parts.tax_subtotals,
          invoice_totals: {
            amount_excl_vat: invoice.amount_excl_vat,
            vat_amount: invoice.vat_amount,
            amount_incl_vat: invoice.amount_incl_vat,
          },
        },
      });
      const { data: row } = await supabase.from("peppol_transmissions").insert({
        document_type: "order_invoice",
        order_invoice_id: invoice.id,
        flow: "buyer_invoice",
        sender_kind: "vendor",
        sender_name_snapshot: vendor.company_name || vendor.name,
        sender_vat_snapshot: vendor.vat_number ?? null,
        receiver_kind: "customer",
        receiver_id: customer.id,
        receiver_peppol_id: customer.peppol_id,
        receiver_name_snapshot: customer.company_name ?? null,
        receiver_vat_snapshot: customer.vat_number ?? null,
        channel: "peppol",
        status: "failed",
        last_error: coherence.error,
        last_attempt_at: new Date().toISOString(),
        retry_count: 1,
        payload_storage_path: failedArchive.payload_storage_path,
        payload_sha256: failedArchive.payload_sha256,
        pdf_storage_path: invoice.pdf_path,
        pdf_sha256: pdfSha,
      }).select("id").maybeSingle();
      await logPeppolEvent(supabase, "buyer_peppol_failed", {
        targetId: invoice.id,
        detail: coherence.error,
        metadata: { transmission_id: row?.id ?? null, stage: "pre_network_coherence", admin_alert: true },
      });
      // Fallback email : l'acheteur reçoit sa facture malgré l'échec de construction.
      const fallback = await emailFallback(supabase, invoice, coherence.error);
      return json(422, {
        ok: false,
        error: "totals_mismatch",
        details: coherence.error,
        transmission_id: row?.id ?? null,
        fallback,
      });
    }

    const issuedAt = (invoice.issued_at || new Date().toISOString()).slice(0, 10);
    const terms = Number(customer.payment_terms_days || 0);
    const dueDate = new Date(new Date(issuedAt).getTime() + terms * 86400000).toISOString().slice(0, 10);

    const metadata: FalcoInvoiceMetadata = {
      document_type: "sale_invoice",
      document_date: issuedAt,
      due_date: dueDate,
      number: invoice.invoice_number, // aucun suffixe (décision 2)
      buyer_reference: order.order_number || invoice.invoice_number,
      note: buildSelfBillingMandateMention(vendor, vendor.mandate_signed_at),
      sender: vendorFalcoParty(vendor),   // self-billing : émetteur = le vendeur
      receiver: customerFalcoParty(customer),
      currency: "EUR",
      base_amount: round2(Number(invoice.amount_excl_vat || 0)),
      total_amount: round2(Number(invoice.amount_incl_vat || 0)),
      tax_subtotals: parts.tax_subtotals,
      lines: parts.lines,
      send_peppol: true,
    };

    // ── archivage de ce que nous transmettons (décision 3)
    const { payload_storage_path: payloadPath, payload_sha256: payloadSha } = await archivePeppolPayload(
      supabase,
      { flow: "buyer_invoice", orderId: invoice.order_id, invoiceId: invoice.id, metadata },
    );


    const { data: tx, error: txErr } = await supabase.from("peppol_transmissions").insert({
      document_type: "order_invoice",
      order_invoice_id: invoice.id,
      flow: "buyer_invoice",
      sender_kind: "vendor",
      sender_name_snapshot: vendor.company_name || vendor.name,
      sender_vat_snapshot: vendor.vat_number ?? null,
      receiver_kind: "customer",
      receiver_id: customer.id,
      receiver_peppol_id: customer.peppol_id,
      receiver_name_snapshot: customer.company_name ?? null,
      receiver_vat_snapshot: customer.vat_number ?? null,
      channel: "peppol",
      status: "sending",
      payload_storage_path: payloadPath,
      payload_sha256: payloadSha,
      pdf_storage_path: invoice.pdf_path,
      pdf_sha256: pdfSha,
      last_attempt_at: new Date().toISOString(),
    }).select("id, retry_count").maybeSingle();
    if (txErr) return json(500, { error: "transmission_insert_failed", details: txErr.message });

    const falcoRes = await submitInvoiceToFalco(pdfBytes, metadata, {
      pdfFilename: `${invoice.invoice_number}.pdf`,
      caller: "send-order-invoice-peppol",
      invoiceId: invoice.id,
    });

    const nowIso = new Date().toISOString();
    if (falcoRes.ok) {
      await supabase.from("peppol_transmissions").update({
        status: "sent",
        peppol_document_id: falcoRes.document_id ?? null,
        falco_import_id: falcoRes.document_id ?? null,
        submitted_at: nowIso,
        last_attempt_at: nowIso,
        last_error: null,
      }).eq("id", tx.id);
      await logPeppolEvent(supabase, "buyer_peppol_submitted", {
        targetId: invoice.id,
        detail: `${invoice.invoice_number} → ${customer.peppol_id}`,
        metadata: { transmission_id: tx.id, document_id: falcoRes.document_id, primary_flow: primaryFlow },
      });
      return json(200, {
        ok: true,
        primary_flow: primaryFlow,
        channel: "peppol",
        status: "sent",
        transmission_id: tx.id,
        document_id: falcoRes.document_id,
      });
    }

    // échec réseau / rejet Falco → fallback email systématique
    await supabase.from("peppol_transmissions").update({
      status: "failed",
      last_error: falcoRes.peppol_error || `http_${falcoRes.http_status}`,
      last_attempt_at: nowIso,
      retry_count: (tx.retry_count || 0) + 1,
    }).eq("id", tx.id);
    await logPeppolEvent(supabase, "buyer_peppol_failed", {
      targetId: invoice.id,
      detail: falcoRes.peppol_error || `http_${falcoRes.http_status}`,
      metadata: { transmission_id: tx.id, http_status: falcoRes.http_status, primary_flow: primaryFlow },
    });
    logFalco("error", "buyer_flow_failed", { invoice_id: invoice.id, http_status: falcoRes.http_status });

    const fallback = await emailFallback(supabase, invoice, `peppol_failed: ${falcoRes.peppol_error || falcoRes.http_status}`);
    return json(200, {
      ok: false,
      primary_flow: primaryFlow,
      channel: "peppol",
      status: "failed",
      transmission_id: tx.id,
      error: falcoRes.peppol_error || `http_${falcoRes.http_status}`,
      fallback,
    });
  } catch (e) {
    console.error("[send-order-invoice-peppol]", e);
    return json(500, { error: "internal_error", details: String((e as any)?.message || e) });
  }
});
