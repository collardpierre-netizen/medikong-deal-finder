// @ts-nocheck — Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "order-pdfs";
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
    const orderId = body?.order_id;
    if (!orderId || typeof orderId !== "string") {
      return new Response(JSON.stringify({ error: "order_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: claims.claims.sub });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: order, error: oErr } = await adminClient
      .from("orders")
      .select("*, customer:customers(*)")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let { data: lines } = await adminClient
      .from("order_lines")
      .select("*, products(name), vendors(company_name, name, vat_number, address_line1, bank_name, iban, bic)")
      .eq("order_id", orderId);

    // Fallback : commande draft / prévisionnelle → lignes dans draft_payload
    let computedSubtotalHt = Number(order.subtotal_excl_vat) || 0;
    let computedVat = Number(order.vat_amount) || 0;
    let computedTtc = Number(order.total_incl_vat) || 0;

    if ((!lines || lines.length === 0) && Array.isArray((order as any).draft_payload?.lines)) {
      const draftLines = (order as any).draft_payload.lines as any[];
      const productIds = Array.from(new Set(draftLines.map((l) => l.product_id).filter(Boolean)));
      const vendorIds = Array.from(new Set(draftLines.map((l) => l.vendor_id).filter(Boolean)));
      const [{ data: prods }, { data: vends }] = await Promise.all([
        productIds.length ? adminClient.from("products").select("id, name").in("id", productIds) : Promise.resolve({ data: [] as any[] }),
        vendorIds.length ? adminClient.from("vendors").select("id, name, company_name, vat_number, address_line1, bank_name, iban, bic").in("id", vendorIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
      const vendMap = new Map((vends || []).map((v: any) => [v.id, v]));
      lines = draftLines.map((l: any) => {
        const qty = Number(l.quantity) || 0;
        const unit = Number(l.unit_price_excl_vat) || 0;
        const vatR = Number(l.vat_rate) || 0;
        const ht = qty * unit;
        return {
          quantity: qty,
          unit_price_excl_vat: unit,
          vat_rate: vatR,
          line_total_excl_vat: ht,
          manual_label: l.offer_label || l.manual_label,
          products: prodMap.get(l.product_id) || null,
          vendors: vendMap.get(l.vendor_id) || null,
        } as any;
      });
      computedSubtotalHt = lines.reduce((a: number, l: any) => a + l.line_total_excl_vat, 0);
      computedVat = lines.reduce((a: number, l: any) => a + (l.line_total_excl_vat * (l.vat_rate || 0)) / 100, 0);
      computedTtc = computedSubtotalHt + computedVat;
    }


    const currency = "EUR";

    // Totaux (en €) — utilise les valeurs hydratées si la commande est encore en draft
    const totalHt = computedSubtotalHt;
    const totalTva = computedVat;
    const totalTtc = computedTtc;

    // ─── PDF ───────────────────────────────────────────────────────────
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    let y = 15;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(28, 88, 217);
    doc.text("BON DE COMMANDE", 15, y);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`N° ${order.order_number}`, 15, y + 6);
    doc.text(`Date : ${new Date(order.created_at).toLocaleDateString("fr-BE")}`, 15, y + 11);
    doc.text(`Statut : ${order.status}`, 15, y + 16);

    // MediKong issuer (right)
    doc.setFontSize(11);
    doc.setTextColor(30, 37, 47);
    doc.text("MediKong", pageW - 15, y + 6, { align: "right" });
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Balooh SRL", pageW - 15, y + 11, { align: "right" });
    doc.text("23 rue de la Procession", pageW - 15, y + 15, { align: "right" });
    doc.text("7822 Ath, Belgique", pageW - 15, y + 19, { align: "right" });
    doc.text("TVA : BE 1005.771.323", pageW - 15, y + 23, { align: "right" });

    y += 35;

    // Customer
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Destinataire", 15, y);
    doc.setFontSize(11);
    doc.setTextColor(30, 37, 47);
    doc.text(order.customer?.company_name || "—", 15, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(80);
    if (order.customer?.address_line1) doc.text(String(order.customer.address_line1), 15, y + 10);
    if (order.customer?.postal_code || order.customer?.city) {
      doc.text(`${order.customer?.postal_code ?? ""} ${order.customer?.city ?? ""}`.trim(), 15, y + 14);
    }
    if (order.customer?.vat_number) doc.text(`TVA : ${order.customer.vat_number}`, 15, y + 18);
    if (order.customer?.email) doc.text(order.customer.email, 15, y + 22);

    y += 30;

    // Notes
    if (order.notes) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      const noteLines = doc.splitTextToSize(String(order.notes), pageW - 30);
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
    doc.text("Fournisseur", 95, y + 5.5);
    doc.text("Qté", 130, y + 5.5, { align: "right" });
    doc.text("PU HT", 152, y + 5.5, { align: "right" });
    doc.text("TVA", 167, y + 5.5, { align: "right" });
    doc.text("Total HT", pageW - 17, y + 5.5, { align: "right" });
    y += 10;

    doc.setTextColor(30, 37, 47);
    doc.setFontSize(9);
    for (const l of (lines || [])) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const label = doc.splitTextToSize(String(l.manual_label || l.products?.name || "—"), 73);
      const vendor = doc.splitTextToSize(String(l.vendors?.company_name || l.vendors?.name || l.qogita_seller_fid || "—"), 32);
      doc.text(label, 17, y);
      doc.text(vendor, 95, y);
      doc.text(String(l.quantity || 0), 130, y, { align: "right" });
      doc.text(fmtEur(Math.round(Number(l.unit_price_excl_vat || 0) * 100), currency), 152, y, { align: "right" });
      doc.text(`${Number(l.vat_rate || 0).toFixed(0)}%`, 167, y, { align: "right" });
      doc.text(fmtEur(Math.round(Number(l.line_total_excl_vat || 0) * 100), currency), pageW - 17, y, { align: "right" });
      const rowH = Math.max(label.length, vendor.length) * 4 + 2;
      y += Math.max(5, rowH);
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
    doc.text(fmtEur(Math.round(totalHt * 100), currency), totX, y, { align: "right" });
    y += 6;
    doc.text("TVA", totX - 50, y, { align: "right" });
    doc.text(fmtEur(Math.round(totalTva * 100), currency), totX, y, { align: "right" });
    y += 7;
    doc.setFillColor(28, 88, 217);
    doc.rect(totX - 70, y - 5, 75, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text("Total TTC", totX - 50, y + 1.5, { align: "right" });
    doc.text(fmtEur(Math.round(totalTtc * 100), currency), totX, y + 1.5, { align: "right" });

    y += 14;

    // Bank info (fournisseur principal avec IBAN)
    const vendorWithBank = (lines || [])
      .map((l: any) => l.vendors)
      .find((v: any) => v && (v.iban || v.bank_name));

    if (vendorWithBank) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFillColor(245, 247, 250);
      doc.rect(15, y, pageW - 30, 28, "F");
      doc.setFontSize(10);
      doc.setTextColor(30, 37, 47);
      doc.text(`Informations de paiement — ${vendorWithBank.company_name || vendorWithBank.name || "Fournisseur"}`, 18, y + 6);
      doc.setFontSize(9);
      doc.setTextColor(80);
      let by = y + 12;
      if (vendorWithBank.bank_name) { doc.text(`Banque : ${vendorWithBank.bank_name}`, 18, by); by += 5; }
      if (vendorWithBank.iban) { doc.text(`IBAN : ${vendorWithBank.iban}`, 18, by); by += 5; }
      if (vendorWithBank.bic) { doc.text(`BIC : ${vendorWithBank.bic}`, 18, by); by += 5; }
      doc.text(`Communication : ${order.order_number}`, pageW - 18, y + 12, { align: "right" });
      if (vendorWithBank.vat_number) doc.text(`TVA : ${vendorWithBank.vat_number}`, pageW - 18, y + 17, { align: "right" });
      y += 32;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Bon de commande émis via MediKong — ${order.order_number}`, 15, 285);

    // ─── Upload ────────────────────────────────────────────────────────
    const pdfBytes = doc.output("arraybuffer");
    const pdfPath = `${order.id}/${order.order_number}.pdf`;
    const { error: upErr } = await adminClient.storage
      .from(BUCKET)
      .upload(pdfPath, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: "upload_failed", details: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: signed } = await adminClient.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_TTL);

    return new Response(JSON.stringify({
      ok: true,
      pdf_path: pdfPath,
      pdf_url: signed?.signedUrl,
      order_number: order.order_number,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-order-pdf error", e);
    return new Response(JSON.stringify({ error: "internal", message: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
