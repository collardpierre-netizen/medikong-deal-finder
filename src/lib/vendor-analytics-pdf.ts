import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtEur } from "@/lib/format-currency";
import type { AnalyticsPeriod } from "@/hooks/useVendorAnalytics";
import logoUrl from "@/assets/logo-medikong.png";

// MediKong brand tokens (mirrors mem://style/*).
const BRAND_BLUE: [number, number, number] = [27, 91, 218]; // #1B5BDA
const NAVY: [number, number, number] = [29, 37, 48]; // #1D2530
const SLATE: [number, number, number] = [97, 107, 124]; // #616B7C
const MUTED: [number, number, number] = [139, 149, 165]; // #8B95A5
const BORDER: [number, number, number] = [226, 232, 240]; // #E2E8F0
const SOFT_BG: [number, number, number] = [248, 250, 252]; // #F8FAFC

// Coverage tertile colors — mirrors src/components/vendor/analytics/CustomerMap.tsx
const TIER_HIGH: [number, number, number] = [22, 163, 74]; // #16A34A green
const TIER_MID: [number, number, number] = [245, 158, 11]; // #F59E0B orange
const TIER_LOW: [number, number, number] = [220, 38, 38]; // #DC2626 red

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

export interface GeoPoint {
  lat: number;
  lng: number;
  city: string;
  postal_code: string;
  country_code: string;
  ca_htva_cents: number;
  orders_count: number;
  customers_count: number;
}

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
  geoPoints: GeoPoint[];
}

function eur(cents: number): string {
  return `${fmtEur((Number(cents) || 0) / 100)} EUR`;
}

function delta(cur: number, prev: number): string {
  if (!prev) return cur > 0 ? "+100%" : "—";
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}

/**
 * Fetch a URL and return its data-URL representation.
 * Used to embed images (logo) and TTF fonts fetched from CDN.
 */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/** Strip a data URL prefix to get raw base64 payload. */
function stripDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

// Module-level cache for DM Sans + Bricolage Grotesque TTFs (fetched once per session).
let dmSansCache: { regular: string; bold: string } | null = null;
let bricolageCache: { bold: string } | null = null;

/**
 * Fetch DM Sans (regular + bold) from a stable CDN and cache the base64 payload.
 * Returns null if the fetch fails so the caller can fall back to Helvetica.
 */
async function loadDmSans(): Promise<{ regular: string; bold: string } | null> {
  if (dmSansCache) return dmSansCache;
  try {
    const [reg, bold] = await Promise.all([
      urlToDataUrl("https://cdn.jsdelivr.net/gh/googlefonts/dm-fonts@master/Sans/Roman/Static/DMSans-Regular.ttf"),
      urlToDataUrl("https://cdn.jsdelivr.net/gh/googlefonts/dm-fonts@master/Sans/Roman/Static/DMSans-Bold.ttf"),
    ]);
    dmSansCache = { regular: stripDataUrl(reg), bold: stripDataUrl(bold) };
    return dmSansCache;
  } catch {
    return null;
  }
}

/**
 * Fetch Bricolage Grotesque Bold — used for titles to mirror the MediKong site
 * (mem://style: titres en Bricolage Grotesque). Best-effort with fallback.
 */
