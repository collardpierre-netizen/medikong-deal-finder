// Parser de codes Scan — sans dépendance, testable (deno test).
// L'AI 21 (numéro de série) est TOUJOURS ignoré et retiré du code stocké.

export type Symbology = "ean13" | "datamatrix" | "manual_cnk" | "other";

export interface ParsedCode {
  gtin: string | null;
  cnk: string | null;
  lot: string | null;
  expiry_date: string | null; // YYYY-MM-DD
  sanitized_raw: string;      // code brut sans AI 21
  kind: "gtin" | "cnk" | "unknown";
}

const GS = "\x1d";

export function digits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function isValidGtin(s: string): boolean {
  if (!/^\d+$/.test(s) || ![8, 12, 13, 14].includes(s.length)) return false;
  const d = s.split("").map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** GTIN-14 à zéro de tête → GTIN-13 (format stocké dans products.gtin). */
export function toGtin13(g: string): string {
  return g.length === 14 && g.startsWith("0") ? g.slice(1) : g;
}

function parseExpiry(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  let dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return null;
  const year = 2000 + yy;
  if (dd === 0) dd = new Date(Date.UTC(year, mm, 0)).getUTCDate(); // dernier jour du mois
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (date.getUTCMonth() !== mm - 1) return null;
  return date.toISOString().slice(0, 10);
}

// Longueurs fixes des AI usuels ; les autres sont variables (terminés par GS).
const FIXED: Record<string, number> = { "01": 14, "17": 6, "11": 6, "15": 6 };

/** Parse une chaîne GS1 (DataMatrix). Accepte le préfixe ]d2 et les séparateurs GS ou "|". */
export function parseGs1(input: string): { ai: Record<string, string>; sanitized: string } {
  let s = input.replace(/^\]d2/, "").replace(/^\]C1/, "").replace(/\|/g, GS);
  // Forme lisible "(01)...(17)..."
  if (s.startsWith("(")) {
    s = s.replace(/\((\d{2,4})\)/g, (_m, ai) => GS + ai).replace(/^\x1d/, "");
  }
  const ai: Record<string, string> = {};
  const kept: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === GS) { i++; continue; }
    const code = s.slice(i, i + 2);
    i += 2;
    let value: string;
    if (FIXED[code]) {
      value = s.slice(i, i + FIXED[code]);
      i += FIXED[code];
    } else {
      const end = s.indexOf(GS, i);
      value = end === -1 ? s.slice(i) : s.slice(i, end);
      i = end === -1 ? s.length : end + 1;
    }
    if (code === "21") continue; // numéro de série : jamais conservé
    ai[code] = value;
    kept.push(`(${code})${value}`);
  }
  return { ai, sanitized: kept.join("") };
}

export function parseCode(raw: string, symbology: Symbology): ParsedCode {
  const trimmed = (raw || "").trim();
  if (symbology === "datamatrix" || /^(\]d2|\(01\)|01\d{14})/.test(trimmed)) {
    const { ai, sanitized } = parseGs1(trimmed);
    const g = ai["01"] && isValidGtin(ai["01"]) ? toGtin13(ai["01"]) : null;
    return {
      gtin: g,
      cnk: null,
      lot: ai["10"] ?? null,
      expiry_date: ai["17"] ? parseExpiry(ai["17"]) : null,
      sanitized_raw: sanitized,
      kind: g ? "gtin" : "unknown",
    };
  }
  const d = digits(trimmed);
  if (symbology === "manual_cnk" || d.length === 7) {
    return { gtin: null, cnk: d.length === 7 ? d : null, lot: null, expiry_date: null,
      sanitized_raw: d, kind: d.length === 7 ? "cnk" : "unknown" };
  }
  if (isValidGtin(d)) {
    return { gtin: toGtin13(d), cnk: null, lot: null, expiry_date: null, sanitized_raw: d, kind: "gtin" };
  }
  return { gtin: null, cnk: null, lot: null, expiry_date: null, sanitized_raw: d || trimmed.slice(0, 64), kind: "unknown" };
}
