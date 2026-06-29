// @ts-nocheck — Deno runtime
// Génère un PDF "Décompte fournisseur" prêt à envoyer : une page par vendeur
// avec lignes commandées, CA HT, commission MediKong, coût/marge (si connus)
// et net HT à reverser. Peut filtrer sur un vendor_id précis.
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
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

function fmtEur(cents: number, currency = "EUR"): string {
  const amount = (cents || 0) / 100;
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency }).format(amount).replace(/\u202F/g, ".");
}

const toNum = (v: any): number => {
  if (v === null || v === undefined || v === "") return NaN;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function lineMetrics(l: any) {
  const qty = Math.max(0, Math.trunc(toNum(l.quantity) || 0));
  const sellC = Math.round((toNum(l.unit_price_excl_vat) || 0) * 100);
  const costRaw = toNum(l.unit_cost_excl_vat);
  const hasCost = Number.isFinite(costRaw) && costRaw > 0;
  const costC = hasCost ? Math.round(costRaw * 100) : 0;
  const caC = sellC * qty;
  const costTotalC = costC * qty;
  const rate = toNum(l.commission_rate);
  const amt = toNum(l.commission_amount);
  const basis = l.commission_basis === "margin" ? "margin" : "ca";
  let commissionC = 0;
  if (Number.isFinite(amt) && amt >= 0) commissionC = Math.round(amt * 100) * qty;
  else if (Number.isFinite(rate) && rate >= 0) {
    const baseC = basis === "margin" && hasCost ? caC - costTotalC : caC;
    commissionC = Math.round((baseC * rate) / 100);
  }
  if (commissionC < 0) commissionC = 0;
  return {
    qty,
    caC,
    costC: costTotalC,
    hasCost,
    commissionC,
    netC: caC - commissionC,
    marginC: hasCost ? caC - costTotalC - commissionC : 0,
  };
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

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;
    const vendorFilter = body?.vendor_id || null;
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

    // Lignes (persistées) avec vendeur
    let { data: lines } = await adminClient
      .from("order_lines")
      .select("*, products(name, gtin, cnk_code), vendors(id, company_name, name, vat_number, address_line1, postal_code, city, country_code, bank_name, iban, bic, email)")
      .eq("order_id", orderId);

    const draftLines = Array.isArray((order as any).draft_payload?.lines) ? (order as any).draft_payload.lines as any[] : [];

    // Fallback intégral si draft
    if ((!lines || lines.length === 0) && draftLines.length > 0) {
      const productIds = Array.from(new Set(draftLines.map((l) => l.product_id).filter(Boolean)));
      const vendorIds = Array.from(new Set(draftLines.map((l) => l.vendor_id).filter(Boolean)));
      const [{ data: prods }, { data: vends }] = await Promise.all([
        productIds.length ? adminClient.from("products").select("id, name, gtin, cnk_code").in("id", productIds) : Promise.resolve({ data: [] as any[] }),
        vendorIds.length ? adminClient.from("vendors").select("id, name, company_name, vat_number, address_line1, postal_code, city, country_code, bank_name, iban, bic, email").in("id", vendorIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
      const vendMap = new Map((vends || []).map((v: any) => [v.id, v]));
      lines = draftLines.map((l: any) => ({
        quantity: Number(l.quantity) || 0,
        unit_price_excl_vat: Number(l.unit_price_excl_vat) || 0,
        vat_rate: Number(l.vat_rate) || 0,
        line_total_excl_vat: (Number(l.quantity) || 0) * (Number(l.unit_price_excl_vat) || 0),
        manual_label: l.manual_label || l.offer_label,
        unit_cost_excl_vat: l.unit_cost_excl_vat ?? null,
        commission_rate: l.commission_rate ?? null,
        commission_amount: l.commission_amount ?? null,
        commission_basis: l.commission_basis ?? null,
        vendor_id: l.vendor_id || null,
        products: prodMap.get(l.product_id) || null,
        vendors: vendMap.get(l.vendor_id) || null,
      })) as any[];
    } else if (lines && lines.length > 0 && draftLines.length > 0) {
      // Merge commission/cost depuis draft_payload (clé product+vendor+prix)
      const idx = new Map<string, any>();
      for (const dl of draftLines) {
        const k = `${dl.product_id || ""}|${dl.vendor_id || ""}|${dl.unit_price_excl_vat ?? ""}`;
        if (!idx.has(k)) idx.set(k, dl);
      }
      for (const pl of lines as any[]) {
        const k = `${pl.product_id || ""}|${pl.vendor_id || ""}|${pl.unit_price_excl_vat ?? ""}`;
        const dl = idx.get(k);
        if (dl) {
          pl.unit_cost_excl_vat = pl.unit_cost_excl_vat ?? dl.unit_cost_excl_vat ?? null;
          pl.commission_rate = pl.commission_rate ?? dl.commission_rate ?? null;
          pl.commission_amount = pl.commission_amount ?? dl.commission_amount ?? null;
          pl.commission_basis = pl.commission_basis ?? dl.commission_basis ?? null;
        }
      }
    }

    let allLines = (lines || []) as any[];
    if (vendorFilter) allLines = allLines.filter((l) => (l.vendors?.id || l.vendor_id) === vendorFilter);
    if (allLines.length === 0) {
      return new Response(JSON.stringify({ error: "no_lines" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group by vendor
    const groups = new Map<string, { vendor: any; lines: any[] }>();
    for (const l of allLines) {
      const vid = l.vendors?.id || l.vendor_id || "__unknown__";
      const g = groups.get(vid) || { vendor: l.vendors, lines: [] };
      g.lines.push(l);
      groups.set(vid, g);
    }

    // ─── PDF ─────
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const M = 15;
    const BRAND: [number, number, number] = [16, 185, 129]; // emerald — décompte = net vendeur
    const NAVY: [number, number, number] = [30, 37, 47];
    const MUTED: [number, number, number] = [100, 116, 139];
    const LINE: [number, number, number] = [226, 232, 240];
    const SOFT: [number, number, number] = [248, 250, 252];

    let firstPage = true;
    for (const [, g] of groups) {
      if (!firstPage) doc.addPage();
      firstPage = false;

      // Bandeau
      doc.setFillColor(...BRAND);
      doc.rect(0, 0, pageW, 4, "F");

      let y = 12;
      try { doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", M, y + 5, 58, 12.1); } catch (_) {}

      // Émetteur (droite)
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
      doc.setDrawColor(...LINE);
      doc.line(M, y, pageW - M, y);
      y += 6;

      // Titre
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...BRAND);
      doc.text("DÉCOMPTE FOURNISSEUR", M, y + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("Commande", M, y + 11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...NAVY);
      doc.text(String(order.order_number || "—"), M, y + 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("Date commande", M, y + 22);
      doc.setTextColor(...NAVY);
      doc.text(new Date(order.created_at).toLocaleDateString("fr-BE"), M + 30, y + 22);

      doc.setTextColor(...MUTED);
      doc.text("Édité le", M, y + 27);
      doc.setTextColor(...NAVY);
      doc.text(new Date().toLocaleDateString("fr-BE"), M + 30, y + 27);

      // Carte fournisseur
      const v = g.vendor || {};
      const cardX = pageW - M - 85;
      const cardW = 85;
      doc.setFillColor(...SOFT);
      doc.setDrawColor(...LINE);
      doc.roundedRect(cardX, y, cardW, 32, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("FOURNISSEUR", cardX + 4, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...NAVY);
      doc.text(String(v.company_name || v.name || "—"), cardX + 4, y + 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      let cy = y + 16;
      if (v.address_line1) { doc.text(String(v.address_line1), cardX + 4, cy); cy += 4; }
      if (v.postal_code || v.city) {
        doc.text(`${v.postal_code ?? ""} ${v.city ?? ""} ${v.country_code ? `(${v.country_code})` : ""}`.trim(), cardX + 4, cy); cy += 4;
      }
      if (v.vat_number) { doc.text(`TVA : ${v.vat_number}`, cardX + 4, cy); cy += 4; }
      if (v.email) { doc.text(String(v.email), cardX + 4, cy); cy += 4; }

      y += 38;

      // Tableau lignes
      const COLS = {
        article: M + 2,
        articleWidth: 78,
        qty: M + 92,
        puHt: M + 110,
        ca: M + 134,
        com: M + 160,
        net: pageW - M - 2,
      };
      doc.setFillColor(...NAVY);
      doc.rect(M, y, pageW - 2 * M, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text("ARTICLE", COLS.article, y + 4.7);
      doc.text("QTÉ", COLS.qty, y + 4.7, { align: "right" });
      doc.text("PU HT", COLS.puHt, y + 4.7, { align: "right" });
      doc.text("CA HT", COLS.ca, y + 4.7, { align: "right" });
      doc.text("COM. MK", COLS.com, y + 4.7, { align: "right" });
      doc.text("NET HT", COLS.net, y + 4.7, { align: "right" });
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      let rowIdx = 0;
      let totalCaC = 0, totalComC = 0, totalNetC = 0, totalCostC = 0, totalMarginC = 0;
      let hasAnyCost = false;
      for (const l of g.lines) {
        const m = lineMetrics(l);
        const label = doc.splitTextToSize(String(l.manual_label || l.products?.name || "—"), COLS.articleWidth);
        const cnk = (l as any).cnk_code || l.products?.cnk_code || null;
        const codeLine = cnk ? `CNK ${cnk}` : null;
        const extraLines = codeLine ? 1 : 0;
        const rowH = Math.max(6, (label.length + extraLines) * 3.4 + 2.5);
        if (y + rowH > pageH - 70) { doc.addPage(); y = 20; }
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
        doc.text(String(m.qty), COLS.qty, y + 3.5, { align: "right" });
        doc.text(fmtEur(Math.round((Number(l.unit_price_excl_vat) || 0) * 100)), COLS.puHt, y + 3.5, { align: "right" });
        doc.text(fmtEur(m.caC), COLS.ca, y + 3.5, { align: "right" });
        doc.setTextColor(...MUTED);
        doc.text(fmtEur(m.commissionC), COLS.com, y + 3.5, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND);
        doc.text(fmtEur(m.netC), COLS.net, y + 3.5, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += rowH;
        rowIdx += 1;
        totalCaC += m.caC; totalComC += m.commissionC; totalNetC += m.netC;
        if (m.hasCost) { hasAnyCost = true; totalCostC += m.costC; totalMarginC += m.marginC; }
      }
      doc.setDrawColor(...LINE);
      doc.line(M, y, pageW - M, y);
      y += 8;

      if (y > pageH - 60) { doc.addPage(); y = 20; }

      // Récap droit
      const totBoxW = 95;
      const totBoxX = pageW - M - totBoxW;
      const totLabelX = totBoxX + 4;
      const totValueX = totBoxX + totBoxW - 4;
      const pct = totalCaC > 0 ? (totalComC / totalCaC) * 100 : 0;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text("CA HT vendeur", totLabelX, y);
      doc.setTextColor(...NAVY);
      doc.text(fmtEur(totalCaC), totValueX, y, { align: "right" });
      y += 5.5;
      doc.setTextColor(...MUTED);
      doc.text(`Commission MediKong (${pct.toFixed(1)} %)`, totLabelX, y);
      doc.setTextColor(...NAVY);
      doc.text(`- ${fmtEur(totalComC)}`, totValueX, y, { align: "right" });
      y += 5.5;
      if (hasAnyCost) {
        doc.setTextColor(...MUTED);
        doc.text("Coût d'achat HT (info)", totLabelX, y);
        doc.setTextColor(...NAVY);
        doc.text(fmtEur(totalCostC), totValueX, y, { align: "right" });
        y += 5.5;
        doc.setTextColor(...MUTED);
        doc.text("Marge nette vendeur (info)", totLabelX, y);
        doc.setTextColor(...NAVY);
        doc.text(fmtEur(totalMarginC), totValueX, y, { align: "right" });
        y += 5.5;
      }
      doc.setDrawColor(...LINE);
      doc.line(totBoxX, y, totBoxX + totBoxW, y);
      y += 4;

      doc.setFillColor(...BRAND);
      doc.rect(totBoxX, y - 4, totBoxW, 11, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("NET À REVERSER HT", totLabelX, y + 3);
      doc.text(fmtEur(totalNetC), totValueX, y + 3, { align: "right" });
      y += 14;

      // Coordonnées bancaires (rappel) — gated par order.show_payment_info
      const showPaymentInfo = (order as any).show_payment_info !== false;
      if (showPaymentInfo && (v.iban || v.bank_name)) {
        if (y > pageH - 40) { doc.addPage(); y = 20; }
        doc.setFillColor(...SOFT);
        doc.setDrawColor(...LINE);
        const bkH = 22;
        doc.roundedRect(M, y, pageW - 2 * M, bkH, 1.5, 1.5, "FD");
        doc.setFillColor(...BRAND);
        doc.rect(M, y, 1.5, bkH, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text("VIREMENT — RAPPEL COORDONNÉES", M + 5, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        let by = y + 11;
        if (v.bank_name) { doc.text(`Banque : ${v.bank_name}`, M + 5, by); by += 4.5; }
        if (v.iban) { doc.text(`IBAN : ${v.iban}`, M + 5, by); by += 4.5; }
        if (v.bic) { doc.text(`BIC : ${v.bic}`, M + 5, by); by += 4.5; }
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY);
        doc.text("Communication", pageW - M - 5, y + 11, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(String(order.order_number), pageW - M - 5, y + 16, { align: "right" });
        y += bkH + 4;
      }

      // Note bas
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(
        "Document informatif émis par MediKong à des fins de réconciliation. Les montants \"coût\" et \"marge nette vendeur\" sont indicatifs et basés sur les données encodées dans la commande.",
        M, pageH - 22, { maxWidth: pageW - 2 * M },
      );
    }

    // Footer toutes pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE);
      doc.line(M, pageH - 14, pageW - M, pageH - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Décompte fournisseur — ${order.order_number}`, M, pageH - 9);
      doc.text("MediKong — Balooh SRL · TVA BE 1005.771.323 · medikong.pro", pageW / 2, pageH - 9, { align: "center" });
      doc.text(`Page ${p} / ${pageCount}`, pageW - M, pageH - 9, { align: "right" });
    }

    const pdfBytes = doc.output("arraybuffer");
    const fname = vendorFilter
      ? `${order.order_number}-decompte-${vendorFilter.slice(0, 8)}.pdf`
      : `${order.order_number}-decompte-fournisseurs.pdf`;
    const pdfPath = `${order.id}/payouts/${fname}`;
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
      vendors: groups.size,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-vendor-payout-pdf error", e);
    return new Response(JSON.stringify({ error: "internal", message: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
