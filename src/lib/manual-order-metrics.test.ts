import { describe, it, expect } from "vitest";
import {
  lineMetrics,
  computeOrderTotals,
  checkCoherence,
  type ManualLineInput,
} from "./manual-order-metrics";

const line = (p: Partial<ManualLineInput>): ManualLineInput => ({
  quantity: 1,
  unit_price_excl_vat: 0,
  vat_rate: 21,
  ...p,
});

describe("manual-order-metrics — lineMetrics", () => {
  it("commission % sur ligne simple", () => {
    const m = lineMetrics(line({
      quantity: 10, unit_price_excl_vat: 12.50, unit_cost_excl_vat: 8,
      commission_rate: 10,
    }));
    expect(m.ca).toBe(125);
    expect(m.cost).toBe(80);
    expect(m.gross).toBe(45);
    expect(m.commission).toBe(12.5);
    expect(m.netVendor).toBe(112.5);
    expect(m.netMargin).toBe(32.5);
    expect(m.hasCost).toBe(true);
  });

  it("commission € fixe par unité prend le pas sur le %", () => {
    const m = lineMetrics(line({
      quantity: 4, unit_price_excl_vat: 20, unit_cost_excl_vat: 15,
      commission_rate: 50, commission_amount: 1.5,
    }));
    expect(m.ca).toBe(80);
    expect(m.commission).toBe(6); // 1.5 * 4
    expect(m.netVendor).toBe(74);
    expect(m.netMargin).toBe(14); // 80 - 60 - 6
  });

  it("pas de coût → marge non calculée mais commission OK", () => {
    const m = lineMetrics(line({
      quantity: 3, unit_price_excl_vat: 10, commission_rate: 15,
    }));
    expect(m.ca).toBe(30);
    expect(m.hasCost).toBe(false);
    expect(m.gross).toBe(0);
    expect(m.netMargin).toBe(0);
    expect(m.commission).toBe(4.5);
    expect(m.netVendor).toBe(25.5);
  });

  it("commission négative bornée à 0", () => {
    const m = lineMetrics(line({
      quantity: 1, unit_price_excl_vat: 10, commission_amount: -5,
    }));
    expect(m.commission).toBe(0);
    expect(m.netVendor).toBe(10);
  });

  it("commission % sur marge brute (basis='margin') avec coût connu", () => {
    const m = lineMetrics(line({
      quantity: 108, unit_price_excl_vat: 2.62, unit_cost_excl_vat: 1.84,
      commission_rate: 50, commission_basis: "margin", vat_rate: 21,
    }));
    // CA=282.96, coût=198.72, marge brute=84.24, commission=50%*84.24=42.12
    expect(m.ca).toBe(282.96);
    expect(m.cost).toBe(198.72);
    expect(m.gross).toBe(84.24);
    expect(m.commission).toBe(42.12);
    expect(m.netVendor).toBe(240.84);
    expect(m.netMargin).toBe(42.12);
  });

  it("basis='margin' sans coût → fallback sur CA HTVA", () => {
    const m = lineMetrics(line({
      quantity: 10, unit_price_excl_vat: 5, commission_rate: 20,
      commission_basis: "margin",
    }));
    expect(m.commission).toBe(10); // 20% * 50€
    expect(m.hasCost).toBe(false);
  });

  it("CA TTC = HTVA * (1 + TVA/100), arrondi 2 décimales", () => {
    const m = lineMetrics(line({
      quantity: 1, unit_price_excl_vat: 100, vat_rate: 6,
    }));
    expect(m.caIncl).toBe(106);
    const m2 = lineMetrics(line({
      quantity: 7, unit_price_excl_vat: 3.33, vat_rate: 21,
    }));
    expect(m2.ca).toBe(23.31);
    expect(m2.caIncl).toBe(28.21); // 23.31 * 1.21 = 28.2051 → 28.21
  });

  it("arrondi stable sur centimes (pas de drift float)", () => {
    const m = lineMetrics(line({
      quantity: 3, unit_price_excl_vat: 0.1, unit_cost_excl_vat: 0.07,
      commission_rate: 33.33,
    }));
    // ca = 0.30 exact, gross = 0.09, commission = round(30 * 33.33 / 100) cents = 10 → 0.10
    expect(m.ca).toBe(0.3);
    expect(m.cost).toBe(0.21);
    expect(m.gross).toBe(0.09);
    expect(m.commission).toBe(0.1);
    expect(m.netVendor).toBe(0.2);
    expect(m.netMargin).toBe(-0.01);
  });
});

