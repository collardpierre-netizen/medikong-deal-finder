import { describe, it, expect } from "vitest";
import { extractPackSizeFromName } from "../pack-size";

/**
 * Tests dédiés à la convention CERP (et grossistes similaires) :
 *   - Règle 0   : suffixe "/N" en fin de libellé
 *   - Règle 0bis: nombre nu en fin de libellé, avec garde-fous unités + bornes 2..50
 *
 * Cf. mem://regles-metier/cerp-pack-suffix-convention
 */

describe("extractPackSizeFromName — CERP suffixe /N (règle 0)", () => {
  it("détecte /4 en fin de libellé Fresubin", () => {
    expect(extractPackSizeFromName("FRESUBIN 2 KCAL CAPPUCCINO /4")).toBe(4);
  });

  it("détecte /15 en fin de libellé Diben", () => {
    expect(extractPackSizeFromName("DIBEN VANILLE /15")).toBe(15);
  });

  it("tolère un espace entre le slash et le nombre", () => {
    expect(extractPackSizeFromName("FRESUBIN ENERGY FIBRE / 6")).toBe(6);
  });

  it("ignore les fractions/dates en milieu de libellé (12/04)", () => {
    expect(extractPackSizeFromName("LOT 12/04/2026 FRESUBIN")).toBeNull();
  });

  it("ignore un slash sans séparateur avant (collé au mot)", () => {
    // "ENERGY/4" sans espace avant le slash → ne doit PAS matcher la règle 0
    // (et ne match aucune autre règle non plus)
    expect(extractPackSizeFromName("FRESUBIN ENERGY/4")).toBeNull();
  });

  it("respecte la borne basse (≥ 2)", () => {
    expect(extractPackSizeFromName("FRESUBIN UNIT /1")).toBeNull();
  });
});

describe("extractPackSizeFromName — CERP nombre nu final (règle 0 bis)", () => {
  it("détecte un pack 4 en fin de libellé Fresubin", () => {
    expect(extractPackSizeFromName("FRESUBIN 2 KCAL FIBRE PECHE 4")).toBe(4);
  });

  it("détecte un pack 15 en fin de libellé Diben", () => {
    expect(extractPackSizeFromName("DIBEN VANILLE FRAISE 15")).toBe(15);
  });

  it("détecte un pack 24 en fin de libellé", () => {
    expect(extractPackSizeFromName("FRESUBIN CREME CHOCOLAT 24")).toBe(24);
  });

  it("ignore un dosage en mg (token précédent = unité)", () => {
    expect(extractPackSizeFromName("PARACETAMOL 500 mg")).toBeNull();
  });

  it("ignore un volume en ml (token précédent = unité)", () => {
    expect(extractPackSizeFromName("FRESUBIN ORIGINAL 200 ml")).toBeNull();
  });

  it("ignore une énergie en kcal", () => {
    expect(extractPackSizeFromName("FRESUBIN PROTEIN 300 kcal")).toBeNull();
  });

  it("ignore les unités collées (g, kg, cl, l, mcg, ui)", () => {
    expect(extractPackSizeFromName("PRODUIT TEST 50 g")).toBeNull();
    expect(extractPackSizeFromName("PRODUIT TEST 1 kg")).toBeNull();
    expect(extractPackSizeFromName("PRODUIT TEST 25 cl")).toBeNull();
    expect(extractPackSizeFromName("PRODUIT TEST 1 l")).toBeNull();
    expect(extractPackSizeFromName("VITAMINE B12 500 mcg")).toBeNull();
    expect(extractPackSizeFromName("VITAMINE D 1000 ui")).toBeNull();
  });

  it("respecte la borne basse stricte (≥ 2)", () => {
    expect(extractPackSizeFromName("FRESUBIN UNIT 1")).toBeNull();
  });

  it("respecte la borne haute stricte (≤ 50)", () => {
    // 51 doit être rejeté par la règle 0 bis (pack vendeur réaliste)
    expect(extractPackSizeFromName("FRESUBIN BIG 51")).toBeNull();
    // Une année en fin de libellé est typiquement > 50
    expect(extractPackSizeFromName("FRESUBIN PROMO 2026")).toBeNull();
  });

  it("ignore un nombre nu si pas en fin de libellé", () => {
    expect(extractPackSizeFromName("FRESUBIN 4 PECHE FIBRE")).toBeNull();
  });
});

describe("extractPackSizeFromName — non-régression sur règles génériques", () => {
  it("règle 0 prioritaire sur la règle 'NxQ unité'", () => {
    // "/4" doit primer même si "4 x 200 ml" est présent dans le libellé
    expect(extractPackSizeFromName("FRESUBIN 4 x 200 ml /4")).toBe(4);
  });

  it("la règle générique 4×200ml fonctionne toujours sans suffixe", () => {
    expect(extractPackSizeFromName("FRESUBIN 4 x 200 ml")).toBe(4);
  });

  it("la règle galénique 30 caps fonctionne toujours", () => {
    expect(extractPackSizeFromName("OMEGA 3 30 caps")).toBe(30);
  });

  it("entrées vides ou nulles → null", () => {
    expect(extractPackSizeFromName(null)).toBeNull();
    expect(extractPackSizeFromName(undefined)).toBeNull();
    expect(extractPackSizeFromName("")).toBeNull();
    expect(extractPackSizeFromName("   ")).toBeNull();
  });
});
