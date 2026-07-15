import * as XLSX from "xlsx";
import type { BePharmacyImportRow } from "@/hooks/useBePharmacies";

const HEADERS: Record<string, keyof BePharmacyImportRow> = {
  apb: "apb_number",
  apb_number: "apb_number",
  numero_apb: "apb_number",
  numéro_apb: "apb_number",
  code_apb: "apb_number",
  nom: "name",
  name: "name",
  officine: "name",
  denomination: "name",
  dénomination: "name",
  adresse: "address_line1",
  address: "address_line1",
  address_line1: "address_line1",
  rue: "address_line1",
  cp: "postal_code",
  code_postal: "postal_code",
  postal: "postal_code",
  postal_code: "postal_code",
  ville: "city",
  city: "city",
  commune: "city",
  localite: "city",
  localité: "city",
  province: "province",
  telephone: "phone",
  téléphone: "phone",
  tel: "phone",
  phone: "phone",
  email: "email",
  mail: "email",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
};

function normalize(s: string) {
  return String(s || "").toLowerCase().trim().replace(/[\s\-.]+/g, "_");
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface ParseBePharmaciesResult {
  rows: BePharmacyImportRow[];
  rejected: { rowNumber: number; reason: string; raw: Record<string, unknown> }[];
  unknownColumns: string[];
  totalRows: number;
}

export async function parseBePharmaciesXlsx(file: File): Promise<ParseBePharmaciesResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const rows: BePharmacyImportRow[] = [];
  const rejected: ParseBePharmaciesResult["rejected"] = [];
  const unknown = new Set<string>();

  raw.forEach((r, idx) => {
    const mapped: any = {};
    for (const [k, v] of Object.entries(r)) {
      const key = HEADERS[normalize(k)];
      if (!key) {
        if (String(v ?? "").trim() !== "") unknown.add(k);
        continue;
      }
      if (key === "latitude" || key === "longitude") mapped[key] = toNum(v);
      else mapped[key] = String(v ?? "").trim() || null;
    }
    const rowNumber = idx + 2;
    if (!mapped.apb_number) {
      rejected.push({ rowNumber, reason: "Numéro APB manquant", raw: r });
      return;
    }
    if (!mapped.name) {
      rejected.push({ rowNumber, reason: "Nom manquant", raw: r });
      return;
    }
    rows.push(mapped as BePharmacyImportRow);
  });

  return {
    rows,
    rejected,
    unknownColumns: Array.from(unknown),
    totalRows: raw.length,
  };
}
