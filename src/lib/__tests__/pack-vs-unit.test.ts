import { describe, it, expect } from "vitest";
import { resolvePackSize, extractPackSizeFromName } from "@/lib/pack-size";
import { computeMarketDelta } from "@/lib/market-price-delta";
import { priceFromUnit } from "@/lib/price-format";

/**
 * Tests de conversion pack -> unitaire et de leur impact sur computeMarketDelta.
 *
 * Convention actuelle : les offres marketplace (`offers.price_excl_vat`) sont
 * encodées à l'unité. Le pack sert uniquement à convertir l'affichage en €/pack.
 */

const toUnit = (packPrice: number, packSize: number) =>
  Number((packPrice / packSize).toFixed(4));

describe("pack -> unitaire — cas représentatifs", () => {
  it("offre marketplace 2,10 €/u. avec pack=24 affiche 2,10 €/u. et 50,40 €/pack", () => {
    expect(priceFromUnit(2.1, "unit", 24)).toBeCloseTo(2.1, 2);
    expect(priceFromUnit(2.1, "pack", 24)).toBeCloseTo(50.4, 2);
  });

  it("7,54 € sur pack=4 donne 1,885 €/u.", () => {
    expect(toUnit(7.54, 4)).toBeCloseTo(1.885, 3);
  });

  it("12,00 € sur pack=24 (carton de cups) donne 0,50 €/u.", () => {
    expect(toUnit(12, 24)).toBeCloseTo(0.5, 3);
  });

  it("pack=1 (unité simple) renvoie le prix tel quel", () => {
    expect(toUnit(9.99, 1)).toBe(9.99);
  });

  it("pack=30 (boîte de 30 capsules) donne le prix unitaire", () => {
    expect(toUnit(15, 30)).toBeCloseTo(0.5, 3);
  });
});

describe("resolvePackSize — priorité override > produit > titre > URL > nom", () => {
  it("override offre vendeur l'emporte sur tout", () => {
    const r = resolvePackSize({
      offerOverride: 4,
      productPackSize: 1,
      productName: "Produit unitaire",
      offerTitle: "Pack de 24",
    });
    expect(r.packSize).toBe(4);
    expect(r.source).toBe("offer_override");
  });

  it("retombe sur products.pack_size si pas d'override", () => {
    const r = resolvePackSize({
      productPackSize: 4,
      productName: "Fresubin Cappuccino",
    });
    expect(r.packSize).toBe(4);
    expect(r.source).toBe("product");
  });

  it("heuristique titre vendeur prioritaire sur nom MediKong", () => {
    const r = resolvePackSize({
      productName: "Fresubin 2 KCAL Cappuccino",
      offerTitle: "Fresubin Cappuccino 24 x 200ml carton",
    });
    expect(r.packSize).toBe(24);
    expect(r.source).toBe("offer_title_heuristic");
  });

  it("heuristique URL si ni titre ni nom n'aident", () => {
    const r = resolvePackSize({
      productName: "Fresubin",
      offerUrl: "https://shop.example.com/fresubin-vanille-15-x-500-ml",
    });
    expect(r.packSize).toBe(15);
    expect(r.source).toBe("offer_url_heuristic");
  });

  it("fallback à 1 quand rien n'est exploitable", () => {
    const r = resolvePackSize({ productName: "Produit X 500 mg" });
    expect(r.packSize).toBe(1);
    expect(r.source).toBe("fallback");
  });
});

describe("extractPackSizeFromName — patterns marché", () => {
  it.each([
    ["Fresubin Cappuccino 4 x 125 ml", 4],
    ["Diben Vanille 15x500ml", 15],
    ["Doliprane 30 caps", 30],
    ["Aspirine 60 cps", 60],
    ["Pansement boîte de 50", 50],
    ["Fresubin 2 Kcal Fibre Pêche /4", 4], // CERP suffixe
    ["FRESUBIN 2 KCAL FIBRE PECHE 4", 4], // CERP compact
    ["Sticks énergie 20 sticks", 20],
  ])("'%s' -> pack=%i", (name, expected) => {
    expect(extractPackSizeFromName(name)).toBe(expected);
  });

  it.each([
    ["Doliprane 500 mg", null], // dosage seul, pas de pack
    ["Crème hydratante 200 ml", null], // contenance seule
    ["Produit", null],
  ])("'%s' -> pas de pack", (name, expected) => {
    expect(extractPackSizeFromName(name)).toBe(expected);
  });
});

