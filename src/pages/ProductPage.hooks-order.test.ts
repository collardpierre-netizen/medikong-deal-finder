import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Régression React error #310 (ordre des hooks) sur ProductPage.
 *
 * Le bug : les appels à `useLocalizedProductField` étaient placés APRÈS les
 * early returns `if (isLoading)` / `if (!product)`. Résultat : au premier
 * rendu (isLoading=true) React comptait N hooks, au rendu suivant (product
 * chargé) il en comptait N+3 → "Rendered more hooks than during the previous
 * render".
 *
 * Ce test garantit que TOUS les hooks (a fortiori useLocalizedProductField)
 * sont invoqués AVANT le premier early return conditionnel du composant, de
 * sorte que l'ordre des hooks est stable entre les états isLoading et
 * "product chargé".
 */
describe("ProductPage — ordre des hooks stable", () => {
  const source = readFileSync(
    resolve(__dirname, "ProductPage.tsx"),
    "utf8",
  );
  const lines = source.split("\n");

  // Récupère les indices (1-based) de tous les patterns qui matchent
  function findLineNumbers(pattern: RegExp): number[] {
    const hits: number[] = [];
    lines.forEach((line, idx) => {
      if (pattern.test(line)) hits.push(idx + 1);
    });
    return hits;
  }

  it("appelle useLocalizedProductField avant tout early return isLoading/!product", () => {
    // Ne considère que les appels (pas l'import)
    const hookCallLines = findLineNumbers(/useLocalizedProductField\s*\(/);
    expect(hookCallLines.length).toBeGreaterThanOrEqual(1);

    // Premier early return du corps du composant : ancre stable = `if (isLoading) {`
    const earlyReturnLines = findLineNumbers(/^\s*if\s*\(isLoading\)\s*\{/);

    expect(earlyReturnLines.length).toBeGreaterThanOrEqual(1);

    const firstEarlyReturn = Math.min(...earlyReturnLines);
    const lastHookCall = Math.max(...hookCallLines);

    expect(
      lastHookCall,
      `useLocalizedProductField appelé ligne ${lastHookCall}, APRÈS le early return ligne ${firstEarlyReturn}. Cela casse l'ordre des hooks entre les états isLoading et product chargé (React error #310). Remontez tous les appels de hook au-dessus des early returns.`,
    ).toBeLessThan(firstEarlyReturn);
  });

  it("n'a aucun appel de hook (use*) entre le premier early return et la fin du composant qui ne soit pas dans un sous-composant", () => {
    // Garde-fou léger : on vérifie juste qu'aucun `useLocalizedProductField`
    // n'apparaît après le premier early return du composant principal.
    const firstEarlyReturn = Math.min(
      ...findLineNumbers(/^\s*if\s*\(isLoading\)\s*\{/),
    );

    const hookCallsAfter = findLineNumbers(/useLocalizedProductField\s*\(/)
      .filter((ln) => ln > firstEarlyReturn);

    expect(
      hookCallsAfter,
      `useLocalizedProductField ne doit pas être appelé après un early return. Occurrences fautives lignes: ${hookCallsAfter.join(", ")}`,
    ).toEqual([]);
  });
});
