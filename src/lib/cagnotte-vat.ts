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

const r2 = (n: number) => Math.round(n * 100) / 100;

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
