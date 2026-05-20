/**
 * Tests de la garde d'accès (gate) de /bonnes-affaires.
 *
 * On vérifie que le titre, la description et les CTA affichés dépendent
 * bien de `buyerStatus` + `hasVendorAccount` exposés par AuthContext :
 *
 *   1. anonymous              → "Se connecter"
 *   2. missing + vendor       → "Activer mon compte acheteur" + "Retour au portail vendeur"
 *   3. missing seul           → "Créer mon profil acheteur"
 *   4. pending                → "Voir l'état de mon compte"
 *   5. verified               → la page principale s'affiche (header "Bonnes affaires")
 *
 * Tous les hooks de données sont mockés : on isole la logique de gating.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom n'implémente pas ResizeObserver — Radix Slider en a besoin pour
// le rendu de la page principale (cas "verified").
if (typeof globalThis.ResizeObserver === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------- Mocks ----------

// AuthContext — contrôlé par chaque test via setAuthState()
let authState: {
  user: { id: string } | null;
  isVerifiedBuyer: boolean;
  verificationLoading: boolean;
  buyerStatus: "verified" | "pending" | "missing" | "anonymous";
  hasVendorAccount: boolean;
} = {
  user: null,
  isVerifiedBuyer: false,
  verificationLoading: false,
  buyerStatus: "anonymous",
  hasVendorAccount: false,
};
const setAuthState = (patch: Partial<typeof authState>) => {
  authState = { ...authState, ...patch };
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/contexts/CountryContext", () => ({
  useCountry: () => ({ currentCountry: "BE", setCurrentCountry: () => {} }),
}));

vi.mock("@/hooks/useDiscountSearch", () => ({
  useDiscountSearch: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
    hasNextPage: false,
    refetch: () => Promise.resolve(),
  }),
  useDiscountByVendor: () => ({
    data: [],
    isLoading: false,
    isFetching: false,
    refetch: () => Promise.resolve(),
  }),
  fetchAllDiscountResults: () => Promise.resolve([]),
}));

vi.mock("@/hooks/usePvpVsMarketComparison", () => ({
  usePvpVsMarketComparison: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          order: () => ({
            range: () => Promise.resolve({ data: [], error: null }),
          }),
          range: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

// Layout: pass-through pour ne pas dépendre du header global (qui appelle
// d'autres contextes/hooks non mockés).
vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// PriceTypeInfo : composant lourd (tooltip) qui n'est pas testé ici.
vi.mock("@/components/product/PriceTypeInfo", () => ({
  PriceTypeInfo: () => null,
}));

// ---------- Helpers ----------

async function renderPage() {
  const { default: BonnesAffairesPage } = await import("@/pages/BonnesAffairesPage");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BonnesAffairesPage />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  cleanup();
  setAuthState({
    user: null,
    isVerifiedBuyer: false,
    verificationLoading: false,
    buyerStatus: "anonymous",
    hasVendorAccount: false,
  });
});

// ---------- Tests ----------

describe("BonnesAffairesPage — gate par buyerStatus", () => {
  it("anonyme : affiche le CTA 'Se connecter' vers /connexion", async () => {
    setAuthState({
      user: null,
      buyerStatus: "anonymous",
      isVerifiedBuyer: false,
    });
    await renderPage();

    expect(
      screen.getByText(/réservé aux acheteurs vérifiés/i),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /se connecter/i });
    expect(cta).toHaveAttribute("href", "/connexion");
  });

  it("missing + vendor : propose 'Activer mon compte acheteur' + retour vendeur", async () => {
    setAuthState({
      user: { id: "u1" },
      buyerStatus: "missing",
      hasVendorAccount: true,
      isVerifiedBuyer: false,
    });
    await renderPage();

    expect(
      screen.getByText(/activez aussi votre compte acheteur/i),
    ).toBeInTheDocument();
    const primary = screen.getByRole("link", {
      name: /activer mon compte acheteur/i,
    });
    expect(primary).toHaveAttribute("href", "/compte/activer-acheteur");
    const secondary = screen.getByRole("link", {
      name: /retour au portail vendeur/i,
    });
    expect(secondary).toHaveAttribute("href", "/vendor");
    // Garde-fou anti-régression : on ne propose PAS le CTA trompeur d'antan.
    expect(
      screen.queryByRole("link", { name: /compléter ma vérification/i }),
    ).toBeNull();
  });

  it("missing seul : propose 'Créer mon profil acheteur'", async () => {
    setAuthState({
      user: { id: "u2" },
      buyerStatus: "missing",
      hasVendorAccount: false,
      isVerifiedBuyer: false,
    });
    await renderPage();

    expect(screen.getByText(/créer un profil acheteur/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", {
      name: /créer mon profil acheteur/i,
    });
    expect(cta).toHaveAttribute("href", "/onboarding?role=buyer");
    expect(
      screen.queryByRole("link", { name: /retour au portail vendeur/i }),
    ).toBeNull();
  });

  it("pending : propose 'Voir l'état de mon compte'", async () => {
    setAuthState({
      user: { id: "u3" },
      buyerStatus: "pending",
      hasVendorAccount: false,
      isVerifiedBuyer: false,
    });
    await renderPage();

    expect(
      screen.getByText(/compte en attente de validation/i),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", {
      name: /voir l'état de mon compte/i,
    });
    expect(cta).toHaveAttribute("href", "/compte");
  });

  it("verified : la page principale (header 'Bonnes affaires') s'affiche", async () => {
    setAuthState({
      user: { id: "u4" },
      buyerStatus: "verified",
      hasVendorAccount: false,
      isVerifiedBuyer: true,
    });
    await renderPage();

    // Le gate ne doit PAS apparaître
    expect(
      screen.queryByText(/réservé aux acheteurs vérifiés/i),
    ).toBeNull();
    expect(screen.queryByText(/créer un profil acheteur/i)).toBeNull();
    expect(
      screen.queryByText(/activez aussi votre compte acheteur/i),
    ).toBeNull();
    expect(
      screen.queryByText(/compte en attente de validation/i),
    ).toBeNull();
  });

  it("verificationLoading : affiche un skeleton (ni gate ni page)", async () => {
    setAuthState({
      user: { id: "u5" },
      verificationLoading: true,
      buyerStatus: "anonymous",
      isVerifiedBuyer: false,
    });
    await renderPage();

    expect(
      screen.queryByText(/réservé aux acheteurs vérifiés/i),
    ).toBeNull();
    expect(screen.queryByText(/créer un profil acheteur/i)).toBeNull();
  });
});
