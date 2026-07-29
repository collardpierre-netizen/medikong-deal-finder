import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { fmtEur } from "@/lib/format-currency";

type PayloadLine = {
  quantity: number | null;
  unit_price_excl_vat: number | null;
  vat_rate: number | null;
  line_total_excl_vat: number | null;
  manual_label?: string | null;
  cnk_code?: string | null;
  products?: { name?: string | null; cnk_code?: string | null; gtin?: string | null } | null;
};

type Payload = {
  order: {
    id: string;
    order_number: string | null;
    status: string | null;
    currency: string;
    created_at: string | null;
    notes?: string | null;
    customer: { company_name?: string | null; email?: string | null } | null;
  };
  lines: PayloadLine[];
  totals: { ht: number; tva: number; ttc: number };
  scope: "admin" | "vendor";
};

type AggRow = { cnk: string | null; name: string; qty: number; ht: number; ttc: number };

function aggregate(lines: PayloadLine[]): { rows: AggRow[]; uniq: number; qty: number; ht: number; tva: number; ttc: number } {
  const map = new Map<string, AggRow>();
  let ht = 0;
  let ttc = 0;
  let qty = 0;
  for (const l of lines) {
    const q = Number(l.quantity) || 0;
    const lineHt = Number(l.line_total_excl_vat) || (Number(l.unit_price_excl_vat) || 0) * q;
    const lineTtc = lineHt * (1 + (Number(l.vat_rate) || 0) / 100);
    const cnk = l.products?.cnk_code || l.cnk_code || null;
    const name = l.manual_label || l.products?.name || "—";
    const key = cnk || `${name}::${l.products?.gtin || ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += q;
      existing.ht += lineHt;
      existing.ttc += lineTtc;
    } else {
      map.set(key, { cnk, name, qty: q, ht: lineHt, ttc: lineTtc });
    }
    ht += lineHt;
    ttc += lineTtc;
    qty += q;
  }
  const rows = Array.from(map.values()).sort((a, b) => b.ht - a.ht);
  return { rows, uniq: rows.length, qty, ht, tva: ttc - ht, ttc };
}

async function getPayload(orderId: string): Promise<Payload> {
  const t0 = performance.now();
  const { data: tokenRes, error: tokErr } = await supabase.functions.invoke("issue-order-pdf-token", {
    body: { order_id: orderId },
  });
  if (tokErr || !tokenRes?.token) {
    throw new Error(tokErr?.message || "Impossible d'émettre le token");
  }
  const { data: payload, error: pErr } = await supabase.functions.invoke("fetch-order-pdf-payload", {
    body: { token: tokenRes.token },
  });
  if (pErr || !payload) {
    throw new Error(pErr?.message || "Impossible de récupérer les données");
  }
  console.info(`[express-order-pdf] payload fetched in ${Math.round(performance.now() - t0)}ms`);
  return payload as Payload;
}

/**
 * Génère et télécharge un PDF récap (5 KPI + tableau produits agrégés) côté
 * navigateur, sans attendre l'edge function `generate-order-pdf` (lourde).
 * Utilise 2 edge functions non bloquantes (token + payload JSON).
 */
export async function generateExpressOrderPdf(orderId: string) {
  const payload = await getPayload(orderId);
  const { order, lines } = payload;
  const agg = aggregate(lines);

  const isDraft = order.status === "draft";
  const currency = order.currency || "EUR";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({
    title: `${isDraft ? "BROUILLON" : "FINAL"} — Recap commande ${order.order_number || ""}`.trim(),
    subject: isDraft
      ? "Document provisoire (brouillon) — sans valeur contractuelle"
      : "Document final",
    keywords: isDraft ? "brouillon,draft,provisoire,MediKong" : "final,definitif,MediKong",
    author: "MediKong",
    creator: "MediKong",
  });
  const pageW = 210;
  const pageH = 297;
  const M = 15;

  const NAVY: [number, number, number] = [30, 37, 47];
  const BLUE: [number, number, number] = [28, 88, 217];
  const MUTED: [number, number, number] = [100, 116, 139];

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("MediKong — Récap commande", M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Commande ${order.order_number || "Sans numéro"}`, pageW - M, 10, { align: "right" });
  const created = order.created_at ? new Date(order.created_at).toLocaleDateString("fr-BE") : "";
  doc.text(created, pageW - M, 16, { align: "right" });

  // Statut / badge draft
  let cursorY = 30;
  if (isDraft) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const badgeLabel = "BROUILLON";
    const badgeW = Math.max(32, doc.getTextWidth(badgeLabel) + 8);
    const badgeH = 6;
    const badgeY = cursorY - 4;
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(M, badgeY, badgeW, badgeH, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    // Centrage vertical dans la pastille (baseline ≈ milieu + 1/3 de la hauteur de casse)
    doc.text(badgeLabel, M + badgeW / 2, badgeY + badgeH / 2 + 1, { align: "center" });
    cursorY += 6;
  }

  if (order.customer) {
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(order.customer.company_name || order.customer.email || "Client", M, cursorY + 4);
    cursorY += 4;
  }

  cursorY += 6;

  // Notes client (imprimées sur le PDF)
  if (order.notes && order.notes.trim()) {
    doc.setFillColor(239, 246, 255);
    const noteLines = doc.splitTextToSize(String(order.notes), pageW - 2 * M - 6);
    const noteH = noteLines.length * 4 + 6;
    doc.rect(M, cursorY, pageW - 2 * M, noteH, "F");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(noteLines, M + 3, cursorY + 5);
    cursorY += noteH + 4;
  }


  // 5 KPI cards
  const kpis = [
    { label: "Produits uniques", value: String(agg.uniq) },
    { label: "Quantité totale", value: String(agg.qty) },
    { label: "Total HTVA", value: fmtEur(agg.ht) + " €" },
    { label: "Total TVA", value: fmtEur(agg.tva) + " €" },
    { label: "Total TTC", value: fmtEur(agg.ttc) + " €" },
  ];
  const gap = 3;
  const kpiW = (pageW - M * 2 - gap * 4) / 5;
  const kpiH = 20;
  kpis.forEach((k, i) => {
    const x = M + i * (kpiW + gap);
    doc.setFillColor(...NAVY);
    doc.roundedRect(x, cursorY, kpiW, kpiH, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(k.value, x + kpiW / 2, cursorY + 9, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(200, 210, 225);
    doc.text(k.label.toUpperCase(), x + kpiW / 2, cursorY + 15, { align: "center" });
  });
  cursorY += kpiH + 8;

  // Tableau produits agrégés
  autoTable(doc, {
    startY: cursorY,
    head: [["#", "CNK", "Produit", "Qté", "HTVA", "TTC"]],
    body: agg.rows.map((r, i) => [
      String(i + 1),
      r.cnk || "—",
      r.name,
      String(r.qty),
      fmtEur(r.ht) + " €",
      fmtEur(r.ttc) + " €",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 8, textColor: MUTED },
      1: { cellWidth: 20, font: "courier" },
      3: { halign: "right", cellWidth: 14 },
      4: { halign: "right", cellWidth: 24 },
      5: { halign: "right", cellWidth: 26 },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      // Filigrane BROUILLON diagonal + bandeau bas
      if (isDraft) {
        const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.09 }) : null;
        if (gs) (doc as any).setGState(gs);
        doc.setTextColor(220, 38, 38);
        doc.setFont("helvetica", "bold");
        // Centrage manuel : jsPDF pivote autour du point d'ancrage,
        // `align: "center"` + `angle` sortait le filigrane de la page.
        const wmAngle = 30; // degrés, sens anti-horaire
        const wmRad = (wmAngle * Math.PI) / 180;
        let wmSize = 90;
        doc.setFontSize(wmSize);
        const wmMaxSpan = (pageW - 2 * M) / Math.cos(wmRad);
        const wmRaw = doc.getTextWidth("BROUILLON");
        if (wmRaw > wmMaxSpan) {
          wmSize = Math.max(36, Math.floor((wmSize * wmMaxSpan) / wmRaw));
          doc.setFontSize(wmSize);
        }
        const wmW = doc.getTextWidth("BROUILLON");
        doc.text(
          "BROUILLON",
          pageW / 2 - (wmW / 2) * Math.cos(wmRad),
          pageH / 2 + (wmW / 2) * Math.sin(wmRad),
          { angle: wmAngle },
        );
        if (gs) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

        doc.setFillColor(254, 226, 226);
        doc.rect(0, pageH - 12, pageW, 12, "F");
        doc.setTextColor(153, 27, 27);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("DOCUMENT PROVISOIRE — BROUILLON NON CONFIRMÉ", pageW / 2, pageH - 5, { align: "center" });
      }
      // Footer
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(
        `MediKong — Récap express · ${new Date().toLocaleString("fr-BE")}`,
        M,
        pageH - (isDraft ? 15 : 6),
      );
      doc.text(
        `Devise : ${currency}`,
        pageW - M,
        pageH - (isDraft ? 15 : 6),
        { align: "right" },
      );
    },
  });

  const suffix = isDraft ? "_BROUILLON" : "_FINAL";
  doc.save(`recap_${order.order_number || "commande-sans-numero"}${suffix}.pdf`);

}
