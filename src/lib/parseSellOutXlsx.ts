import * as XLSX from "xlsx";
import type { SellOutLineInput } from "@/hooks/useVendorSellOut";

const HEADERS: Record<string, keyof SellOutLineInput | "label"> = {
  gtin: "gtin",
  ean: "gtin",
  cnk: "cnk_code",
  cnk_code: "cnk_code",
  produit: "label",
  product: "label",
  nom: "label",
  designation: "label",
  label: "label",
  units: "units",
  unites: "units",
  unités: "units",
  quantite: "units",
  quantité: "units",
  qty: "units",
  ca_brut: "gross_revenue_cents",
  gross: "gross_revenue_cents",
  ca: "net_revenue_cents",
  net: "net_revenue_cents",
  ca_net: "net_revenue_cents",
  revenue: "net_revenue_cents",
};

function normalize(s: string) {
  return String(s || "").toLowerCase().trim().replace(/[\s\-_.]+/g, "_");
}

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export interface RejectedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  reason: string;
}

export interface ParseResult {
  lines: SellOutLineInput[];
  rejected: RejectedRow[];
  totalRows: number;
  recognizedColumns: string[];
  unknownColumns: string[];
}

export async function parseSellOutXlsx(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const lines: SellOutLineInput[] = [];
  const rejected: RejectedRow[] = [];
  const recognized = new Set<string>();
  const unknown = new Set<string>();

  rows.forEach((raw, idx) => {
    const mapped: any = { units: 0, gross_revenue_cents: 0, net_revenue_cents: 0 };
    let label: string | undefined;
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADERS[normalize(k)];
      if (!key) {
        if (String(v ?? "").trim() !== "") unknown.add(k);
        continue;
      }
      recognized.add(k);
      if (key === "label") label = String(v || "").trim();
      else if (key === "gtin" || key === "cnk_code") mapped[key] = String(v || "").trim() || null;
      else if (key === "units") mapped.units = Math.round(toNumber(v));
      else mapped[key] = Math.round(toNumber(v) * 100);
    }
    if (label) mapped.raw_label = label;

    const rowNumber = idx + 2; // +1 header +1 base
    const hasIdent = !!(mapped.gtin || mapped.cnk_code);
    const hasMetric = mapped.units > 0 || mapped.net_revenue_cents > 0 || mapped.gross_revenue_cents > 0;

    if (!hasIdent && !hasMetric && !label) return; // ligne vide, ignore silencieusement
    if (!hasIdent) {
      rejected.push({ rowNumber, raw, reason: "GTIN/CNK manquant" });
      return;
    }
    if (!hasMetric) {
      rejected.push({ rowNumber, raw, reason: "Aucune unité ni CA renseigné" });
      return;
    }
    lines.push(mapped);
  });

  return {
    lines,
    rejected,
    totalRows: rows.length,
    recognizedColumns: Array.from(recognized),
    unknownColumns: Array.from(unknown),
  };
}
