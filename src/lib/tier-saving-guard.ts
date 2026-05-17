/**
 * Guard centralisé pour le calcul/affichage des économies par palier MOV.
 *
 * Centralise une règle unique partagée par TOUS les sites de rendu
 * (discountTiers, offerPriceTiers desktop/mobile, legacyTiers, etc.) :
 *
 *   - Tier 0 (index 0) = prix de base → JAMAIS de pastille `-X%`, JAMAIS de
 *     diagnostic remonté (c'est intentionnel, voir TierBaseLegend).
 *   - Tier i > 0 → on calcule via `computeTierSavingPercent`. Si la fonction
 *     retourne `null` (donnée manquante/invalide), on logge un incident
 *     `compute_returned_null` avec le contexte fourni.
 *
 * Toute branche de rendu DOIT passer par `resolveTierSaving` plutôt que de
 * dupliquer `if (i > 0) { ... recordTierSavingIssue(...) }` — ça évite que
 * deux sites divergent (ex: un site oublie le record, un autre passe Tier 0
 * dans le compute par erreur, etc.).
 */

import { computeTierSavingPercent } from "@/lib/tier-saving";
import {
  recordTierSavingIssue,
  type TierSavingIssueContext,
} from "@/lib/tier-saving-diagnostics";

export interface ResolveTierSavingInput {
  /** Position du palier dans la liste triée. 0 = palier de base. */
  index: number;
  /** Prix unitaire de référence (palier 0). */
  basePrice: number | null | undefined;
  /** Prix unitaire du palier courant. */
  unitPrice: number | null | undefined;
  /** Contexte de diagnostic (where, offerId, productId, …). */
  context?: Omit<TierSavingIssueContext, "basePrice" | "unitPrice">;
}

export interface ResolveTierSavingResult {
  /** `true` ssi `index === 0` (palier de base, pas de pastille à afficher). */
  isBase: boolean;
  /**
   * Économie en % (>0) pour les paliers i > 0, `null` si non calculable.
   * Toujours `null` pour Tier 0 (par design — aucun calcul n'est tenté).
   */
  saving: number | null;
}

/**
 * Règle unique : Tier 0 → pas de badge ; sinon compute + record si null.
 * À appeler systématiquement dans la boucle `.map((tier, i) => …)`.
 */
export function resolveTierSaving({
  index,
  basePrice,
  unitPrice,
  context,
}: ResolveTierSavingInput): ResolveTierSavingResult {
  if (index <= 0) {
    return { isBase: true, saving: null };
  }
  const saving = computeTierSavingPercent(basePrice, unitPrice);
  if (saving === null) {
    recordTierSavingIssue("compute_returned_null", {
      ...context,
      basePrice,
      unitPrice,
    });
  }
  return { isBase: false, saving };
}
