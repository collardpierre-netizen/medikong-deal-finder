import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Garde-fou statique :
 *  - "Mis à jour" ne doit apparaître qu'UNE seule fois dans la fiche produit
 *    (un seul libellé sous le statut de stock, pas de doublon ailleurs).
 *  - "Synchro" / "synchro" ne doit plus jamais apparaître côté front
 *    (consigne produit : aucun badge "Synchro" sur la fiche).
 *
 * On scanne le source brut pour rester rapide et indépendant
 * du runtime React (pas besoin de monter ProductPage).
 *
 * Les commentaires JSX (`{/* ... *\/}`) sont retirés avant comptage
 * pour autoriser des notes développeur sans casser le test.
 */

const PRODUCT_PAGE_PATH = resolve(__dirname, "../ProductPage.tsx");

function loadProductPageSource(): string {
  const raw = readFileSync(PRODUCT_PAGE_PATH, "utf8");
  // Strip JSX comments {/* ... */} and JS block comments /* ... */
  // so dev notes don't pollute the count.
  return raw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("ProductPage — libellé de mise à jour", () => {
  const source = loadProductPageSource();

  it("contient exactement une occurrence du libellé \"Mis à jour\"", () => {
    const matches = source.match(/Mis à jour/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("ne contient aucune occurrence du mot \"synchro\" (insensible à la casse)", () => {
    const matches = source.match(/synchro/gi) ?? [];
    expect(matches.length).toBe(0);
  });
});
