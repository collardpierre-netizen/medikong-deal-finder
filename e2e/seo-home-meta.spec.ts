import { test, expect } from "@playwright/test";

/**
 * Vérifie que la home rend bien le bon `<title>`, la meta description,
 * les balises Open Graph et la Twitter Card pour FR / NL / EN.
 *
 * Le `<title>` et `<meta name="description">` sont injectés par
 * react-helmet-async via le composant Layout (clé i18n `seo.home*`).
 * Les balises OG/Twitter title+description sont définies en dur dans
 * `index.html` (FR, valeurs par défaut servies au crawler avant exécution
 * du JS) et doivent rester présentes et non vides.
 *
 * La langue UI est résolue via localStorage (`medikong_language`),
 * que l'on positionne avant la navigation initiale.
 */

const I18N_KEY = "medikong_language";

const EXPECTED = {
  fr: {
    title: "MediKong — La marketplace B2B des professionnels de santé en Belgique",
    description:
      "MediKong.pro : comparateur B2B + marketplace pour pharmacies, cabinets médicaux et professionnels de santé en Belgique. Comparez les offres de centaines de fournisseurs, commandez en quelques clics.",
  },
  nl: {
    title: "MediKong — De B2B-marktplaats voor zorgprofessionals in België",
    description:
      "MediKong.pro: B2B-prijsvergelijker en marktplaats voor apotheken, medische praktijken en zorgprofessionals in België. Vergelijk aanbiedingen van honderden leveranciers, bestel in enkele klikken.",
  },
  en: {
    title: "MediKong — The B2B marketplace for healthcare professionals in Belgium",
    description:
      "MediKong.pro: B2B price comparison and marketplace for pharmacies, medical practices and healthcare professionals in Belgium. Compare offers from hundreds of suppliers, order in just a few clicks.",
  },
} as const;

// Valeurs OG/Twitter statiques (FR) injectées par index.html
const STATIC_FR_OG_TITLE =
  "MediKong — La marketplace B2B des professionnels de santé en Belgique";

async function getMeta(page: import("@playwright/test").Page, selector: string) {
  return page.locator(`head ${selector}`).first().getAttribute("content");
}

test.describe("SEO home — title, meta description, OG, Twitter (FR/NL/EN)", () => {
  // Sur 1 seul viewport desktop (les balises <head> ne dépendent pas du viewport)
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "desktop-1280",
    "Test SEO indépendant du viewport — exécuté uniquement sur desktop-1280",
  );

  for (const lang of ["fr", "nl", "en"] as const) {
    test(`rend le bon title + meta description en ${lang.toUpperCase()}`, async ({ page }) => {
      // Préfixe la langue avant le boot de l'app pour que i18next résolve
      // la bonne ressource avant le premier rendu du Helmet.
      await page.addInitScript(
        ({ key, value }) => {
          try {
            window.localStorage.setItem(key, value);
          } catch {
            /* noop */
          }
        },
        { key: I18N_KEY, value: lang },
      );

      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Helmet patche les tags après le mount React → on attend le bon titre.
      await expect.poll(() => page.title(), { timeout: 10_000 }).toBe(EXPECTED[lang].title);

      const description = await getMeta(page, 'meta[name="description"]');
      expect(description).toBe(EXPECTED[lang].description);
    });
  }

  test("expose des balises OG et Twitter Card non vides", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const ogTitle = await getMeta(page, 'meta[property="og:title"]');
    const ogDescription = await getMeta(page, 'meta[property="og:description"]');
    const ogImage = await getMeta(page, 'meta[property="og:image"]');
    const ogType = await getMeta(page, 'meta[property="og:type"]');
    const twitterCard = await getMeta(page, 'meta[name="twitter:card"]');
    const twitterTitle = await getMeta(page, 'meta[name="twitter:title"]');
    const twitterDescription = await getMeta(page, 'meta[name="twitter:description"]');
    const twitterImage = await getMeta(page, 'meta[name="twitter:image"]');

    // Présence
    for (const [name, value] of Object.entries({
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
    })) {
      expect(value, `${name} should be set`).toBeTruthy();
    }

    // Cohérence avec le pivot pro de santé (statique FR dans index.html)
    expect(ogTitle).toBe(STATIC_FR_OG_TITLE);
    expect(twitterTitle).toBe(STATIC_FR_OG_TITLE);
    expect(ogType).toBe("website");
    expect(twitterCard).toBe("summary_large_image");

    // Pas de wording obsolète "Fournitures médicales B2B"
    expect(ogTitle).not.toMatch(/Fournitures m[ée]dicales B2B/i);
    expect(twitterTitle).not.toMatch(/Fournitures m[ée]dicales B2B/i);
  });
});
