/**
 * Helpers d'affichage harmonisés pour les prix sur la page produit
 * (et partout où l'on affiche un prix avec une base de comparaison).
 *
 * Règles uniques :
 *  - Locale : fr-BE (séparateur de milliers = espace insécable, décimale = virgule)
 *  - Toujours 2 décimales pour les montants
 *  - Symbole € séparé du nombre par une espace insécable
 *  - Suffixes de base : « €/pack », « €/u. », « €/100 u. » (jamais « /unit » ou « /u » seul)
 */

export type CompareBasis = "pack" | "unit" | "hundred";

/** Formate un montant en euros, style fr-BE, 2 décimales (sans le symbole). */
export function formatAmount(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formate un montant avec le symbole « € » suffixé (espace insécable). */
export function formatEur(n: number | null | undefined): string {
  const formatted = formatAmount(n);
  if (formatted === "—") return "—";
  return `${formatted}\u00A0€`;
}

/**
 * Étiquette de la base de comparaison utilisée sur la page produit.
 * - basis "pack"   → "€/pack"            (ou "€/pack de N" si packSize > 1 et `withPackSize`)
 * - basis "unit"   → "€/u."
 * - basis "hundred"→ "€/100 u."
 */
export function formatBasisLabel(
  basis: CompareBasis,
  opts?: { packSize?: number; withPackSize?: boolean }
): string {
  switch (basis) {
    case "pack":
      if (opts?.withPackSize && opts.packSize && opts.packSize > 1) {
        return `€/pack de ${opts.packSize}`;
      }
      return "€/pack";
    case "hundred":
      return "€/100 u.";
    case "unit":
    default:
      return "€/u.";
  }
}

/** Formate un prix avec sa base de comparaison ("12,34 € /pack de 4"). */
export function formatEurWithBasis(
  n: number | null | undefined,
  basis: CompareBasis,
  opts?: { packSize?: number; withPackSize?: boolean }
): string {
  return `${formatEur(n)} ${formatBasisLabel(basis, opts)}`;
}

/**
 * Convertit un prix source exprimé à l'unité vers la base d'affichage choisie.
 * Sur les offres marketplace, `offers.price_excl_vat` / `unitPriceEur` est un prix unitaire.
 */
export function priceFromUnit(
  unitPrice: number | null | undefined,
  basis: CompareBasis,
  packSize: number | null | undefined = 1
): number {
  const unit = Number(unitPrice);
  if (!Number.isFinite(unit)) return 0;
  const pack = Math.max(1, Number(packSize) || 1);
  if (basis === "pack") return unit * pack;
  if (basis === "hundred") return unit * 100;
  return unit;
}
