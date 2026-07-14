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

export async function parseSellOutXlsx(file: File): Promise<SellOutLineInput[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const lines: SellOutLineInput[] = [];
  for (const raw of rows) {
    const mapped: any = { units: 0, gross_revenue_cents: 0, net_revenue_cents: 0 };
    let label: string | undefined;
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADERS[normalize(k)];
      if (!key) continue;
      if (key === "label") label = String(v || "").trim();
      else if (key === "gtin" || key === "cnk_code") mapped[key] = String(v || "").trim() || null;
      else if (key === "units") mapped.units = Math.round(toNumber(v));
      else mapped[key] = Math.round(toNumber(v) * 100);
    }
    if (label) mapped.raw_label = label;
    if (mapped.units > 0 || mapped.net_revenue_cents > 0 || mapped.gtin || mapped.cnk_code) {
      lines.push(mapped);
    }
  }
  return lines;
}
