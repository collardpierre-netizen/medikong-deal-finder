import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type DeliveryNotePdfInput = {
  documentNumber: string | null;
  issuedAt: string;
  status: "issued" | "cancelled";
  orderNumber: string | null;
  customerName?: string | null;
  shippingAddress?: Record<string, any> | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  note?: string | null;
  rows: {
    name: string;
    cnk: string | null;
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

  let y = 32;
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
    head: [["#", "CNK", "Produit", "Commandé", "Livré", "Reliquat"]],
    body: input.rows.map((r, i) => [
      String(i + 1),
      r.cnk || "—",
      r.name,
      String(r.ordered),
      String(r.delivered),
      String(r.remaining),
    ]),
    foot: [["", "", "Total", "", String(totalDelivered), String(totalRemaining)]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 8, textColor: MUTED },
      1: { cellWidth: 20, font: "courier" },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 18 },
      5: { halign: "right", cellWidth: 20 },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
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

  doc.save(`bon-livraison_${input.documentNumber || "sans-numero"}.pdf`);
}
