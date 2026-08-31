// @ts-nocheck — Deno runtime
// Vendor payout statement PDF ("décompte fournisseur")
// - Vendeur : ses propres lignes sur une commande (optionnel : tracking_number = une expédition).
// - Admin : peut passer vendor_id, ou générer pour TOUS les vendeurs de la commande
//   (réponse `pdfs: [{ vendor_id, pdf_url }]`, avec `pdf_url` = premier pour rétro-compat).
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

function slugTracking(t: string | null | undefined): string {
  if (!t) return "";
  return String(t).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
}

// Compute commission on gross ex-VAT amount, mirroring computeMargin() logic.
function computeCommission(
  unitPriceHt: number,
  costPrice: number | null,
  cfg: { commission_model: string; commission_rate: number | null; margin_split_pct: number | null; fixed_commission_amount: number | null },
): number {
  const model = cfg.commission_model || "flat_percentage";
  if (model === "fixed_amount") {
    return Number(cfg.fixed_commission_amount) || 0;
  }
  if (model === "margin_split") {
    const cost = Number(costPrice) || 0;
    const grossMargin = unitPriceHt - cost;
    if (grossMargin <= 0) return 0;
    const pct = Number(cfg.margin_split_pct) || 0;
    return grossMargin * (pct / 100);
  }
  // flat_percentage
  const rate = Number(cfg.commission_rate) || 0;
  return unitPriceHt * (rate / 100);
}

