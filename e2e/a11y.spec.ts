import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Smoke a11y tests — vérifie qu'aucune violation WCAG 2.1 niveau A ou AA
 * n'est introduite sur les pages publiques clés.
 *
 * Tags axe utilisés : wcag2a, wcag2aa, wcag21a, wcag21aa.
 *
 * Pour limiter le bruit pendant qu'on rattrape la dette, on tolère
 * temporairement quelques règles via `disableRules` ci-dessous. Chaque
 * entrée doit pointer vers un ticket de remédiation et être levée
 * dès que la dette est purgée.
 */

const KEY_PUBLIC_PAGES = [
  { name: "Accueil", path: "/" },
  { name: "Catalogue", path: "/catalogue" },
  { name: "Marques", path: "/marques" },
  { name: "Catégories", path: "/categories" },
  { name: "Promotions", path: "/promotions" },
  { name: "Connexion", path: "/connexion" },
];

// Règles temporairement désactivées (à vider au fur et à mesure).
// Documente toujours la raison + le ticket de suivi.
const TEMPORARILY_DISABLED_RULES: string[] = [
  // ex: "color-contrast", // dette CMS — ticket A11Y-12
];

// Ce projet ne tourne qu'une fois — pas besoin de le rejouer sur 6 viewports.
const A11Y_PROJECTS = ["desktop-1280"];

for (const { name, path } of KEY_PUBLIC_PAGES) {
  test.describe(`A11y ${name} (${path})`, () => {
    test.skip(
      ({}, testInfo) => !A11Y_PROJECTS.includes(testInfo.project.name),
      "Audit a11y exécuté uniquement sur desktop-1280",
    );

    test("aucune violation WCAG A/AA", async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(TEMPORARILY_DISABLED_RULES)
        // Ignore les iframes tierces (recaptcha, stripe, gtm, etc.)
        .exclude("iframe")
        .analyze();

      // Rapport lisible en cas d'échec
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        firstTarget: v.nodes[0]?.target,
      }));

      expect(
        results.violations,
        `Violations a11y détectées sur ${path}:\n${JSON.stringify(summary, null, 2)}`,
      ).toEqual([]);
    });
  });
}
