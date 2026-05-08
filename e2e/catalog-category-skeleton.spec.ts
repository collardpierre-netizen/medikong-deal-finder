import { test, expect } from "@playwright/test";

/**
 * Vérifie que pendant le tout premier chargement d'une page catégorie
 * `mk-*`, on affiche bien un skeleton dans le H1 et le breadcrumb (et
 * jamais le slug technique capitalisé "Mk Otc Medicaments"), puis que
 * le libellé traduit prend le relais une fois la requête résolue.
 *
 * On ralentit volontairement la requête `categories?slug=eq.<slug>`
 * pour rendre le skeleton observable de manière déterministe.
 */

const CATEGORY_SLUG = "mk-otc-medicaments";
const EXPECTED_LABEL = "OTC & Médicaments";
const DELAY_MS = 1500;

test.describe("Catalogue — skeleton initial du H1 et du breadcrumb", () => {
  test.use({ viewport: { width: 1366, height: 800 } });

  test("affiche un skeleton puis le libellé traduit (jamais le slug brut)", async ({ page }) => {
    // Ralentit toute requête REST sur la table categories pour ce slug,
    // afin que le skeleton soit visible suffisamment longtemps pour être
    // assert-é. Les autres requêtes catégories (sidebar, etc.) sont
    // laissées intactes.
    await page.route(/\/rest\/v1\/categories\?.*slug=eq\.mk-otc-medicaments/i, async (route) => {
      await new Promise((r) => setTimeout(r, DELAY_MS));
      await route.continue();
    });

    await page.goto(`/catalogue?category=${CATEGORY_SLUG}`, { waitUntil: "domcontentloaded" });

    // 1. Skeleton du H1 visible avant que la donnée n'arrive.
    //    Le composant Skeleton shadcn applique `animate-pulse`.
    const h1Skeleton = page
      .locator('h1, [class*="Skeleton"], div')
      .locator(".animate-pulse.rounded-md")
      .first();
    await expect(h1Skeleton).toBeVisible({ timeout: 1000 });

    // 2. Skeleton du breadcrumb (placeholder dans la dernière puce).
    const breadcrumb = page.locator('nav[aria-label="Fil d\'Ariane"]');
    await expect(breadcrumb).toBeVisible();
    const breadcrumbSkeleton = breadcrumb.locator(".animate-pulse").first();
    await expect(breadcrumbSkeleton).toBeVisible({ timeout: 1000 });

    // 3. Pendant ce premier rendu, le slug technique ne doit jamais
    //    être capitalisé et affiché tel quel.
    await expect(page.locator("body")).not.toContainText(/Mk\s+Otc\s+Medicaments/i);
    await expect(breadcrumb).not.toContainText(CATEGORY_SLUG);

    // 4. Une fois la requête résolue, le libellé FR remplace le skeleton.
    await expect(page.locator("h1").first()).toHaveText(EXPECTED_LABEL, {
      timeout: DELAY_MS + 8000,
    });
    await expect(breadcrumb).toContainText(EXPECTED_LABEL);

    // 5. Plus aucun skeleton actif dans la zone titre/breadcrumb.
    await expect(breadcrumb.locator(".animate-pulse")).toHaveCount(0);
  });

  test("au second affichage (cache chaud), aucun skeleton n'apparaît", async ({ page }) => {
    // Premier passage : on chauffe le cache React Query (sans throttle).
    await page.goto(`/catalogue?category=${CATEGORY_SLUG}`);
    await expect(page.locator("h1").first()).toHaveText(EXPECTED_LABEL, { timeout: 15_000 });

    // Navigation interne vers une autre catégorie puis retour : grâce à
    // `placeholderData: keepPreviousData`, le skeleton ne doit pas
    // réapparaître (on rend la donnée mise en cache immédiatement).
    await page.goto(`/catalogue?category=mk-maman-bebe`);
    await expect(page.locator("h1").first()).toHaveText("Maman & bébé", { timeout: 15_000 });

    await page.goto(`/catalogue?category=${CATEGORY_SLUG}`);

    // Le H1 et le breadcrumb doivent être présents immédiatement
    // (label déjà connu) — pas de pulse skeleton dans le breadcrumb.
    const breadcrumb = page.locator('nav[aria-label="Fil d\'Ariane"]');
    await expect(breadcrumb).toContainText(EXPECTED_LABEL, { timeout: 3000 });
    await expect(breadcrumb.locator(".animate-pulse")).toHaveCount(0);
    await expect(page.locator("h1").first()).toHaveText(EXPECTED_LABEL);
  });
});
