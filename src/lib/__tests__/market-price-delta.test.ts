import { describe, it, expect } from "vitest";
import {
  computeMarketDelta,
  pickReferencePrice,
} from "@/lib/market-price-delta";

/**
 * Tests unitaires & non-régression — onglet "Prix du marché" (ProductPage).
 *
 * Vérifie le SIGNE ("−"/"+") et le POURCENTAGE affichés selon les scénarios :
 *  - MK moins cher / MK plus cher / MK égal
 *  - Cascade de référence (pharmacien > grossiste > public HTVA)
 *  - Promos (grosse remise concurrente → MK fortement plus cher)
 *  - Valeurs nulles / 0 / undefined / négatives → pas de calcul
 *  - Arrondi entier du % et valeur absolue affichée
 */

describe("pickReferencePrice — cascade pharmacien > grossiste > public", () => {
  it("retient le prix pharmacien quand disponible", () => {
    expect(pickReferencePrice({ pharmHT: 10, grossisteHT: 8, publicHTVA: 12 })).toBe(10);
  });

  it("retombe sur le grossiste si pharmacien indisponible (0/null)", () => {
    expect(pickReferencePrice({ pharmHT: 0, grossisteHT: 8, publicHTVA: 12 })).toBe(8);
    expect(pickReferencePrice({ pharmHT: null, grossisteHT: 8, publicHTVA: 12 })).toBe(8);
  });

  it("retombe sur le public HTVA si pharmacien et grossiste indisponibles", () => {
    expect(pickReferencePrice({ pharmHT: 0, grossisteHT: 0, publicHTVA: 12 })).toBe(12);
    expect(pickReferencePrice({ pharmHT: undefined, grossisteHT: undefined, publicHTVA: 12 })).toBe(12);
  });

  it("renvoie 0 si toutes les références sont indisponibles", () => {
    expect(pickReferencePrice({ pharmHT: 0, grossisteHT: 0, publicHTVA: 0 })).toBe(0);
    expect(pickReferencePrice({})).toBe(0);
  });
});

describe("computeMarketDelta — MK moins cher (signe −, vert)", () => {
  it("calcule un écart négatif quand MK < concurrent (pharmacien)", () => {
    const r = computeMarketDelta({ mkHT: 8, pharmHT: 10 });
    expect(r.mkCheaper).toBe(true);
    expect(r.sign).toBe("−");
    expect(r.deltaAbs).toBeCloseTo(-2, 5);
    // -2 / 8 * 100 = -25 → arrondi -25
    expect(r.deltaPct).toBe(-25);
    expect(r.refPrice).toBe(10);
  });

  it("utilise grossiste si pharmacien absent", () => {
    const r = computeMarketDelta({ mkHT: 9, pharmHT: 0, grossisteHT: 10 });
    expect(r.mkCheaper).toBe(true);
    expect(r.sign).toBe("−");
    expect(r.refPrice).toBe(10);
  });

  it("petite différence centime → reste MK moins cher", () => {
    const r = computeMarketDelta({ mkHT: 9.99, pharmHT: 10 });
    expect(r.mkCheaper).toBe(true);
    expect(r.sign).toBe("−");
    // -0.01 / 9.99 ≈ -0.1% → arrondi 0 (cas limite : reste mkCheaper)
    expect(r.deltaPct).toBe(0);
  });
});

describe("computeMarketDelta — MK plus cher (signe +, rouge)", () => {
  it("calcule un écart positif quand MK > concurrent", () => {
    const r = computeMarketDelta({ mkHT: 12, pharmHT: 10 });
    expect(r.mkCheaper).toBe(false);
    expect(r.sign).toBe("+");
    expect(r.deltaAbs).toBeCloseTo(2, 5);
    // 2 / 12 * 100 = 16.66 → 17
    expect(r.deltaPct).toBe(17);
  });

  it("scénario promo concurrent agressive → MK très défavorable", () => {
    // Promo concurrent à -50% vs MK
    const r = computeMarketDelta({ mkHT: 20, pharmHT: 10 });
    expect(r.mkCheaper).toBe(false);
    expect(r.sign).toBe("+");
    expect(r.deltaAbs).toBeCloseTo(10, 5);
    // 10 / 20 * 100 = 50
    expect(r.deltaPct).toBe(50);
  });
});

