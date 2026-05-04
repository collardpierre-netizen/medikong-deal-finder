/**
 * Calculs purs des totaux panier / checkout.
 * Garantit l'invariant : Sous-total HTVA + TVA = Total TTC.
 */

export interface CartLine {
  quantity: number;
  price_excl_vat?: number | null;
  price_incl_vat?: number | null;
  product_id?: string | null;
  product?: { price?: number | null } | null;
}

export const DEFAULT_VAT_RATE = 21;

export function lineExcl(item: CartLine): number {
  return Number(item.price_excl_vat ?? item.product?.price ?? 0) || 0;
}

export function lineIncl(
  item: CartLine,
  vatRates: Record<string, number> = {},
  fallbackRate: number = DEFAULT_VAT_RATE,
): number {
  if (item.price_incl_vat && item.price_incl_vat > 0) return Number(item.price_incl_vat);
  const rate = (item.product_id && vatRates[item.product_id]) ?? fallbackRate;
  return lineExcl(item) * (1 + rate / 100);
}

export interface CartTotals {
  subtotalExcl: number;
  subtotalIncl: number;
  vat: number;
}

export function computeCartTotals(
  items: CartLine[],
  vatRates: Record<string, number> = {},
  fallbackRate: number = DEFAULT_VAT_RATE,
): CartTotals {
  const subtotalExcl = items.reduce((s, i) => s + lineExcl(i) * i.quantity, 0);
  const subtotalIncl = items.reduce(
    (s, i) => s + lineIncl(i, vatRates, fallbackRate) * i.quantity,
    0,
  );
  const vat = Math.max(subtotalIncl - subtotalExcl, 0);
  return { subtotalExcl, subtotalIncl, vat };
}