describe("computeMarketDelta — pack résolu en amont (cas pivot Valerco)", () => {
  it("MK 7,54 €/pack=4 vs ref 1,98 €/u. -> -5 % (MK moins cher)", () => {
    const mkUnit = toUnit(7.54, 4); // 1.885
    const r = computeMarketDelta({ mkHT: mkUnit, pharmHT: 1.98 });
    expect(r.refPrice).toBe(1.98);
    expect(r.sign).toBe("−");
    expect(r.mkCheaper).toBe(true);
    // (1.885 - 1.98) / 1.885 * 100 ≈ -5.04 -> -5
    expect(r.deltaPct).toBe(-5);
  });

  it("anti-régression : SI pack non résolu (pack=1), l'écart est faussement +281 %", () => {
    // Reproduction du bug : MK servi en prix pack et comparé à un unitaire externe
    const r = computeMarketDelta({ mkHT: 7.54, pharmHT: 1.98 });
    expect(r.sign).toBe("+");
    // (7.54 - 1.98) / 7.54 * 100 ≈ 73.74 -> 74
    expect(r.deltaPct).toBe(74);
  });

  it("carton 24 cups MK (12 €) vs ref unitaire 0,55 € -> ~-10 %", () => {
    const mkUnit = toUnit(12, 24); // 0.5
    const r = computeMarketDelta({ mkHT: mkUnit, grossisteHT: 0.55 });
    expect(r.mkCheaper).toBe(true);
    // (0.5 - 0.55) / 0.5 * 100 = -10
    expect(r.deltaPct).toBe(-10);
  });

  it("MK boîte 30 caps (15 €) vs ref 0,40 €/u. -> MK +20 %", () => {
    const mkUnit = toUnit(15, 30); // 0.5
    const r = computeMarketDelta({ mkHT: mkUnit, pharmHT: 0.4 });
    expect(r.sign).toBe("+");
    // (0.5 - 0.4) / 0.5 * 100 = 20
    expect(r.deltaPct).toBe(20);
  });

  it("pack=1 (unité simple) — comparaison directe sans transformation", () => {
    const mkUnit = toUnit(9.99, 1); // 9.99
    const r = computeMarketDelta({ mkHT: mkUnit, pharmHT: 10 });
    expect(r.mkCheaper).toBe(true);
    expect(r.refPrice).toBe(10);
  });
});

describe("Pipeline complet : resolvePackSize -> toUnit -> computeMarketDelta", () => {
  it("offre Valerco corrigée via products.pack_size = 4", () => {
    const resolved = resolvePackSize({
      productPackSize: 4,
      productName: "Fresubin Cappuccino",
    });
    expect(resolved.packSize).toBe(4);
    expect(resolved.source).toBe("product");

    const mkUnit = toUnit(7.54, resolved.packSize);
    expect(mkUnit).toBeCloseTo(1.885, 3);

    const r = computeMarketDelta({ mkHT: mkUnit, pharmHT: 1.98 });
    expect(r.mkCheaper).toBe(true);
    expect(r.deltaPct).toBe(-5);
  });

  it("offre Valerco corrigée via offer.pack_size_override = 4 (override prioritaire)", () => {
    const resolved = resolvePackSize({
      offerOverride: 4,
      productPackSize: 1, // mauvaise valeur produit, override l'écrase
      productName: "Fresubin Cappuccino",
    });
    expect(resolved.source).toBe("offer_override");
    expect(resolved.packSize).toBe(4);

    const mkUnit = toUnit(7.54, resolved.packSize);
    const r = computeMarketDelta({ mkHT: mkUnit, pharmHT: 1.98 });
    expect(r.deltaPct).toBe(-5);
  });
});
