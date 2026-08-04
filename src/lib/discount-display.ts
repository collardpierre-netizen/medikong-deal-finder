/**
 * Remise affichée — règle unique MediKong.
 *
 * La remise NE se calcule PLUS contre le prix de référence interne
 * (`products.reference_price`, dérivé du prix max des offres) : deux outliers
 * comparés entre eux produisaient des −93% absurdes.
 *
 * Nouvelle base : le PVP (prix public conseillé) encodé sur le produit
 * (`products.pvp_ttc_cents`, sources APB / PMR / fabricant / admin).
 *
 * Le badge est masqué si :
 *   - aucun PVP fiable n'est encodé ;
 *   - le prix de vente est manquant ou nul ;
 *   - la remise calculée dépasse MAX_PLAUSIBLE_DISCOUNT_PCT (artefact probable) ;
 *   - la remise est inférieure à MIN_DISPLAY_DISCOUNT_PCT (bruit d'arrondi).
 */
export const MAX_PLAUSIBLE_DISCOUNT_PCT = 75;
export const MIN_DISPLAY_DISCOUNT_PCT = 5;

export interface DiscountDisplayInput {
  /** Prix de vente MediKong TVAC (celui comparé au PVP, qui est TTC). */
  bestPriceInclVat?: number | null;
  /** PVP TTC en centimes (products.pvp_ttc_cents). */
  pvpTtcCents?: number | null;
}

/**
 * Retourne la remise en % (entier) à afficher, ou `null` si aucun badge ne doit
 * être affiché.
 */
export function computeDisplayDiscount({
  bestPriceInclVat,
  pvpTtcCents,
}: DiscountDisplayInput): number | null {
  const price = Number(bestPriceInclVat);
  const pvp = Number(pvpTtcCents) / 100;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(pvp) || pvp <= 0) return null;
  if (price >= pvp) return null;

  const pct = Math.round((1 - price / pvp) * 100);
  if (pct < MIN_DISPLAY_DISCOUNT_PCT) return null;
  if (pct > MAX_PLAUSIBLE_DISCOUNT_PCT) return null;
  return pct;
}

/** Prix barré à afficher (PVP TTC en euros), ou `null` si pas de badge. */
export function displayReferencePrice(input: DiscountDisplayInput): number | null {
  if (computeDisplayDiscount(input) == null) return null;
  return Number(input.pvpTtcCents) / 100;
}
