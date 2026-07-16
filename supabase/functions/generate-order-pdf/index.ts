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
      .select("*, products(name, gtin, cnk_code), vendors(company_name, name, vat_number, address_line1, bank_name, iban, bic)")
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
        productIds.length ? adminClient.from("products").select("id, name, gtin, cnk_code").in("id", productIds) : Promise.resolve({ data: [] as any[] }),
        vendorIds.length ? adminClient.from("vendors").select("id, name, company_name, vat_number, address_line1, bank_name, iban, bic").in("id", vendorIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
      const vendMap = new Map((vends || []).map((v: any) => [v.id, v]));
      lines = draftLines.map((l: any) => {
        const qty = Number(l.quantity) || 0;
        const unit = Number(l.unit_price_excl_vat) || 0;
        const vatR = Number(l.vat_rate) || 0;
        const ht = qty * unit;
        const prod = prodMap.get(l.product_id) || null;
        return {
          quantity: qty,
          unit_price_excl_vat: unit,
          vat_rate: vatR,
          line_total_excl_vat: ht,
          manual_label: l.manual_label || l.offer_label,
          cnk_code: l.cnk_code ?? (prod as any)?.cnk_code ?? null,
          products: prod,
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
    const pageH = 297;
    const M = 15; // marge

    // Couleurs
    const BRAND: [number, number, number] = [28, 88, 217]; // primary blue #1C58D9
    const NAVY: [number, number, number] = [30, 37, 47];
    const MUTED: [number, number, number] = [100, 116, 139];
    const LINE: [number, number, number] = [226, 232, 240];
    const SOFT: [number, number, number] = [248, 250, 252];

    // ─── Header ────────────────────────────────────────────────────────
    // Bandeau supérieur fin couleur marque
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 4, "F");

    let y = 12;

    // Logo recadré, ratio natif ≈ 4.8 — évite l'effet "écrasé" et agrandit la marque
    try {
      doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", M, y + 5, 58, 12.1);
    } catch (_) { /* non bloquant */ }

    // Bloc émetteur (droite)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("MediKong", pageW - M, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Balooh SRL", pageW - M, y + 7.5, { align: "right" });
    doc.text("23 rue de la Procession", pageW - M, y + 11.5, { align: "right" });
    doc.text("7822 Ath, Belgique", pageW - M, y + 15.5, { align: "right" });
    doc.text("TVA : BE 1005.771.323", pageW - M, y + 19.5, { align: "right" });
    doc.text("contact@medikong.pro", pageW - M, y + 23.5, { align: "right" });

    y += 30;

    // Séparateur
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    y += 6;

    // Titre + métadonnées (bloc gauche) / Destinataire (bloc droit)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...BRAND);
    doc.text("BON DE COMMANDE", M, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("N° de commande", M, y + 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(String(order.order_number || "—"), M, y + 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Date", M, y + 22);
    doc.setTextColor(...NAVY);
    doc.text(new Date(order.created_at).toLocaleDateString("fr-BE"), M + 18, y + 22);

    doc.setTextColor(...MUTED);
    doc.text("Statut", M, y + 27);
    const isDraft = String(order.status || "").toLowerCase() === "draft";
    const STATUS_LABELS: Record<string, string> = {
      draft: "Brouillon",
      pending: "En attente",
      confirmed: "Confirmée",
      processing: "En cours",
      shipped: "Expédiée",
      delivered: "Livrée",
      cancelled: "Annulée",
    };
    const statusLabel = STATUS_LABELS[String(order.status || "").toLowerCase()] || String(order.status || "—");
    if (isDraft) {
      // Pastille rouge "Brouillon" bien visible
      doc.setFillColor(220, 38, 38); // red-600
      doc.roundedRect(M + 18, y + 23.5, 26, 5.5, 1.2, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(statusLabel.toUpperCase(), M + 31, y + 27.4, { align: "center" });
      doc.setFont("helvetica", "normal");
    } else {
      doc.setTextColor(...NAVY);
      doc.text(statusLabel, M + 18, y + 27);
    }

    // Destinataire (carte)
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
    doc.text(String(order.customer?.company_name || "—"), cardX + 4, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    let cy = y + 16;
    if (order.customer?.address_line1) { doc.text(String(order.customer.address_line1), cardX + 4, cy); cy += 4; }
    if (order.customer?.postal_code || order.customer?.city) {
      doc.text(`${order.customer?.postal_code ?? ""} ${order.customer?.city ?? ""}`.trim(), cardX + 4, cy); cy += 4;
    }
    if (order.customer?.vat_number) { doc.text(`TVA : ${order.customer.vat_number}`, cardX + 4, cy); cy += 4; }
    if (order.customer?.email) { doc.text(String(order.customer.email), cardX + 4, cy); cy += 4; }

    y += 38;

    // Mode logistique (picking / livraison) + adresse de livraison si applicable
    const fMode = (order as any).fulfillment_mode as ("pickup" | "delivery" | null | undefined);
    if (fMode) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text("MODE LOGISTIQUE", M, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(fMode === "pickup" ? "Picking — retrait sur place" : "Livraison", M + 38, y);
      y += 5;
      if (fMode === "delivery") {
        let ship = (order as any).shipping_address as any;
        // Fallback 1 : snapshot manquant mais shipping_address_id présent → on va le chercher.
        // Fallback 2 : ni snapshot ni id → on prend l'adresse par défaut du customer.
        if (!ship) {
          const shipId = (order as any).shipping_address_id as string | null | undefined;
          if (shipId) {
            const { data: addr } = await adminClient
              .from("customer_shipping_addresses")
              .select("label, address_l1, address_l2, postal_code, city, country_code")
              .eq("id", shipId)
              .maybeSingle();
            if (addr) ship = addr;
          } else if ((order as any).customer_id) {
            const { data: addr } = await adminClient
              .from("customer_shipping_addresses")
              .select("label, address_l1, address_l2, postal_code, city, country_code")
              .eq("customer_id", (order as any).customer_id)
              .eq("is_default", true)
              .maybeSingle();
            if (addr) ship = addr;
          }
        }
        if (ship) {
          doc.setFontSize(8.5);
          doc.setTextColor(80, 80, 80);
          if (ship.label) { doc.text(`Site : ${ship.label}`, M, y); y += 4; }
          if (ship.address_l1) { doc.text(String(ship.address_l1), M, y); y += 4; }
          if (ship.address_l2) { doc.text(String(ship.address_l2), M, y); y += 4; }
          if (ship.postal_code || ship.city) {
            doc.text(`${ship.postal_code ?? ""} ${ship.city ?? ""} ${ship.country_code ? `(${ship.country_code})` : ""}`.trim(), M, y);
            y += 4;
          }
        }
      }
      y += 3;
    }


    // Lien public
    if (order.public_token) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Consulter en ligne : https://medikong.pro/commande/lien/${order.public_token}`, M, y);
      y += 5;
    }

    // Notes
    if (order.notes) {
      doc.setFillColor(239, 246, 255);
      const noteLines = doc.splitTextToSize(String(order.notes), pageW - 2 * M - 6);
      const noteH = noteLines.length * 4 + 6;
      doc.rect(M, y, pageW - 2 * M, noteH, "F");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(noteLines, M + 3, y + 5);
      y += noteH + 4;
    } else {
      y += 2;
    }

    // ─── Tableau lignes ────────────────────────────────────────────────
    // En-tête tableau
    const COLS = {
      article: M + 2,
      articleWidth: 60,
      vendor: M + 66,
      vendorWidth: 30,
      qty: M + 102,
      puHt: M + 124,
      vat: M + 140,
      puTtc: M + 162,
      total: pageW - M - 2,
    };

    doc.setFillColor(...NAVY);
    doc.rect(M, y, pageW - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("ARTICLE", COLS.article, y + 4.7);
    doc.text("FOURNISSEUR", COLS.vendor, y + 4.7);
    doc.text("QTÉ", COLS.qty, y + 4.7, { align: "right" });
    doc.text("PU HT", COLS.puHt, y + 4.7, { align: "right" });
    doc.text("TVA", COLS.vat, y + 4.7, { align: "right" });
    doc.text("PU TTC", COLS.puTtc, y + 4.7, { align: "right" });
    doc.text("TOTAL HT", COLS.total, y + 4.7, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    let rowIdx = 0;
    for (const l of (lines || [])) {
      const label = doc.splitTextToSize(String(l.manual_label || l.products?.name || "—"), COLS.articleWidth);
      const vendor = doc.splitTextToSize(String(l.vendors?.company_name || l.vendors?.name || l.qogita_seller_fid || "—"), COLS.vendorWidth);
      const cnk = (l as any).cnk_code || l.products?.cnk_code || null;
      const codeLine = cnk ? `CNK ${cnk}` : null;
      const extraLines = codeLine ? 1 : 0;
      const rowH = Math.max(6, (Math.max(label.length, vendor.length) + extraLines) * 3.4 + 2.5);

      if (y + rowH > pageH - 50) {
        doc.addPage();
        y = 20;
      }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(...SOFT);
        doc.rect(M, y, pageW - 2 * M, rowH, "F");
      }

      const puHt = Number(l.unit_price_excl_vat) || 0;
      const vatR = Number(l.vat_rate) || 0;
      const puTtc = puHt * (1 + vatR / 100);

      doc.setTextColor(...NAVY);
      doc.text(label, COLS.article, y + 3.5);
      if (codeLine) {
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text(codeLine, COLS.article, y + 3.5 + label.length * 3.4);
        doc.setFontSize(7.5);
      }
      doc.setTextColor(80, 80, 80);
      doc.text(vendor, COLS.vendor, y + 3.5);
      doc.setTextColor(...NAVY);
      doc.text(String(l.quantity || 0), COLS.qty, y + 3.5, { align: "right" });
      doc.text(fmtEur(Math.round(puHt * 100), currency), COLS.puHt, y + 3.5, { align: "right" });
      doc.setTextColor(...MUTED);
      doc.text(`${vatR.toFixed(0)}%`, COLS.vat, y + 3.5, { align: "right" });
      doc.setTextColor(80, 80, 80);
      doc.text(fmtEur(Math.round(puTtc * 100), currency), COLS.puTtc, y + 3.5, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(fmtEur(Math.round(Number(l.line_total_excl_vat || 0) * 100), currency), COLS.total, y + 3.5, { align: "right" });
      doc.setFont("helvetica", "normal");

      y += rowH;
      rowIdx += 1;
    }

    // Trait de fermeture du tableau
    doc.setDrawColor(...LINE);
    doc.line(M, y, pageW - M, y);
    y += 8;

    if (y > pageH - 60) { doc.addPage(); y = 20; }

    // ─── Totaux (carte droite) ─────────────────────────────────────────
    const totBoxW = 80;
    const totBoxX = pageW - M - totBoxW;
    const totLabelX = totBoxX + 4;
    const totValueX = totBoxX + totBoxW - 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text("Total HT", totLabelX, y);
    doc.setTextColor(...NAVY);
    doc.text(fmtEur(Math.round(totalHt * 100), currency), totValueX, y, { align: "right" });
    y += 5.5;
    doc.setTextColor(...MUTED);
    doc.text("TVA", totLabelX, y);
    doc.setTextColor(...NAVY);
    doc.text(fmtEur(Math.round(totalTva * 100), currency), totValueX, y, { align: "right" });
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
    doc.text(fmtEur(Math.round(totalTtc * 100), currency), totValueX, y + 3, { align: "right" });
    y += 14;

    // ─── Infos paiement ────────────────────────────────────────────────
    const vendorWithBank = (lines || [])
      .map((l: any) => l.vendors)
      .find((v: any) => v && (v.iban || v.bank_name));

    // Single source of truth (shared with public_get_order_by_token + vendor payout PDF)
    const { data: showPaymentInfo } = await adminClient.rpc("order_should_show_payment_info", { _order_id: order.id });
    if (vendorWithBank && showPaymentInfo !== false) {
      if (y > pageH - 50) { doc.addPage(); y = 20; }
      const bkH = 30;
      doc.setFillColor(...SOFT);
      doc.setDrawColor(...LINE);
      doc.roundedRect(M, y, pageW - 2 * M, bkH, 1.5, 1.5, "FD");
      // Accent
      doc.setFillColor(...BRAND);
      doc.rect(M, y, 1.5, bkH, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("INFORMATIONS DE PAIEMENT", M + 5, y + 5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(String(vendorWithBank.company_name || vendorWithBank.name || "Fournisseur"), M + 5, y + 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      let by = y + 17;
      if (vendorWithBank.bank_name) { doc.text(`Banque : ${vendorWithBank.bank_name}`, M + 5, by); by += 4.5; }
      if (vendorWithBank.iban) { doc.text(`IBAN : ${vendorWithBank.iban}`, M + 5, by); by += 4.5; }
      if (vendorWithBank.bic) { doc.text(`BIC : ${vendorWithBank.bic}`, M + 5, by); by += 4.5; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text("Communication", pageW - M - 5, y + 11, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(String(order.order_number), pageW - M - 5, y + 16, { align: "right" });
      if (vendorWithBank.vat_number) {
        doc.text(`TVA fournisseur : ${vendorWithBank.vat_number}`, pageW - M - 5, y + 21, { align: "right" });
      }

      y += bkH + 4;
    }

    // ─── Footer (toutes pages) ─────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE);
      doc.line(M, pageH - 14, pageW - M, pageH - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Bon de commande ${order.order_number}`, M, pageH - 9);
      doc.text("MediKong — Balooh SRL · TVA BE 1005.771.323 · medikong.pro", pageW / 2, pageH - 9, { align: "center" });
      doc.text(`Page ${p} / ${pageCount}`, pageW - M, pageH - 9, { align: "right" });
    }

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
