import { describe, it, expect } from "vitest";
import {
  recalcOfferPricing,
  type MarginRule,
  type OfferForRecalc,
} from "../../supabase/functions/_shared/recalc-offer-pricing.ts";

// Demo dataset covering the branches we care about in CI:
//  - fresh offers with valid base -> updated at ~default 25%
//  - price_stale offers -> skipped_stale (price unchanged)
//  - offers without base price -> skipped_no_base
//  - offers matching a category rule -> use that rule's margin (not default)
const DEFAULT_MARGIN = 25;

function offer(overrides: Partial<OfferForRecalc>): OfferForRecalc {
  return {
    id: overrides.id ?? "o",
    vendor_id: "v1",
    qogita_base_price: 10,
    qogita_base_delay_days: 3,
    vat_rate: 6,
    price_stale: false,
    price_tiers: null,
    products: { category_id: "cat-default", brand_id: null },
    ...overrides,
  };
}

describe("recalcOfferPricing — CI demo dataset", () => {
  const rules: MarginRule[] = [
    {
      id: "rule-premium-cat",
      category_id: "cat-premium",
      brand_id: null,
      vendor_id: null,
      min_base_price: null,
      max_base_price: null,
      margin_percentage: 40,
      extra_delay_days: 3,
      round_price_to: 0.01,
    },
  ];

  const dataset: OfferForRecalc[] = [
    offer({ id: "fresh-1", qogita_base_price: 10 }),
    offer({ id: "fresh-2", qogita_base_price: 20 }),
    offer({ id: "stale", qogita_base_price: 15, price_stale: true }),
    offer({ id: "no-base-null", qogita_base_price: null }),
    offer({ id: "no-base-zero", qogita_base_price: 0 }),
    offer({
      id: "premium",
      qogita_base_price: 10,
      products: { category_id: "cat-premium", brand_id: null },
    }),
  ];

  const results = dataset.map((o) => ({ id: o.id, ...recalcOfferPricing(o, rules, DEFAULT_MARGIN) }));

  it("skips stale offers", () => {
    const r = results.find((x) => x.id === "stale")!;
    expect(r.action).toBe("skipped_stale");
    expect(r.patch).toBeUndefined();
  });

  it("skips offers without a base price", () => {
    expect(results.find((x) => x.id === "no-base-null")!.action).toBe("skipped_no_base");
    expect(results.find((x) => x.id === "no-base-zero")!.action).toBe("skipped_no_base");
  });

  it("applies the default 25% margin to fresh offers", () => {
    const r = results.find((x) => x.id === "fresh-1")!;
    expect(r.action).toBe("updated");
    // base 10 * 1.25 = 12.50 HT ; TVA 6% -> 13.25 TTC
    expect(r.patch!.price_excl_vat).toBeCloseTo(12.5, 2);
    expect(r.patch!.price_incl_vat).toBeCloseTo(13.25, 2);
    expect(r.patch!.applied_margin_percentage).toBe(25);
    expect(r.patch!.applied_margin_rule_id).toBeNull();
    expect(r.patch!.margin_amount).toBeCloseTo(2.5, 2);
  });

  it("preserves counts: 3 updated, 1 stale, 2 no_base", () => {
    const counts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.updated).toBe(3);
    expect(counts.skipped_stale).toBe(1);
    expect(counts.skipped_no_base).toBe(2);
  });

  it("all updated offers land in the [24%, 26%] band unless a rule overrides", () => {
    for (const r of results) {
      if (r.action !== "updated") continue;
      if (r.patch!.applied_margin_rule_id) continue; // rule-driven, out of band
      expect(r.patch!.applied_margin_percentage).toBeGreaterThanOrEqual(24);
      expect(r.patch!.applied_margin_percentage).toBeLessThanOrEqual(26);
    }
  });

  it("respects a matching category rule (40% instead of default)", () => {
    const r = results.find((x) => x.id === "premium")!;
    expect(r.action).toBe("updated");
    expect(r.patch!.applied_margin_rule_id).toBe("rule-premium-cat");
    expect(r.patch!.applied_margin_percentage).toBe(40);
    // base 10 * 1.40 = 14.00 HT
    expect(r.patch!.price_excl_vat).toBeCloseTo(14, 2);
  });

  it("recomputes tier prices with the applied margin", () => {
    const withTiers = offer({
      id: "tiers",
      qogita_base_price: 10,
      price_tiers: [
        { qogita_base_price: 10, price_excl_vat: 12 },
        { qogita_base_price: 8, price_excl_vat: 9.6 },
      ],
    });
    const r = recalcOfferPricing(withTiers, rules, DEFAULT_MARGIN);
    expect(r.action).toBe("updated");
    expect(r.patch!.price_tiers![0].price_excl_vat).toBeCloseTo(12.5, 2);
    expect(r.patch!.price_tiers![1].price_excl_vat).toBeCloseTo(10, 2);
  });
});
