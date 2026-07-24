// @ts-nocheck — Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { jsPDF } from "npm:jspdf@2.5.2";
import { MEDIKONG_LOGO_PNG_BASE64 } from "../_shared/medikong-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "quote-pdfs";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

function fmtEur(cents: number, currency = "EUR"): string {
  const amount = (cents || 0) / 100;
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency }).format(amount).replace(/\u202F/g, ".");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const quoteId = body?.quote_id;
    if (!quoteId || typeof quoteId !== "string") {
      return new Response(JSON.stringify({ error: "quote_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: claims.claims.sub });
    const { data: quote, error: qErr } = await adminClient
      .from("quotes")
      .select("*, customer:customers(*), vendor:vendors(*)")
      .eq("id", quoteId)
      .maybeSingle();
    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "quote not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!isAdmin) {
      const { data: vendor } = await adminClient.from("vendors").select("id").eq("auth_user_id", claims.claims.sub).maybeSingle();
      if (!vendor || vendor.id !== quote.vendor_id) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: lines } = await adminClient
      .from("quote_lines")
      .select("*, products(cnk_code)")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true });


    const currency = quote.currency_code || "EUR";

    // ─── PDF (mirror generate-order-pdf layout) ────────────────────────
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const M = 15;

    const BRAND: [number, number, number] = [28, 88, 217];
    const NAVY: [number, number, number] = [30, 37, 47];
    const MUTED: [number, number, number] = [100, 116, 139];
    const LINE: [number, number, number] = [226, 232, 240];
    const SOFT: [number, number, number] = [248, 250, 252];

    // Header band
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 4, "F");

    let y = 12;

    // Logo MediKong
    try {
      doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", M, y + 5, 58, 12.1);
    } catch (_) { /* non bloquant */ }

    // Emitter block (MediKong / MediKong SRL)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("MediKong", pageW - M, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("MediKong SRL", pageW - M, y + 7.5, { align: "right" });
    doc.text("23 rue de la Procession", pageW - M, y + 11.5, { align: "right" });
    doc.text("7822 Ath, Belgique", pageW - M, y + 15.5, { align: "right" });
    doc.text("TVA : BE 1005.771.323", pageW - M, y + 19.5, { align: "right" });
    doc.text("contact@medikong.pro", pageW - M, y + 23.5, { align: "right" });

    y += 30;

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    y += 6;

    // Title + meta (left) / Customer card (right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...BRAND);
    doc.text("DEVIS", M, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("N° de devis", M, y + 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(String(quote.quote_number || "—"), M, y + 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Date", M, y + 22);
    doc.setTextColor(...NAVY);
    doc.text(new Date(quote.created_at).toLocaleDateString("fr-BE"), M + 18, y + 22);

    if (quote.token_expires_at) {
      doc.setTextColor(...MUTED);
      doc.text("Validité", M, y + 27);
      doc.setTextColor(...NAVY);
      doc.text(new Date(quote.token_expires_at).toLocaleDateString("fr-BE"), M + 18, y + 27);
    }

    // Customer card
    const cardX = pageW - M - 85;
    const cardW = 85;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.roundedRect(cardX, y, cardW, 32, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("DESTINATAIRE", cardX + 4, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(String(quote.customer?.company_name || "—"), cardX + 4, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    let cy = y + 16;
    if (quote.customer?.address_line1) { doc.text(String(quote.customer.address_line1), cardX + 4, cy); cy += 4; }
    if (quote.customer?.postal_code || quote.customer?.city) {
      doc.text(`${quote.customer?.postal_code ?? ""} ${quote.customer?.city ?? ""}`.trim(), cardX + 4, cy); cy += 4;
    }
    if (quote.customer?.vat_number) { doc.text(`TVA : ${quote.customer.vat_number}`, cardX + 4, cy); cy += 4; }
    if (quote.customer?.email) { doc.text(String(quote.customer.email), cardX + 4, cy); cy += 4; }

    y += 38;

    // Public link
    if (quote.public_token) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Consulter en ligne : https://medikong.pro/devis/${quote.public_token}`, M, y);
      y += 5;
    }

    // Customer note
    if (quote.notes_customer) {
      doc.setFillColor(239, 246, 255);
      const noteLines = doc.splitTextToSize(String(quote.notes_customer), pageW - 2 * M - 6);
      const noteH = noteLines.length * 4 + 6;
      doc.rect(M, y, pageW - 2 * M, noteH, "F");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(noteLines, M + 3, y + 5);
      y += noteH + 4;
    } else {
      y += 2;
    }

    // Lines table
    const COLS = {
      article: M + 2,
      articleWidth: 95,
      qty: M + 110,
      puHt: M + 134,
      vat: M + 152,
      total: pageW - M - 2,
    };

    doc.setFillColor(...NAVY);
    doc.rect(M, y, pageW - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("ARTICLE", COLS.article, y + 4.7);
    doc.text("QTÉ", COLS.qty, y + 4.7, { align: "right" });
    doc.text("PU HT", COLS.puHt, y + 4.7, { align: "right" });
    doc.text("TVA", COLS.vat, y + 4.7, { align: "right" });
    doc.text("TOTAL HT", COLS.total, y + 4.7, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    let rowIdx = 0;
    for (const l of (lines || [])) {
      const label = doc.splitTextToSize(String(l.label || "—"), COLS.articleWidth);
      const cnk = (l as any).products?.cnk_code || null;
      const codeLine = cnk ? `CNK ${cnk}` : null;
      const extraLines = codeLine ? 1 : 0;
      const rowH = Math.max(6, (label.length + extraLines) * 3.4 + 2.5);

      if (y + rowH > pageH - 50) { doc.addPage(); y = 20; }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(...SOFT);
        doc.rect(M, y, pageW - 2 * M, rowH, "F");
      }

      doc.setTextColor(...NAVY);
      doc.text(label, COLS.article, y + 3.5);
      if (codeLine) {
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text(codeLine, COLS.article, y + 3.5 + label.length * 3.4);
        doc.setFontSize(7.5);
        doc.setTextColor(...NAVY);
      }
      doc.text(String(l.qty || 0), COLS.qty, y + 3.5, { align: "right" });
      doc.text(fmtEur(Number(l.unit_price_ht_cents) || 0, currency), COLS.puHt, y + 3.5, { align: "right" });
      doc.setTextColor(...MUTED);
      doc.text(`${Number(l.vat_rate || 0).toFixed(0)}%`, COLS.vat, y + 3.5, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(fmtEur(Number(l.total_ht_cents) || 0, currency), COLS.total, y + 3.5, { align: "right" });
      doc.setFont("helvetica", "normal");

      y += rowH;
      rowIdx += 1;
    }

    doc.setDrawColor(...LINE);
    doc.line(M, y, pageW - M, y);
    y += 8;

    if (y > pageH - 60) { doc.addPage(); y = 20; }

    // Totals card
    const totBoxW = 80;
    const totBoxX = pageW - M - totBoxW;
    const totLabelX = totBoxX + 4;
    const totValueX = totBoxX + totBoxW - 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text("Total HT", totLabelX, y);
    doc.setTextColor(...NAVY);
    doc.text(fmtEur(Number(quote.total_ht_cents) || 0, currency), totValueX, y, { align: "right" });
    y += 5.5;
    doc.setTextColor(...MUTED);
    doc.text("TVA", totLabelX, y);
    doc.setTextColor(...NAVY);
    doc.text(fmtEur(Number(quote.total_tva_cents) || 0, currency), totValueX, y, { align: "right" });
    y += 4;
    doc.setDrawColor(...LINE);
    doc.line(totBoxX, y, totBoxX + totBoxW, y);
    y += 4;

    doc.setFillColor(...BRAND);
    doc.rect(totBoxX, y - 4, totBoxW, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Total TTC", totLabelX, y + 3);
    doc.text(fmtEur(Number(quote.total_ttc_cents) || 0, currency), totValueX, y + 3, { align: "right" });
    y += 14;

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE);
      doc.line(M, pageH - 14, pageW - M, pageH - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Devis ${quote.quote_number}`, M, pageH - 9);
      doc.text("MediKong SRL · TVA BE 1005.771.323 · medikong.pro", pageW / 2, pageH - 9, { align: "center" });
      doc.text(`Page ${p} / ${pageCount}`, pageW - M, pageH - 9, { align: "right" });
    }

    // ─── Upload ────────────────────────────────────────────────────────
    const pdfBytes = doc.output("arraybuffer");
    const pdfPath = `${quote.vendor_id}/${quote.id}/${quote.quote_number}.pdf`;
    const { error: upErr } = await adminClient.storage
      .from(BUCKET)
      .upload(pdfPath, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: "upload_failed", details: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await adminClient.from("quotes").update({ pdf_storage_path: pdfPath }).eq("id", quote.id);

    const { data: signed } = await adminClient.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_TTL);

    return new Response(JSON.stringify({
      ok: true,
      pdf_path: pdfPath,
      pdf_url: signed?.signedUrl,
      quote_number: quote.quote_number,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-quote-pdf error", e);
    return new Response(JSON.stringify({ error: "internal", message: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
