/**
 * Tests E2E (intégration) pour la route legacy /vendeur/:slug.
 *
 * On vérifie 3 invariants critiques :
 *   1. Un slug nominatif (non-display_code) rend la page 410 Gone — pas la
 *      VendorPublicPage et SANS redirect (l'URL reste inchangée).
 *   2. La page injecte bien <meta name="robots" content="noindex,nofollow">
 *      (équivalent SPA du header X-Robots-Tag).
 *   3. Un display_code valide (6 alphanum) NE déclenche PAS la 410.
 *
 * Le gate se trouve dans App.tsx (`VendorRouteGate`) mais on teste ici
 * directement la fonction de détection + le rendu de la page, car monter
 * tout App.tsx alourdirait inutilement le test.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { waitFor } from "@testing-library/react";
import VendorLegacySlugGone, { isLegacyVendorSlug } from "@/pages/VendorLegacySlugGone";

function renderAt(path: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/vendeur/:code" element={<VendorLegacySlugGone />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("isLegacyVendorSlug", () => {
  it("retourne false pour un display_code valide (6 alphanum)", () => {
    expect(isLegacyVendorSlug("ABC123")).toBe(false);
    expect(isLegacyVendorSlug("abcdef")).toBe(false);
    expect(isLegacyVendorSlug("000000")).toBe(false);
  });

  it("retourne true pour les slugs nominatifs (tirets, longueur ≠ 6, non-alphanum)", () => {
    expect(isLegacyVendorSlug("pharma-belgique-sa")).toBe(true);
    expect(isLegacyVendorSlug("acme")).toBe(true); // trop court
    expect(isLegacyVendorSlug("ABCDEFG")).toBe(true); // trop long
    expect(isLegacyVendorSlug("abc_12")).toBe(true); // underscore
    expect(isLegacyVendorSlug("abc 12")).toBe(true); // espace
    expect(isLegacyVendorSlug("")).toBe(false); // pas un slug à 410, route ne match pas
    expect(isLegacyVendorSlug(null)).toBe(false);
    expect(isLegacyVendorSlug(undefined)).toBe(false);
  });
});

describe("VendorLegacySlugGone (page 410)", () => {
  beforeEach(() => {
    // Reset des balises meta injectées par Helmet entre tests
    document.head
      .querySelectorAll('meta[name="robots"], meta[name="googlebot"], title')
      .forEach((el) => el.remove());
  });

  it("rend le contenu 410 Gone pour un slug nominatif (pas de redirect)", () => {
    renderAt("/vendeur/pharma-belgique-sa");

    expect(screen.getByText(/410\s*·\s*Gone/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /cette page n'existe plus/i,
    );
    // Liens de repli présents (pas de redirect côté router)
    expect(screen.getByRole("link", { name: /voir le catalogue/i })).toHaveAttribute(
      "href",
      "/catalogue",
    );
    expect(screen.getByRole("link", { name: /retour à l'accueil/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("injecte <meta name='robots' content='noindex,nofollow'> + googlebot", async () => {
    renderAt("/vendeur/pharma-belgique-sa");

    await waitFor(() => {
      const robots = document.head.querySelector('meta[name="robots"]');
      expect(robots).not.toBeNull();
      expect(robots?.getAttribute("content")).toBe("noindex,nofollow");
    });

    const googlebot = document.head.querySelector('meta[name="googlebot"]');
    expect(googlebot).not.toBeNull();
    expect(googlebot?.getAttribute("content")).toBe("noindex,nofollow");
  });

  it("définit le <title> 410 (signal supplémentaire pour les crawlers)", async () => {
    renderAt("/vendeur/pharma-belgique-sa");
    await waitFor(() => {
      expect(document.title).toMatch(/page supprimée/i);
    });
  });
});
