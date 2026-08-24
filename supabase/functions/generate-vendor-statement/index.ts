// @ts-nocheck — Deno runtime
// Sprint 3b — Génération du relevé mensuel de transfert vendeur ("settlement statement").
// Agrège les order_invoices du mois pour le vendeur + les Stripe transfers depuis order_transfers,
// produit un PDF (jsPDF) uploadé dans le bucket `vendor-statements`, upsert dans vendor_statements.
//
// Auth : admin (via JWT) ou service_role (cron).
// Body : { vendor_id: uuid, year: int, month: int (1-12), send_email?: bool }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { jsPDF } from "npm:jspdf@2.5.2";
import { MEDIKONG_LOGO_PNG_BASE64 } from "../_shared/medikong-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKET = "vendor-statements";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" })
    .format(n || 0)
    .replace(/\u202F/g, " ");
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth: admin OR service_role (cron)
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.replace("Bearer ", "").trim() === serviceKey;

    if (!isServiceRole) {
      if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: authErr } = await userClient.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      if (authErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });
      const { data: isAdm } = await admin.rpc("is_admin", { _user_id: claims.claims.sub });
      if (!isAdm) return json(403, { error: "admin_only" });
    }

    const body = await req.json().catch(() => ({}));
    const vendorId = String(body?.vendor_id || "");
    const year = Number(body?.year);
    const month = Number(body?.month);
    const sendEmail = Boolean(body?.send_email);

    if (!vendorId || !year || !month || month < 1 || month > 12) {
      return json(400, { error: "vendor_id, year, month (1-12) required" });
    }

    // Vendor
    const { data: vendor, error: vErr } = await admin
      .from("vendors")
      .select("id, name, company_name, vat_number, address_line1, city, postal_code, country_code, email")
      .eq("id", vendorId)
      .maybeSingle();
    if (vErr || !vendor) return json(404, { error: "vendor_not_found" });

    // Période — bornes du mois en UTC
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    // Récupère toutes les commandes du vendeur avec au moins une invoice self_billing sur la période
    // On agrège via order_invoices type=self_billing (montant vendeur brut TTC = amount_incl_vat)
    const { data: invoices, error: iErr } = await admin
      .from("order_invoices")
      .select("id, order_id, type, amount_excl_vat, vat_amount, amount_incl_vat, issued_at, created_at, orders:order_id(order_number, created_at)")
      .eq("vendor_id", vendorId)
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString());
    if (iErr) return json(500, { error: "invoices_fetch_failed", details: iErr.message });

    // Transfers Stripe du mois pour ce vendeur (amount, commission_amount en cents)
    const { data: transfers } = await admin
      .from("order_transfers")
      .select("order_id, amount, commission_amount, commission_rate, status")
      .eq("vendor_id", vendorId)
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString());

    const transferByOrder = new Map<string, { amountCents: number; commissionCents: number }>();
    (transfers || []).forEach((t: any) => {
      const cur = transferByOrder.get(t.order_id) || { amountCents: 0, commissionCents: 0 };
      cur.amountCents += Number(t.amount || 0);
      cur.commissionCents += Number(t.commission_amount || 0);
      transferByOrder.set(t.order_id, cur);
    });

    // Regroupement par commande
    type Row = {
      order_id: string;
      order_number: string;
      order_date: string;
      gross_ttc: number;
      commission_ht: number;
      commission_vat: number;
      net_transferred: number;
    };
    const byOrder = new Map<string, Row>();
    for (const inv of invoices || []) {
      const oid = inv.order_id;
      const row = byOrder.get(oid) || {
        order_id: oid,
        order_number: inv.orders?.order_number || "—",
        order_date: inv.orders?.created_at || inv.created_at,
        gross_ttc: 0,
        commission_ht: 0,
        commission_vat: 0,
        net_transferred: 0,
      };
      if (inv.type === "self_billing") {
        // Self-billing = ce que le vendeur nous a facturé → brut vendeur TTC
        row.gross_ttc += Number(inv.amount_incl_vat || 0);
      } else if (inv.type === "commission") {
        // Facture de commission MediKong au vendeur
        row.commission_ht += Number(inv.amount_excl_vat || 0);
        row.commission_vat += Number(inv.vat_amount || 0);
      }
      byOrder.set(oid, row);
    }

    // Net transféré : Stripe transfer si présent, sinon calculé = brut TTC - commission TTC
    let totalGrossTtc = 0;
    let totalCommissionHt = 0;
    let totalCommissionVat = 0;
    let totalNet = 0;

    const rows: Row[] = [];
    for (const row of byOrder.values()) {
      const t = transferByOrder.get(row.order_id);
      if (t && t.amountCents > 0) {
        row.net_transferred = (t.amountCents - t.commissionCents) / 100;
      } else {
        row.net_transferred = row.gross_ttc - (row.commission_ht + row.commission_vat);
      }
      totalGrossTtc += row.gross_ttc;
      totalCommissionHt += row.commission_ht;
      totalCommissionVat += row.commission_vat;
      totalNet += row.net_transferred;
      rows.push(row);
    }
    rows.sort((a, b) => (a.order_date < b.order_date ? -1 : 1));

    // ─── PDF ────────────────────────────────────────────────────────────
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
    try { doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", M, y + 5, 58, 12.1); } catch (_) {}

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

    y += 30;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    y += 6;

    // Titre
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...BRAND);
    doc.text("RELEVÉ DE COMPTE", M, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(`${MONTHS_FR[month - 1].toUpperCase()} ${year}`, M, y + 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Émis le", M, y + 18);
    doc.setTextColor(...NAVY);
    doc.text(new Date().toLocaleDateString("fr-BE"), M + 18, y + 18);

    doc.setTextColor(...MUTED);
    doc.text("Nature", M, y + 23);
    doc.setTextColor(...NAVY);
    doc.text("Relevé comptable (n'est pas une facture)", M + 18, y + 23);

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
    doc.text(String(vendor.company_name || vendor.name || "—"), cardX + 4, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    let cy = y + 16;
    if (vendor.address_line1) { doc.text(String(vendor.address_line1), cardX + 4, cy); cy += 4; }
    if (vendor.postal_code || vendor.city) {
      doc.text(`${vendor.postal_code ?? ""} ${vendor.city ?? ""} ${vendor.country_code ? `(${vendor.country_code})` : ""}`.trim(), cardX + 4, cy);
      cy += 4;
    }
    if (vendor.vat_number) { doc.text(`TVA : ${vendor.vat_number}`, cardX + 4, cy); cy += 4; }

    y += 46;

    // ─── Tableau lignes ────────────────────────────────────────────────
    const COLS = {
      order: M + 2,
      date: M + 42,
      brut: M + 82,
      commHt: M + 112,
      commVat: M + 142,
      net: pageW - M - 2,
    };

    doc.setFillColor(...NAVY);
    doc.rect(M, y, pageW - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("N° COMMANDE", COLS.order, y + 4.7);
    doc.text("DATE", COLS.date, y + 4.7);
    doc.text("BRUT TTC", COLS.brut, y + 4.7, { align: "right" });
    doc.text("COMMISSION HT", COLS.commHt, y + 4.7, { align: "right" });
    doc.text("TVA COMM.", COLS.commVat, y + 4.7, { align: "right" });
    doc.text("NET REVERSÉ", COLS.net, y + 4.7, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (rows.length === 0) {
      doc.setTextColor(...MUTED);
      doc.text("Aucune commande sur la période.", M + 2, y + 5);
      y += 10;
    } else {
      let rowIdx = 0;
      for (const r of rows) {
        const rowH = 6.5;
        if (y + rowH > pageH - 70) { doc.addPage(); y = 20; }
        if (rowIdx % 2 === 0) {
          doc.setFillColor(...SOFT);
          doc.rect(M, y, pageW - 2 * M, rowH, "F");
        }
        doc.setTextColor(...NAVY);
        doc.text(r.order_number, COLS.order, y + 4.3);
        doc.setTextColor(...MUTED);
        doc.text(new Date(r.order_date).toLocaleDateString("fr-BE"), COLS.date, y + 4.3);
        doc.setTextColor(...NAVY);
        doc.text(fmtEur(r.gross_ttc), COLS.brut, y + 4.3, { align: "right" });
        doc.setTextColor(...MUTED);
        doc.text(fmtEur(r.commission_ht), COLS.commHt, y + 4.3, { align: "right" });
        doc.text(fmtEur(r.commission_vat), COLS.commVat, y + 4.3, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY);
        doc.text(fmtEur(r.net_transferred), COLS.net, y + 4.3, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += rowH;
        rowIdx += 1;
      }
    }

    doc.setDrawColor(...LINE);
    doc.line(M, y, pageW - M, y);
    y += 8;
    if (y > pageH - 65) { doc.addPage(); y = 20; }

    // ─── Totaux ────────────────────────────────────────────────────────
    const totBoxW = 95;
    const totBoxX = pageW - M - totBoxW;
    const totLabelX = totBoxX + 4;
    const totValueX = totBoxX + totBoxW - 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`TOTAUX ${MONTHS_FR[month - 1].toUpperCase()} ${year}`, totLabelX, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text("Ventes brutes TTC", totLabelX, y);
    doc.setTextColor(...NAVY);
    doc.text(fmtEur(totalGrossTtc), totValueX, y, { align: "right" });
    y += 5.5;
    doc.setTextColor(...MUTED);
    doc.text("Commissions prélevées HT", totLabelX, y);
    doc.setTextColor(...NAVY);
    doc.text(`- ${fmtEur(totalCommissionHt)}`, totValueX, y, { align: "right" });
    y += 5.5;
    doc.setTextColor(...MUTED);
    doc.text("TVA sur commissions", totLabelX, y);
    doc.setTextColor(...NAVY);
    doc.text(`- ${fmtEur(totalCommissionVat)}`, totValueX, y, { align: "right" });
    y += 4;
    doc.setDrawColor(...LINE);
    doc.line(totBoxX, y, totBoxX + totBoxW, y);
    y += 4;

    doc.setFillColor(...BRAND);
    doc.rect(totBoxX, y - 4, totBoxW, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Net transféré sur votre compte", totLabelX, y + 3);
    doc.text(fmtEur(totalNet), totValueX, y + 3, { align: "right" });
    y += 14;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Les transferts ont été effectués via Stripe Connect sur le compte bancaire enregistré.",
      M, y, { maxWidth: pageW - 2 * M },
    );
    y += 5;
    doc.text(
      "Ce document est un relevé comptable récapitulatif. Il ne constitue pas une facture et n'est pas soumis à la facturation électronique Peppol.",
      M, y, { maxWidth: pageW - 2 * M },
    );

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE);
      doc.line(M, pageH - 14, pageW - M, pageH - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Relevé ${MONTHS_FR[month - 1]} ${year} · ${vendor.company_name || vendor.name}`, M, pageH - 9);
      doc.text("MediKong SRL · TVA BE 1005.771.323 · medikong.pro", pageW / 2, pageH - 9, { align: "center" });
      doc.text(`Page ${p} / ${pageCount}`, pageW - M, pageH - 9, { align: "right" });
    }

    // ─── Upload + upsert ───────────────────────────────────────────────
    const pdfBytes = doc.output("arraybuffer");
    const paddedMonth = String(month).padStart(2, "0");
    const pdfPath = `${vendor.id}/${year}-${paddedMonth}-releve.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(pdfPath, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (upErr) return json(500, { error: "upload_failed", details: upErr.message });

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_TTL);

    const { data: stmt, error: upsertErr } = await admin
      .from("vendor_statements")
      .upsert({
        vendor_id: vendor.id,
        period_year: year,
        period_month: month,
        total_gross_ttc: Number(totalGrossTtc.toFixed(2)),
        total_commission_ht: Number(totalCommissionHt.toFixed(2)),
        total_commission_vat: Number(totalCommissionVat.toFixed(2)),
        total_net_transferred: Number(totalNet.toFixed(2)),
        order_count: rows.length,
        pdf_path: pdfPath,
        pdf_url: signed?.signedUrl || null,
        generated_at: new Date().toISOString(),
      }, { onConflict: "vendor_id,period_year,period_month" })
      .select()
      .single();
    if (upsertErr) return json(500, { error: "upsert_failed", details: upsertErr.message });

    // Email best-effort (relevé disponible)
    if (sendEmail && vendor.email) {
      try {
        await admin.functions.invoke("send-app-email", {
          body: {
            templateName: "vendor-statement-ready",
            recipientEmail: vendor.email,
            idempotencyKey: `vendor-statement-${stmt.id}`,
            templateData: {
              vendorName: vendor.company_name || vendor.name,
              periodLabel: `${MONTHS_FR[month - 1]} ${year}`,
              totalNet: fmtEur(totalNet),
              orderCount: rows.length,
              pdfUrl: signed?.signedUrl,
            },
          },
        });
        await admin.from("vendor_statements").update({ email_sent_at: new Date().toISOString() }).eq("id", stmt.id);
      } catch (e) {
        console.warn("vendor-statement email failed:", e);
      }
    }

    return json(200, {
      ok: true,
      statement_id: stmt.id,
      pdf_path: pdfPath,
      pdf_url: signed?.signedUrl,
      totals: {
        gross_ttc: totalGrossTtc,
        commission_ht: totalCommissionHt,
        commission_vat: totalCommissionVat,
        net_transferred: totalNet,
        order_count: rows.length,
      },
    });
  } catch (e) {
    console.error("generate-vendor-statement error", e);
    return json(500, { error: "internal", message: String((e as any)?.message ?? e) });
  }
});
