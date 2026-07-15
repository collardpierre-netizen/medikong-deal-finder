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

// Design tokens — kept in one place for consistency.
const C = {
  primary: [28, 88, 217] as [number, number, number],     // #1C58D9 MediKong blue
  ink: [17, 24, 39] as [number, number, number],          // near-black text
  body: [55, 65, 81] as [number, number, number],         // secondary text
  mute: [107, 114, 128] as [number, number, number],      // labels
  line: [226, 232, 240] as [number, number, number],      // hairlines
  soft: [248, 250, 252] as [number, number, number],      // panel bg
  zebra: [250, 251, 253] as [number, number, number],     // table stripe
  success: [5, 150, 105] as [number, number, number],
  successBg: [236, 253, 245] as [number, number, number],
};

const M = { left: 14, right: 196, width: 182 };

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

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Top accent bar
  setFill(doc, C.primary);
  doc.rect(0, 0, 210, 4, "F");

  // Logo — dimensions PNG source 398×83 (ratio ~4.795). On respecte le ratio
  // pour éviter tout étirement (avant : 34×10 → écrasé verticalement).
  try {
    const LOGO_W = 40;
    const LOGO_H = LOGO_W / (398 / 83); // ≈ 8.34 mm
    doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", M.left, 12, LOGO_W, LOGO_H);
  } catch { /* logo optional */ }

  // Issuer block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, C.body);
  doc.text(MEDIKONG.name, M.left, 28);
  setText(doc, C.mute);
  doc.text(MEDIKONG.address, M.left, 32);
  doc.text(`${MEDIKONG.postal} — ${MEDIKONG.country}`, M.left, 36);
  doc.text(`TVA : ${MEDIKONG.vat}`, M.left, 40);

  // Big title with document number underneath
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setText(doc, C.primary);
  doc.text(title, M.right, 22, { align: "right" });
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, C.mute);
    doc.text(subtitle, M.right, 28, { align: "right" });
  }

  // Separator
  setDraw(doc, C.line);
  doc.setLineWidth(0.2);
  doc.line(M.left, 46, M.right, 46);
}

