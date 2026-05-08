/**
 * Formate un nombre pour l'affichage public.
 * - Séparateur de milliers : espace ("1 234").
 * - Arrondi optionnel à la centaine ("412" -> "400") via roundDown.
 * - Suffixe "+" optionnel, désactivé par défaut.
 */
export function formatCount(
  value: number | null | undefined,
  opts: { roundDown?: boolean; suffix?: string } = {}
): string {
  const { roundDown = false, suffix = "" } = opts;
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const v = roundDown && safe >= 100 ? Math.floor(safe / 100) * 100 : safe;
  // fr-BE utilise un espace insécable comme séparateur — on le normalise en
  // espace standard pour rester cohérent avec le reste du site.
  return `${v.toLocaleString("fr-BE").replace(/\u00A0/g, " ")}${suffix}`;
}
