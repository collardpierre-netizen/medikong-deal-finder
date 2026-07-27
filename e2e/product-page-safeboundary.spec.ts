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

      // 3. Aucun message d'erreur React minifié dans la console
      const react310 = [...consoleErrors, ...pageErrors].filter((m) =>
        /Minified React error #310|Rendered (more|fewer) hooks/i.test(m)
      );
      expect(react310, "aucune erreur React #310 dans la console").toEqual([]);
    });
  }
});
