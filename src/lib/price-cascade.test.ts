import { describe, it, expect } from "vitest";
import { resolvePriceCascade } from "./price-cascade";

describe("resolvePriceCascade", () => {
  const base = { basePriceExclVat: 10, basePriceInclVat: 12.1 }; // ratio TVA 21%

  it("retourne le prix de base quand aucun override n'est disponible", () => {
    const r = resolvePriceCascade({ ...base, profileOverride: null, legacyLevelPrice: null });
    expect(r.unitPriceEur).toBe(10);
    expect(r.unitPriceInclVat).toBe(12.1);
    expect(r.source).toBe("offer_base");
    expect(r.hasOverride).toBe(false);
  });

  it("priorité 1 : applique l'override RPC par profil (offer_absolute) et recalcule TVAC", () => {
    const r = resolvePriceCascade({
      ...base,
      profileOverride: { price_excl_vat: 8, source: "offer_absolute" },
      legacyLevelPrice: 9, // ignoré car RPC > legacy
    });
    expect(r.unitPriceEur).toBe(8);
    // 8 * (12.1/10) = 9.68
    expect(r.unitPriceInclVat).toBe(9.68);
    expect(r.source).toBe("offer_absolute");
    expect(r.hasOverride).toBe(true);
  });

  it("priorité 1 : accepte aussi les sources discount et vendor_default_*", () => {
    for (const src of [
      "offer_discount",
      "vendor_default_absolute",
      "vendor_default_discount",
    ] as const) {
      const r = resolvePriceCascade({
        ...base,
        profileOverride: { price_excl_vat: 7.5, source: src },
        legacyLevelPrice: null,
      });
      expect(r.source).toBe(src);
      expect(r.unitPriceEur).toBe(7.5);
      expect(r.hasOverride).toBe(true);
    }
  });

  it("priorité 2 : fallback legacy product_prices quand RPC retombe sur offer_base", () => {
    const r = resolvePriceCascade({
      ...base,
      profileOverride: { price_excl_vat: 10, source: "offer_base" }, // ignoré
      legacyLevelPrice: 9,
    });
    expect(r.unitPriceEur).toBe(9);
    // 9 * 1.21 = 10.89
    expect(r.unitPriceInclVat).toBe(10.89);
    expect(r.source).toBe("legacy_level");
    expect(r.hasOverride).toBe(true);
  });

  it("priorité 2 : fallback legacy quand pas d'override RPC", () => {
    const r = resolvePriceCascade({ ...base, profileOverride: null, legacyLevelPrice: 9 });
    expect(r.unitPriceEur).toBe(9);
    expect(r.source).toBe("legacy_level");
  });

  it("ignore les overrides invalides (NaN, 0, négatifs)", () => {
    const cases = [
      { profileOverride: { price_excl_vat: 0, source: "offer_absolute" as const } },
      { profileOverride: { price_excl_vat: -5, source: "offer_absolute" as const } },
      { profileOverride: { price_excl_vat: NaN, source: "offer_absolute" as const } },
    ];
    for (const c of cases) {
      const r = resolvePriceCascade({ ...base, ...c, legacyLevelPrice: null });
      expect(r.source).toBe("offer_base");
      expect(r.unitPriceEur).toBe(10);
    }
  });

  it("ignore un legacyLevelPrice <= 0", () => {
    const r = resolvePriceCascade({ ...base, profileOverride: null, legacyLevelPrice: 0 });
    expect(r.source).toBe("offer_base");
  });

  it("préserve le ratio TVA 6% (médicaments)", () => {
    const r = resolvePriceCascade({
      basePriceExclVat: 10,
      basePriceInclVat: 10.6,
      profileOverride: { price_excl_vat: 8, source: "offer_absolute" },
    });
    expect(r.unitPriceEur).toBe(8);
    // 8 * 1.06 = 8.48
    expect(r.unitPriceInclVat).toBe(8.48);
  });

  it("retombe sur ratio 1 si TVA déductible invalide", () => {
    const r = resolvePriceCascade({
      basePriceExclVat: 0,
      basePriceInclVat: 0,
      profileOverride: { price_excl_vat: 5, source: "offer_absolute" },
    });
    expect(r.unitPriceEur).toBe(5);
    expect(r.unitPriceInclVat).toBe(5);
  });

  it("le prix change selon le profil pour la même offre (simulation buyer_profile_id)", () => {
    // Même offre → 2 profils différents → 2 prix différents
    const pharmacien = resolvePriceCascade({
      ...base,
      profileOverride: { price_excl_vat: 9.5, source: "offer_absolute" },
    });
    const grossiste = resolvePriceCascade({
      ...base,
      profileOverride: { price_excl_vat: 8.0, source: "offer_absolute" },
    });
    expect(pharmacien.unitPriceEur).toBe(9.5);
    expect(grossiste.unitPriceEur).toBe(8.0);
    expect(pharmacien.unitPriceEur).not.toBe(grossiste.unitPriceEur);
  });

  it("le prix change selon l'offer_id pour le même profil", () => {
    // 2 offres distinctes du même produit, mêmes inputs → résultats indépendants
    const offerA = resolvePriceCascade({
      basePriceExclVat: 10,
      basePriceInclVat: 12.1,
      profileOverride: { price_excl_vat: 8, source: "offer_absolute" },
    });
    const offerB = resolvePriceCascade({
      basePriceExclVat: 15,
      basePriceInclVat: 18.15,
      profileOverride: { price_excl_vat: 13, source: "offer_absolute" },
    });
    expect(offerA.unitPriceEur).toBe(8);
    expect(offerB.unitPriceEur).toBe(13);
  });
});