const VENDOR_COLUMNS =
  "id, name, company_name, vat_number, address_line1, postal_code, city, country_code, phone, email, bank_name, iban, bic";

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
    const trackingFilter: string | null = body?.tracking_number ? String(body.tracking_number) : null;
    const preferredVendorId: string | null = body?.vendor_id ? String(body.vendor_id) : null;
    if (!orderId || typeof orderId !== "string") return json(400, { error: "order_id required" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_number, status, created_at, tracking_number, tracking_url, tracking_carrier, shipped_at")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) return json(404, { error: "order_not_found" });

    // ─── Génération du décompte pour UN vendeur ─────────────────────
    async function generateForVendor(vendorRow: any) {
      let linesQuery = admin
        .from("order_lines")
        .select("id, offer_id, quantity, quantity_shipped, unit_price_excl_vat, vat_rate, line_total_excl_vat, manual_label, tracking_number, tracking_url, fulfillment_status, cost_price, commission_amount, commission_computed, commission_basis, commission_rate, products(name, gtin, cnk_code)")
        .eq("order_id", orderId)
        .eq("vendor_id", vendorRow.id);

      if (trackingFilter) {
        linesQuery = linesQuery.eq("tracking_number", trackingFilter);
      }

      const { data: lines, error: lErr } = await linesQuery;
      if (lErr) throw Object.assign(new Error(lErr.message), { code: "lines_fetch_failed" });
      if (!lines || lines.length === 0) return null; // aucun décompte pour ce vendeur

      // Resolve effective commission per offer
      const offerIds = [...new Set(lines.map((l: any) => l.offer_id).filter(Boolean))];
      const commissionByOffer = new Map<string, any>();
      for (const offerId of offerIds) {
        const { data: c } = await admin.rpc("resolve_effective_commission", { _offer_id: offerId });
        const row = Array.isArray(c) ? c[0] : c;
        if (row) commissionByOffer.set(offerId, row);
      }

      // Compute totals
      let totalGrossHt = 0;
      let totalCommission = 0;
      let totalVat = 0;
      const computedLines = lines.map((l: any) => {
        const cfg = commissionByOffer.get(l.offer_id) || {
          commission_model: "flat_percentage",
          commission_rate: 0,
          margin_split_pct: null,
          fixed_commission_amount: null,
        };
        const qty = Number(l.quantity) || 0;
        const puHt = Number(l.unit_price_excl_vat) || 0;
        const lineHt = Number(l.line_total_excl_vat) || puHt * qty;
        // Priorité aux montants RÉELS stockés sur la ligne (commandes manuelles
        // notamment) : commission_amount / commission_computed sont des TOTAUX
        // de ligne. Fallback sur la config de l'offre si rien n'est stocké.
        const storedRaw = l.commission_amount ?? l.commission_computed;
        const storedN = storedRaw === null || storedRaw === undefined ? NaN : Number(storedRaw);
        const hasStored = Number.isFinite(storedN);
        const commissionPerUnit = hasStored ? (qty > 0 ? storedN / qty : 0) : computeCommission(puHt, l.cost_price, cfg);
        const lineCommission = hasStored ? storedN : commissionPerUnit * qty;
        const commissionMeta = hasStored && Number(l.commission_rate) > 0
          ? `Com. ${Number(l.commission_rate)} % ${l.commission_basis === "margin" ? "marge" : "CA"}`
          : null;
        const lineVat = (lineHt * (Number(l.vat_rate) || 0)) / 100;
        totalGrossHt += lineHt;
        totalCommission += lineCommission;
        totalVat += lineVat;
        return { l, cfg, lineHt, lineCommission, lineVat, commissionPerUnit, commissionMeta };
      });
      const totalNetHt = totalGrossHt - totalCommission;
      const totalTtc = totalGrossHt + totalVat;
      const currency = "EUR";

      // ─── PDF ──────────────────────────────────────────────────────────
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
      } catch (_) {}

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text("MediKong", pageW - M, y + 3, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("MediKong SRL", pageW - M, y + 7.5, { align: "right" });
      doc.text("23 rue de la Procession", pageW - M, y + 11.5, { align: "right" });
      doc.text("7822 Meslin-l'Évêque, Belgique", pageW - M, y + 15.5, { align: "right" });
      doc.text("TVA : BE 1005.771.323", pageW - M, y + 19.5, { align: "right" });

      y += 30;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
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
      doc.text("Émis le", M, y + 22);
      doc.setTextColor(...NAVY);
      doc.text(new Date().toLocaleDateString("fr-BE"), M + 18, y + 22);

      doc.setTextColor(...MUTED);
      doc.text("Portée", M, y + 27);
      doc.setTextColor(...NAVY);
      doc.text(trackingFilter ? `Expédition ${trackingFilter}` : "Toutes les lignes vendeur", M + 18, y + 27);

      // Carte fournisseur
      const cardX = pageW - M - 85;
      const cardW = 85;
      doc.setFillColor(...SOFT);
      doc.setDrawColor(...LINE);
      doc.roundedRect(cardX, y, cardW, 40, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("FOURNISSEUR", cardX + 4, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...NAVY);
      doc.text(String(vendorRow.company_name || vendorRow.name || "—"), cardX + 4, y + 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      let cy = y + 16;
      if (vendorRow.address_line1) { doc.text(String(vendorRow.address_line1), cardX + 4, cy); cy += 4; }
      if (vendorRow.postal_code || vendorRow.city) {
        doc.text(`${vendorRow.postal_code ?? ""} ${vendorRow.city ?? ""} ${vendorRow.country_code ? `(${vendorRow.country_code})` : ""}`.trim(), cardX + 4, cy);
        cy += 4;
      }
      if (vendorRow.vat_number) { doc.text(`TVA : ${vendorRow.vat_number}`, cardX + 4, cy); cy += 4; }
      if (vendorRow.iban) { doc.text(`IBAN : ${vendorRow.iban}`, cardX + 4, cy); cy += 4; }
      if (vendorRow.bic) { doc.text(`BIC : ${vendorRow.bic}`, cardX + 4, cy); cy += 4; }

      y += 46;

      // ─── Tableau lignes ──────────────────────────────────────────────
      const COLS = {
        article: M + 2,
        articleWidth: 74,
        qty: M + 88,
        puHt: M + 108,
        brut: M + 132,
        commission: M + 158,
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
      doc.text("BRUT HT", COLS.brut, y + 4.7, { align: "right" });
      doc.text("COMMISSION", COLS.commission, y + 4.7, { align: "right" });
      doc.text("NET HT", COLS.net, y + 4.7, { align: "right" });
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      let rowIdx = 0;
      for (const { l, lineHt, lineCommission, commissionMeta } of computedLines) {
        const label = doc.splitTextToSize(String(l.manual_label || l.products?.name || "—"), COLS.articleWidth);
        const cnk = l.cnk_code || l.products?.cnk_code || null;
        const gtin = l.products?.gtin || null;
        const meta: string[] = [];
        if (cnk) meta.push(`CNK ${cnk}`);
        if (gtin) meta.push(`EAN ${gtin}`);
        if (commissionMeta) meta.push(commissionMeta);
        if (l.tracking_number) meta.push(`Tracking ${l.tracking_number}`);
        const metaLine = meta.length ? meta.join(" · ") : null;
        const extra = metaLine ? 1 : 0;
        const rowH = Math.max(6, (label.length + extra) * 3.4 + 2.5);

        if (y + rowH > pageH - 60) {
          doc.addPage();
          y = 20;
        }

        if (rowIdx % 2 === 0) {
          doc.setFillColor(...SOFT);
          doc.rect(M, y, pageW - 2 * M, rowH, "F");
        }

        const puHt = Number(l.unit_price_excl_vat) || 0;
        const netHt = lineHt - lineCommission;

        doc.setTextColor(...NAVY);
        doc.text(label, COLS.article, y + 3.5);
        if (metaLine) {
          doc.setFontSize(6.5);
          doc.setTextColor(...MUTED);
          doc.text(metaLine, COLS.article, y + 3.5 + label.length * 3.4);
          doc.setFontSize(7.5);
        }
        doc.setTextColor(...NAVY);
        doc.text(String(l.quantity || 0), COLS.qty, y + 3.5, { align: "right" });
        doc.text(fmtEur(Math.round(puHt * 100), currency), COLS.puHt, y + 3.5, { align: "right" });
        doc.text(fmtEur(Math.round(lineHt * 100), currency), COLS.brut, y + 3.5, { align: "right" });
        doc.setTextColor(...MUTED);
        doc.text(`- ${fmtEur(Math.round(lineCommission * 100), currency)}`, COLS.commission, y + 3.5, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY);
        doc.text(fmtEur(Math.round(netHt * 100), currency), COLS.net, y + 3.5, { align: "right" });
        doc.setFont("helvetica", "normal");

        y += rowH;
        rowIdx += 1;
      }

      doc.setDrawColor(...LINE);
      doc.line(M, y, pageW - M, y);
      y += 8;

      if (y > pageH - 70) { doc.addPage(); y = 20; }

      // Totaux
      const totBoxW = 90;
      const totBoxX = pageW - M - totBoxW;
      const totLabelX = totBoxX + 4;
      const totValueX = totBoxX + totBoxW - 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text("Brut HT", totLabelX, y);
      doc.setTextColor(...NAVY);
      doc.text(fmtEur(Math.round(totalGrossHt * 100), currency), totValueX, y, { align: "right" });
      y += 5.5;
      doc.setTextColor(...MUTED);
      doc.text("Commission MediKong", totLabelX, y);
      doc.setTextColor(...NAVY);
      doc.text(`- ${fmtEur(Math.round(totalCommission * 100), currency)}`, totValueX, y, { align: "right" });
      y += 5.5;
      doc.setTextColor(...MUTED);
      doc.text("TVA (info)", totLabelX, y);
      doc.setTextColor(...NAVY);
      doc.text(fmtEur(Math.round(totalVat * 100), currency), totValueX, y, { align: "right" });
      y += 4;
      doc.setDrawColor(...LINE);
      doc.line(totBoxX, y, totBoxX + totBoxW, y);
      y += 4;

      doc.setFillColor(...BRAND);
      doc.rect(totBoxX, y - 4, totBoxW, 11, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("Net à percevoir HT", totLabelX, y + 3);
      doc.text(fmtEur(Math.round(totalNetHt * 100), currency), totValueX, y + 3, { align: "right" });
      y += 14;

      // Mention TTC information
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(
        `Total commande TTC (indicatif) : ${fmtEur(Math.round(totalTtc * 100), currency)}. La TVA est reversée selon les règles fiscales applicables au fournisseur.`,
        M,
        y,
        { maxWidth: pageW - 2 * M },
      );
      y += 8;

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setDrawColor(...LINE);
        doc.line(M, pageH - 14, pageW - M, pageH - 14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(
          `Décompte ${order.order_number}${trackingFilter ? ` · ${trackingFilter}` : ""}`,
          M,
          pageH - 9,
        );
        doc.text("MediKong SRL · TVA BE 1005.771.323 · medikong.pro", pageW / 2, pageH - 9, { align: "center" });
        doc.text(`Page ${p} / ${pageCount}`, pageW - M, pageH - 9, { align: "right" });
      }

      // Upload
      const pdfBytes = doc.output("arraybuffer");
      const suffix = trackingFilter ? `-${slugTracking(trackingFilter)}` : "";
      const pdfPath = `${order.id}/payout-${vendorRow.id}-${order.order_number}${suffix}.pdf`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(pdfPath, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
      if (upErr) throw Object.assign(new Error(upErr.message), { code: "upload_failed" });

      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_TTL);

      return {
        vendor_id: vendorRow.id,
        vendor_name: vendorRow.company_name || vendorRow.name || null,
        pdf_path: pdfPath,
        pdf_url: signed?.signedUrl,
        totals: {
          gross_ht_cents: Math.round(totalGrossHt * 100),
          commission_cents: Math.round(totalCommission * 100),
          net_ht_cents: Math.round(totalNetHt * 100),
          vat_cents: Math.round(totalVat * 100),
        },
      };
    }

    // ─── 1) Chemin vendeur (propriétaire ou membre) ──────────────────
    const { resolveVendorForUser } = await import("../_shared/resolve-vendor.ts");
    const vendorRow = await resolveVendorForUser(admin, userId, preferredVendorId);
    if (vendorRow) {
      const result = await generateForVendor(vendorRow);
      if (!result) return json(404, { error: "no_lines_found" });
      return json(200, {
        ok: true,
        ...result,
        vendors: 1,
        pdfs: [{ vendor_id: result.vendor_id, pdf_url: result.pdf_url }],
        order_number: order.order_number,
        tracking_number: trackingFilter,
      });
    }

    // ─── 2) Chemin admin : vendor_id ciblé ou tous les vendeurs ──────
    const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: userId });
    if (!adminFlag) return json(403, { error: "not_a_vendor" });

    let vendorIds: string[] = [];
    if (preferredVendorId) {
      vendorIds = [preferredVendorId];
    } else {
      let vq = admin.from("order_lines").select("vendor_id").eq("order_id", orderId);
      if (trackingFilter) vq = vq.eq("tracking_number", trackingFilter);
      const { data: vrows, error: vErr } = await vq;
      if (vErr) return json(500, { error: "lines_fetch_failed", details: vErr.message });
      vendorIds = [...new Set((vrows ?? []).map((r: any) => r.vendor_id).filter(Boolean))] as string[];
    }
    if (vendorIds.length === 0) return json(404, { error: "no_lines_found" });

    const { data: vendorRows } = await admin.from("vendors").select(VENDOR_COLUMNS).in("id", vendorIds);

    const results: any[] = [];
    for (const v of vendorRows ?? []) {
      try {
        const r = await generateForVendor(v);
        if (r) results.push(r);
      } catch (e) {
        console.error(`payout pdf failed for vendor ${v.id}`, e);
      }
    }
    if (results.length === 0) return json(404, { error: "no_lines_found" });

    return json(200, {
      ok: true,
      vendors: results.length,
      pdfs: results.map((r) => ({ vendor_id: r.vendor_id, vendor_name: r.vendor_name, pdf_url: r.pdf_url })),
      pdf_url: results[0]?.pdf_url, // rétro-compat
      pdf_path: results[0]?.pdf_path,
      order_number: order.order_number,
      tracking_number: trackingFilter,
      totals: results[0]?.totals,
    });
  } catch (e) {
    console.error("generate-vendor-payout-pdf error", e);
    return json(500, { error: "internal", message: String((e as any)?.message ?? e) });
  }
});
