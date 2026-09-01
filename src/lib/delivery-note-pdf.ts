import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { resolveVatExemption } from "@/lib/vat-exemption";

export type DeliveryNotePdfInput = {
  documentNumber: string | null;
  issuedAt: string;
  status: "issued" | "cancelled";
  /** Commande encore en brouillon : le BL est provisoire. */
  isDraft?: boolean;
  orderNumber: string | null;
  customerName?: string | null;
  shippingAddress?: Record<string, any> | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  note?: string | null;
  /** Pays du client (ISO-2) — sert à la mention TVA 0 %. */
  customerCountryCode?: string | null;
  /** N° TVA intracommunautaire du client. */
  customerVatNumber?: string | null;
  rows: {
    name: string;
    cnk: string | null;
    gtin?: string | null;
    ordered: number;
    delivered: number;
    remaining: number;
  }[];
};

const NAVY: [number, number, number] = [30, 37, 47];
const BLUE: [number, number, number] = [28, 88, 217];
const MUTED: [number, number, number] = [100, 116, 139];

function formatAddress(addr?: Record<string, any> | null): string[] {
  if (!addr || typeof addr !== "object") return [];
  const parts = [
    addr.company_name || addr.company,
    addr.address_line1 || addr.street || addr.line1,
    addr.address_line2 || addr.line2,
    [addr.postal_code || addr.zip, addr.city].filter(Boolean).join(" "),
    addr.country_code || addr.country,
  ];
  return parts.filter((p) => typeof p === "string" && p.trim()).map(String);
}

