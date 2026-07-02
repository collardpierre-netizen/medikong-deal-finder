import { describe, it, expect } from "vitest";
import {
  formatMoney,
  formatMoneyFromCents,
  formatDelta,
  formatDeltaFromCents,
} from "./money-format";

/**
 * Ces tests verrouillent la conversion cents → euros utilisée partout dans le
 * dashboard vendeur. Ils protègent contre le bug historique où `sub_orders`
 * (euros) était divisé par 100 comme s'il était en cents, ou l'inverse dans
 * `order_lines`.
 *
 * Règle MediKong : toutes les valeurs monétaires stockées côté hook sont EN
 * CENTIVES (integer). L'UI divise par 100 juste avant l'affichage OU appelle
 * `formatMoneyFromCents` — les deux doivent produire le même résultat.
 */
describe("money-format · conversion cents → euros", () => {
  const LOCALE = "fr-BE";

  it("formatMoneyFromCents divise par 100 (12 345 c → 123,45 €)", () => {
    expect(formatMoneyFromCents(12345, { locale: LOCALE })).toBe("123,45\u00A0€");
  });

  it("formatMoneyFromCents · zéro", () => {
    expect(formatMoneyFromCents(0, { locale: LOCALE })).toBe("0,00\u00A0€");
  });

  it("formatMoneyFromCents · gros montant avec séparateur de milliers", () => {
    // 1 234 567 c = 12 345,67 €
    expect(formatMoneyFromCents(1_234_567, { locale: LOCALE })).toBe(
      "12.345,67\u00A0€",
    );
  });

  it("formatMoneyFromCents · négatif (remboursement)", () => {
    expect(formatMoneyFromCents(-500, { locale: LOCALE })).toBe("-5,00\u00A0€");
  });

  it("formatMoneyFromCents · fractionDigits: 0 (KPI dashboard)", () => {
    // Le dashboard vendeur affiche les KPIs sans décimales
    expect(
      formatMoneyFromCents(1_234_567, { locale: LOCALE, fractionDigits: 0 }),
    ).toBe("12.346\u00A0€");
  });

  it("formatMoneyFromCents · null/undefined traité comme 0 (Number coercion)", () => {
    // `Number(null) === 0` et `Number(undefined) === NaN` : la fonction
    // renvoie "0,00 €" pour null (finite) et "—" pour undefined (NaN).
    expect(formatMoneyFromCents(null, { locale: "fr-BE" })).toBe("0,00\u00A0€");
    expect(formatMoneyFromCents(undefined)).toBe("—");
  });

  it("formatMoneyFromCents(c) ≡ formatMoney(c/100) (invariant dashboard)", () => {
    // Le dashboard fait `const revenueEur = revenueExclVatCents / 100;
    // formatMoney(revenueEur)`. Ce test verrouille l'équivalence avec la
    // forme condensée `formatMoneyFromCents(revenueExclVatCents)`.
    const samples = [0, 1, 99, 100, 12345, 1_234_567, -500];
    for (const cents of samples) {
      expect(formatMoney(cents / 100, { locale: LOCALE })).toBe(
        formatMoneyFromCents(cents, { locale: LOCALE }),
      );
    }
  });

  it("aucune perte de précision sur cents entiers (roundtrip €→c→€)", () => {
    // Simule la chaîne DB(euros) → hook(cents via *100 arrondi) → UI(/100).
    const eurosFromDb = [0, 0.01, 0.99, 1, 12.34, 123.45, 12_345.67];
    for (const eur of eurosFromDb) {
      const cents = Math.round(eur * 100);
      expect(cents / 100).toBeCloseTo(eur, 2);
      expect(formatMoneyFromCents(cents, { locale: LOCALE })).toBe(
        formatMoney(eur, { locale: LOCALE }),
      );
    }
  });
});

describe("money-format · formatDelta (variation de prix)", () => {
  const LOCALE = "fr-BE";

  it("delta positif affiche un signe +", () => {
    expect(formatDelta(12.34, { locale: LOCALE })).toBe("+\u00A012,34\u00A0€");
  });

  it("delta négatif affiche un signe −", () => {
    expect(formatDelta(-5, { locale: LOCALE })).toBe("−\u00A05,00\u00A0€");
  });

  it("delta zéro n'affiche pas de signe", () => {
    expect(formatDelta(0, { locale: LOCALE })).toBe("0,00\u00A0€");
  });

  it("formatDeltaFromCents divise par 100", () => {
    expect(formatDeltaFromCents(1234, { locale: LOCALE })).toBe(
      "+\u00A012,34\u00A0€",
    );
    expect(formatDeltaFromCents(-1234, { locale: LOCALE })).toBe(
      "−\u00A012,34\u00A0€",
    );
  });
});
