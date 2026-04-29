/**
 * Cascade pure de résolution du prix HTVA effectif d'une offre pour un acheteur.
 *
 * Priorité (du plus spécifique au plus général) :
 *   1. Override par profil acheteur (RPC `resolve_offer_price_for_profile`,
 *      sources `offer_absolute|offer_discount|vendor_default_absolute|vendor_default_discount`)
 *   2. Fallback legacy `product_prices × price_levels` (au niveau produit, pas par offre)
 *   3. Prix de base de l'offre (`offers.price_excl_vat`)
 *
 * Le TVAC est recalculé via le ratio TTC/HTVA déduit de l'offre quand un override s'applique.
 *
 * Cette fonction est pure → 100% testable sans mock Supabase.
 */
export type PriceCascadeSource =
  | "offer_absolute"
  | "offer_discount"
  | "vendor_default_absolute"
  | "vendor_default_discount"
  | "offer_base"
  | "legacy_level";

export interface PriceCascadeInput {
  basePriceExclVat: number | null | undefined;
  basePriceInclVat: number | null | undefined;
  /** Résolution RPC par profil acheteur (null si pas de buyer_profile_id ou si la RPC retombe sur offer_base). */
  profileOverride?: { price_excl_vat: number; source: PriceCascadeSource } | null;
  /** Prix legacy product_prices × price_levels matchant le levelCode du user (null si absent). */
  legacyLevelPrice?: number | null;
}

export interface PriceCascadeResult {
  unitPriceEur: number;
  unitPriceInclVat: number;
  source: PriceCascadeSource;
  /** true si un override (RPC ou legacy) a remplacé le prix de base. */
  hasOverride: boolean;
}

export function resolvePriceCascade(input: PriceCascadeInput): PriceCascadeResult {
  const baseExcl = Number(input.basePriceExclVat);
  const baseIncl = Number(input.basePriceInclVat);
  const safeBaseExcl = Number.isFinite(baseExcl) && baseExcl > 0 ? baseExcl : 0;
  const safeBaseIncl = Number.isFinite(baseIncl) && baseIncl > 0 ? baseIncl : 0;
  // Ratio TTC/HTVA : utilisé pour recalculer le TTC quand on remplace le HTVA.
  const vatRatio = safeBaseExcl > 0 && safeBaseIncl > 0 ? safeBaseIncl / safeBaseExcl : 1;

  // 1. Override RPC par profil
  if (
    input.profileOverride &&
    Number.isFinite(input.profileOverride.price_excl_vat) &&
    input.profileOverride.price_excl_vat > 0 &&
    input.profileOverride.source !== "offer_base"
  ) {
    const eff = input.profileOverride.price_excl_vat;
    return {
      unitPriceEur: eff,
      unitPriceInclVat: Math.round(eff * vatRatio * 100) / 100,
      source: input.profileOverride.source,
      hasOverride: true,
    };
  }

  // 2. Fallback legacy product_prices × price_levels
  if (
    input.legacyLevelPrice !== null &&
    input.legacyLevelPrice !== undefined &&
    Number.isFinite(input.legacyLevelPrice) &&
    input.legacyLevelPrice > 0
  ) {
    const eff = input.legacyLevelPrice;
    return {
      unitPriceEur: eff,
      unitPriceInclVat: Math.round(eff * vatRatio * 100) / 100,
      source: "legacy_level",
      hasOverride: true,
    };
  }

  // 3. Prix de base
  return {
    unitPriceEur: safeBaseExcl,
    unitPriceInclVat: safeBaseIncl,
    source: "offer_base",
    hasOverride: false,
  };
}