function drawParties(doc: jsPDF, seller: any, buyer: any, y: number): number {
  const colW = M.width / 2;
  const rightX = M.left + colW + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, C.mute);
  doc.text("FOURNISSEUR", M.left, y);
  doc.text("CLIENT", rightX, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setText(doc, C.ink);
  doc.text(String(seller.company_name || seller.name || "—"), M.left, y + 6, { maxWidth: colW - 4 });
  doc.text(String(buyer.company_name || "—"), rightX, y + 6, { maxWidth: colW - 4 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setText(doc, C.body);
  const sLines = [
    seller.address_line1 || "",
    `${seller.postal_code || ""} ${seller.city || ""}`.trim(),
    seller.country_code || "",
    seller.vat_number ? `TVA : ${seller.vat_number}` : "",
  ].filter(Boolean);
  const bLines = [
    buyer.address_line1 || "",
    buyer.address_line2 || "",
    `${buyer.postal_code || ""} ${buyer.city || ""}`.trim(),
    buyer.country_code || "",
    buyer.vat_number ? `TVA : ${buyer.vat_number}` : "",
  ].filter(Boolean);
  let sy = y + 12;
  sLines.forEach((l) => { doc.text(String(l), M.left, sy, { maxWidth: colW - 4 }); sy += 4.6; });
  let by = y + 12;
  bLines.forEach((l) => { doc.text(String(l), rightX, by, { maxWidth: colW - 4 }); by += 4.6; });
  return Math.max(sy, by) + 4;
}

/**
 * Meta panel with adaptive column widths so long invoice numbers never collide with the
 * neighbouring column. The invoice number column takes 45 % of the width, the rest split the remainder.
 */
function drawInvoiceMeta(doc: jsPDF, meta: Record<string, string>, y: number): number {
  const entries = Object.entries(meta);
  const h = 18;
  setFill(doc, C.soft);
  setDraw(doc, C.line);
  doc.setLineWidth(0.2);
  doc.roundedRect(M.left, y, M.width, h, 2, 2, "FD");

  // Weight the first column (invoice number) heavier.
  const weights = entries.map((_, i) => (i === 0 ? 2.2 : 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pad = 5;
  const inner = M.width - pad * 2;
  let x = M.left + pad;

  entries.forEach(([k, v], i) => {
    const w = (weights[i] / totalW) * inner;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, C.mute);
    doc.text(k.toUpperCase(), x, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(doc, C.ink);
    // Truncate defensively so nothing overflows into the next column.
    doc.text(String(v || "—"), x, y + 13, { maxWidth: w - 4 });
    x += w;
  });
  return y + h + 6;
}

function drawTableHeader(doc: jsPDF, y: number, cols: Array<{ label: string; x: number; align?: "left" | "right" }>): number {
  setFill(doc, C.primary);
  doc.rect(M.left, y, M.width, 8.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  cols.forEach((c) => doc.text(c.label, c.x, y + 5.6, { align: c.align || "left" }));
  // Return baseline for the first body row (leaves ~5 mm padding under the header bar).
  return y + 8.5 + 5;
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

function drawTotalsBlock(
  doc: jsPDF,
  y: number,
  rows: Array<{ label: string; value: string; strong?: boolean }>,
): number {
  const boxX = 112;
  const boxW = M.right - boxX;
  const rowH = 6.5;
  const totalRows = rows.length;
  const boxH = rowH * totalRows + 4;

  setFill(doc, C.soft);
  setDraw(doc, C.line);
  doc.setLineWidth(0.2);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, "FD");

  let ry = y + 6;
  rows.forEach((r, i) => {
    if (r.strong) {
      // Top separator before final total
      setDraw(doc, C.line);
      doc.line(boxX + 4, ry - 3, M.right - 4, ry - 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setText(doc, C.primary);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setText(doc, C.body);
    }
    doc.text(r.label, boxX + 4, ry);
    if (r.strong) setText(doc, C.primary);
    else setText(doc, C.ink);
    doc.setFont(r.strong ? "helvetica" : "helvetica", r.strong ? "bold" : "normal");
    doc.text(r.value, M.right - 4, ry, { align: "right" });
    ry += rowH;
  });
  return y + boxH + 6;
}

export function buildSelfBillingPdf(p: SelfBillingParams): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "FACTURE", `N° ${p.invoiceNumber}`);
  let y = 54;
  y = drawParties(doc, p.vendor, p.customer, y);
  y = drawInvoiceMeta(doc, {
    "N° facture": p.invoiceNumber,
    "Date": fmtDateBE(new Date()),
    "Commande": p.order.order_number || "—",
    "Échéance": "Acquitté",
  }, y);

  // Table header
  y = drawTableHeader(doc, y, [
    { label: "DÉSIGNATION", x: M.left + 3 },
    { label: "QTÉ", x: 118, align: "right" },
    { label: "PU HTVA", x: 148, align: "right" },
    { label: "TVA", x: 165, align: "right" },
    { label: "TOTAL HTVA", x: M.right - 3, align: "right" },
  ]);

  // Table body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  let subtotal = 0;
  let vatTotal = 0;
  const rowH = 7;
  p.lines.forEach((l, idx) => {
    // Zebra background
    if (idx % 2 === 1) {
      setFill(doc, C.zebra);
      doc.rect(M.left, y - 5, M.width, rowH, "F");
    }
    setText(doc, C.ink);
    const name = String(l.name || "—");
    doc.text(name, M.left + 3, y, { maxWidth: 100 });
    setText(doc, C.body);
    doc.text(String(l.quantity), 118, y, { align: "right" });
    doc.text(fmtEur(l.unit_price_excl_vat), 148, y, { align: "right" });
    doc.text(`${Number(l.vat_rate).toFixed(0)}%`, 165, y, { align: "right" });
    setText(doc, C.ink);
    doc.text(fmtEur(l.line_total_excl_vat), M.right - 3, y, { align: "right" });
    subtotal += Number(l.line_total_excl_vat);
    vatTotal += Number(l.line_total_incl_vat) - Number(l.line_total_excl_vat);
    y += rowH;
    if (y > 250) { doc.addPage(); y = 20; }
  });

  y += 4;
  y = drawTotalsBlock(doc, y, [
    { label: "Sous-total HTVA", value: fmtEur(subtotal) },
    { label: "TVA", value: fmtEur(vatTotal) },
    { label: "Total TTC", value: fmtEur(subtotal + vatTotal), strong: true },
  ]);

  // Paid banner
  y += 2;
  setFill(doc, C.successBg);
  setDraw(doc, C.success);
  doc.setLineWidth(0.3);
  doc.roundedRect(M.left, y, M.width, 12, 2, 2, "FD");
  setText(doc, C.success);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`✓  Acquitté — paiement reçu via MediKong le ${fmtDateBE(p.paidAt)}`, 105, y + 7.8, { align: "center" });

  // Legal mandate mention
  y += 18;
  const mandateText = buildSelfBillingMandateMention(p.vendor, p.mandateSignedAt);
  setFill(doc, C.soft);
  setDraw(doc, C.line);
  doc.setLineWidth(0.2);
  const mandateHeight = 20;
  doc.roundedRect(M.left, y, M.width, mandateHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, C.mute);
  doc.text("MENTION LÉGALE — MANDAT DE FACTURATION", M.left + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, C.body);
  doc.text(mandateText, M.left + 4, y + 10, { maxWidth: M.width - 8 });

  // Footer
  drawFooter(doc);
  return doc.output("arraybuffer") as any;
}

function drawFooter(doc: jsPDF) {
  const pageH = 297;
  const y = pageH - 12;
  setDraw(doc, C.line);
  doc.setLineWidth(0.2);
  doc.line(M.left, y - 3, M.right, y - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, C.mute);
  doc.text(
    `${MEDIKONG.name} · ${MEDIKONG.address}, ${MEDIKONG.postal}, ${MEDIKONG.country} · TVA ${MEDIKONG.vat} · ${MEDIKONG.email}`,
    105, y + 1, { align: "center" },
  );
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
  let y = 54;
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

  y = drawTableHeader(doc, y, [
    { label: "DÉSIGNATION", x: M.left + 3 },
    { label: "BASE HTVA", x: 148, align: "right" },
    { label: "TAUX", x: 165, align: "right" },
    { label: "MONTANT", x: M.right - 3, align: "right" },
  ]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setText(doc, C.ink);
  doc.text(`Commission MediKong — commande ${p.order.order_number}`, M.left + 3, y, { maxWidth: 110 });
  setText(doc, C.body);
  doc.text(fmtEur(p.gmvExclVat), 148, y, { align: "right" });
  doc.text(`${p.commissionRate.toFixed(2)}%`, 165, y, { align: "right" });
  setText(doc, C.ink);
  doc.text(fmtEur(commissionHt), M.right - 3, y, { align: "right" });
  y += 8;

  y = drawTotalsBlock(doc, y, [
    { label: "Commission HTVA", value: fmtEur(commissionHt) },
    { label: "TVA 21%", value: fmtEur(vat) },
    { label: "Total TTC", value: fmtEur(commissionTtc), strong: true },
  ]);

  y += 4;
  setFill(doc, C.soft);
  setDraw(doc, C.line);
  doc.setLineWidth(0.2);
  doc.roundedRect(M.left, y, M.width, 16, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, C.mute);
  doc.text("NATURE DU DOCUMENT", M.left + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, C.body);
  doc.text(
    `Facture de commission émise par ${MEDIKONG.name} au fournisseur suite au paiement de la commande.`,
    M.left + 4, y + 10, { maxWidth: M.width - 8 },
  );

  drawFooter(doc);
  return { pdf: doc.output("arraybuffer") as any, commissionHt, vat, commissionTtc };
}
