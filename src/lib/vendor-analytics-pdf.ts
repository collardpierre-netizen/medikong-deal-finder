import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtEur } from "@/lib/format-currency";
import type { AnalyticsPeriod } from "@/hooks/useVendorAnalytics";

// MediKong brand tokens (mirrors mem://style/*).
const BRAND_BLUE: [number, number, number] = [27, 91, 218]; // #1B5BDA
const NAVY: [number, number, number] = [29, 37, 48]; // #1D2530
const SLATE: [number, number, number] = [97, 107, 124]; // #616B7C
const MUTED: [number, number, number] = [139, 149, 165]; // #8B95A5
const BORDER: [number, number, number] = [226, 232, 240]; // #E2E8F0
const SOFT_BG: [number, number, number] = [248, 250, 252]; // #F8FAFC

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  retail: "Retail",
  pharmacy: "Pharmacie",
  wholesaler: "Grossiste",
  hospital: "Hôpital",
  nursing_home: "MR/MRS",
  clinic: "Cabinet",
  veterinary: "Vétérinaire",
  dentist: "Dentiste",
  other: "Autre",
  unknown: "Non renseigné",
};

const COUNTRY_LABEL: Record<string, string> = {
  BE: "Belgique",
  FR: "France",
  LU: "Luxembourg",
  NL: "Pays-Bas",
  DE: "Allemagne",
  UNK: "Non renseigné",
};

export interface VendorAnalyticsPdfPayload {
  vendorName: string;
  period: AnalyticsPeriod;
  periodLabel: string;
  kpis: {
    ca_htva_cents: number;
    margin_cents: number;
    commission_cents: number;
    orders_count: number;
    active_customers: number;
    avg_basket_cents: number;
    prev_ca_htva_cents: number;
    prev_margin_cents: number;
    prev_commission_cents: number;
    prev_orders_count: number;
    prev_active_customers: number;
    prev_avg_basket_cents: number;
  } | null;
  byType: Array<{ customer_type: string; ca_htva_cents: number; orders_count: number; share: number }>;
  byCountry: Array<{ country_code: string; ca_htva_cents: number; orders_count: number; share: number }>;
  topCustomers: Array<{
    company_name: string | null;
    customer_type: string | null;
    city: string | null;
    postal_code: string | null;
    country_code: string | null;
    ca_htva_cents: number;
    orders_count: number;
    share: number;
    last_order_at: string | null;
  }>;
  topProducts: Array<{
    product_name: string | null;
    units: number;
    ca_htva_cents: number;
    margin_cents: number;
    commission_cents: number;
  }>;
  recurrence: {
    new_customers: number;
    returning_customers: number;
    total_customers: number;
    avg_orders_per_customer: number;
    avg_days_between_orders: number;
    churn_risk_count: number;
  } | null;
}

function eur(cents: number): string {
  return `${fmtEur((Number(cents) || 0) / 100)} EUR`;
}

function delta(cur: number, prev: number): string {
  if (!prev) return cur > 0 ? "+100%" : "—";
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}

