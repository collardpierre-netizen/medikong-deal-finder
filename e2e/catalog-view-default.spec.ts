import { test, expect, devices } from "@playwright/test";

/**
 * Vérifie les défauts de la vue catalogue (Trivago vs Grid) et la persistance
 * du choix utilisateur via localStorage.
 *
 * Règles testées (cf. src/hooks/useCatalogViewMode.ts) :
 *   - /catalogue (sans intent) → Grid par défaut sur desktop
 *   - /catalogue?q=... ou ?category=... ou /catalogue/:slug → Trivago
 *   - /recherche?q=... → Trivago
 *   - /marques, /promotions → Grid (même avec intent)
 *   - mobile (< 768px) → Trivago partout
 *   - choix utilisateur (localStorage) → override les défauts et survit au reload
 */

const TRIVAGO_TOGGLE = '[role="radio"][aria-label="Vue comparative"]';
const GRID_TOGGLE = '[role="radio"][aria-label="Vue grille"]';

async function activeView(page: import("@playwright/test").Page) {
  // Attend que le toolbar se monte
  await page.waitForSelector('[role="radiogroup"][aria-label="Mode d\'affichage du catalogue"]', {
    timeout: 15_000,
  });
  const trivagoChecked = await page.locator(TRIVAGO_TOGGLE).getAttribute("aria-checked");
  const gridChecked = await page.locator(GRID_TOGGLE).getAttribute("aria-checked");
  if (trivagoChecked === "true") return "trivago" as const;
  if (gridChecked === "true") return "grid" as const;
  return "unknown" as const;
}

test.describe("Catalog default view — desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("/catalogue sans intent → Grid", async ({ page }) => {
    await page.goto("/catalogue");
    expect(await activeView(page)).toBe("grid");
  });

  test("/catalogue?q=vitamine → Trivago (intent recherche)", async ({ page }) => {
    await page.goto("/catalogue?q=vitamine");
    expect(await activeView(page)).toBe("trivago");
  });

  test("/catalogue?category=mk-hygiene → Trivago (intent catégorie)", async ({ page }) => {
    await page.goto("/catalogue?category=mk-hygiene");
    expect(await activeView(page)).toBe("trivago");
  });
});

test.describe("Catalog default view — mobile", () => {
  test.use({ ...devices["Pixel 5"] });

  test("/catalogue → Trivago (mobile force toujours Trivago)", async ({ page }) => {
    await page.goto("/catalogue");
    expect(await activeView(page)).toBe("trivago");
  });
});

test.describe("Catalog view persistence", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("toggle utilisateur persiste après refresh et override les défauts", async ({ page }) => {
    // Démarre sur /catalogue (défaut Grid)
    await page.goto("/catalogue");
    expect(await activeView(page)).toBe("grid");

    // Bascule sur Trivago
    await page.locator(TRIVAGO_TOGGLE).click();
    await expect(page.locator(TRIVAGO_TOGGLE)).toHaveAttribute("aria-checked", "true");

    // localStorage doit refléter le choix
    const stored = await page.evaluate(() => localStorage.getItem("medikong.catalog.view"));
    expect(stored).toBe("trivago");

    // Reload : la préférence doit survivre
    await page.reload();
    expect(await activeView(page)).toBe("trivago");

    // Et override le défaut Grid de /promotions également
    await page.goto("/promotions");
    expect(await activeView(page)).toBe("trivago");
  });

  test("préférence localStorage 'grid' force Grid sur une page intent (Trivago par défaut)", async ({
    page,
  }) => {
    await page.goto("/catalogue");
    await page.evaluate(() => localStorage.setItem("medikong.catalog.view", "grid"));
    await page.goto("/catalogue?q=vitamine");
    expect(await activeView(page)).toBe("grid");
  });
});
