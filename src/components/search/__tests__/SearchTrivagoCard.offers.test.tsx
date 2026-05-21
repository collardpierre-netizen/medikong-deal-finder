import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SearchTrivagoCard from "../SearchTrivagoCard";
import type { Product } from "@/hooks/useProducts";

// Mock useProductOffers — keep empty so the card falls back to product-level
// (sellers/price) for the "best deal" panel. This reproduces what /fabricant/:slug
// renders after the useManufacturerProducts mapping was normalised via mapDbProduct.
vi.mock("@/hooks/useProducts", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProducts")>("@/hooks/useProducts");
  return {
    ...actual,
    useProductOffers: () => ({ data: [], isLoading: false, isError: false }),
  };
});

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "produit-test",
    name: "Produit Test",
    brand: "MarqueX",
    gtin: "5400123456789",
    cnk: "1234567",
    ean: "5400123456789",
    price: 12.5,
    pub: 15.13,
    pct: 17,
    sellers: 3,
    rating: 0,
    reviews: 0,
    best: "Meilleur prix",
    unit: "unité",
    stock: true,
    mk: true,
    imageUrls: [],
    ...overrides,
  };
}

function renderCard(product: Product) {
  return render(
    <MemoryRouter>
      <SearchTrivagoCard product={product} />
    </MemoryRouter>
  );
}

describe("SearchTrivagoCard — offres sur /fabricant/:slug", () => {
  it("affiche le panneau Meilleur prix quand sellers > 0 et price > 0", () => {
    renderCard(makeProduct());
    expect(screen.getByText("Meilleur prix")).toBeInTheDocument();
    expect(screen.getByText(/12[.,]50/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voir l'offre/i })).toBeInTheDocument();
    expect(screen.getByText(/3 offres/)).toBeInTheDocument();
    expect(screen.queryByText("Pas encore d'offre")).not.toBeInTheDocument();
  });

  it("affiche 'Pas encore d'offre' quand sellers = 0", () => {
    renderCard(makeProduct({ sellers: 0, price: 0, mk: false }));
    expect(screen.getByText("Pas encore d'offre")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Voir l'offre/i })).not.toBeInTheDocument();
  });
});
