/**
 * Cagnotte MediKong — utilitaire TVA à 2 modes.
 *
 * Mode `payment` (défaut) : la cagnotte est un moyen de paiement.
 *   → TVA calculée sur le sous-total HT PLEIN.
 * Mode `discount` : la cagnotte est une remise commerciale.
 *   → TVA calculée sur (sous-total HT − cagnotte utilisée).
 *
 * Le mode est piloté par settings.cagnotte_vat_mode (/admin/cagnotte).
 */
export type CagnotteVatMode = "payment" | "discount";

export interface VatBreakdown {
  vat_base: number;
  vat_amount: number;
  vat_mode: CagnotteVatMode;
  total_ttc: number;
  net_to_pay: number;
}

/**
 * Arrondi monétaire de référence (2 décimales, demi-supérieur sur la valeur absolue,
 * insensible aux erreurs de représentation flottante : 1.005 → 1.01, 8.575 → 8.58).
 * Doit rester identique au miroir serveur `supabase/functions/_shared/cagnotte-vat.ts`.
 */
export function roundEur(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  const cents = Math.round(Number((Math.abs(n) * 100).toPrecision(12)));
  return (sign * cents) / 100;
}

/**
 * Formatage monétaire belge : virgule décimale, toujours 2 décimales,
 * espace insécable comme séparateur de milliers, suffixe « € ».
 * Miroir strict de la version serveur (mêmes chaînes dans le récap et dans l'email).
 */
export function formatEurBe(value: number): string {
  const rounded = roundEur(value);
  const [intPart, decPart] = Math.abs(rounded).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return `${rounded < 0 ? "-" : ""}${grouped},${decPart}\u00A0€`;
}

const r2 = roundEur;

/**
 * @param subtotalHt      sous-total HT de la commande
 * @param cagnotteUsed    montant de cagnotte appliqué
 * @param vatMode         settings.cagnotte_vat_mode
 * @param vatRate         settings.cagnotte_vat_rate (0.21)
 * @param fullVatAmount   optionnel : TVA réelle multi-taux (6 % / 21 %) déjà calculée
 *                        sur le sous-total plein. Si fourni, la TVA du mode `discount`
 *                        est réduite proportionnellement au lieu d'appliquer vatRate à plat.
 */
export function computeVatBase(
  subtotalHt: number,
  cagnotteUsed: number,
  vatMode: CagnotteVatMode = "payment",
  vatRate = 0.21,
  fullVatAmount?: number,
): VatBreakdown {
  const subtotal = r2(Math.max(subtotalHt, 0));
  const used = r2(Math.min(Math.max(cagnotteUsed, 0), subtotal));

  const vat_base = vatMode === "discount" ? r2(subtotal - used) : subtotal;

  let vat_amount: number;
  if (typeof fullVatAmount === "number" && subtotal > 0) {
    // Respecte le mix réel des taux (6 % médicaments / 21 % OTC)
    vat_amount = r2(fullVatAmount * (vat_base / subtotal));
  } else {
    vat_amount = r2(vat_base * vatRate);
  }

  const total_ttc = vatMode === "discount" ? r2(vat_base + vat_amount) : r2(subtotal + vat_amount);
  const net_to_pay = vatMode === "discount" ? total_ttc : r2(total_ttc - used);

  return { vat_base, vat_amount, vat_mode: vatMode, total_ttc, net_to_pay };
}

export function cagnotteVatModeLabel(mode: CagnotteVatMode) {
  return mode === "discount"
    ? "Remise commerciale (TVA sur le HT net)"
    : "Moyen de paiement (TVA sur le HT plein)";
}