function drawHeader(doc: jsPDF, vendorName: string, periodLabel: string) {
  const w = doc.internal.pageSize.getWidth();
  // Blue banner
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, w, 26, "F");
  // Logo wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("MediKong", 14, 17);
  // Tagline right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 232, 255);
  doc.text("Rapport analytics vendeur", w - 14, 12, { align: "right" });
  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" }),
    w - 14,
    20,
    { align: "right" }
  );

  // Sub-header (vendor + period)
  doc.setFillColor(...SOFT_BG);
  doc.rect(0, 26, w, 16, "F");
  doc.setDrawColor(...BORDER);
  doc.line(0, 42, w, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(vendorName || "Vendeur", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`Période : ${periodLabel}`, w - 14, 36, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.line(14, h - 14, w - 14, h - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("MediKong · Balooh SRL · BE 1005.771.323", 14, h - 8);
    doc.text(`Page ${i} / ${pageCount}`, w - 14, h - 8, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, y: number, title: string, subtitle?: string): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(14, y, 3, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(title, 20, y + 5);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, w - 14, y + 5, { align: "right" });
  }
  return y + 10;
}

function drawKpiGrid(doc: jsPDF, y: number, kpis: NonNullable<VendorAnalyticsPdfPayload["kpis"]>): number {
  const w = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 4;
  const cols = 3;
  const cellW = (w - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = 22;

  const items: { label: string; value: string; deltaText: string }[] = [
    { label: "CA HTVA", value: eur(kpis.ca_htva_cents), deltaText: delta(kpis.ca_htva_cents, kpis.prev_ca_htva_cents) },
    { label: "Marge nette", value: eur(kpis.margin_cents), deltaText: delta(kpis.margin_cents, kpis.prev_margin_cents) },
    { label: "Commission MediKong", value: eur(kpis.commission_cents), deltaText: delta(kpis.commission_cents, kpis.prev_commission_cents) },
    { label: "Commandes", value: String(kpis.orders_count), deltaText: delta(kpis.orders_count, kpis.prev_orders_count) },
    { label: "Clients actifs", value: String(kpis.active_customers), deltaText: delta(kpis.active_customers, kpis.prev_active_customers) },
    { label: "Panier moyen", value: eur(kpis.avg_basket_cents), deltaText: delta(kpis.avg_basket_cents, kpis.prev_avg_basket_cents) },
  ];

  items.forEach((it, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = margin + col * (cellW + gap);
    const cy = y + row * (cellH + gap);
    doc.setDrawColor(...BORDER);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, cy, cellW, cellH, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(it.label.toUpperCase(), x + 4, cy + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(it.value, x + 4, cy + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const isPos = !it.deltaText.startsWith("-") && it.deltaText !== "—";
    doc.setTextColor(...(isPos ? ([4, 120, 87] as [number, number, number]) : ([185, 28, 28] as [number, number, number])));
    if (it.deltaText === "—") doc.setTextColor(...MUTED);
    doc.text(`${it.deltaText} vs période précédente`, x + 4, cy + 19);
  });

  return y + Math.ceil(items.length / cols) * (cellH + gap);
}

const tableStyles = {
  headStyles: { fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, fontStyle: "bold" as const },
  bodyStyles: { fontSize: 9, textColor: NAVY },
  alternateRowStyles: { fillColor: SOFT_BG },
  styles: { cellPadding: 2.5, lineColor: BORDER, lineWidth: 0.1 },
  margin: { left: 14, right: 14 },
};

export function generateVendorAnalyticsPdf(payload: VendorAnalyticsPdfPayload): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawHeader(doc, payload.vendorName, payload.periodLabel);

  let y = 50;

  // KPIs
  if (payload.kpis) {
    y = sectionTitle(doc, y, "Indicateurs clés", payload.periodLabel);
    y = drawKpiGrid(doc, y, payload.kpis) + 6;
  }

  // Recurrence
  if (payload.recurrence) {
    y = sectionTitle(doc, y, "Récurrence clients");
    const r = payload.recurrence;
    const retention = r.total_customers ? Math.round((r.returning_customers / r.total_customers) * 100) : 0;
    autoTable(doc, {
      startY: y,
      head: [["Indicateur", "Valeur", "Détail"]],
      body: [
        ["Nouveaux clients", String(r.new_customers), `sur ${r.total_customers} actifs`],
        ["Clients récurrents", String(r.returning_customers), `${retention}% du total`],
        ["Commandes / client (moy.)", String(r.avg_orders_per_customer ?? 0), `Ø ${r.avg_days_between_orders ?? 0} j entre commandes`],
        ["Risque de churn", String(r.churn_risk_count ?? 0), "Aucune commande depuis 60 j"],
      ],
      ...tableStyles,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Typologie
  if (payload.byType.length > 0) {
    if (y > 240) { doc.addPage(); drawHeader(doc, payload.vendorName, payload.periodLabel); y = 50; }
    y = sectionTitle(doc, y, "Répartition par typologie de client");
    autoTable(doc, {
      startY: y,
      head: [["Profil", "CA HTVA", "Part", "Commandes"]],
      body: payload.byType.map((r) => [
        CUSTOMER_TYPE_LABEL[r.customer_type] ?? r.customer_type,
        eur(r.ca_htva_cents),
        `${Number(r.share).toFixed(1)}%`,
        String(r.orders_count),
      ]),
      ...tableStyles,
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Pays
  if (payload.byCountry.length > 0) {
    if (y > 240) { doc.addPage(); drawHeader(doc, payload.vendorName, payload.periodLabel); y = 50; }
    y = sectionTitle(doc, y, "Répartition par pays");
    autoTable(doc, {
      startY: y,
      head: [["Pays", "CA HTVA", "Part", "Commandes"]],
      body: payload.byCountry.map((r) => [
        COUNTRY_LABEL[r.country_code] ?? r.country_code,
        eur(r.ca_htva_cents),
        `${Number(r.share).toFixed(1)}%`,
        String(r.orders_count),
      ]),
      ...tableStyles,
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Top clients
  if (payload.topCustomers.length > 0) {
    doc.addPage();
    drawHeader(doc, payload.vendorName, payload.periodLabel);
    y = 50;
    y = sectionTitle(doc, y, "Top clients", `${payload.topCustomers.length} entrées`);
    autoTable(doc, {
      startY: y,
      head: [["#", "Client", "Profil", "Localisation", "CA HTVA", "Part", "Cmd", "Dernière"]],
      body: payload.topCustomers.map((r, i) => [
        String(i + 1),
        r.company_name || "—",
        CUSTOMER_TYPE_LABEL[r.customer_type ?? "unknown"] ?? r.customer_type ?? "",
        [r.postal_code, r.city].filter(Boolean).join(" ") + (r.country_code ? ` · ${r.country_code}` : ""),
        eur(r.ca_htva_cents),
        `${Number(r.share).toFixed(1)}%`,
        String(r.orders_count),
        r.last_order_at ? new Date(r.last_order_at).toLocaleDateString("fr-FR") : "—",
      ]),
      ...tableStyles,
      styles: { ...tableStyles.styles, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Top produits
  if (payload.topProducts.length > 0) {
    if (y > 220) { doc.addPage(); drawHeader(doc, payload.vendorName, payload.periodLabel); y = 50; }
    y = sectionTitle(doc, y, "Top produits", `${payload.topProducts.length} entrées`);
    autoTable(doc, {
      startY: y,
      head: [["#", "Produit", "Unités", "CA HTVA", "Marge", "Commission"]],
      body: payload.topProducts.map((r, i) => [
        String(i + 1),
        r.product_name || "—",
        String(r.units),
        eur(r.ca_htva_cents),
        eur(r.margin_cents),
        eur(r.commission_cents),
      ]),
      ...tableStyles,
      styles: { ...tableStyles.styles, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  }

  drawFooter(doc);

  const safeVendor = (payload.vendorName || "vendeur").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`medikong-analytics-${safeVendor}-${payload.period}-${dateStr}.pdf`);
}