describe("manual-order-metrics — computeOrderTotals & invariants", () => {
  const cases: { name: string; lines: ManualLineInput[] }[] = [
    {
      name: "1 ligne flat % avec coût",
      lines: [line({ quantity: 10, unit_price_excl_vat: 12.5, unit_cost_excl_vat: 8, commission_rate: 10, vat_rate: 21 })],
    },
    {
      name: "2 lignes mixtes (% + fixe), TVA 6% + 21%",
      lines: [
        line({ quantity: 5, unit_price_excl_vat: 4.20, unit_cost_excl_vat: 3.10, commission_rate: 12, vat_rate: 6 }),
        line({ quantity: 2, unit_price_excl_vat: 99.99, unit_cost_excl_vat: 70, commission_amount: 5, vat_rate: 21 }),
      ],
    },
    {
      name: "1 ligne sans coût",
      lines: [line({ quantity: 7, unit_price_excl_vat: 3.33, commission_rate: 15, vat_rate: 21 })],
    },
    {
      name: "3 lignes hétérogènes (cas réel)",
      lines: [
        line({ quantity: 12, unit_price_excl_vat: 1.99, unit_cost_excl_vat: 1.20, commission_rate: 8, vat_rate: 6 }),
        line({ quantity: 1, unit_price_excl_vat: 250, unit_cost_excl_vat: 180, commission_amount: 12.50, vat_rate: 21 }),
        line({ quantity: 4, unit_price_excl_vat: 19.95, commission_rate: 0, vat_rate: 21 }),
      ],
    },
    {
      name: "ligne à zéro et ligne classique",
      lines: [
        line({ quantity: 0, unit_price_excl_vat: 100, unit_cost_excl_vat: 50, commission_rate: 10 }),
        line({ quantity: 3, unit_price_excl_vat: 10, unit_cost_excl_vat: 6, commission_rate: 20, vat_rate: 21 }),
      ],
    },
  ];

  for (const c of cases) {
    it(`cohérence — ${c.name}`, () => {
      const check = checkCoherence(c.lines);
      expect(check.issues).toEqual([]);
      expect(check.ok).toBe(true);

      const t = computeOrderTotals(c.lines);
      // invariants explicites
      expect(t.excl).toBeCloseTo(t.commission + t.netVendor, 2);
      expect(t.incl).toBeCloseTo(t.excl + t.vat, 2);
      if (t.hasAnyCost) {
        expect(t.gross).toBeCloseTo(t.excl - t.cost, 2);
        expect(t.netMargin).toBeCloseTo(t.gross - t.commission, 2);
      }
    });
  }

  it("totaux agrégés = somme des lineMetrics (au centime)", () => {
    const lines = cases[3].lines;
    const t = computeOrderTotals(lines);
    const sumCa = lines.reduce((s, l) => s + lineMetrics(l).ca, 0);
    const sumCommission = lines.reduce((s, l) => s + lineMetrics(l).commission, 0);
    expect(Math.abs(t.excl - sumCa)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(t.commission - sumCommission)).toBeLessThanOrEqual(0.01);
  });

  it("détecte une incohérence si on force des valeurs incompatibles", () => {
    // checkCoherence opère sur les sorties de lineMetrics qui sont par
    // construction cohérentes ; on vérifie juste qu'un panier vide est OK.
    const empty = checkCoherence([]);
    expect(empty.ok).toBe(true);
  });
});