async function loadBricolage(): Promise<{ bold: string } | null> {
  if (bricolageCache) return bricolageCache;
  const urls = [
    "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bricolagegrotesque/static/BricolageGrotesque_24pt-Bold.ttf",
    "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bricolagegrotesque/static/BricolageGrotesque-Bold.ttf",
  ];
  for (const u of urls) {
    try {
      const b = await urlToDataUrl(u);
      bricolageCache = { bold: stripDataUrl(b) };
      return bricolageCache;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Register DM Sans in a jsPDF document if it has been loaded, else no-op. */
function registerDmSans(doc: jsPDF, font: { regular: string; bold: string } | null): string {
  if (!font) return "helvetica";
  doc.addFileToVFS("DMSans-Regular.ttf", font.regular);
  doc.addFileToVFS("DMSans-Bold.ttf", font.bold);
  doc.addFont("DMSans-Regular.ttf", "DMSans", "normal");
  doc.addFont("DMSans-Bold.ttf", "DMSans", "bold");
  return "DMSans";
}

/** Register Bricolage Grotesque Bold for titles. Returns the family name or a fallback. */
function registerBricolage(doc: jsPDF, font: { bold: string } | null, fallback: string): string {
  if (!font) return fallback;
  doc.addFileToVFS("BricolageGrotesque-Bold.ttf", font.bold);
  doc.addFont("BricolageGrotesque-Bold.ttf", "Bricolage", "bold");
  return "Bricolage";
}

function drawHeader(
  doc: jsPDF,
  vendorName: string,
  periodLabel: string,
  logoDataUrl: string | null,
  fontName: string,
  titleFont: string
) {
  const w = doc.internal.pageSize.getWidth();
  // Blue banner
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, w, 26, "F");

  // Logo (left) — falls back to wordmark if the image failed to load.
  if (logoDataUrl) {
    try {
      // White panel so the horizontal logo pops on the blue banner.
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(10, 5, 56, 16, 2, 2, "F");
      doc.addImage(logoDataUrl, "PNG", 12, 7, 52, 12, undefined, "FAST");
    } catch {
      doc.setFont(titleFont, "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("MediKong", 14, 17);
    }
  } else {
    doc.setFont(titleFont, "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("MediKong", 14, 17);
  }

  // Tagline right
  doc.setFont(fontName, "normal");
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
  doc.setFont(titleFont, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(vendorName || "Vendeur", 14, 36);
  doc.setFont(fontName, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`Période : ${periodLabel}`, w - 14, 36, { align: "right" });
}

function drawFooter(doc: jsPDF, fontName: string) {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.line(14, h - 14, w - 14, h - 14);
    doc.setFont(fontName, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("MediKong · Balooh SRL · BE 1005.771.323", 14, h - 8);
    doc.text(`Page ${i} / ${pageCount}`, w - 14, h - 8, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, y: number, title: string, fontName: string, titleFont: string, subtitle?: string): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(14, y, 3, 7, "F");
  doc.setFont(titleFont, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(title, 20, y + 5.5);
  if (subtitle) {
    doc.setFont(fontName, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, w - 14, y + 5.5, { align: "right" });
  }
  return y + 11;
}

function drawKpiGrid(
  doc: jsPDF,
  y: number,
  kpis: NonNullable<VendorAnalyticsPdfPayload["kpis"]>,
  fontName: string
): number {
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
    doc.setFont(fontName, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(it.label.toUpperCase(), x + 4, cy + 5);
    doc.setFont(fontName, "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(it.value, x + 4, cy + 13);
    doc.setFont(fontName, "normal");
    doc.setFontSize(8);
    const isPos = !it.deltaText.startsWith("-") && it.deltaText !== "—";
    doc.setTextColor(...(isPos ? ([4, 120, 87] as [number, number, number]) : ([185, 28, 28] as [number, number, number])));
    if (it.deltaText === "—") doc.setTextColor(...MUTED);
    doc.text(`${it.deltaText} vs période précédente`, x + 4, cy + 19);
  });

  return y + Math.ceil(items.length / cols) * (cellH + gap);
}

// Country outlines cache (MediKong operating footprint: BE / LU / FR / NL / DE).
type CountryCode = "BE" | "FR" | "LU" | "NL" | "DE";
const COUNTRY_TO_ISO3: Record<CountryCode, string> = { BE: "BEL", FR: "FRA", LU: "LUX", NL: "NLD", DE: "DEU" };
type Ring = Array<[number, number]>; // [lng, lat]
const countryOutlineCache: Record<string, Ring[]> = {};

async function loadCountryOutline(iso3: string): Promise<Ring[]> {
  if (countryOutlineCache[iso3]) return countryOutlineCache[iso3];
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries/${iso3}.geo.json`
    );
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const rings: Ring[] = [];
    const feat = json?.features?.[0] ?? json;
    const geom = feat?.geometry ?? feat;
    const coords = geom?.coordinates;
    if (geom?.type === "Polygon" && Array.isArray(coords)) {
      // First ring only (outer boundary).
      if (Array.isArray(coords[0])) rings.push(coords[0] as Ring);
    } else if (geom?.type === "MultiPolygon" && Array.isArray(coords)) {
      for (const poly of coords) if (Array.isArray(poly?.[0])) rings.push(poly[0] as Ring);
    }
    countryOutlineCache[iso3] = rings;
    return rings;
  } catch {
    countryOutlineCache[iso3] = [];
    return [];
  }
}

/**
 * Preload outlines for the countries actually present in the dataset
 * (fallback to BE so the map is never empty). Called from generateVendorAnalyticsPdf.
 */
async function preloadCountryOutlines(points: GeoPoint[]): Promise<Record<CountryCode, Ring[]>> {
  const present = new Set<CountryCode>();
  for (const p of points) {
    const cc = (p.country_code || "").toUpperCase();
    if (cc in COUNTRY_TO_ISO3) present.add(cc as CountryCode);
  }
  if (present.size === 0) present.add("BE");
  // Always include neighbours of BE for geographic context.
  present.add("BE");
  present.add("FR");
  present.add("NL");
  present.add("LU");
  const codes = Array.from(present);
  const rings = await Promise.all(codes.map((cc) => loadCountryOutline(COUNTRY_TO_ISO3[cc])));
  const out = {} as Record<CountryCode, Ring[]>;
  codes.forEach((cc, i) => (out[cc] = rings[i]));
  return out;
}

/**
 * Draw a coverage map with country outlines (BE/LU/FR/NL/DE) as background
 * and geocoded customer points colour-coded by CA tertile.
 */
function drawCoverageMap(
  doc: jsPDF,
  y: number,
  points: GeoPoint[],
  outlines: Record<CountryCode, Ring[]>,
  fontName: string
): number {
  const w = doc.internal.pageSize.getWidth();
  const margin = 14;
  const boxW = w - margin * 2;
  const boxH = 110;

  // Frame
  doc.setDrawColor(...BORDER);
  doc.setFillColor(238, 244, 253); // soft "sea" background
  doc.roundedRect(margin, y, boxW, boxH, 2, 2, "FD");

  // Compute bounding box: union of loaded country outlines + points (padded).
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const includePt = (lng: number, lat: number) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  };
  for (const cc of Object.keys(outlines) as CountryCode[]) {
    for (const ring of outlines[cc]) for (const [lng, lat] of ring) includePt(lng, lat);
  }
  for (const p of points) includePt(p.lng, p.lat);
  if (!isFinite(minLat)) {
    // No outlines and no points — fallback to BENELUX box.
    minLat = 49; maxLat = 54; minLng = 2; maxLng = 8;
  }
  const spanLat = Math.max(0.5, maxLat - minLat);
  const spanLng = Math.max(0.5, maxLng - minLng);
  const padLat = spanLat * 0.05;
  const padLng = spanLng * 0.05;
  const lat0 = minLat - padLat;
  const lat1 = maxLat + padLat;
  const lng0 = minLng - padLng;
  const lng1 = maxLng + padLng;

  // Preserve aspect ratio inside the frame.
  const dataAspect = (lng1 - lng0) / (lat1 - lat0);
  const boxAspect = (boxW - 6) / (boxH - 6);
  let drawW = boxW - 6;
  let drawH = boxH - 6;
  if (dataAspect > boxAspect) drawH = drawW / dataAspect;
  else drawW = drawH * dataAspect;
  const ox = margin + (boxW - drawW) / 2;
  const oy = y + (boxH - drawH) / 2;

  const project = (lng: number, lat: number): [number, number] => [
    ox + ((lng - lng0) / (lng1 - lng0)) * drawW,
    oy + (1 - (lat - lat0) / (lat1 - lat0)) * drawH,
  ];

  // Draw country outlines (filled land + border).
  doc.setLineWidth(0.25);
  doc.setDrawColor(148, 163, 184); // slate-400 borders
  doc.setFillColor(255, 255, 255); // land
  for (const cc of Object.keys(outlines) as CountryCode[]) {
    for (const ring of outlines[cc]) {
      if (ring.length < 3) continue;
      const pts = ring.map(([lng, lat]) => project(lng, lat));
      const [sx, sy] = pts[0];
      const deltas: [number, number][] = [];
      for (let i = 1; i < pts.length; i++) {
        deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
      }
      // Fill + stroke
      (doc as unknown as { lines: (l: number[][], x: number, y: number, s: number[], style: string, closed: boolean) => void }).lines(
        deltas as unknown as number[][],
        sx,
        sy,
        [1, 1],
        "FD",
        true
      );
    }
  }

  // Country ISO labels at approx centroids.
  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  for (const cc of Object.keys(outlines) as CountryCode[]) {
    const rings = outlines[cc];
    if (!rings.length) continue;
    // Centroid of the first (main) ring.
    const ring = rings[0];
    let cx = 0, cy = 0;
    for (const [lng, lat] of ring) { cx += lng; cy += lat; }
    cx /= ring.length; cy /= ring.length;
    const [px, py] = project(cx, cy);
    doc.text(cc, px, py, { align: "center" });
  }

  if (points.length === 0) {
    doc.setFont(fontName, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Aucune localisation client géocodée sur la période.", margin + boxW / 2, y + boxH / 2 + 6, { align: "center" });
    return y + boxH + 6;
  }

  // Tertile thresholds on CA (same logic as CustomerMap.quantile)
  const sortedCa = points.map((p) => p.ca_htva_cents).sort((a, b) => a - b);
  const q = (arr: number[], p: number) => {
    if (!arr.length) return 0;
    const pos = (arr.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    return arr[base + 1] !== undefined ? arr[base] + rest * (arr[base + 1] - arr[base]) : arr[base];
  };
  const p33 = q(sortedCa, 1 / 3);
  const p66 = q(sortedCa, 2 / 3);
  const maxCa = Math.max(1, ...sortedCa);

  // Plot points on top of the outlines.
  for (const p of points) {
    const [px, py] = project(p.lng, p.lat);
    const tier: [number, number, number] =
      p.ca_htva_cents >= p66 ? TIER_HIGH : p.ca_htva_cents >= p33 ? TIER_MID : TIER_LOW;
    const r = 1.1 + 2.6 * (p.ca_htva_cents / maxCa);
    // White halo for readability against country fill.
    doc.setFillColor(255, 255, 255);
    doc.circle(px, py, r + 0.6, "F");
    doc.setFillColor(...tier);
    doc.setDrawColor(...tier);
    doc.setLineWidth(0.2);
    doc.circle(px, py, r, "F");
  }

  // Legend (bottom-left inside the box)
  const legW = 54;
  const legH = 20;
  const legX = margin + 4;
  const legY = y + boxH - legH - 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(legX, legY, legW, legH, 1.5, 1.5, "FD");
  doc.setFont(fontName, "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text("COUVERTURE (CA)", legX + 2, legY + 3.5);
  const legendRow = (row: number, color: [number, number, number], label: string) => {
    doc.setFillColor(...color);
    doc.circle(legX + 3.5, legY + 7 + row * 4, 1.2, "F");
    doc.setFont(fontName, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(label, legX + 6, legY + 8 + row * 4);
  };
  legendRow(0, TIER_HIGH, `Forte (≥ ${fmtEur(p66 / 100)} €)`);
  legendRow(1, TIER_MID, "Moyenne");
  legendRow(2, TIER_LOW, `Faible (< ${fmtEur(p33 / 100)} €)`);

  // Caption
  doc.setFont(fontName, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `${points.length} zones géocodées · taille des cercles ∝ CA HTVA · couleur par tertile de CA`,
    margin,
    y + boxH + 5
  );

  return y + boxH + 10;
}

const tableStylesBase = {
  headStyles: { fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, fontStyle: "bold" as const },
  bodyStyles: { fontSize: 9, textColor: NAVY },
  alternateRowStyles: { fillColor: SOFT_BG },
  styles: { cellPadding: 2.5, lineColor: BORDER, lineWidth: 0.1 },
  margin: { left: 14, right: 14 },
};

function tableStyles(fontName: string) {
  return {
    ...tableStylesBase,
    headStyles: { ...tableStylesBase.headStyles, font: fontName },
    bodyStyles: { ...tableStylesBase.bodyStyles, font: fontName },
    styles: { ...tableStylesBase.styles, font: fontName },
  };
}

export async function generateVendorAnalyticsPdf(payload: VendorAnalyticsPdfPayload): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Try to load the MediKong logo + DM Sans + Bricolage Grotesque in parallel; all best-effort.
  const [logoDataUrl, dmSans, bricolage, outlines] = await Promise.all([
    urlToDataUrl(logoUrl).catch(() => null),
    loadDmSans(),
    loadBricolage(),
    preloadCountryOutlines(payload.geoPoints),
  ]);
  const fontName = registerDmSans(doc, dmSans);
  const titleFont = registerBricolage(doc, bricolage, fontName);
  doc.setFont(fontName, "normal");

  drawHeader(doc, payload.vendorName, payload.periodLabel, logoDataUrl, fontName, titleFont);

  let y = 50;

  // KPIs
  if (payload.kpis) {
    y = sectionTitle(doc, y, "Indicateurs clés", fontName, titleFont, payload.periodLabel);
    y = drawKpiGrid(doc, y, payload.kpis, fontName) + 6;
  }

  // Recurrence
  if (payload.recurrence) {
    y = sectionTitle(doc, y, "Récurrence clients", fontName, titleFont);
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
      ...tableStyles(fontName),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Typologie
  if (payload.byType.length > 0) {
    if (y > 240) { doc.addPage(); drawHeader(doc, payload.vendorName, payload.periodLabel, logoDataUrl, fontName, titleFont); y = 50; }
    y = sectionTitle(doc, y, "Répartition par typologie de client", fontName, titleFont);
    autoTable(doc, {
      startY: y,
      head: [["Profil", "CA HTVA", "Part", "Commandes"]],
      body: payload.byType.map((r) => [
        CUSTOMER_TYPE_LABEL[r.customer_type] ?? r.customer_type,
        eur(r.ca_htva_cents),
        `${Number(r.share).toFixed(1)}%`,
        String(r.orders_count),
      ]),
      ...tableStyles(fontName),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Pays
  if (payload.byCountry.length > 0) {
    if (y > 240) { doc.addPage(); drawHeader(doc, payload.vendorName, payload.periodLabel, logoDataUrl, fontName, titleFont); y = 50; }
    y = sectionTitle(doc, y, "Répartition par pays", fontName, titleFont);
    autoTable(doc, {
      startY: y,
      head: [["Pays", "CA HTVA", "Part", "Commandes"]],
      body: payload.byCountry.map((r) => [
        COUNTRY_LABEL[r.country_code] ?? r.country_code,
        eur(r.ca_htva_cents),
        `${Number(r.share).toFixed(1)}%`,
        String(r.orders_count),
      ]),
      ...tableStyles(fontName),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Coverage map — new page dedicated to the scatter + legend.
  doc.addPage();
  drawHeader(doc, payload.vendorName, payload.periodLabel, logoDataUrl, fontName, titleFont);
  y = 50;
  y = sectionTitle(doc, y, "Carte de couverture clients", fontName, titleFont, `${payload.geoPoints.length} zones`);
  y = drawCoverageMap(doc, y, payload.geoPoints, outlines, fontName);

  // Top clients
  if (payload.topCustomers.length > 0) {
    if (y > 220) { doc.addPage(); drawHeader(doc, payload.vendorName, payload.periodLabel, logoDataUrl, fontName); y = 50; }
    y = sectionTitle(doc, y, "Top clients", fontName, `${payload.topCustomers.length} entrées`);
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
      ...tableStyles(fontName),
      styles: { ...tableStyles(fontName).styles, fontSize: 8 },
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
    if (y > 220) { doc.addPage(); drawHeader(doc, payload.vendorName, payload.periodLabel, logoDataUrl, fontName); y = 50; }
    y = sectionTitle(doc, y, "Top produits", fontName, `${payload.topProducts.length} entrées`);
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
      ...tableStyles(fontName),
      styles: { ...tableStyles(fontName).styles, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  }

  drawFooter(doc, fontName);

  const safeVendor = (payload.vendorName || "vendeur").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`medikong-analytics-${safeVendor}-${payload.period}-${dateStr}.pdf`);
}
