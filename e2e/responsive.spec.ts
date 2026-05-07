import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke tests : vérifient que les pages clés se chargent et que la mise en page
 * ne génère pas de scroll horizontal (débordement) sur desktop comme mobile.
 */

const KEY_PAGES = [
  { name: "Accueil", path: "/" },
  { name: "Catalogue", path: "/catalogue" },
  { name: "Marques", path: "/marques" },
  { name: "Catégories", path: "/categories" },
  { name: "Promotions", path: "/promotions" },
];

async function expectNoHorizontalOverflow(page: Page) {
  // Tolérance de 2px pour les arrondis (scrollbars, sub-pixel rendering).
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(overflow.scrollWidth, `débordement horizontal détecté (${overflow.scrollWidth} > ${overflow.clientWidth})`)
    .toBeLessThanOrEqual(overflow.clientWidth + 2);
}

for (const { name, path } of KEY_PAGES) {
  test.describe(`Page ${name} (${path})`, () => {
    test("se charge sans erreur réseau critique", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response, "réponse HTTP manquante").not.toBeNull();
      expect(response!.status(), `status ${response!.status()} sur ${path}`).toBeLessThan(500);

      // Logo MediKong doit apparaître (présent dans la Navbar globale).
      await expect(page.getByAltText(/medikong/i).first()).toBeVisible({ timeout: 10_000 });

      expect(errors, `erreurs JS: ${errors.join(" | ")}`).toEqual([]);
    });

    test("ne déborde pas horizontalement", async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      await expectNoHorizontalOverflow(page);
    });
  });
}

test.describe("Navigation mobile (burger)", () => {
  test.skip(({ isMobile }) => !isMobile, "test mobile uniquement");

  test("ouvre et ferme le menu burger", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Ouvrir le menu (bouton burger : icône Menu de lucide).
    const burger = page.locator("nav button").filter({ has: page.locator("svg") }).last();
    await burger.click();

    // Le menu doit afficher le toggle HTVA/TTC.
    await expect(page.getByText("HTVA", { exact: false }).first()).toBeVisible();

    // Fermer (clic sur le bouton X qui a remplacé le burger).
    await burger.click();
    await expect(page.getByText(/Mes Prix/i)).toHaveCount(0);
  });
});
