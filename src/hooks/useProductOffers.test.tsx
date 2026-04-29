import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/**
 * Tests d'intégration pour useProductOffers : vérifie que le prix HTVA
 * affiché change correctement selon le buyer_profile_id (RPC override) et
 * selon l'offer_id (chaque offre est résolue indépendamment).
 *
 * On mocke @/integrations/supabase/client + les contextes (Country, Buyer profile)
 * pour ne tester que la cascade de résolution prix dans le hook.
 */

// ---------- Mocks ----------
const mockBuyerProfileId = vi.fn<() => string | null>();
vi.mock("@/hooks/useResolvedOfferPrice", () => ({
  useBuyerProfileId: () => mockBuyerProfileId(),
}));

vi.mock("@/contexts/CountryContext", () => ({
  useCountry: () => ({ country: "BE" }),
}));

vi.mock("@/lib/vendor-display", () => ({
  resolveVendorVisibility: () => true,
  getVendorPublicName: (v: any) => v?.name || "Vendor",
}));

vi.mock("@/lib/catalog-filters", () => ({
  applyHiddenCategoryFilter: (q: any) => q,
}));

// Le mock supabase doit gérer .from(table).select().eq().eq().order() / .in() / .maybeSingle()
// + .rpc(name, args) + .auth.getUser()
const offersFixture = [
  {
    id: "offer-A",
    product_id: "prod-1",
    vendor_id: "vendor-1",
    price_excl_vat: 10,
    price_incl_vat: 12.1,
    stock_quantity: 5,
    moq: 1,
    is_active: true,
  },
  {
    id: "offer-B",
    product_id: "prod-1",
    vendor_id: "vendor-2",
    price_excl_vat: 15,
    price_incl_vat: 18.15,
    stock_quantity: 3,
    moq: 1,
    is_active: true,
  },
];

/** Map des prix retournés par la RPC selon (offer_id, buyer_profile_id). */
const rpcPriceMatrix: Record<string, Record<string, { price_excl_vat: number; source: string }>> = {
  "offer-A": {
    pharmacien: { price_excl_vat: 9.5, source: "offer_absolute" },
    grossiste: { price_excl_vat: 8.0, source: "offer_absolute" },
    autre: { price_excl_vat: 10, source: "offer_base" }, // pas d'override
  },
  "offer-B": {
    pharmacien: { price_excl_vat: 14.0, source: "offer_absolute" },
    grossiste: { price_excl_vat: 12.5, source: "offer_absolute" },
    autre: { price_excl_vat: 15, source: "offer_base" },
  },
};

vi.mock("@/integrations/supabase/client", () => {
  const fromHandler = (table: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => {
        if (table === "offers") return Promise.resolve({ data: offersFixture, error: null });
        return Promise.resolve({ data: [], error: null });
      },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: undefined,
    };
    if (table === "offers") {
      // .from('offers').select('*').eq().eq().order() — order termine la chaine
      return chain;
    }
    if (table === "vendors_public") {
      chain.in = () =>
        Promise.resolve({
          data: [
            { id: "vendor-1", name: "V1", display_code: "V1ABCD" },
            { id: "vendor-2", name: "V2", display_code: "V2ABCD" },
          ],
        });
      return chain;
    }
    if (table === "discount_tiers" || table === "vendor_visibility_rules" || table === "offer_price_tiers") {
      chain.in = () => ({ order: () => Promise.resolve({ data: [] }) });
      // Cas sans .order après .in (vendor_visibility_rules)
      const inResult: any = Promise.resolve({ data: [] });
      inResult.order = () => Promise.resolve({ data: [] });
      chain.in = () => inResult;
      return chain;
    }
    if (table === "profiles") {
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
      return chain;
    }
    if (table === "product_prices") {
      // Pas de prix legacy par défaut
      return chain;
    }
    return chain;
  };

  return {
    supabase: {
      from: fromHandler,
      rpc: vi.fn((name: string, args: any) => {
        if (name === "resolve_offer_price_for_profile") {
          const oid = args._offer_id as string;
          const bpid = args._buyer_profile_id as string;
          const row = rpcPriceMatrix[oid]?.[bpid];
          return Promise.resolve({ data: row ? [row] : null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    },
  };
});

// Import APRÈS les mocks
import { useProductOffers } from "./useProducts";

// ---------- Helpers ----------
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

// ---------- Tests ----------
describe("useProductOffers — prix par profil et par offer_id", () => {
  beforeEach(() => {
    mockBuyerProfileId.mockReset();
  });

  it("profil 'pharmacien' : applique l'override RPC sur chaque offre", async () => {
    mockBuyerProfileId.mockReturnValue("pharmacien");
    const { result } = renderHook(() => useProductOffers("prod-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const offers = result.current.data!;
    const a = offers.find((o) => o.id === "offer-A")!;
    const b = offers.find((o) => o.id === "offer-B")!;
    expect(a.unitPriceEur).toBe(9.5);
    expect(b.unitPriceEur).toBe(14.0);
  });

  it("profil 'grossiste' : retourne des prix DIFFÉRENTS pour les mêmes offres", async () => {
    mockBuyerProfileId.mockReturnValue("grossiste");
    const { result } = renderHook(() => useProductOffers("prod-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const offers = result.current.data!;
    const a = offers.find((o) => o.id === "offer-A")!;
    const b = offers.find((o) => o.id === "offer-B")!;
    expect(a.unitPriceEur).toBe(8.0);
    expect(b.unitPriceEur).toBe(12.5);
  });

  it("profil 'autre' (RPC retombe sur offer_base) : retourne le prix de base de l'offre", async () => {
    mockBuyerProfileId.mockReturnValue("autre");
    const { result } = renderHook(() => useProductOffers("prod-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const offers = result.current.data!;
    const a = offers.find((o) => o.id === "offer-A")!;
    const b = offers.find((o) => o.id === "offer-B")!;
    expect(a.unitPriceEur).toBe(10);
    expect(b.unitPriceEur).toBe(15);
  });

  it("recalcule le TVAC en appliquant le ratio TVA de chaque offre", async () => {
    mockBuyerProfileId.mockReturnValue("pharmacien");
    const { result } = renderHook(() => useProductOffers("prod-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const a = result.current.data!.find((o) => o.id === "offer-A")!;
    // ratio = 12.1 / 10 = 1.21 ; 9.5 * 1.21 = 11.495 → arrondi à 11.5
    expect(a.unitPriceInclVat).toBe(11.5);
  });

  it("re-trie les offres par prix résolu croissant après application des overrides", async () => {
    mockBuyerProfileId.mockReturnValue("grossiste");
    const { result } = renderHook(() => useProductOffers("prod-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const offers = result.current.data!;
    expect(offers[0].id).toBe("offer-A"); // 8.0 < 12.5
    expect(offers[1].id).toBe("offer-B");
    expect(offers[0].unitPriceEur).toBeLessThan(offers[1].unitPriceEur);
  });
});
