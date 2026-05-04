import { describe, it, expect } from "vitest";
import { computeCartTotals, lineExcl, lineIncl, type CartLine } from "./cart-totals";

const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("cart-totals — invariant Sous-total HTVA + TVA = Total TTC", () => {
  it("panier vide", () => {
    const t = computeCartTotals([]);
    expect(t).toEqual({ subtotalExcl: 0, subtotalIncl: 0, vat: 0 });
    expect(approx(t.subtotalExcl + t.vat, t.subtotalIncl)).toBe(true);
  });

  it("ligne avec price_incl_vat fourni (override)", () => {
    const items: CartLine[] = [
      { quantity: 2, price_excl_vat: 10, price_incl_vat: 12.6, product_id: "p1" },
    ];
    const t = computeCartTotals(items, { p1: 21 });
    expect(t.subtotalExcl).toBeCloseTo(20);
    expect(t.subtotalIncl).toBeCloseTo(25.2);
    expect(t.vat).toBeCloseTo(5.2);
    expect(approx(t.subtotalExcl + t.vat, t.subtotalIncl)).toBe(true);
  });

  it("fallback 21% si pas de TTC stocké ni vatRates", () => {
    const items: CartLine[] = [{ quantity: 1, price_excl_vat: 100, product_id: "p1" }];
    const t = computeCartTotals(items);
    expect(t.subtotalExcl).toBeCloseTo(100);
    expect(t.subtotalIncl).toBeCloseTo(121);
    expect(t.vat).toBeCloseTo(21);
    expect(approx(t.subtotalExcl + t.vat, t.subtotalIncl)).toBe(true);
  });

  it("résolution dynamique 6% médicament / 21% OTC", () => {
    const items: CartLine[] = [
      { quantity: 1, price_excl_vat: 100, product_id: "med" },
      { quantity: 1, price_excl_vat: 100, product_id: "otc" },
    ];
    const t = computeCartTotals(items, { med: 6, otc: 21 });
    expect(t.subtotalExcl).toBeCloseTo(200);
    expect(t.subtotalIncl).toBeCloseTo(106 + 121);
    expect(t.vat).toBeCloseTo(27);
    expect(approx(t.subtotalExcl + t.vat, t.subtotalIncl)).toBe(true);
  });

  it("multi-lignes avec quantités, fallback product.price", () => {
    const items: CartLine[] = [
      { quantity: 3, product: { price: 5 }, product_id: "a" },
      { quantity: 2, price_excl_vat: 8.5, product_id: "b", price_incl_vat: 9.01 },
      { quantity: 4, price_excl_vat: 12, product_id: "c" },
    ];
    const t = computeCartTotals(items, { a: 6, c: 21 });
    const expectedExcl = 3 * 5 + 2 * 8.5 + 4 * 12;
    const expectedIncl = 3 * 5 * 1.06 + 2 * 9.01 + 4 * 12 * 1.21;
    expect(t.subtotalExcl).toBeCloseTo(expectedExcl);
    expect(t.subtotalIncl).toBeCloseTo(expectedIncl);
    expect(t.vat).toBeCloseTo(expectedIncl - expectedExcl);
    expect(approx(t.subtotalExcl + t.vat, t.subtotalIncl, 1e-9)).toBe(true);
  });

  it("TVA jamais négative (cas de données incohérentes)", () => {
    const items: CartLine[] = [
      { quantity: 1, price_excl_vat: 100, price_incl_vat: 90, product_id: "x" },
    ];
    const t = computeCartTotals(items);
    expect(t.vat).toBe(0);
  });

  it("helpers lineExcl / lineIncl cohérents", () => {
    const item: CartLine = { quantity: 1, price_excl_vat: 50, product_id: "p" };
    expect(lineExcl(item)).toBe(50);
    expect(lineIncl(item, { p: 6 })).toBeCloseTo(53);
    expect(lineIncl(item, {}, 21)).toBeCloseTo(60.5);
  });
});
