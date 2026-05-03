import { describe, it, expect } from "vitest";
import { buildCountryFilterExpression } from "../useCatalog";

/**
 * Régression : les produits actifs sans aucune offre dans le pays courant
 * (LEFT JOIN sur product_country_stats → country_code NULL) doivent rester
 * visibles dans la grille catalogue. Sans la branche `country_code.is.null`,
 * ils disparaissent alors qu'ils s'affichent dans le moteur de recherche.
 */
describe("buildCountryFilterExpression", () => {
  it("inclut le pays courant ET la branche IS NULL", () => {
    expect(buildCountryFilterExpression("BE")).toBe(
      "country_code.eq.BE,country_code.is.null"
    );
  });

  it("fonctionne pour FR et LU", () => {
    expect(buildCountryFilterExpression("FR")).toContain("country_code.eq.FR");
    expect(buildCountryFilterExpression("FR")).toContain("country_code.is.null");
    expect(buildCountryFilterExpression("LU")).toContain("country_code.eq.LU");
    expect(buildCountryFilterExpression("LU")).toContain("country_code.is.null");
  });

  it("ne perd jamais la clause IS NULL (anti-régression catalogue vide)", () => {
    for (const c of ["BE", "FR", "LU", "DE", "NL"]) {
      expect(buildCountryFilterExpression(c)).toMatch(/country_code\.is\.null/);
    }
  });
});
