// @ts-nocheck — Deno runtime
// Shared helpers to build PDF invoices (self-billing + commission) for the marketplace.
import { jsPDF } from "npm:jspdf@2.5.2";
import { MEDIKONG_LOGO_PNG_BASE64 } from "./medikong-logo.ts";

export const MEDIKONG = {
  name: "Balooh SRL (MediKong)",
  address: "23 rue de la Procession",
  postal: "7822 Ath",
  country: "Belgique",
  vat: "BE 1005.771.323",
  email: "billing@medikong.pro",
};

export function fmtEur(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency })
    .format(Number(n || 0))
    .replace(/\u202F/g, " ");
}

function fmtDateBE(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
}

function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  try {
    doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", 14, 12, 34, 10);
  } catch { /* logo optional */ }
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(MEDIKONG.name, 14, 28);
  doc.text(MEDIKONG.address, 14, 32);
  doc.text(`${MEDIKONG.postal} — ${MEDIKONG.country}`, 14, 36);
  doc.text(`TVA : ${MEDIKONG.vat}`, 14, 40);

  doc.setFontSize(18);
  doc.setTextColor(28, 88, 217);
  doc.text(title, 196, 20, { align: "right" });
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitle, 196, 26, { align: "right" });
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 46, 196, 46);
}

function drawParties(doc: jsPDF, seller: any, buyer: any, y: number): number {
  doc.setFontSize(9);
  doc.setTextColor(139, 149, 165);
  doc.text("FOURNISSEUR", 14, y);
  doc.text("CLIENT", 110, y);

  doc.setFontSize(10);
  doc.setTextColor(29, 37, 48);
  const sLines = [
    seller.company_name || seller.name || "—",
    seller.address_line1 || "",
    `${seller.postal_code || ""} ${seller.city || ""}`.trim(),
    seller.country_code || "",
    seller.vat_number ? `TVA : ${seller.vat_number}` : "",
  ].filter(Boolean);
  const bLines = [
    buyer.company_name || "—",
    buyer.address_line1 || "",
    buyer.address_line2 || "",
    `${buyer.postal_code || ""} ${buyer.city || ""}`.trim(),
    buyer.country_code || "",
    buyer.vat_number ? `TVA : ${buyer.vat_number}` : "",
  ].filter(Boolean);
  let sy = y + 5;
  sLines.forEach((l) => { doc.text(l, 14, sy); sy += 4.5; });
  let by = y + 5;
  bLines.forEach((l) => { doc.text(l, 110, by); by += 4.5; });
  return Math.max(sy, by) + 4;
}

function drawInvoiceMeta(doc: jsPDF, meta: Record<string, string>, y: number): number {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 16, "FD");
  doc.setFontSize(9);
  const entries = Object.entries(meta);
  const colW = 182 / entries.length;
  entries.forEach(([k, v], i) => {
    doc.setTextColor(139, 149, 165);
    doc.text(k.toUpperCase(), 18 + i * colW, y + 6);
    doc.setTextColor(29, 37, 48);
    doc.setFont(undefined, "bold");
    doc.text(v, 18 + i * colW, y + 12);
    doc.setFont(undefined, "normal");
  });
  return y + 22;
}

export interface SelfBillingParams {
  order: any;
  vendor: any;      // seller (real supplier)
  customer: any;    // buyer (end client)
  lines: Array<{
    name: string;
    quantity: number;
    unit_price_excl_vat: number;
    vat_rate: number;
    line_total_excl_vat: number;
    line_total_incl_vat: number;
  }>;
  invoiceNumber: string;
  paidAt: Date;
  mandateSignedAt?: Date | string | null;
}

/** Fixed legal mention required by BE self-billing rules (mandat de facturation). */
export function buildSelfBillingMandateMention(vendor: any, mandateSignedAt: Date | string | null | undefined): string {
  const name = vendor?.company_name || vendor?.name || "—";
  const vat = vendor?.vat_number ? String(vendor.vat_number) : "N° TVA non renseigné";
  const date = mandateSignedAt ? fmtDateBE(mandateSignedAt) : "date à confirmer";
  return `Facture émise par Balooh SRL (BE1005771323) au nom et pour le compte de ${name} — N° TVA fournisseur : ${vat} — Conformément au mandat de facturation signé le ${date}.`;
}

