/**
 * Garde-fou : <TierSavingBadge /> ne doit JAMAIS être rendu pour le tier 0
 * (prix de base) dans aucune des variantes de ProductPage :
 *   - discountTiers (desktop)
 *   - offerPriceTiers (desktop)
 *   - hasLegacyTiers (desktop)
 *   - offerPriceTiers (mobile)
 *
 * Comme ProductPage est trop lourd à monter en isolation (énormément de
 * dépendances : router, query, auth, supabase, etc.), on procède par
 * analyse statique du source : chaque occurrence JSX de `<TierSavingBadge`
 * doit être précédée — sur la même ligne — d'une garde `i > 0 &&` ou
 * `i > 0 ?`. Toute régression future (call site oublié, garde supprimée,
 * ou nouveau call site sans garde) fait échouer ce test.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PRODUCT_PAGE_PATH = path.resolve(
  __dirname,
  "..",
  "ProductPage.tsx",
);

function getProductPageSource(): string {
  return readFileSync(PRODUCT_PAGE_PATH, "utf8");
}

/** Lignes contenant une instanciation JSX du composant (pas la définition). */
function findBadgeUsageLines(source: string): { lineNo: number; text: string }[] {
  const out: { lineNo: number; text: string }[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // On cible "<TierSavingBadge" mais on exclut :
    //   - la définition `export function TierSavingBadge(`
    //   - les imports
    if (!line.includes("<TierSavingBadge")) continue;
    if (line.includes("function TierSavingBadge")) continue;
    if (line.trim().startsWith("import ")) continue;
    out.push({ lineNo: i + 1, text: line });
  }
  return out;
}

describe("TierSavingBadge — jamais rendu pour i=0 (static analysis)", () => {
  const source = getProductPageSource();
  const usages = findBadgeUsageLines(source);

  it("trouve au moins une utilisation JSX (sanity check du parser)", () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it("couvre les 4 variantes attendues (desktop/mobile/legacy)", () => {
    // 3 desktop (discountTiers, offerPriceTiers desktop, legacyTiers)
    // + 1 mobile (offerPriceTiers mobile) = 4.
    expect(usages.length).toBe(4);
  });

  it.each(
    // Génère un cas par occurrence pour avoir un message d'échec ciblé.
    findBadgeUsageLines(getProductPageSource()).map((u) => [u.lineNo, u.text] as const),
  )(
    "ligne %i est gardée par `i > 0` avant <TierSavingBadge>",
    (_lineNo, text) => {
      // Avant le `<TierSavingBadge`, on doit trouver `i > 0 &&` OU `i > 0 ?`.
      const before = text.slice(0, text.indexOf("<TierSavingBadge"));
      const hasGuard =
        /\bi\s*>\s*0\s*&&\s*$/.test(before) ||
        /\bi\s*>\s*0\s*\?\s*$/.test(before);
      expect(
        hasGuard,
        `Le badge doit être précédé de "i > 0 &&" ou "i > 0 ?" sur la même ligne.\n` +
          `Ligne trouvée : ${text}`,
      ).toBe(true);
    },
  );

  it("aucune occurrence ne rend le badge inconditionnellement", () => {
    for (const u of usages) {
      const before = u.text.slice(0, u.text.indexOf("<TierSavingBadge"));
      // Refuse les patterns évidents de rendu non gardé :
      //   - retour direct `return <TierSavingBadge`
      //   - début de bloc JSX `{<TierSavingBadge`
      //   - fragment direct `> <TierSavingBadge`
      const looksUnguarded =
        /\breturn\s+$/.test(before) ||
        /\{\s*$/.test(before) ||
        />\s*$/.test(before);
      expect(
        looksUnguarded,
        `Rendu inconditionnel détecté ligne ${u.lineNo} : ${u.text}`,
      ).toBe(false);
    }
  });
});