describe("computeMarketDelta — égalité parfaite", () => {
  it("MK == ref → delta 0, signe '+', non mkCheaper", () => {
    const r = computeMarketDelta({ mkHT: 10, pharmHT: 10 });
    expect(r.deltaAbs).toBe(0);
    expect(r.deltaPct).toBe(0);
    expect(r.mkCheaper).toBe(false);
    expect(r.sign).toBe("+");
  });
});

describe("computeMarketDelta — valeurs nulles / non calculables", () => {
  it("renvoie null/null si mkHT = 0", () => {
    const r = computeMarketDelta({ mkHT: 0, pharmHT: 10 });
    expect(r.deltaAbs).toBeNull();
    expect(r.deltaPct).toBeNull();
    expect(r.sign).toBe("");
    expect(r.mkCheaper).toBe(false);
  });

  it("renvoie null/null si aucune référence concurrente", () => {
    const r = computeMarketDelta({ mkHT: 10 });
    expect(r.deltaAbs).toBeNull();
    expect(r.deltaPct).toBeNull();
    expect(r.sign).toBe("");
  });

  it("renvoie null/null si toutes les références sont 0", () => {
    const r = computeMarketDelta({ mkHT: 10, pharmHT: 0, grossisteHT: 0, publicHTVA: 0 });
    expect(r.deltaAbs).toBeNull();
    expect(r.deltaPct).toBeNull();
  });

  it("tolère des valeurs null/undefined sur les références", () => {
    const r = computeMarketDelta({ mkHT: 10, pharmHT: null, grossisteHT: undefined, publicHTVA: 12 });
    expect(r.refPrice).toBe(12);
    expect(r.sign).toBe("−");
    // (10 - 12) / 10 * 100 = -20
    expect(r.deltaPct).toBe(-20);
  });
});

describe("computeMarketDelta — arrondi entier du %", () => {
  it("arrondit au plus proche (Math.round)", () => {
    // (11 - 10)/11 * 100 = 9.09 → 9
    expect(computeMarketDelta({ mkHT: 11, pharmHT: 10 }).deltaPct).toBe(9);
    // (13 - 10)/13 * 100 = 23.07 → 23
    expect(computeMarketDelta({ mkHT: 13, pharmHT: 10 }).deltaPct).toBe(23);
    // (10 - 13)/10 * 100 = -30 → -30
    expect(computeMarketDelta({ mkHT: 10, pharmHT: 13 }).deltaPct).toBe(-30);
  });

  it("Math.abs(deltaPct) côté UI donne toujours un entier positif", () => {
    const r = computeMarketDelta({ mkHT: 8, pharmHT: 10 });
    expect(Math.abs(r.deltaPct!)).toBe(25);
  });
});

describe("computeMarketDelta — non-régression scénarios réels", () => {
  it("pack Fresubin grossiste — MK légèrement moins cher", () => {
    // Ex : MK 4.50 €/u, Febelco 4.75 €/u (grossiste)
    const r = computeMarketDelta({ mkHT: 4.5, grossisteHT: 4.75 });
    expect(r.sign).toBe("−");
    expect(r.mkCheaper).toBe(true);
    // (4.5 - 4.75) / 4.5 * 100 = -5.55 → -6
    expect(r.deltaPct).toBe(-6);
  });

  it("source online — public TTC dérivé en HTVA, MK plus cher", () => {
    // pharmHT = 0 (source online), publicHTVA dérivé du TTC
    const r = computeMarketDelta({ mkHT: 15, pharmHT: 0, grossisteHT: 0, publicHTVA: 12 });
    expect(r.refPrice).toBe(12);
    expect(r.sign).toBe("+");
    expect(r.deltaPct).toBe(20); // 3/15 = 20%
  });

  it("priorité pharmacien stricte même si grossiste plus bas", () => {
    const r = computeMarketDelta({ mkHT: 10, pharmHT: 11, grossisteHT: 8 });
    // ref = 11 (pharm), pas 8 (grossiste)
    expect(r.refPrice).toBe(11);
    expect(r.sign).toBe("−");
  });
});
