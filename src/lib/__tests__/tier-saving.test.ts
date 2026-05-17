/**
 * Tests unitaires :
 *   - `computeTierSavingPercent` (règles centralisées de calcul)
 *   - `parseTierSavingValue` (normalisation pour le badge)
 *   - `formatTierSaving` (format d'affichage)
 *
 * Garantit qu'aucune divergence ne peut s'installer entre les blocs
 * desktop / mobile / tableau iPad puisque tous appellent ce module.
 */
import { describe, it, expect } from "vitest";
import {
  computeTierSavingPercent,
  parseTierSavingValue,
  formatTierSaving,
} from "@/lib/tier-saving";

describe("computeTierSavingPercent — basePrice invalide", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["zéro", 0],
    ["négatif", -5],
  ])("renvoie null pour basePrice=%s", (_label, base) => {
    expect(
      computeTierSavingPercent(base as number | null | undefined, 5),
    ).toBeNull();
  });
});

describe("computeTierSavingPercent — unitPrice invalide", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
  ])("renvoie null pour unitPrice=%s", (_label, unit) => {
    expect(
      computeTierSavingPercent(10, unit as number | null | undefined),
    ).toBeNull();
  });
});

describe("computeTierSavingPercent — réduction non strictement positive", () => {
  it("renvoie null si unitPrice = basePrice (saving = 0)", () => {
    expect(computeTierSavingPercent(10, 10)).toBeNull();
  });
  it("renvoie null si unitPrice > basePrice (saving < 0)", () => {
    expect(computeTierSavingPercent(10, 12)).toBeNull();
  });
});

describe("computeTierSavingPercent — cas valides", () => {
  it("calcule -10% pour 10 → 9", () => {
    expect(computeTierSavingPercent(10, 9)).toBeCloseTo(10, 5);
  });
  it("calcule -50% pour 2 → 1", () => {
    expect(computeTierSavingPercent(2, 1)).toBeCloseTo(50, 5);
  });
  it("accepte basePrice fractionnaire", () => {
    expect(computeTierSavingPercent(1.64, 1.5)).toBeCloseTo(8.5365, 3);
  });
});

describe("parseTierSavingValue", () => {
  it.each([
    ["null", null, null],
    ["undefined", undefined, null],
    ["chaîne vide", "", null],
    ["chaîne non parsable", "abc", null],
    ["NaN", NaN, null],
    ["Infinity", Infinity, null],
    ["-Infinity", -Infinity, null],
    ["zéro number", 0, null],
    ["zéro string", "0", null],
    ["zéro formaté", "0.0", null],
    ["négatif number", -5, null],
    ["négatif string", "-2.3", null],
    ["valide number", 4.5, 4.5],
    ["valide string", "6.8", 6.8],
    ["valide entier", 3, 3],
  ])("%s → %s", (_label, input, expected) => {
    expect(
      parseTierSavingValue(input as string | number | null | undefined),
    ).toStrictEqual(expected);
  });
});

describe("formatTierSaving", () => {
  it("force toujours 1 décimale", () => {
    expect(formatTierSaving(3)).toBe("-3.0%");
    expect(formatTierSaving(4.5)).toBe("-4.5%");
    expect(formatTierSaving("6.875")).toBe("-6.9%"); // arrondi
  });
  it("renvoie null pour entrée invalide", () => {
    expect(formatTierSaving(null)).toBeNull();
    expect(formatTierSaving(0)).toBeNull();
    expect(formatTierSaving("NaN")).toBeNull();
  });
});

describe("invariant desktop / mobile — chaîne calcul + format", () => {
  it("computeTierSavingPercent + formatTierSaving produit la même sortie qu'on passe par l'un ou l'autre", () => {
    const pct = computeTierSavingPercent(10, 9);
    expect(pct).not.toBeNull();
    expect(formatTierSaving(pct)).toBe("-10.0%");
  });
  it("base nulle → chaîne complète renvoie null à chaque étape", () => {
    const pct = computeTierSavingPercent(0, 9);
    expect(pct).toBeNull();
    expect(formatTierSaving(pct)).toBeNull();
  });
});
