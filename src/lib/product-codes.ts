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

/**
 * Calcule la clé de contrôle (dernier chiffre) d'un GTIN à partir de son corps
 * (le code sans son dernier chiffre). Algorithme mod 10 GS1.
 */
export function computeGtinCheckDigit(body: string): number | null {
  const s = normalizeDigits(body);
  if (!/^\d+$/.test(s)) return null;
  const sum = s
    .split("")
    .map(Number)
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

export type GtinDiagnosis = {
  valid: boolean;
  /** Message court affichable sous le champ */
  message: string;
  /** Explication de la règle de contrôle */
  rule?: string;
  /** Comment corriger */
  fix?: string;
  /** Chiffre de contrôle attendu (si longueur valide) */
  expectedCheckDigit?: number;
  /** Chiffre de contrôle saisi */
  providedCheckDigit?: number;
  /** Code corrigé proposé (même corps, bonne clé) */
  suggestion?: string;
};

const GTIN_RULE =
  "Règle GS1 (mod 10) : en partant de la droite (hors dernier chiffre), on multiplie les chiffres alternativement par 3 et 1, on additionne, puis la clé = (10 − (somme mod 10)) mod 10.";

/**
 * Diagnostic complet et pédagogique d'un GTIN saisi.
 */
export function diagnoseGtin(raw: string): GtinDiagnosis {
  const s = normalizeDigits(raw);
  if (!s) {
    return { valid: true, message: "" };
  }
  if (!/^\d+$/.test(s)) {
    return {
      valid: false,
      message: "Le GTIN ne doit contenir que des chiffres.",
      rule: GTIN_RULE,
      fix: "Supprimez les lettres, espaces ou caractères spéciaux et ressaisissez uniquement les chiffres du code-barres.",
    };
  }
  if (![8, 12, 13, 14].includes(s.length)) {
    return {
      valid: false,
      message: `Longueur invalide : ${s.length} chiffre${s.length > 1 ? "s" : ""} (attendu 8, 12, 13 ou 14 — un EAN-13 fait 13 chiffres).`,
      rule: GTIN_RULE,
      fix:
        s.length < 13
          ? "Vérifiez qu'aucun chiffre n'a été oublié, notamment les zéros en début de code."
          : "Vérifiez qu'aucun chiffre n'a été saisi en trop (ne collez que le code sous le code-barres).",
    };
  }
  const body = s.slice(0, -1);
  const provided = Number(s.slice(-1));
  const expected = computeGtinCheckDigit(body);
  if (expected === null || expected === provided) {
    return { valid: true, message: "" };
  }
  return {
    valid: false,
    message: `Clé de contrôle invalide : le dernier chiffre devrait être ${expected} et non ${provided}.`,
    rule: GTIN_RULE,
    fix: `Vérifiez le code imprimé sous le code-barres. Si le début « ${body} » est correct, le GTIN valide est ${body}${expected}. Sinon, laissez le champ vide et renseignez uniquement le CNK.`,
    expectedCheckDigit: expected,
    providedCheckDigit: provided,
    suggestion: `${body}${expected}`,
  };
}
