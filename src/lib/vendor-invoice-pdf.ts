import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { buildEpcQrDataUrl, MEDIKONG_BENEFICIARY, MEDIKONG_IBAN } from "@/lib/epc-qr";
import { docLocale, docT, type DocLang } from "@/lib/doc-i18n";

/**
 * Facture fournisseur (gabarit MediKong) avec coordonnées bancaires MediKong
 * et QR de paiement SEPA.
 *
 * Deux natures de document :
 *  - `commission` : facture MediKong au fournisseur (le fournisseur paie MediKong).
 *  - `self_billing` : facture émise « au nom et pour le compte de » le fournisseur,
 *    avec le compte MediKong comme compte de paiement (mandat de facturation).
 */
export type VendorInvoiceKind = "commission" | "self_billing" | "manual" | string;

export interface VendorInvoicePdfInput {
  kind: VendorInvoiceKind;
  invoiceNumber: string;
  issuedAt?: string | null;
  dueDate?: string | null;
  status?: string | null;
  orderNumber?: string | null;
  vendor: {
    name: string;
    companyName?: string | null;
    vatNumber?: string | null;
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
    countryCode?: string | null;
    email?: string | null;
  };
  amountExclVat: number;
  vatAmount: number;
  amountInclVat: number;
  /** Communication du virement (défaut : numéro de facture). */
  reference?: string;
  /** Langue de sortie du document (défaut : FR). */
  lang?: DocLang;
}

const NAVY: [number, number, number] = [30, 37, 47];
const BLUE: [number, number, number] = [28, 88, 217];
const MUTED: [number, number, number] = [100, 116, 139];

export function vendorInvoiceKindLabel(kind: VendorInvoiceKind, lang: DocLang = "fr"): string {
  if (kind === "commission") return docT(lang, "invoiceCommission");
  if (kind === "self_billing") return docT(lang, "invoiceSelfBilling");
  return docT(lang, "invoiceManual");
}


/** Construit la facture fournisseur en PDF (Blob + nom de fichier). */
export async function buildVendorInvoicePdf(
  input: VendorInvoicePdfInput,
): Promise<{ blob: Blob; fileName: string }> {
  const lang: DocLang = input.lang ?? "fr";
  const t = (k: string) => docT(lang, k);
  const locale = docLocale(lang);
  const eur = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(n) || 0);
  const day = (v?: string | null) =>
    v ? new Date(v).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const M = 15;
  const reference = input.reference || input.invoiceNumber;
  const kindLabel = vendorInvoiceKindLabel(input.kind, lang);

  doc.setProperties({
    title: `${kindLabel} ${input.invoiceNumber}`,
    author: "MediKong",
    creator: "MediKong",
    subject: kindLabel,
  });

  // En-tête
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("MediKong", M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(kindLabel, M, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(input.invoiceNumber, pageW - M, 15, { align: "right" });

  let y = 34;
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(t("issuer"), M, y);
  doc.text(t("supplier"), pageW / 2, y);
  y += 5;
  doc.setTextColor(...NAVY);
  doc.setFontSize(9.5);

  const issuer = [
    "Balooh SRL — MediKong",
    "23, rue de la Procession",
    "7822 Ath — Belgique",
    "TVA BE 1005.771.323",
  ];
  const vendorLines = [
    input.vendor.companyName || input.vendor.name,
    input.vendor.addressLine1 || "",
    [input.vendor.postalCode, input.vendor.city].filter(Boolean).join(" "),
    input.vendor.countryCode || "",
    input.vendor.vatNumber ? `${t("vatNumber")} ${input.vendor.vatNumber}` : "",
  ].filter(Boolean) as string[];

  const rows = Math.max(issuer.length, vendorLines.length);
  for (let i = 0; i < rows; i++) {
    if (issuer[i]) doc.text(issuer[i], M, y + i * 4.6);
    if (vendorLines[i]) doc.text(vendorLines[i], pageW / 2, y + i * 4.6);
  }
  y += rows * 4.6 + 6;

  // Métadonnées
  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, pageW - M, y);
  y += 6;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8.5);
  doc.text(`${t("issueDate")} : ${day(input.issuedAt)}`, M, y);
  doc.text(`${t("dueDate")} : ${day(input.dueDate)}`, M + 60, y);
  if (input.orderNumber) doc.text(`${t("order")} : ${input.orderNumber}`, M + 115, y);
  y += 8;

  // Montants
  autoTable(doc, {
    startY: y,
    head: [[t("description"), t("amount")]],
    body: [
      [kindLabel, eur(input.amountExclVat)],
      [t("vatTotal"), eur(input.vatAmount)],
      [t("totalToPay"), eur(input.amountInclVat)],
    ],
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 2.5, textColor: NAVY },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 45 } },
    margin: { left: M, right: M },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 2) data.cell.styles.fontStyle = "bold";
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Coordonnées bancaires MediKong + QR SEPA
  doc.setDrawColor(199, 221, 255);
  doc.setFillColor(240, 246, 255);
  doc.roundedRect(M, y, pageW - 2 * M, 40, 2, 2, "FD");
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(t("sepaTitle"), M + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...NAVY);
  doc.setFontSize(9);
  doc.text(`${t("beneficiary")} : ${MEDIKONG_BENEFICIARY} (Balooh SRL)`, M + 5, y + 15);
  doc.text(`${t("iban")} : ${MEDIKONG_IBAN}`, M + 5, y + 21);
  doc.text(`${t("communication")} : ${reference}`, M + 5, y + 27);
  doc.text(`${t("amount")} : ${eur(input.amountInclVat)}`, M + 5, y + 33);

  try {
    const qr = await buildEpcQrDataUrl({ amountEur: Number(input.amountInclVat) || 0, reference }, 320);
    doc.addImage(qr, "PNG", pageW - M - 37, y + 3, 34, 34);
  } catch {
    /* QR indisponible — les coordonnées bancaires restent lisibles */
  }
  y += 47;

  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  const legal =
    input.kind === "self_billing" ? t("legalSelfBilling") : t("legalCommission");
  doc.text(doc.splitTextToSize(legal, pageW - 2 * M), M, y);

  const fileName = `${input.invoiceNumber.replace(/[^\w.-]+/g, "-")}-${lang}.pdf`;
  return { blob: doc.output("blob") as Blob, fileName };
}

/** Génère et télécharge la facture fournisseur. */
export async function downloadVendorInvoicePdf(input: VendorInvoicePdfInput) {
  const { blob, fileName } = await buildVendorInvoicePdf(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
