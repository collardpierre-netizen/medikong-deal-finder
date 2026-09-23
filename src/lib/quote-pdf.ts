import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { docLocale, docT, type DocLang } from "@/lib/doc-i18n";

export type QuotePdfInput = {
  quoteNumber: string | null;
  createdAt?: string | null;
  validUntil?: string | null;
  status?: string | null;
  vendorName?: string | null;
  vendorVatNumber?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerVatNumber?: string | null;
  notesCustomer?: string | null;
  lines: {
    label: string | null;
    vendorReference?: string | null;
    qty: number;
    unitPriceHtCents: number;
    vatRate: number;
    totalHtCents: number;
  }[];
  totalHtCents: number;
  totalTvaCents: number;
  totalTtcCents: number;
  /** Langue de sortie du document (défaut : FR). */
  lang?: DocLang;
};

const NAVY: [number, number, number] = [30, 37, 47];
const BLUE: [number, number, number] = [28, 88, 217];
const MUTED: [number, number, number] = [100, 116, 139];

/** Génère et télécharge un devis PDF imprimable (gabarit MediKong). */
export function generateQuotePdf(input: QuotePdfInput) {
  const lang: DocLang = input.lang ?? "fr";
  const t = (k: string) => docT(lang, k);
  const locale = docLocale(lang);

  const eur = (cents: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      (Number(cents) || 0) / 100
    ) + " €";
  const dateLoc = (v?: string | null) => (v ? new Date(v).toLocaleDateString(locale) : "—");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const M = 15;

  doc.setProperties({
    title: `${t("quoteDocName")} ${input.quoteNumber || ""}`.trim(),
    subject: t("quoteSubject"),
    author: "MediKong",
    creator: "MediKong",
  });

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(t("quoteTitle"), M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(input.quoteNumber || "", pageW - M, 14, { align: "right" });

  let y = 32;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(`${t("date")} : ${dateLoc(input.createdAt)}`, M, y);
  if (input.validUntil) doc.text(`${t("validUntil")} : ${dateLoc(input.validUntil)}`, pageW / 2, y);
  y += 8;

  // Blocs vendeur / acheteur
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(t("supplier"), M, y);
  doc.text(t("customer"), pageW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const leftLines = [
    input.vendorName || "—",
    input.vendorVatNumber ? `${t("vatNumber")} : ${input.vendorVatNumber}` : null,
  ].filter(Boolean) as string[];
  const rightLines = [
    input.customerName || "—",
    input.customerEmail || null,
    input.customerVatNumber ? `${t("vatNumber")} : ${input.customerVatNumber}` : null,
  ].filter(Boolean) as string[];
  const rows = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < rows; i++) {
    if (leftLines[i]) doc.text(leftLines[i], M, y + i * 4.6);
    if (rightLines[i]) doc.text(rightLines[i], pageW / 2, y + i * 4.6);
  }
  y += rows * 4.6 + 6;

  if (input.notesCustomer) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(input.notesCustomer, pageW - 2 * M);
    doc.text(wrapped, M, y);
    y += wrapped.length * 4.2 + 4;
  }

  autoTable(doc, {
    startY: y,
    head: [[
      t("colArticle"),
      t("colVendorRef"),
      t("colQty"),
      t("colUnitPriceExcl"),
      t("colVat"),
      t("colTotalExcl"),
    ]],
    body: input.lines.map((l) => [
      l.label || "—",
      l.vendorReference || "—",
      String(l.qty ?? 0),
      eur(l.unitPriceHtCents),
      `${Number(l.vatRate || 0).toFixed(0)} %`,
      eur(l.totalHtCents),
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

  let ty = (doc as any).lastAutoTable.finalY + 8;
  const labelX = pageW - M - 60;
  const valX = pageW - M;

  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(t("totalExcl"), labelX, ty);
  doc.setTextColor(...NAVY);
  doc.text(eur(input.totalHtCents), valX, ty, { align: "right" });
  ty += 5.5;
  doc.setTextColor(...MUTED);
  doc.text(t("vatTotal"), labelX, ty);
  doc.setTextColor(...NAVY);
  doc.text(eur(input.totalTvaCents), valX, ty, { align: "right" });
  ty += 3;

  doc.setFillColor(...BLUE);
  doc.rect(labelX - 5, ty, pageW - M - (labelX - 5), 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t("totalIncl"), labelX, ty + 6.8);
  doc.text(eur(input.totalTtcCents), valX - 1, ty + 6.8, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(t("quoteFooter"), M, 285, { maxWidth: pageW - 2 * M });

  doc.save(`${t("quoteFile")}-${input.quoteNumber || "medikong"}-${lang}.pdf`);
}
