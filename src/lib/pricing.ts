/**
 * MediKong pricing utilities.
 * All public-facing prices must include the MediKong margin.
 * Admin pages show raw (purchase) prices — do NOT use these helpers in admin views.
 *
 * Le formatage est désormais locale-aware. En contexte React, préférer
 * `useMoneyFormat()` (src/lib/money-format.ts). Ces helpers restent dispos
 * pour les call-sites non-React et acceptent un paramètre `locale` optionnel.
 */

import { formatMoney, type MoneyLocale } from "./money-format";

const DEFAULT_MARGIN_PERCENT = 15;

/** Apply the MediKong margin to a raw purchase price */
export function applyMargin(rawPrice: number, marginPercent = DEFAULT_MARGIN_PERCENT): number {
  return rawPrice * (1 + marginPercent / 100);
}

/** @deprecated Préférer `useMoneyFormat().formatMoney(price)` en React. */
export function formatPriceEur(price: number, locale: MoneyLocale = "fr-BE"): string {
  return formatMoney(price, { locale, withSymbol: true });
}

/** @deprecated Préférer `useMoneyFormat().formatMoney(price, { withSymbol: false })`. */
export function formatPriceRaw(price: number, locale: MoneyLocale = "fr-BE"): string {
  return formatMoney(price, { locale, withSymbol: false });
}
