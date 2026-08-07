import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Product } from "@/hooks/useProducts";

/**
 * Régression « + 0 autre offre » :
 * le nombre affiché dans le bouton doit TOUJOURS correspondre à la taille
 * réelle de la liste d'offres affichée au clic (visibles + masquées).
 */

const offersState: { data: any[]; isLoading: boolean } = { data: [], isLoading: false };
const batchState: { bestOffer: any; hasContext: boolean } = { bestOffer: null, hasContext: true };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

vi.mock("@/hooks/useLocalizedProductField", () => ({
  useLocalizedProductField: (_id: string, _p: any, _f: string, fallback: any) => fallback,
}));

vi.mock("@/hooks/useProducts", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProducts")>("@/hooks/useProducts");
  return {
    ...actual,
    useProductOffers: () => ({
      data: offersState.data,
      isLoading: offersState.isLoading,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

vi.mock("@/contexts/BestOffersContext", () => ({
  useBestOfferForProduct: () => ({
    bestOffer: batchState.bestOffer,
    hasContext: batchState.hasContext,
    isLoading: false,
    isError: false,
    errorCode: null,
  }),
}));

import SearchTrivagoCard from "../SearchTrivagoCard";

function makeOffer(i: number) {
  return {
    id: `o${i}`,
    sellerName: `Fournisseur ${i}`,
    unitPriceEur: 10 + i,
    unitPriceInclVat: (10 + i) * 1.21,
    deliveryDays: 2,
    isVerified: true,
    stockQuantity: 100,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "produit-test",
    name: "Produit Test",
    brand: "MarqueX",
    gtin: "5400123456789",
    cnk: "1234567",
    ean: "5400123456789",
    price: 10,
    pub: 15,
    pct: 17,
    sellers: 1,
    rating: 0,
    reviews: 0,
    best: "Meilleur prix",
    unit: "unité",
    stock: true,
    mk: true,
    imageUrls: [],
    ...overrides,
  } as Product;
}

function extraCountFromLabel(): number {
  const btn = screen.getByRole("button", { name: /autres? offres?/i });
  const m = btn.textContent?.match(/\+\s*(\d+)/);
  return m ? Number(m[1]) : NaN;
}

/** Nombre de lignes d'offre secondaire réellement rendues (chacune a un bouton « Voir »). */
function renderedOfferRows(): number {
  return screen.queryAllByRole("button", { name: /^Voir$/ }).length;
}

function renderCard(product: Product) {
  return render(
    <MemoryRouter>
      <SearchTrivagoCard product={product} />
    </MemoryRouter>
  );
}

beforeAll(() => {
  // jsdom n'implémente pas IntersectionObserver (prefetch au scroll)
  (globalThis as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("SearchTrivagoCard — cohérence compteur / liste d'offres", () => {
  it.each([2, 3, 6, 12])(
    "affiche exactement N-1 autres offres pour %i offres au total",
    (total) => {
      const offers = Array.from({ length: total }, (_, i) => makeOffer(i + 1));
      offersState.data = offers;
      offersState.isLoading = false;
      batchState.hasContext = true;
      // Compteur batch volontairement sous-estimé (cas du bug d'origine)
      batchState.bestOffer = {
        offerId: "o1",
        sellerName: "Fournisseur 1",
        unitPriceEur: 11,
        deliveryDays: 2,
        isVerified: true,
        offerCount: 1,
        isExclusiveWinner: false,
      };

      const { unmount } = renderCard(makeProduct({ sellers: 1 }));

      const expected = total - 1; // toutes sauf la meilleure offre
      expect(extraCountFromLabel()).toBe(expected);

      // Clic 1 : ouvre la liste (2 premières visibles + le reste masqué)
      fireEvent.click(screen.getByRole("button", { name: /autres? offres?/i }));
      // Clic 2 sur « Moins d'offres » n'est pas voulu : on vérifie l'état ouvert
      expect(renderedOfferRows()).toBe(expected);
      unmount();
    }
  );

  it("ne descend jamais sous le compteur connu tant que les offres chargent", () => {
    offersState.data = [];
    offersState.isLoading = true;
    batchState.hasContext = true;
    batchState.bestOffer = {
      offerId: "o1",
      sellerName: "Fournisseur 1",
      unitPriceEur: 11,
      deliveryDays: 2,
      isVerified: true,
      offerCount: 37,
      isExclusiveWinner: false,
    };

    renderCard(makeProduct({ sellers: 37 }));
    expect(extraCountFromLabel()).toBe(36);
  });

  it("n'affiche aucun bloc « autre offre » quand il n'y a qu'une seule offre connue", () => {
    offersState.data = [makeOffer(1)];
    offersState.isLoading = false;
    batchState.hasContext = true;
    batchState.bestOffer = {
      offerId: "o1",
      sellerName: "Fournisseur 1",
      unitPriceEur: 11,
      deliveryDays: 2,
      isVerified: true,
      offerCount: 1,
      isExclusiveWinner: false,
    };

    renderCard(makeProduct({ sellers: 1 }));
    expect(screen.queryByRole("button", { name: /autres? offres?/i })).toBeNull();
  });
});
