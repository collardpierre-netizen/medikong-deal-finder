import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SubNav } from "./SubNav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/hooks/useSiteFeatures", () => ({
  useSiteFeatures: () => ({ data: { restockEnabled: false } }),
}));

function getShopTab() {
  return screen.getByRole("link", { name: "nav.shop" });
}

function isUnderlined(el: HTMLElement) {
  // Soulignement = présence du span absolu avec bg-primary
  return el.querySelector("span.bg-primary") !== null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SubNav />
    </MemoryRouter>,
  );
}

describe("SubNav — onglet Shop souligné", () => {
  it("n'est PAS souligné sur la home /", () => {
    renderAt("/");
    expect(isUnderlined(getShopTab())).toBe(false);
  });

  it("est souligné sur /shop", () => {
    renderAt("/shop");
    expect(isUnderlined(getShopTab())).toBe(true);
  });

  it("est souligné sur /catalogue", () => {
    renderAt("/catalogue");
    expect(isUnderlined(getShopTab())).toBe(true);
  });

  it("est souligné sur /catalogue avec query params", () => {
    renderAt("/catalogue?marque=avene");
    expect(isUnderlined(getShopTab())).toBe(true);
  });

  it("est souligné sur /categorie/xxx", () => {
    renderAt("/categorie/cosmetiques");
    expect(isUnderlined(getShopTab())).toBe(true);
  });

  it("n'est PAS souligné sur /marques", () => {
    renderAt("/marques");
    expect(isUnderlined(getShopTab())).toBe(false);
  });
});
