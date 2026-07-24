// @ts-nocheck — Deno runtime
// Generate a PDF purchase order restricted to the calling vendor's own lines.
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
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency })
    .format(amount)
    .replace(/\u202F/g, ".");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;
    const preferredVendorId: string | null = body?.vendor_id ? String(body.vendor_id) : null;
    if (!orderId || typeof orderId !== "string") {
      return json(400, { error: "order_id required" });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve vendor from user (owner OR active vendor account membership)
    const { resolveVendorForUser } = await import("../_shared/resolve-vendor.ts");
    const vendorRow = await resolveVendorForUser(admin, userId, preferredVendorId);
    if (!vendorRow) return json(403, { error: "not_a_vendor" });

    // Load order and vendor's own lines
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_number, status, created_at, shipping_address, billing_address, notes, payment_method, payment_status, payment_due_date, tracking_number, tracking_url, tracking_carrier, customer_id")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) return json(404, { error: "order_not_found" });

    const { data: lines, error: lErr } = await admin
      .from("order_lines")
      .select("id, offer_id, quantity, unit_price_excl_vat, vat_rate, line_total_excl_vat, cost_price, manual_label, cnk_code, tracking_number, tracking_url, tracking_carrier, status, products(name, gtin, cnk_code)")
      .eq("order_id", orderId)
      .eq("vendor_id", vendorRow.id);

    if (lErr) return json(500, { error: "lines_fetch_failed", details: lErr.message });
    if (!lines || lines.length === 0) return json(403, { error: "no_lines_for_vendor" });

    // Résolution commission effective par offre (dédoublonnée)
    const offerIds = [...new Set((lines as any[]).map((l) => l.offer_id).filter(Boolean))];
    const commissionMap = new Map<string, any>();
    await Promise.all(offerIds.map(async (oid) => {
      const { data } = await admin.rpc("resolve_effective_commission", { _offer_id: oid });
      const row: any = Array.isArray(data) ? data[0] : data;
      if (row) commissionMap.set(oid, row);
    }));

    const computeLineBreakdown = (l: any) => {
      const sell = Number(l.unit_price_excl_vat) || 0;
      const cost = Number(l.cost_price) || 0;
      const hasCost = cost > 0;
      const cfg: any = commissionMap.get(l.offer_id) ?? { commission_model: "flat_percentage" };
      let commission = 0;
      const model = cfg.commission_model as string;
      let formula = "";
      if (model === "flat_percentage") {
        const rate = Number(cfg.commission_rate) || 0;
        commission = (sell * rate) / 100;
        formula = `${rate.toFixed(0)}% × ${fmtEur(Math.round(sell * 100), currency)} = ${fmtEur(Math.round(commission * 100), currency)}`;
      } else if (model === "margin_split") {
        const vendorPct = Number(cfg.margin_split_pct) || 0;
        const mkPct = Math.max(0, 100 - vendorPct);
        if (hasCost) {
          const gross = Math.max(0, sell - cost);
          commission = (gross * mkPct) / 100;
          formula = `(${fmtEur(Math.round(sell * 100), currency)} − ${fmtEur(Math.round(cost * 100), currency)}) × ${mkPct.toFixed(0)}% = ${fmtEur(Math.round(commission * 100), currency)}`;
        } else {
          commission = 0;
          formula = "Coût d'achat manquant — commission à 0";
        }
      } else if (model === "fixed_amount") {
        const fixed = Number(cfg.fixed_commission_amount) || 0;
        commission = fixed;
        formula = `${fmtEur(Math.round(fixed * 100), currency)}/u`;
      }
      commission = Math.max(0, commission);
      const netRevenue = sell - commission;
      const netMargin = sell - cost - commission;
      const modelLabel =
        model === "flat_percentage" ? `Taux fixe ${Number(cfg.commission_rate) || 0}%`
        : model === "margin_split" ? `Ventilation vendeur ${Number(cfg.margin_split_pct) || 0}% / MK ${Math.max(0, 100 - (Number(cfg.margin_split_pct) || 0))}%`
        : model === "fixed_amount" ? `Montant fixe ${(Number(cfg.fixed_commission_amount) || 0).toFixed(2)} €/u`
        : "—";
      return { commission, netRevenue, netMargin, hasCost, modelLabel, model, formula };
    };

    // Buyer contact (email/phone)
    let buyer: any = null;
    if (order.customer_id) {
      const { data } = await admin
        .from("customers")
        .select("company_name, email, phone, vat_number")
        .eq("id", order.customer_id)
        .maybeSingle();
      buyer = data;
    }

    // Totaux vendeur uniquement
    const totalHt = lines.reduce((a: number, l: any) => a + (Number(l.line_total_excl_vat) || 0), 0);
    const totalTva = lines.reduce((a: number, l: any) => {
      const ht = Number(l.line_total_excl_vat) || 0;
      const r = Number(l.vat_rate) || 0;
      return a + (ht * r) / 100;
    }, 0);
    const totalTtc = totalHt + totalTva;
    const currency = "EUR";

    // ─── PDF ───────────────────────────────────────────────────────────
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const M = 15;

    const BRAND: [number, number, number] = [28, 88, 217];
    const NAVY: [number, number, number] = [30, 37, 47];
    const MUTED: [number, number, number] = [100, 116, 139];
    const LINE: [number, number, number] = [226, 232, 240];
    const SOFT: [number, number, number] = [248, 250, 252];

    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 4, "F");

    let y = 12;
    try {
      doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", M, y + 5, 58, 12.1);
    } catch (_) { /* non bloquant */ }

    // Bloc vendeur (droite)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(String(vendorRow.company_name || vendorRow.name || "Fournisseur"), pageW - M, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    let vy = y + 7.5;
    if (vendorRow.address_line1) { doc.text(String(vendorRow.address_line1), pageW - M, vy, { align: "right" }); vy += 4; }
    if (vendorRow.postal_code || vendorRow.city) {
      doc.text(`${vendorRow.postal_code ?? ""} ${vendorRow.city ?? ""} ${vendorRow.country_code ? `(${vendorRow.country_code})` : ""}`.trim(), pageW - M, vy, { align: "right" });
      vy += 4;
    }
    if (vendorRow.vat_number) { doc.text(`TVA : ${vendorRow.vat_number}`, pageW - M, vy, { align: "right" }); vy += 4; }
    if (vendorRow.email) { doc.text(String(vendorRow.email), pageW - M, vy, { align: "right" }); vy += 4; }

    y += 30;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    y += 6;

    // Titre + méta
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
    doc.setTextColor(...NAVY);
    doc.text(String(order.status || "—"), M + 18, y + 27);

    // Carte acheteur (livraison)
    const ship: any = order.shipping_address || {};
    const bill: any = order.billing_address || {};
    const cardX = pageW - M - 85;
    const cardW = 85;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.roundedRect(cardX, y, cardW, 40, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("LIVRAISON", cardX + 4, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    const shipName = ship.label || ship.name || ship.company || buyer?.company_name || "Raison sociale non renseignée";
    doc.text(String(shipName), cardX + 4, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    let cy = y + 16;
    if (ship.address_l1 || ship.line1) { doc.text(String(ship.address_l1 || ship.line1), cardX + 4, cy); cy += 4; }
    if (ship.address_l2 || ship.line2) { doc.text(String(ship.address_l2 || ship.line2), cardX + 4, cy); cy += 4; }
    if (ship.postal_code || ship.city) {
      doc.text(`${ship.postal_code ?? ""} ${ship.city ?? ""} ${ship.country_code ? `(${ship.country_code})` : ""}`.trim(), cardX + 4, cy);
      cy += 4;
    }
    if (buyer?.email) { doc.text(String(buyer.email), cardX + 4, cy); cy += 4; }
    if (buyer?.phone || ship.phone) { doc.text(`Tél. ${buyer?.phone || ship.phone}`, cardX + 4, cy); cy += 4; }
    if (buyer?.vat_number) { doc.text(`TVA : ${buyer.vat_number}`, cardX + 4, cy); cy += 4; }

    y += 46;

    // Notes acheteur
    if (order.notes) {
      doc.setFillColor(239, 246, 255);
      const noteLines = doc.splitTextToSize(`Note acheteur : ${order.notes}`, pageW - 2 * M - 6);
      const noteH = noteLines.length * 4 + 6;
      doc.rect(M, y, pageW - 2 * M, noteH, "F");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(noteLines, M + 3, y + 5);
      y += noteH + 4;
    }

    // ─── Tableau lignes ────────────────────────────────────────────────
    const COLS = {
      article: M + 2,
      articleWidth: 92,
      qty: M + 108,
      puHt: M + 130,
      vat: M + 148,
      puTtc: M + 168,
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
    doc.text("PU TTC", COLS.puTtc, y + 4.7, { align: "right" });
    doc.text("TOTAL HT", COLS.total, y + 4.7, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    let rowIdx = 0;
    for (const l of lines) {
      const label = doc.splitTextToSize(String((l as any).manual_label || l.products?.name || "—"), COLS.articleWidth);
      const cnk = (l as any).cnk_code || l.products?.cnk_code || null;
      const gtin = l.products?.gtin || null;
      const codeParts: string[] = [];
      if (cnk) codeParts.push(`CNK ${cnk}`);
      if (gtin) codeParts.push(`EAN ${gtin}`);
      const codeLine = codeParts.length ? codeParts.join(" · ") : null;
      const extraLines = codeLine ? 1 : 0;
      const rowH = Math.max(6, (label.length + extraLines) * 3.4 + 2.5);

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

    doc.setDrawColor(...LINE);
    doc.line(M, y, pageW - M, y);
    y += 8;

    if (y > pageH - 60) { doc.addPage(); y = 20; }

    // Totaux
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

    // Suivi commande
    if (order.tracking_number || order.tracking_url) {
      if (y > pageH - 40) { doc.addPage(); y = 20; }
      doc.setFillColor(...SOFT);
      doc.setDrawColor(...LINE);
      doc.roundedRect(M, y, pageW - 2 * M, 18, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("SUIVI D'EXPÉDITION", M + 5, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      const parts: string[] = [];
      if (order.tracking_carrier) parts.push(String(order.tracking_carrier));
      if (order.tracking_number) parts.push(String(order.tracking_number));
      doc.text(parts.join(" · ") || "—", M + 5, y + 11);
      if (order.tracking_url) {
        doc.setTextColor(...BRAND);
        doc.textWithLink(String(order.tracking_url).slice(0, 90), M + 5, y + 15.5, { url: String(order.tracking_url) });
      }
      y += 22;
    }

    // ─── Récapitulatif acheteur ────────────────────────────────────────
    const missingBuyerFields: string[] = [];
    if (!buyer?.company_name) missingBuyerFields.push("raison sociale");
    if (!buyer?.email) missingBuyerFields.push("email");
    if (!buyer?.phone) missingBuyerFields.push("téléphone");

    if (y > pageH - 55) { doc.addPage(); y = 20; }
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    const buyerH = missingBuyerFields.length > 0 ? 34 : 26;
    doc.roundedRect(M, y, pageW - 2 * M, buyerH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("RÉCAPITULATIF ACHETEUR", M + 5, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(String(buyer?.company_name || "Raison sociale non renseignée"), M + 5, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const bLine1: string[] = [];
    if (buyer?.email) bLine1.push(String(buyer.email));
    else bLine1.push("Email non renseigné");
    if (buyer?.phone) bLine1.push(`Tél. ${buyer.phone}`);
    else bLine1.push("Téléphone non renseigné");
    doc.text(bLine1.join("  ·  "), M + 5, y + 17);
    if (buyer?.vat_number) doc.text(`TVA : ${buyer.vat_number}`, M + 5, y + 22);

    if (missingBuyerFields.length > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9); // amber
      const warningText = `Avertissement : ${missingBuyerFields.join(", ")} ${missingBuyerFields.length > 1 ? "manquants" : "manquant"} — la commande n'a pas été associée à des coordonnées vérifiées.`;
      const warningLines = doc.splitTextToSize(warningText, pageW - 2 * M - 10);
      doc.text(warningLines, M + 5, y + 27);
      doc.setFont("helvetica", "normal");
    }
    y += buyerH + 6;

    // ─── Ventilation de marge (commission MediKong / Net vendeur) ──────
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("VENTILATION DE MARGE", M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Détail commission MediKong et net vendeur par ligne (HT)", M, y + 4);
    y += 7;

    const MCOLS = {
      article: M + 2,
      articleWidth: 62,
      model: M + 66,
      qty: M + 118,
      commUnit: M + 135,
      commTot: M + 152,
      netTot: pageW - M - 2,
    };

    doc.setFillColor(...NAVY);
    doc.rect(M, y, pageW - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text("ARTICLE", MCOLS.article, y + 4.7);
    doc.text("MODÈLE", MCOLS.model, y + 4.7);
    doc.text("QTÉ", MCOLS.qty, y + 4.7, { align: "right" });
    doc.text("COMM./U", MCOLS.commUnit, y + 4.7, { align: "right" });
    doc.text("COMM. TOT.", MCOLS.commTot, y + 4.7, { align: "right" });
    doc.text("NET VENDEUR", MCOLS.netTot, y + 4.7, { align: "right" });
    y += 7;

    let totalCommission = 0;
    let totalNet = 0;
    let missingCost = false;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    let mIdx = 0;
    for (const l of lines as any[]) {
      const b = computeLineBreakdown(l);
      const qty = Number(l.quantity) || 0;
      const commTot = b.commission * qty;
      const netTot = b.netRevenue * qty;
      totalCommission += commTot;
      totalNet += netTot;
      if (b.model === "margin_split" && !b.hasCost) missingCost = true;

      const label = doc.splitTextToSize(String(l.manual_label || l.products?.name || "—"), MCOLS.articleWidth);
      const modelText = doc.splitTextToSize(b.modelLabel, MCOLS.qty - MCOLS.model - 2);
      const formulaText = doc.splitTextToSize(b.formula, MCOLS.qty - MCOLS.model - 2);
      const rowH = Math.max(8, Math.max(label.length, modelText.length + formulaText.length + 0.5) * 3.4 + 2.5);

      if (y + rowH > pageH - 40) { doc.addPage(); y = 20; }

      if (mIdx % 2 === 0) {
        doc.setFillColor(...SOFT);
        doc.rect(M, y, pageW - 2 * M, rowH, "F");
      }
      doc.setTextColor(...NAVY);
      doc.text(label, MCOLS.article, y + 3.5);
      doc.setTextColor(...MUTED);
      doc.text(modelText, MCOLS.model, y + 3.5);
      doc.setFontSize(6.5);
      doc.text(formulaText, MCOLS.model, y + 3.5 + modelText.length * 3.4 + 1);
      doc.setFontSize(7.5);
      doc.setTextColor(...NAVY);
      doc.text(String(qty), MCOLS.qty, y + 3.5, { align: "right" });
      doc.text(fmtEur(Math.round(b.commission * 100), currency), MCOLS.commUnit, y + 3.5, { align: "right" });
      doc.setTextColor(180, 83, 9); // amber
      doc.text(fmtEur(Math.round(commTot * 100), currency), MCOLS.commTot, y + 3.5, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND);
      doc.text(fmtEur(Math.round(netTot * 100), currency), MCOLS.netTot, y + 3.5, { align: "right" });
      doc.setFont("helvetica", "normal");

      y += rowH;
      mIdx += 1;
    }

    // Totaux ventilation
    doc.setDrawColor(...LINE);
    doc.line(M, y, pageW - M, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Total commission MediKong", MCOLS.model, y);
    doc.setTextColor(180, 83, 9);
    doc.text(fmtEur(Math.round(totalCommission * 100), currency), MCOLS.commTot, y, { align: "right" });
    doc.setTextColor(...MUTED);
    doc.text("Net vendeur", MCOLS.commTot + 6, y + 5, { align: "right" });
    doc.setTextColor(...BRAND);
    doc.text(fmtEur(Math.round(totalNet * 100), currency), MCOLS.netTot, y + 5, { align: "right" });
    y += 10;

    if (missingCost) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text(
        "Note : coût d'achat manquant sur certaines lignes en ventilation de marge — commission calculée à 0.",
        M,
        y,
      );
      y += 5;
      doc.setFont("helvetica", "normal");
    }

    // ─── Récapitulatif financier vendeur ───────────────────────────────
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    const summaryW = pageW - 2 * M;
    const summaryH = 44;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.roundedRect(M, y, summaryW, summaryH, 1.5, 1.5, "FD");
    doc.setFillColor(...BRAND);
    doc.rect(M, y, summaryW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("RÉCAPITULATIF FINANCIER VENDEUR", M + 5, y + 5);

    const valX = M + summaryW - 5;
    let sy = y + 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Total HT", M + 5, sy);
    doc.setTextColor(...NAVY);
    doc.text(fmtEur(Math.round(totalHt * 100), currency), valX, sy, { align: "right" });
    sy += 5.5;

    doc.setTextColor(...MUTED);
    doc.text("TVA", M + 5, sy);
    doc.setTextColor(...NAVY);
    doc.text(fmtEur(Math.round(totalTva * 100), currency), valX, sy, { align: "right" });
    sy += 5.5;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text("Total TTC", M + 5, sy);
    doc.text(fmtEur(Math.round(totalTtc * 100), currency), valX, sy, { align: "right" });
    sy += 7;

    doc.setDrawColor(...LINE);
    doc.line(M + 5, sy - 2, M + summaryW - 5, sy - 2);
    sy += 4;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 83, 9);
    doc.text("Commission totale MediKong", M + 5, sy);
    doc.text(fmtEur(Math.round(totalCommission * 100), currency), valX, sy, { align: "right" });
    sy += 5.5;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND);
    doc.text("Net vendeur total", M + 5, sy);
    doc.text(fmtEur(Math.round(totalNet * 100), currency), valX, sy, { align: "right" });

    y += summaryH + 6;

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE);
      doc.line(M, pageH - 14, pageW - M, pageH - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Bon de commande ${order.order_number} — vue vendeur`, M, pageH - 9);
      doc.text("MediKong SRL · TVA BE 1005.771.323 · medikong.pro", pageW / 2, pageH - 9, { align: "center" });
      doc.text(`Page ${p} / ${pageCount}`, pageW - M, pageH - 9, { align: "right" });
    }

    // Upload
    const pdfBytes = doc.output("arraybuffer");
    const pdfPath = `${order.id}/vendor-${vendorRow.id}-${order.order_number}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(pdfPath, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (upErr) return json(500, { error: "upload_failed", details: upErr.message });

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_TTL);

    return json(200, {
      ok: true,
      pdf_path: pdfPath,
      pdf_url: signed?.signedUrl,
      order_number: order.order_number,
    });
  } catch (e) {
    console.error("generate-vendor-order-pdf error", e);
    return json(500, { error: "internal", message: String((e as any)?.message ?? e) });
  }
});
