// Validation utilitaire pour codes produits utilisés en B2B pharma
// - GTIN : 8, 12, 13 ou 14 chiffres avec checksum mod 10
// - CNK (Belgique) : 7 chiffres (souvent affichés "1234-567" ou "1234567")

export type ProductCodeKind = "gtin" | "cnk";

export function normalizeDigits(input: string): string {
  return (input || "").replace(/[\s\-\.]/g, "").trim();
}

export function isValidGtin(raw: string): boolean {
  const s = normalizeDigits(raw);
  if (!/^\d+$/.test(s)) return false;
  if (![8, 12, 13, 14].includes(s.length)) return false;
  const digits = s.split("").map(Number);
  const check = digits.pop()!;
  // Pondération depuis la droite (alternance 3,1,3,1...)
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  const computed = (10 - (sum % 10)) % 10;
  return computed === check;
}

export function isValidCnk(raw: string): boolean {
  const s = normalizeDigits(raw);
  return /^\d{7}$/.test(s);
}

export function detectCodeKind(raw: string): ProductCodeKind | null {
  const s = normalizeDigits(raw);
  if (isValidGtin(s)) return "gtin";
  if (isValidCnk(s)) return "cnk";
  return null;
}

export function describeCodeError(raw: string): string | null {
  const s = normalizeDigits(raw);
  if (!s) return "Saisissez un GTIN (8/12/13/14 chiffres) ou un CNK (7 chiffres).";
  if (!/^\d+$/.test(s)) return "Le code ne doit contenir que des chiffres.";
  if (s.length === 7) return null; // CNK valide
  if ([8, 12, 13, 14].includes(s.length)) {
    return isValidGtin(s) ? null : "Clé de contrôle GTIN invalide — vérifiez la saisie.";
  }
  return `Longueur ${s.length} non reconnue (attendu : 7 = CNK ; 8/12/13/14 = GTIN).`;
}
