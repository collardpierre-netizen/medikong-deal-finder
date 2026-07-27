import { test, expect } from "@playwright/test";

/**
 * Smoke test : charge une fiche produit et vérifie que ni le SafeBoundary
 * global (« Données indisponibles ») ni le ProductPageErrorBoundary
 * (« Impossible d'afficher cette fiche produit ») ne sont déclenchés.
 *
 * Couvre notamment la régression React #310 (hook order) qui blanchissait
 * la fiche via le fallback SafeBoundary.
 *
 * Cible :
 *   - `PLAYWRIGHT_BASE_URL` (staging/prod) si défini côté CI
 *   - sinon localhost:8080 (dev server local)
 *
 * Slugs testés : `SMOKE_PRODUCT_SLUGS` (CSV) ou liste par défaut connue
 * pour disposer d'offres + historique de prix.
 */

const DEFAULT_SLUGS = [
  "refectocil-lash-brow-booster-serum-for-eyebrow-and-eyelash-growth-2-in-1-6ml",
  "corega-max-denture-adhesive-cream-40g",
  "biotherm-biocorps-body-serum-200ml-anti-blemish",
];

const SLUGS = (process.env.SMOKE_PRODUCT_SLUGS || DEFAULT_SLUGS.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

test.describe("Fiche produit — smoke SafeBoundary", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const slug of SLUGS) {
    test(`/produit/${slug} n'affiche pas de fallback d'erreur`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => {
        pageErrors.push(err.message || String(err));
      });

      const response = await page.goto(`/produit/${slug}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response, "response non nulle").not.toBeNull();
      expect(response!.status(), "status HTTP").toBeLessThan(500);

      // Attente que le squelette de chargement disparaisse (aria-busy=true)
      await page
        .locator('[role="status"][aria-busy="true"]')
        .first()
        .waitFor({ state: "detached", timeout: 20_000 })
        .catch(() => {
          /* pas de skeleton si SSR/cache, on continue */
        });

      // Le H1 (nom du produit) doit apparaître — preuve que la fiche a rendu
      const h1 = page.locator("h1").first();
      await expect(h1, "H1 fiche produit visible").toBeVisible({ timeout: 15_000 });
      await expect(h1).not.toHaveText(/^\s*$/);

      // 1. Aucun fallback SafeBoundary global
      const safeBoundaryFallback = page.getByText(/Données indisponibles/i);
      await expect(
        safeBoundaryFallback,
        "aucun fallback SafeBoundary (« Données indisponibles »)"
      ).toHaveCount(0);

      // 2. Aucun fallback ProductPageErrorBoundary
      const productErrorFallback = page.getByText(
        /Impossible d'afficher cette fiche produit/i
      );
      await expect(
        productErrorFallback,
        "aucun fallback ProductPageErrorBoundary"
      ).toHaveCount(0);

      // 3. Aucune erreur React (console + pageerror) — strict, incluant #310
      const allMessages = [...consoleErrors, ...pageErrors];
      const reactErrors = allMessages.filter((m) => REACT_ERROR_PATTERN.test(m));
      expect(
        reactErrors,
        `Erreur React détectée dans la console/pageerror :\n${reactErrors.join("\n")}`
      ).toEqual([]);

      // Ceinture + bretelles : aucune erreur JS non capturée (pageerror)
      expect(
        pageErrors,
        `Erreurs JS non capturées (pageerror) :\n${pageErrors.join("\n")}`
      ).toEqual([]);
    });
  }

  /**
   * Régression React #310 spécifique à `ProductPriceHistory` : quand `gtin`
   * bascule entre `null | undefined` (composant désactivé, `enabled = false`)
   * et une chaîne (composant activé), l'ordre des hooks doit rester stable.
   *
   * On enchaîne dans une même page (donc même contexte React, sans reload) :
   *   1. produit A (gtin défini → historique ENABLED)
   *   2. navigation SPA vers /catalogue (composant DÉMONTÉ)
   *   3. produit B (gtin défini → nouveau montage, ENABLED)
   *   4. navigation SPA vers /catalogue (DÉMONTÉ)
   *   5. retour produit A (REMONTÉ)
   *
   * À chaque étape on vérifie qu'aucun SafeBoundary / ErrorBoundary
   * n'apparaît et qu'aucune erreur React #310 n'est journalisée.
   */
  test.skip(
    SLUGS.length < 2,
    "Il faut au moins 2 slugs pour tester les transitions enabled/disabled"
  );
  test(`transitions enabled/disabled de l'historique de prix — aucun fallback`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message || String(err));
    });

    async function waitProductReady() {
      await page
        .locator('[role="status"][aria-busy="true"]')
        .first()
        .waitFor({ state: "detached", timeout: 20_000 })
        .catch(() => {});
      const h1 = page.locator("h1").first();
      await expect(h1, "H1 fiche produit visible").toBeVisible({ timeout: 15_000 });
      await expect(h1).not.toHaveText(/^\s*$/);
    }

    async function assertNoFallback(step: string) {
      await expect(
        page.getByText(/Données indisponibles/i),
        `[${step}] aucun SafeBoundary`
      ).toHaveCount(0);
      await expect(
        page.getByText(/Impossible d'afficher cette fiche produit/i),
        `[${step}] aucun ProductPageErrorBoundary`
      ).toHaveCount(0);
    }

    // Navigation SPA — pushState + popstate déclenche le routeur React sans reload,
    // donc ProductPriceHistory (dé)monte réellement et son état enabled bascule.
    async function spaNavigate(pathname: string) {
      await page.evaluate((p) => {
        window.history.pushState({}, "", p);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, pathname);
      await page.waitForURL(new RegExp(pathname.replace(/[/]/g, "\\/") + "(?:$|\\?)"), {
        timeout: 15_000,
      });
    }

    const [slugA, slugB] = SLUGS;

    // 1. Produit A → historique enabled
    const res = await page.goto(`/produit/${slugA}`, { waitUntil: "domcontentloaded" });
    expect(res!.status(), "status HTTP produit A").toBeLessThan(500);
    await waitProductReady();
    await assertNoFallback("produit A initial");

    // 2. Route sans fiche produit → composant démonté
    await spaNavigate("/catalogue");
    await assertNoFallback("catalogue après A");

    // 3. Produit B → nouveau montage
    await spaNavigate(`/produit/${slugB}`);
    await waitProductReady();
    await assertNoFallback("produit B après catalogue");

    // 4. Retour catalogue
    await spaNavigate("/catalogue");
    await assertNoFallback("catalogue après B");

    // 5. Retour produit A
    await spaNavigate(`/produit/${slugA}`);
    await waitProductReady();
    await assertNoFallback("retour produit A");

    // Aucun message React #310 (« more/fewer hooks », #310 minifié) sur TOUT le run
    const react310 = [...consoleErrors, ...pageErrors].filter((m) =>
      /Minified React error #310|Rendered (more|fewer) hooks|change in the order of Hooks/i.test(
        m
      )
    );
    expect(
      react310,
      `Erreur React #310 détectée pendant les transitions enabled/disabled :\n${react310.join("\n")}`
    ).toEqual([]);
  });
});
