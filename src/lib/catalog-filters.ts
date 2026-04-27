/**
 * Filtres globaux côté front pour le catalogue public.
 *
 * NB : ces filtres ne modifient PAS la base. Ils sont appliqués uniquement
 * dans les requêtes lues par les écrans publics (catalogue, recherche,
 * pages marques/fabricants, accueil). L'admin et le portail vendeur
 * continuent de voir les produits exclus.
 */

/**
 * Mots-clés (insensible à la casse) qui, présents dans `category_name`,
 * doivent masquer le produit du catalogue public.
 *
 * Ajustable sans migration : il suffit d'éditer cette liste.
 */
export const HIDDEN_CATEGORY_KEYWORDS: string[] = [
  "parfum",
  "cologne",
  "fragrance",
  "eau de toilette",
  "extrait de parfum",
];

/**
 * Construit un filtre PostgREST `not.ilike.all` pour exclure les produits
 * dont `category_name` matche l'un des mots-clés.
 *
 * Exemple appliqué à un query builder Supabase :
 *   query = applyHiddenCategoryFilter(query);
 */
export function applyHiddenCategoryFilter<T extends { not: (...args: any[]) => T }>(
  query: T,
): T {
  let q = query;
  for (const kw of HIDDEN_CATEGORY_KEYWORDS) {
    // category_name NOT ILIKE %kw% (les NULL passent — ils ne matchent pas)
    q = q.not("category_name", "ilike", `%${kw}%`);
  }
  return q;
}

/**
 * Variante côté JS pour filtrer un tableau déjà chargé (utile quand la
 * requête est complexe ou paginée côté client).
 */
export function isHiddenCategoryName(categoryName: string | null | undefined): boolean {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();
  return HIDDEN_CATEGORY_KEYWORDS.some((kw) => lower.includes(kw));
}
