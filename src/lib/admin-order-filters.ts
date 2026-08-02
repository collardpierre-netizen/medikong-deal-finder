/**
 * Filtrage unifié des commandes de test (`orders.is_test = true`) pour tous les
 * écrans admin (listes serveur via RPC `admin_list_orders`, widgets dashboard,
 * graphiques).
 *
 * Règle unique : les commandes de test sont MASQUÉES par défaut partout.
 * Seul un toggle explicite (ex. `/admin/commandes`) peut les réafficher.
 *
 * Toute nouvelle vue admin qui lit `orders` doit passer par ce module afin
 * d'éviter que les écrans divergent à nouveau.
 */

/** Valeur par défaut du flag `_hide_test` / `hideTest` côté admin. */
export const ADMIN_HIDE_TEST_ORDERS_DEFAULT = true;

export type MaybeTestOrder = { is_test?: boolean | null };

/** True si la commande est une commande de test. */
export const isTestOrder = (order: MaybeTestOrder | null | undefined): boolean =>
  Boolean(order?.is_test);

/**
 * Filtre une liste de commandes déjà chargées côté client.
 * @param hideTest défaut = ADMIN_HIDE_TEST_ORDERS_DEFAULT (masquer les tests)
 */
export function excludeTestOrders<T extends MaybeTestOrder>(
  orders: T[] | null | undefined,
  hideTest: boolean = ADMIN_HIDE_TEST_ORDERS_DEFAULT,
): T[] {
  const rows = orders ?? [];
  return hideTest ? rows.filter((o) => !isTestOrder(o)) : rows;
}

/**
 * Applique le filtre à une requête PostgREST (`supabase.from("orders")...`).
 * Utiliser sur toute requête admin directe sur la table `orders`.
 */
export function applyTestOrderFilter<Q extends { eq: (col: string, val: any) => Q }>(
  query: Q,
  hideTest: boolean = ADMIN_HIDE_TEST_ORDERS_DEFAULT,
): Q {
  return hideTest ? query.eq("is_test", false) : query;
}
