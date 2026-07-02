/**
 * Modèle de filtre partagé — source de vérité UNIQUE côté front pour tout ce qui
 * calcule CA HTVA / GMV TTC / commandes vendeur à partir de `order_lines` +
 * `orders`.
 *
 * DOIT rester strictement aligné avec la RPC canonique
 * `public.get_vendor_gmv_progress` (SQL). Toute modification ici implique
 * d'ajuster la RPC (et inversement). Le test d'intégration
 * `vendor_gmv_filters_self_test_admin()` (côté DB) verrouille l'alignement.
 *
 * Statuts EXCLUS du CA/GMV vendeur — normalisés en lowercase :
 *   - cancelled  (enum canonique BE)
 *   - canceled   (variante orthographique tolérée, jamais émise aujourd'hui)
 *   - refused
 *   - rejected
 *   - refunded
 *   - failed
 *
 * Exclusions structurelles complémentaires appliquées sur `orders` :
 *   - is_forecast = true      (prévisionnel, jamais facturable)
 *   - is_test = true          (jeux de données)
 *   - hidden_from_list = true (masquée par l'admin)
 *   - deleted_at IS NOT NULL  (soft-delete)
 */

export const VENDOR_GMV_EXCLUDED_STATUSES = [
  "cancelled",
  "canceled",
  "refused",
  "rejected",
  "refunded",
  "failed",
] as const;

export type VendorGmvExcludedStatus =
  (typeof VENDOR_GMV_EXCLUDED_STATUSES)[number];

const EXCLUDED_SET: ReadonlySet<string> = new Set(
  VENDOR_GMV_EXCLUDED_STATUSES,
);

/** Normalise un statut brut (trim + lowercase) avant comparaison. */
export function normalizeOrderStatus(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** true si le statut fait partie de la GMV/CA vendeur. */
export function isBillableStatus(rawStatus: unknown): boolean {
  return !EXCLUDED_SET.has(normalizeOrderStatus(rawStatus));
}

/**
 * Vérifie qu'une commande (joined via `orders!inner`) doit être conservée dans
 * le calcul CA/GMV vendeur. À utiliser côté client après un SELECT pour
 * appliquer les exclusions non-représentables via PostgREST (statuts) et
 * garantir la cohérence avec la RPC.
 */
export function isBillableOrder(order: {
  status?: unknown;
  is_forecast?: boolean | null;
  is_test?: boolean | null;
  hidden_from_list?: boolean | null;
  deleted_at?: string | null;
} | null | undefined): boolean {
  if (!order) return false;
  if (order.is_forecast) return false;
  if (order.is_test) return false;
  if (order.hidden_from_list) return false;
  if (order.deleted_at) return false;
  return isBillableStatus(order.status);
}

/**
 * Colonnes minimales à sélectionner sur `orders` pour pouvoir appliquer
 * `isBillableOrder` côté client. Regrouper ici évite les oublis lors d'un
 * ajout de filtre.
 */
export const VENDOR_GMV_ORDER_COLUMNS =
  "id, status, is_forecast, is_test, hidden_from_list, deleted_at, created_at" as const;

