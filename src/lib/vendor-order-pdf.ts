import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type VendorOrderPdfInput = {
  orderNumber: string | null;
  orderDate?: string | null;
  statusLabel?: string | null;
  vendorName?: string | null;
  vendorVatNumber?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerVatNumber?: string | null;
  notes?: string | null;
  lines: {
    label: string | null;
    vendorReference?: string | null;
    qty: number;
    unitPriceExclVat: number;
    vatRate: number;
    lineTotalExclVat: number;
  }[];
};

const NAVY: [number, number, number] = [30, 37, 47];
const BLUE: [number, number, number] = [28, 88, 217];
const MUTED: [number, number, number] = [100, 116, 139];

const eur = (v: number) =>
  new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(v) || 0
  ) + " €";

const dateFr = (v?: string | null) => (v ? new Date(v).toLocaleDateString("fr-BE") : "—");

const normalizedVatRate = (r: number) => {
  const n = Number(r) || 0;
  return n > 1 ? n : n * 100;
};

/** Génère et télécharge un bon de commande fournisseur imprimable (gabarit MediKong). */
export function generateVendorOrderPdf(input: VendorOrderPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const M = 15;

  doc.setProperties({
    title: `Bon de commande ${input.orderNumber || ""}`.trim(),
    subject: "Bon de commande fournisseur MediKong",
    author: "MediKong",
    creator: "MediKong",
  });

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("MediKong — Bon de commande fournisseur", M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(input.orderNumber || "", pageW - M, 14, { align: "right" });

  let y = 32;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(`Date : ${dateFr(input.orderDate)}`, M, y);
  if (input.statusLabel) doc.text(`Statut : ${input.statusLabel}`, pageW / 2, y);
  y += 8;

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FOURNISSEUR", M, y);
  doc.text("CLIENT", pageW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const leftLines = [
    input.vendorName || "—",
    input.vendorVatNumber ? `TVA : ${input.vendorVatNumber}` : null,
  ].filter(Boolean) as string[];
  const rightLines = [
    input.customerName || "—",
    input.customerEmail || null,
    input.customerVatNumber ? `TVA : ${input.customerVatNumber}` : null,
  ].filter(Boolean) as string[];
  const rows = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < rows; i++) {
    if (leftLines[i]) doc.text(leftLines[i], M, y + i * 4.6);
    if (rightLines[i]) doc.text(rightLines[i], pageW / 2, y + i * 4.6);
  }
  y += rows * 4.6 + 6;

  if (input.notes) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(input.notes, pageW - 2 * M);
    doc.text(wrapped, M, y);
    y += wrapped.length * 4.2 + 4;
  }

  autoTable(doc, {
    startY: y,
    head: [["Article", "Réf. fournisseur", "Qté", "PU HTVA", "TVA", "Total HTVA"]],
    body: input.lines.map((l) => [
      l.label || "—",
      l.vendorReference || "—",
      String(l.qty ?? 0),
      eur(l.unitPriceExclVat),
      `${normalizedVatRate(l.vatRate).toFixed(0)} %`,
      eur(l.lineTotalExclVat),
    ]),
    styles: { fontSize: 9, cellPadding: 2, textColor: NAVY },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 34 },
      2: { halign: "right", cellWidth: 14 },
      3: { halign: "right", cellWidth: 24 },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 30 },
    },
    margin: { left: M, right: M },
  });

  const totalHt = input.lines.reduce((a, l) => a + (Number(l.lineTotalExclVat) || 0), 0);
  const totalTva = input.lines.reduce(
    (a, l) => a + ((Number(l.lineTotalExclVat) || 0) * normalizedVatRate(l.vatRate)) / 100,
    0
  );
  const totalTtc = totalHt + totalTva;

  let ty = (doc as any).lastAutoTable.finalY + 8;
  const labelX = pageW - M - 60;
  const valX = pageW - M;

  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text("Total HTVA", labelX, ty);
  doc.setTextColor(...NAVY);
  doc.text(eur(totalHt), valX, ty, { align: "right" });
  ty += 5.5;
  doc.setTextColor(...MUTED);
  doc.text("TVA", labelX, ty);
  doc.setTextColor(...NAVY);
  doc.text(eur(totalTva), valX, ty, { align: "right" });
  ty += 3;

  doc.setFillColor(...BLUE);
  doc.rect(labelX - 5, ty, pageW - M - (labelX - 5), 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total TVAC", labelX, ty + 6.8);
  doc.text(eur(totalTtc), valX - 1, ty + 6.8, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "MediKong — Bon de commande exprimé en euros, prix HTVA sauf mention contraire.",
    M,
    285,
    { maxWidth: pageW - 2 * M }
  );

  doc.save(`bon-de-commande-${input.orderNumber || "medikong"}.pdf`);
}
