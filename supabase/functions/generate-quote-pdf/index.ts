// @ts-nocheck — Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { jsPDF } from "npm:jspdf@2.5.2";

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

    // Vérifier que l'utilisateur a le droit (admin OU vendor owner)
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
      .select("*")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true });

    // ─── PDF ───────────────────────────────────────────────────────────
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    let y = 15;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(28, 88, 217);
    doc.text("DEVIS", 15, y);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`N° ${quote.quote_number}`, 15, y + 6);
    doc.text(`Date : ${new Date(quote.created_at).toLocaleDateString("fr-BE")}`, 15, y + 11);
    if (quote.token_expires_at) {
      doc.text(`Valable jusqu'au : ${new Date(quote.token_expires_at).toLocaleDateString("fr-BE")}`, 15, y + 16);
    }

    // Vendor box (right)
    doc.setFontSize(11);
    doc.setTextColor(30, 37, 47);
    doc.text(quote.vendor?.company_name || quote.vendor?.name || "—", pageW - 15, y + 6, { align: "right" });
    doc.setFontSize(9);
    doc.setTextColor(100);
    if (quote.vendor?.address) doc.text(String(quote.vendor.address).slice(0, 60), pageW - 15, y + 11, { align: "right" });
    if (quote.vendor?.vat_number) doc.text(`TVA : ${quote.vendor.vat_number}`, pageW - 15, y + 16, { align: "right" });

    y += 28;

    // Customer
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Destinataire", 15, y);
    doc.setFontSize(11);
    doc.setTextColor(30, 37, 47);
    doc.text(quote.customer?.company_name || "—", 15, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(80);
    if (quote.customer?.address_line1) doc.text(String(quote.customer.address_line1), 15, y + 10);
    if (quote.customer?.postal_code || quote.customer?.city) {
      doc.text(`${quote.customer?.postal_code ?? ""} ${quote.customer?.city ?? ""}`.trim(), 15, y + 14);
    }
    if (quote.customer?.vat_number) doc.text(`TVA : ${quote.customer.vat_number}`, 15, y + 18);

    y += 28;

    // Customer note
    if (quote.notes_customer) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      const noteLines = doc.splitTextToSize(String(quote.notes_customer), pageW - 30);
      doc.text(noteLines, 15, y);
      y += noteLines.length * 4 + 4;
    }

    // Lines table header
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, pageW - 30, 8, "F");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Article", 17, y + 5.5);
    doc.text("Qté", 120, y + 5.5, { align: "right" });
    doc.text("PU HT", 145, y + 5.5, { align: "right" });
    doc.text("TVA", 162, y + 5.5, { align: "right" });
    doc.text("Total HT", pageW - 17, y + 5.5, { align: "right" });
    y += 10;

    doc.setTextColor(30, 37, 47);
    doc.setFontSize(9);
    for (const l of (lines || [])) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const label = doc.splitTextToSize(String(l.label || "—"), 95);
      doc.text(label, 17, y);
      doc.text(String(l.qty || 0), 120, y, { align: "right" });
      doc.text(fmtEur(Number(l.unit_price_ht_cents) || 0, quote.currency_code), 145, y, { align: "right" });
      doc.text(`${Number(l.vat_rate || 0).toFixed(0)}%`, 162, y, { align: "right" });
      doc.text(fmtEur(Number(l.total_ht_cents) || 0, quote.currency_code), pageW - 17, y, { align: "right" });
      y += Math.max(5, label.length * 4) + 2;
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y - 1, pageW - 15, y - 1);
    }

    y += 6;
    if (y > 250) { doc.addPage(); y = 20; }

    // Totals
    const totX = pageW - 17;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Total HT", totX - 50, y, { align: "right" });
    doc.text(fmtEur(Number(quote.total_ht_cents) || 0, quote.currency_code), totX, y, { align: "right" });
    y += 6;
    doc.text("TVA", totX - 50, y, { align: "right" });
    doc.text(fmtEur(Number(quote.total_tva_cents) || 0, quote.currency_code), totX, y, { align: "right" });
    y += 7;
    doc.setFillColor(28, 88, 217);
    doc.rect(totX - 70, y - 5, 75, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text("Total TTC", totX - 50, y + 1.5, { align: "right" });
    doc.text(fmtEur(Number(quote.total_ttc_cents) || 0, quote.currency_code), totX, y + 1.5, { align: "right" });

    y += 16;
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Devis émis via MediKong — ${quote.quote_number}`, 15, 285);
    doc.text(`Page 1`, pageW - 15, 285, { align: "right" });

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
