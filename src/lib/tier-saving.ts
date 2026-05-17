/**
 * Règles de validation centralisées pour le badge "-X%" des paliers MOV.
 *
 * Objectif : garantir que les blocs desktop et mobile (et tout futur appelant)
 * appliquent EXACTEMENT les mêmes gardes (basePrice/unitPrice nul, négatif,
 * NaN, Infinity, chaîne invalide, etc.). Toute modification des règles doit
 * passer par ce module — ne JAMAIS dupliquer la logique dans les pages.
 *
 * Deux entrées :
 *   - `computeTierSavingPercent(basePrice, unitPrice)` : à utiliser côté
 *     pages pour calculer la valeur à passer au badge. Renvoie un nombre
 *     positif (% d'économie) ou `null` si l'un des prix est invalide ou
 *     si l'économie n'est pas strictement positive.
 *   - `parseTierSavingValue(saving)` : utilisé par <TierSavingBadge /> pour
 *     normaliser n'importe quelle entrée (string/number/null/undefined) en
 *     nombre fini > 0, ou `null` sinon. Sert de filet de sécurité si un
 *     appelant ne passe pas par `computeTierSavingPercent`.
 */

export type TierSavingInput = string | number | null | undefined;

/** Vrai si la valeur est un nombre fini et strictement > 0. */
function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Calcule le pourcentage d'économie d'un palier MOV par rapport au prix de
 * base. Retourne `null` si :
 *   - basePrice manquant / null / undefined
 *   - basePrice non numérique, NaN, Infinity, ≤ 0
 *   - unitPrice manquant / null / undefined
 *   - unitPrice non numérique, NaN, Infinity (négatif accepté → saving > 100%)
 *   - économie résultante ≤ 0 (pas de réduction effective)
 */
export function computeTierSavingPercent(
  basePrice: number | null | undefined,
  unitPrice: number | null | undefined,
): number | null {
  if (!isPositiveFinite(basePrice)) return null;
  if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice)) return null;
  const pct = ((basePrice - unitPrice) / basePrice) * 100;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return pct;
}

/**
 * Normalise une valeur reçue par <TierSavingBadge /> en nombre fini > 0.
 * Retourne `null` pour : null/undefined/"", non parsable, NaN, ±Infinity,
 * ≤ 0, ou chaîne formatée représentant "0.0".
 */
export function parseTierSavingValue(saving: TierSavingInput): number | null {
  if (saving === null || saving === undefined || saving === "") return null;
  const num = typeof saving === "number" ? saving : parseFloat(saving);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

/**
 * Format d'affichage canonique : "-X.X%" (1 décimale forcée).
 * Renvoie `null` si l'entrée n'est pas une réduction valide.
 */
export function formatTierSaving(saving: TierSavingInput): string | null {
  const num = parseTierSavingValue(saving);
  if (num === null) return null;
  return `-${num.toFixed(1)}%`;
}