export function buildSelfBillingPdf(p: SelfBillingParams): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "FACTURE", `N° ${p.invoiceNumber}`);
  let y = 52;
  y = drawParties(doc, p.vendor, p.customer, y);
  y = drawInvoiceMeta(doc, {
    "N° facture": p.invoiceNumber,
    "Date": fmtDateBE(new Date()),
    "Commande": p.order.order_number || "—",
    "Échéance": "Acquitté",
  }, y);

  // Lines table (simple, no autotable dependency guaranteed)
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(139, 149, 165);
  doc.text("DÉSIGNATION", 16, y + 5);
  doc.text("QTÉ", 118, y + 5, { align: "right" });
  doc.text("PU HTVA", 148, y + 5, { align: "right" });
  doc.text("TVA", 165, y + 5, { align: "right" });
  doc.text("TOTAL HTVA", 194, y + 5, { align: "right" });
  y += 10;
  doc.setTextColor(29, 37, 48);
  let subtotal = 0;
  let vatTotal = 0;
  for (const l of p.lines) {
    const name = String(l.name || "—").slice(0, 55);
    doc.text(name, 16, y);
    doc.text(String(l.quantity), 118, y, { align: "right" });
    doc.text(fmtEur(l.unit_price_excl_vat), 148, y, { align: "right" });
    doc.text(`${Number(l.vat_rate).toFixed(0)}%`, 165, y, { align: "right" });
    doc.text(fmtEur(l.line_total_excl_vat), 194, y, { align: "right" });
    subtotal += Number(l.line_total_excl_vat);
    vatTotal += Number(l.line_total_incl_vat) - Number(l.line_total_excl_vat);
    y += 6;
    if (y > 250) { doc.addPage(); y = 20; }
  }

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(120, y, 196, y);
  y += 5;
  doc.setFontSize(10);
  doc.text("Sous-total HTVA", 148, y, { align: "right" });
  doc.text(fmtEur(subtotal), 194, y, { align: "right" });
  y += 5;
  doc.text("TVA", 148, y, { align: "right" });
  doc.text(fmtEur(vatTotal), 194, y, { align: "right" });
  y += 6;
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text("Total TTC", 148, y, { align: "right" });
  doc.text(fmtEur(subtotal + vatTotal), 194, y, { align: "right" });
  doc.setFont(undefined, "normal");

  y += 12;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(5, 150, 105);
  doc.rect(14, y, 182, 14, "FD");
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.text(`Acquitté — paiement reçu via MediKong le ${fmtDateBE(p.paidAt)}`, 105, y + 9, { align: "center" });
  doc.setFont(undefined, "normal");

  y += 20;
  doc.setFontSize(8);
  doc.setTextColor(139, 149, 165);
  doc.text(
    `Facture émise par ${MEDIKONG.name} au nom et pour le compte de ${p.vendor.company_name || p.vendor.name} (self-billing marketplace).`,
    14, y, { maxWidth: 182 },
  );
  return doc.output("arraybuffer") as any;
}

export interface CommissionParams {
  order: any;
  vendor: any;
  gmvExclVat: number;    // base HT (subtotal of vendor lines)
  commissionRate: number; // %
  invoiceNumber: string;
  paidAt: Date;
}

export function buildCommissionPdf(p: CommissionParams): { pdf: Uint8Array; commissionHt: number; vat: number; commissionTtc: number } {
  const commissionHt = Math.round(p.gmvExclVat * p.commissionRate) / 100;
  const vat = Math.round(commissionHt * 21) / 100;
  const commissionTtc = commissionHt + vat;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "COMMISSION", `N° ${p.invoiceNumber}`);
  let y = 52;
  y = drawParties(doc, {
    company_name: MEDIKONG.name,
    address_line1: MEDIKONG.address,
    postal_code: MEDIKONG.postal.split(" ")[0],
    city: MEDIKONG.postal.split(" ").slice(1).join(" "),
    country_code: "BE",
    vat_number: MEDIKONG.vat,
  }, p.vendor, y);

  y = drawInvoiceMeta(doc, {
    "N° facture": p.invoiceNumber,
    "Date": fmtDateBE(new Date()),
    "Commande": p.order.order_number || "—",
    "Réf. paiement": fmtDateBE(p.paidAt),
  }, y);

  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(139, 149, 165);
  doc.text("DÉSIGNATION", 16, y + 5);
  doc.text("BASE HTVA", 148, y + 5, { align: "right" });
  doc.text("TAUX", 165, y + 5, { align: "right" });
  doc.text("MONTANT", 194, y + 5, { align: "right" });
  y += 10;
  doc.setTextColor(29, 37, 48);
  doc.text(`Commission MediKong — commande ${p.order.order_number}`, 16, y);
  doc.text(fmtEur(p.gmvExclVat), 148, y, { align: "right" });
  doc.text(`${p.commissionRate.toFixed(2)}%`, 165, y, { align: "right" });
  doc.text(fmtEur(commissionHt), 194, y, { align: "right" });
  y += 10;

  doc.setDrawColor(226, 232, 240);
  doc.line(120, y, 196, y);
  y += 5;
  doc.setFontSize(10);
  doc.text("Commission HTVA", 148, y, { align: "right" });
  doc.text(fmtEur(commissionHt), 194, y, { align: "right" });
  y += 5;
  doc.text("TVA 21%", 148, y, { align: "right" });
  doc.text(fmtEur(vat), 194, y, { align: "right" });
  y += 6;
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text("Total TTC", 148, y, { align: "right" });
  doc.text(fmtEur(commissionTtc), 194, y, { align: "right" });
  doc.setFont(undefined, "normal");

  y += 14;
  doc.setFontSize(8);
  doc.setTextColor(139, 149, 165);
  doc.text(
    `Facture de commission émise par ${MEDIKONG.name} au fournisseur suite au paiement de la commande.`,
    14, y, { maxWidth: 182 },
  );
  return { pdf: doc.output("arraybuffer") as any, commissionHt, vat, commissionTtc };
}
