import { describe, it, expect } from "vitest";
import { computeCommissionFromLines } from "./order-commission-fallback";
import type { VendorCommissionConfig } from "./vendorMargin";

const vendors = new Map<string, VendorCommissionConfig>([
  ["v-flat", { commission_model: "flat_percentage", commission_rate: 10 }],
  ["v-split", { commission_model: "margin_split", margin_split_pct: 50 }],
  ["v-fixed", { commission_model: "fixed_amount", fixed_commission_amount: 2 }],
  ["v-zero", { commission_model: "flat_percentage", commission_rate: 0 }],
]);

describe("computeCommissionFromLines (fallback /admin/commandes)", () => {
  it("retourne 0 quand la liste est vide / nulle / non-array", () => {
    expect(computeCommissionFromLines([], vendors)).toBe(0);
    expect(computeCommissionFromLines(null, vendors)).toBe(0);
    expect(computeCommissionFromLines(undefined, vendors)).toBe(0);
    // @ts-expect-error test runtime guard
    expect(computeCommissionFromLines("nope", vendors)).toBe(0);
  });

  it("flat_percentage : 10% × (12 × 10) = 12", () => {
    const total = computeCommissionFromLines(
      [{ vendor_id: "v-flat", quantity: 10, unit_price_excl_vat: 12, cost_price: 8 }],
      vendors,
    );
    expect(total).toBeCloseTo(12, 5);
  });

  it("margin_split 50/50 : marge brute (20-15)×4 = 20 → MediKong garde 50% = 10", () => {
    const total = computeCommissionFromLines(
      [{ vendor_id: "v-split", quantity: 4, unit_price_excl_vat: 20, cost_price: 15 }],
      vendors,
    );
    expect(total).toBeCloseTo(10, 5);
  });

  it("margin_split avec marge négative → commission 0", () => {
    const total = computeCommissionFromLines(
      [{ vendor_id: "v-split", quantity: 3, unit_price_excl_vat: 10, cost_price: 20 }],
      vendors,
    );
    expect(total).toBe(0);
  });

  it("fixed_amount : 2 € fixes (par unité dans computeMargin = montant tel quel)", () => {
    const total = computeCommissionFromLines(
      [{ vendor_id: "v-fixed", quantity: 5, unit_price_excl_vat: 9, cost_price: 6 }],
      vendors,
    );
    expect(total).toBeCloseTo(2, 5);
  });

  it("ignore les lignes sans vendor_id ou vendeur inconnu", () => {
    const total = computeCommissionFromLines(
      [
        { vendor_id: null, quantity: 10, unit_price_excl_vat: 12 },
        { vendor_id: "v-unknown", quantity: 10, unit_price_excl_vat: 12 },
        { vendor_id: "v-flat", quantity: 1, unit_price_excl_vat: 100 },
      ],
      vendors,
    );
    expect(total).toBeCloseTo(10, 5); // seule la 3e ligne compte : 10% de 100
  });

  it("ignore les lignes avec quantité ≤ 0 ou prix de vente ≤ 0", () => {
    const total = computeCommissionFromLines(
      [
        { vendor_id: "v-flat", quantity: 0, unit_price_excl_vat: 100 },
        { vendor_id: "v-flat", quantity: 5, unit_price_excl_vat: 0 },
        { vendor_id: "v-flat", quantity: -3, unit_price_excl_vat: 50 },
        { vendor_id: "v-flat", quantity: 2, unit_price_excl_vat: 50 },
      ],
      vendors,
    );
    expect(total).toBeCloseTo(10, 5); // 10% × (2 × 50)
  });

  it("cost_price absent / 0 → flat_percentage reste calculable", () => {
    const total = computeCommissionFromLines(
      [{ vendor_id: "v-flat", quantity: 10, unit_price_excl_vat: 12 }],
      vendors,
    );
    expect(total).toBeCloseTo(12, 5);
  });

  it("override vendeur à 0% → commission 0 (respect du Noralphar/0 €)", () => {
    const total = computeCommissionFromLines(
      [{ vendor_id: "v-zero", quantity: 10, unit_price_excl_vat: 100, cost_price: 60 }],
      vendors,
    );
    expect(total).toBe(0);
  });

  it("accepte les valeurs numériques sous forme string (payload DB)", () => {
    const total = computeCommissionFromLines(
      [{ vendor_id: "v-flat", quantity: "3" as any, unit_price_excl_vat: "20" as any, cost_price: "10" as any }],
      vendors,
    );
    expect(total).toBeCloseTo(6, 5); // 10% × 60
  });

  it("agrège plusieurs vendeurs sur la même commande", () => {
    const total = computeCommissionFromLines(
      [
        { vendor_id: "v-flat", quantity: 10, unit_price_excl_vat: 12 }, // 12
        { vendor_id: "v-split", quantity: 4, unit_price_excl_vat: 20, cost_price: 15 }, // 10
        { vendor_id: "v-fixed", quantity: 5, unit_price_excl_vat: 9 }, // 2
      ],
      vendors,
    );
    expect(total).toBeCloseTo(24, 5);
  });
});
