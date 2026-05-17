/**
 * Diagnostics client-side pour le badge "-X%" des paliers MOV.
 *
 * Objectif : repérer en production les cas où `saving` ou `basePrice` est
 * invalide (null, NaN, ≤ 0, chaîne non parsable, etc.) afin de remonter à
 * la source des problèmes de données (offre mal saisie, palier incomplet,
 * sync Qogita partielle, etc.).
 *
 * Ce module est PUREMENT side-effect : il n'altère jamais le rendu ni la
 * valeur retournée par `computeTierSavingPercent` / `parseTierSavingValue`.
 * Il fournit :
 *   - un compteur en mémoire agrégé par `reason`
 *   - un échantillonnage console (N premiers warns par reason, throttle)
 *   - une exposition sur `window.__tierSavingDiagnostics` pour inspection
 *     manuelle depuis la console navigateur en prod / preview.
 *
 * Aucune dépendance externe (pas d'envoi réseau). Si on souhaite plus tard
 * pousser vers Sentry/PostHog, brancher ici dans `recordTierSavingIssue`.
 */

export type TierSavingIssueReason =
  // Le badge a reçu une valeur qu'il n'a pas pu parser en nombre > 0.
  | "badge_fallback_invalid_saving"
  // `computeTierSavingPercent` a retourné null pour un palier i > 0
  // (basePrice manquant/≤0, unitPrice non fini, ou écart ≤ 0).
  | "compute_returned_null";

export interface TierSavingIssueContext {
  /** Emplacement appelant (ex: "discountTiers", "offerPriceTiers:desktop"). */
  where?: string;
  /** Valeurs brutes pour aider au diagnostic (toujours sérialisables). */
  basePrice?: unknown;
  unitPrice?: unknown;
  saving?: unknown;
  /** Identifiants utiles si dispo (offer, product, vendor). */
  offerId?: string;
  productId?: string;
  vendorId?: string;
}

interface ReasonStats {
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastContext: TierSavingIssueContext | null;
}

const MAX_WARNS_PER_REASON = 5;
const counters = new Map<TierSavingIssueReason, ReasonStats>();
const warnedCounts = new Map<TierSavingIssueReason, number>();

function bumpCounter(
  reason: TierSavingIssueReason,
  ctx: TierSavingIssueContext,
): ReasonStats {
  const now = Date.now();
  const prev = counters.get(reason);
  const next: ReasonStats = prev
    ? { ...prev, count: prev.count + 1, lastSeenAt: now, lastContext: ctx }
    : { count: 1, firstSeenAt: now, lastSeenAt: now, lastContext: ctx };
  counters.set(reason, next);
  return next;
}

/**
 * Enregistre un incident de validation. Idempotent côté UI : à appeler dans
 * la branche d'erreur (fallback badge ou `computeTierSavingPercent === null`).
 */
export function recordTierSavingIssue(
  reason: TierSavingIssueReason,
  context: TierSavingIssueContext = {},
): void {
  const stats = bumpCounter(reason, context);

  // Warn échantillonné pour éviter de polluer la console.
  const warned = warnedCounts.get(reason) ?? 0;
  if (warned < MAX_WARNS_PER_REASON) {
    warnedCounts.set(reason, warned + 1);
    // eslint-disable-next-line no-console
    console.warn(
      `[TierSaving] ${reason} (#${stats.count})`,
      context,
      warned + 1 === MAX_WARNS_PER_REASON
        ? "(suppression des warnings suivants pour cette raison)"
        : "",
    );
  }

  // Exposition window pour debug manuel (ignorée en SSR / tests Node).
  if (typeof window !== "undefined") {
    (window as unknown as {
      __tierSavingDiagnostics?: ReturnType<typeof getTierSavingDiagnostics>;
    }).__tierSavingDiagnostics = getTierSavingDiagnostics();
  }
}

export function getTierSavingDiagnostics(): Record<
  TierSavingIssueReason,
  ReasonStats | null
> & { total: number } {
  let total = 0;
  const out: Record<string, ReasonStats | null> = {
    badge_fallback_invalid_saving: null,
    compute_returned_null: null,
  };
  for (const [reason, stats] of counters.entries()) {
    out[reason] = stats;
    total += stats.count;
  }
  return { ...(out as Record<TierSavingIssueReason, ReasonStats | null>), total };
}

/** Réinitialise compteurs et seuils de warning. Utile pour les tests. */
export function resetTierSavingDiagnostics(): void {
  counters.clear();
  warnedCounts.clear();
  if (typeof window !== "undefined") {
    delete (window as unknown as { __tierSavingDiagnostics?: unknown })
      .__tierSavingDiagnostics;
  }
}
