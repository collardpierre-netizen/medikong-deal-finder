import { test, expect } from "@playwright/test";

/**
 * Vérifie que la page catalogue branchée sur la taxonomie maîtresse
 * (slugs `mk-*`) affiche le nom traduit (FR par défaut) partout dans
 * la chrome — H1, fil d'Ariane, chip de filtre actif — et que le
 * compteur reflète bien les ~363 produits associés à `mk-otc-medicaments`
 * (filtrés via `primary_category_id` + `category_descendants`).
 *
 * Régressions couvertes :
 *  - H1 = "OTC & Médicaments" (et non "Mk Otc Medicaments")
 *  - Breadcrumb idem (ne capitalise plus le slug)
 *  - Chip "Catégorie: OTC & Médicaments"
 *  - Toolbar : compteur >= 300 (~363 attendus, tolérance large pour
 *    absorber les fluctuations de stock / activations admin)
 *  - Aucun "Mk " ni le slug brut visible dans la zone titre/sidebar
 */

const CATEGORY_SLUG = "mk-otc-medicaments";
const EXPECTED_LABEL = "OTC & Médicaments";

test.describe("Catalogue — catégorie maîtresse mk-*", () => {
  test.use({ viewport: { width: 1366, height: 800 } });

  test(`/catalogue?category=${CATEGORY_SLUG} affiche le libellé FR + ~363 produits`, async ({
    page,
  }) => {
    await page.goto(`/catalogue?category=${CATEGORY_SLUG}`);

    // 1. H1 traduit
    const h1 = page.locator("h1").first();
    await expect(h1).toHaveText(EXPECTED_LABEL, { timeout: 15_000 });

    // 2. Breadcrumb : dernier item = libellé traduit (et pas le slug capitalisé)
    const breadcrumb = page.locator('nav[aria-label="Fil d\'Ariane"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText(EXPECTED_LABEL);
    await expect(breadcrumb).not.toContainText(/Mk\s+Otc/i);
    await expect(breadcrumb).not.toContainText(CATEGORY_SLUG);

    // 3. Chip "Catégorie: ..." dans ActiveFilters
    const chip = page.getByText(`Catégorie: ${EXPECTED_LABEL}`);
    await expect(chip).toBeVisible();

    // 4. Compteur de la toolbar : >= 300 (tolérance large autour de 363)
    //    Format attendu : "363 produits" ou "1 234 produits".
    const toolbar = page.getByText(/\d[\d\s\u202f]*\s+produits?/i).first();
    await expect(toolbar).toBeVisible({ timeout: 15_000 });
    const toolbarText = (await toolbar.textContent()) ?? "";
    const count = Number(toolbarText.replace(/[^\d]/g, ""));
    expect(count).toBeGreaterThanOrEqual(300);
    expect(count).toBeLessThanOrEqual(600);

    // 5. Aucun slug technique mk-* visible dans la zone titre
    const titleZone = page.locator("main, #root").first();
    await expect(titleZone).not.toContainText(CATEGORY_SLUG);
  });

  test(`/categorie/${CATEGORY_SLUG} (route param) affiche le même libellé`, async ({ page }) => {
    await page.goto(`/categorie/${CATEGORY_SLUG}`);
    await expect(page.locator("h1").first()).toHaveText(EXPECTED_LABEL, { timeout: 15_000 });
    await expect(page.locator('nav[aria-label="Fil d\'Ariane"]')).toContainText(EXPECTED_LABEL);
  });

  test("mk-maman-bebe : esperluette correctement rendue (pas 'Mannan')", async ({ page }) => {
    await page.goto("/catalogue?category=mk-maman-bebe");
    const h1 = page.locator("h1").first();
    await expect(h1).toHaveText("Maman & bébé", { timeout: 15_000 });
    await expect(page.locator("body")).not.toContainText(/Mannan/i);
  });
});
