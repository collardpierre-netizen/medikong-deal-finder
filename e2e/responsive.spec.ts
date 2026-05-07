import { test, expect, type Page } from "@playwright/test";

/**
 * Tests anti-régression responsive.
 *
 * Pour chaque page clé et à chaque largeur (configurée dans playwright.config.ts) :
 *   1. La page doit répondre < 500 et ne pas lever d'erreur JS bloquante.
 *   2. Le `<html>` ne doit JAMAIS scroller horizontalement (tolérance 2 px).
 *   3. Aucun élément visible ne doit déborder du viewport, sauf si un ancêtre
 *      l'autorise explicitement via `overflow-x: auto / scroll / hidden` réel
 *      (carrousels, tabs, etc.) — ce qui est intentionnel et acceptable.
 */

const KEY_PAGES = [
  { name: "Accueil", path: "/" },
  { name: "Catalogue", path: "/catalogue" },
  { name: "Marques", path: "/marques" },
  { name: "Catégories", path: "/categories" },
  { name: "Promotions", path: "/promotions" },
  { name: "Panier", path: "/panier" },
];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `débordement horizontal détecté (scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth})`
  ).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

/**
 * Recherche les éléments qui dépassent du viewport sans qu'aucun ancêtre
 * ne soit configuré pour scroller horizontalement. Ces éléments sont
 * de vrais bugs visuels.
 */
async function findUnexpectedOverflowingElements(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders: { tag: string; cls: string; right: number; width: number }[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.width > 4000) return;
      if (r.right <= vw + 1) return;
      // Un ancêtre autorise-t-il explicitement le scroll horizontal ?
      let parent: HTMLElement | null = el.parentElement;
      while (parent) {
        const s = getComputedStyle(parent);
        if (
          ["auto", "scroll", "hidden"].includes(s.overflowX) &&
          parent.scrollWidth > parent.clientWidth
        ) {
          return; // débordement intentionnel, on ignore
        }
        parent = parent.parentElement;
      }
      offenders.push({
        tag: el.tagName,
        cls: (el.className || "").toString().slice(0, 100),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    });
    // dédoublonne par signature
    const seen = new Set<string>();
    return offenders
      .filter((o) => {
        const k = `${o.tag}|${o.cls}|${o.width}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 10);
  });
}

for (const { name, path } of KEY_PAGES) {
  test.describe(`Page ${name} (${path})`, () => {
    test("se charge sans erreur JS", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response, "réponse HTTP manquante").not.toBeNull();
      expect(response!.status(), `status ${response!.status()} sur ${path}`).toBeLessThan(500);

      await expect(page.getByAltText(/medikong/i).first()).toBeVisible({ timeout: 10_000 });
      expect(errors, `erreurs JS: ${errors.join(" | ")}`).toEqual([]);
    });

    test("pas de scroll horizontal global", async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      await expectNoHorizontalOverflow(page);
    });

    test("aucun composant ne déborde involontairement", async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      const offenders = await findUnexpectedOverflowingElements(page);
      expect(
        offenders,
        `Composants en débordement non intentionnel:\n${JSON.stringify(offenders, null, 2)}`
      ).toEqual([]);
    });
  });
}

test.describe("Navigation mobile (burger)", () => {
  test.skip(({ isMobile }) => !isMobile, "test mobile uniquement");

  test("ouvre et ferme le menu burger", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const burger = page.locator("nav button").filter({ has: page.locator("svg") }).last();
    await burger.click();
    await expect(page.getByText("HTVA", { exact: false }).first()).toBeVisible();
    await burger.click();
    await expect(page.getByText(/Mes Prix/i)).toHaveCount(0);
  });
});