/** Génère et télécharge un bon de livraison PDF (gabarit MediKong). */
export function generateDeliveryNotePdf(input: DeliveryNotePdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const M = 15;
  const cancelled = input.status === "cancelled";
  const isDraft = input.isDraft === true;
  doc.setProperties({
    title: `${isDraft ? "BROUILLON" : "FINAL"} — Bon de livraison ${input.documentNumber || ""}`.trim(),
    subject: isDraft
      ? "Bon de livraison provisoire (brouillon) — sans valeur définitive"
      : "Bon de livraison final",
    keywords: isDraft ? "brouillon,draft,provisoire,MediKong" : "final,definitif,MediKong",
    author: "MediKong",
    creator: "MediKong",
  });

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("MediKong — Bon de livraison", M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(input.documentNumber || "Sans numéro", pageW - M, 10, { align: "right" });
  doc.text(new Date(input.issuedAt).toLocaleDateString("fr-BE"), pageW - M, 16, { align: "right" });

  if (isDraft) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const label = "BROUILLON";
    const bw = doc.getTextWidth(label) + 8;
    const bh = 6.5;
    const bx = pageW / 2 - bw / 2;
    const by = 25;
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, bw, bh, 1.5, 1.5, "FD");
    doc.setTextColor(153, 27, 27);
    doc.text(label, pageW / 2, by + bh / 2 + 1.5, { align: "center" });
    doc.setFont("helvetica", "normal");
  }

  let y = isDraft ? 38 : 32;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Commande ${input.orderNumber || "—"}`, M, y);
  y += 6;

  if (input.customerName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(input.customerName, M, y);
    y += 5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  for (const line of formatAddress(input.shippingAddress)) {
    doc.text(line, M, y);
    y += 4.5;
  }

  if (input.customerVatNumber) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(8.5);
    doc.text(`N° TVA intracommunautaire : ${input.customerVatNumber}`, M, y);
    y += 4.5;
    doc.setFontSize(9);
  }

  // Mention TVA 0 % (export hors UE / autoliquidation intracommunautaire)
  const vatEx = resolveVatExemption({
    countryCode: input.customerCountryCode,
    vatNumber: input.customerVatNumber,
  });
  if (vatEx.exempt && vatEx.mention) {
    y += 2;
    const mLines = doc.splitTextToSize(`TVA 0 % — ${vatEx.label} — ${vatEx.mention}`, pageW - 2 * M - 6);
    const mH = mLines.length * 4 + 5;
    doc.setFillColor(255, 247, 237);
    doc.rect(M, y, pageW - 2 * M, mH, "F");
    doc.setTextColor(146, 64, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(mLines, M + 3, y + 4.5);
    y += mH + 3;
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
  }



  const meta: string[] = [];
  if (input.carrier) meta.push(`Transporteur : ${input.carrier}`);
  if (input.trackingNumber) meta.push(`Suivi : ${input.trackingNumber}`);
  if (meta.length) {
    y += 2;
    doc.setTextColor(...NAVY);
    doc.text(meta.join("  ·  "), M, y);
    y += 5;
  }

  if (input.note) {
    y += 2;
    const noteLines = doc.splitTextToSize(String(input.note), pageW - 2 * M - 6);
    doc.setFillColor(239, 246, 255);
    doc.rect(M, y, pageW - 2 * M, noteLines.length * 4 + 6, "F");
    doc.setTextColor(...NAVY);
    doc.text(noteLines, M + 3, y + 5);
    y += noteLines.length * 4 + 10;
  }

  y += 4;

  const totalDelivered = input.rows.reduce((s, r) => s + r.delivered, 0);
  const totalRemaining = input.rows.reduce((s, r) => s + r.remaining, 0);
  const isPartial = totalRemaining > 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  if (isPartial) {
    doc.setFillColor(254, 243, 199);
    doc.setTextColor(146, 64, 14);
  } else {
    doc.setFillColor(220, 252, 231);
    doc.setTextColor(22, 101, 52);
  }
  const badge = isPartial ? "LIVRAISON PARTIELLE — RELIQUAT EN BACK ORDER" : "LIVRAISON TOTALE";
  doc.roundedRect(M, y, pageW - 2 * M, 8, 1.5, 1.5, "F");
  doc.text(badge, pageW / 2, y + 5.5, { align: "center" });
  y += 14;

  autoTable(doc, {
    startY: y,
    head: [["#", "CNK", "EAN", "Produit", "Commandé", "Livré", "Reliquat"]],
    body: input.rows.map((r, i) => [
      String(i + 1),
      r.cnk || "—",
      r.gtin || "—",
      r.name,
      String(r.ordered),
      String(r.delivered),
      String(r.remaining),
    ]),
    foot: [["", "", "", "Total", "", String(totalDelivered), String(totalRemaining)]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 8, textColor: MUTED },
      1: { cellWidth: 18, font: "courier" },
      // EAN 13 chiffres en 6.5pt pour tenir dans 25mm sans retour à la ligne
      2: { cellWidth: 25, font: "courier", fontSize: 6.5, cellPadding: 1.5 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 16 },
      6: { halign: "right", cellWidth: 18 },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      if (isDraft) {
        const gsD = (doc as any).GState ? new (doc as any).GState({ opacity: 0.12 }) : null;
        if (gsD) (doc as any).setGState(gsD);
        doc.setTextColor(220, 38, 38);
        doc.setFont("helvetica", "bold");
        const wmAngle = 30;
        const rad = (wmAngle * Math.PI) / 180;
        let wmSize = 110;
        doc.setFontSize(wmSize);
        const maxSpan = (pageW - 2 * M) / Math.cos(rad);
        const rawWidth = doc.getTextWidth("BROUILLON");
        if (rawWidth > maxSpan) {
          wmSize = Math.max(40, Math.floor((wmSize * maxSpan) / rawWidth));
          doc.setFontSize(wmSize);
        }
        const wmWidth = doc.getTextWidth("BROUILLON");
        doc.text(
          "BROUILLON",
          pageW / 2 - (wmWidth / 2) * Math.cos(rad),
          pageH / 2 + (wmWidth / 2) * Math.sin(rad),
          { angle: wmAngle },
        );
        if (gsD) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.4);
        doc.roundedRect(M, pageH - 20, pageW - 2 * M, 7, 1.2, 1.2, "FD");
        doc.setTextColor(153, 27, 27);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(
          "DOCUMENT PROVISOIRE — BROUILLON · Ne pas utiliser comme bon de livraison définitif",
          pageW / 2,
          pageH - 15.5,
          { align: "center" },
        );
      }
      if (cancelled) {
        const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.09 }) : null;
        if (gs) (doc as any).setGState(gs);
        doc.setTextColor(220, 38, 38);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(80);
        doc.text("ANNULÉ", pageW / 2, pageH / 2 + 20, { align: "center", angle: -30 });
        if (gs) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
      }
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`MediKong — Bon de livraison · ${new Date().toLocaleString("fr-BE")}`, M, pageH - 6);
      doc.text("Signature du réceptionnaire : ______________________", pageW - M, pageH - 6, { align: "right" });
    },
  });

  doc.save(
    `bon-livraison_${input.documentNumber || "sans-numero"}_${isDraft ? "BROUILLON" : "FINAL"}.pdf`,
  );
}
