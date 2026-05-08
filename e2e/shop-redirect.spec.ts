import { test, expect } from "@playwright/test";

/**
 * Vérifie que /shop (et variantes) redirigent côté client vers /catalogue
 * en préservant query params et hash. Lovable hosting ne supportant pas les
 * 301 serveur, la redirection est faite par React Router (HTTP 200 + JS).
 */
const cases = [
  { from: "/shop", expected: "/catalogue", search: "" },
  { from: "/shop/", expected: "/catalogue", search: "" },
  { from: "/shop?marque=avene", expected: "/catalogue", search: "?marque=avene" },
  {
    from: "/shop?marque=avene&page=2#top",
    expected: "/catalogue",
    search: "?marque=avene&page=2",
    hash: "#top",
  },
];

for (const c of cases) {
  test(`redirige ${c.from} → ${c.expected}${c.search}${c.hash ?? ""}`, async ({ page }) => {
    await page.goto(c.from);
    await page.waitForURL((url) => url.pathname === c.expected, { timeout: 10_000 });

    const url = new URL(page.url());
    expect(url.pathname).toBe(c.expected);
    expect(url.search).toBe(c.search);
    if (c.hash) expect(url.hash).toBe(c.hash);
  });
}
