/**
 * MediKong pricing utilities.
 * All public-facing prices must include the MediKong margin.
 * Admin pages show raw (purchase) prices — do NOT use these helpers in admin views.
 */

const DEFAULT_MARGIN_PERCENT = 15;

/** Apply the MediKong margin to a raw purchase price */
export function applyMargin(rawPrice: number, marginPercent = DEFAULT_MARGIN_PERCENT): number {
  return rawPrice * (1 + marginPercent / 100);
}

/** Format a price in European style (comma decimal, EUR suffix) */
export function formatPriceEur(price: number): string {
  return new Intl.NumberFormat("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price) + " €";
}

/** Format price without the € suffix (for inline use) */
export function formatPriceRaw(price: number): string {
  return new Intl.NumberFormat("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}
