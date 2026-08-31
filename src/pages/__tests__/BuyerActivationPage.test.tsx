/**
 * Tests de /compte/activer-acheteur (BuyerActivationPage).
 *
 * Cibles vérifiées :
 *  1. Pré-remplissage UI depuis la ligne `vendors` (raison sociale, TVA, email, téléphone, adresse).
 *  2. Activation : INSERT dans `customers` avec les bons champs + redirection vers `/compte/statut`.
 *
 * Tous les hooks externes (AuthContext, supabase, react-router navigate, Layout) sont mockés
 * pour isoler la logique de la page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---------- Auth mock ----------
let authState = {
  user: { id: "vendor-user-1", email: "tv@destockpharma.com" } as { id: string; email: string } | null,
  hasVendorAccount: true,
  hasCustomerRow: false,
  buyerStatus: "missing" as "verified" | "pending" | "missing" | "anonymous",
  verificationLoading: false,
};
const setAuthState = (patch: Partial<typeof authState>) => {
  authState = { ...authState, ...patch };
};
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

// ---------- react-router navigate spy ----------
const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// ---------- Layout pass-through ----------
vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------- Supabase mock ----------
// Vendor row renvoyé par .from('vendors').select(...).eq(...).maybeSingle()
const vendorRow = {
  id: "v-1",
  name: "Destock Pharma",
  company_name: "Destock Pharma SRL",
  email: "tv@destockpharma.com",
  phone: "+32 471 00 00 00",
  vat_number: "BE0788250902",
  address_line1: "Rue de la Procession 23",
  city: "Ath",
  postal_code: "7822",
  country_code: "BE",
};

const customersInsertSpy = vi.fn().mockResolvedValue({ error: null });
const restockSelectMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const restockInsertSpy = vi.fn().mockResolvedValue({ error: null });
const updateUserSpy = vi.fn().mockResolvedValue({ error: null });
const invokeSpy = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "vendors") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: vendorRow, error: null }),
            }),
          }),
        };
      }
      if (table === "customers") {
        return { insert: (...args: unknown[]) => customersInsertSpy(...args) };
      }
      if (table === "restock_buyers") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => restockSelectMaybeSingle() }),
          }),
          insert: (...args: unknown[]) => restockInsertSpy(...args),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    auth: {
      updateUser: (...args: unknown[]) => updateUserSpy(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => {
        invokeSpy(...args);
        // .catch(() => {}) est utilisé côté page : il faut donc un thenable.
        return Promise.resolve({ data: null, error: null });
      },
    },
  },
}));

// ---------- Toast no-op ----------
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------- Helpers ----------
async function renderPage() {
  const { default: BuyerActivationPage } = await import("@/pages/BuyerActivationPage");
  return render(
    <MemoryRouter>
      <BuyerActivationPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  navigateSpy.mockReset();
  customersInsertSpy.mockClear().mockResolvedValue({ error: null });
  restockSelectMaybeSingle.mockClear().mockResolvedValue({ data: null, error: null });
  restockInsertSpy.mockClear().mockResolvedValue({ error: null });
  updateUserSpy.mockClear().mockResolvedValue({ error: null });
  invokeSpy.mockClear();
  setAuthState({
    user: { id: "vendor-user-1", email: "tv@destockpharma.com" },
    hasVendorAccount: true,
    hasCustomerRow: false,
    buyerStatus: "missing",
    verificationLoading: false,
  });
});

// ---------- Tests ----------

describe("BuyerActivationPage — pré-remplissage depuis vendors", () => {
  it("affiche la raison sociale, le numéro de TVA, l'email, le téléphone et l'adresse du vendeur", async () => {
    await renderPage();

    expect(await screen.findByText("Destock Pharma SRL")).toBeInTheDocument();
    expect(screen.getByText("BE0788250902")).toBeInTheDocument();
    expect(screen.getByText("tv@destockpharma.com")).toBeInTheDocument();
    expect(screen.getByText("+32 471 00 00 00")).toBeInTheDocument();
    expect(
      screen.getByText(/Rue de la Procession 23, 7822 Meslin-l'Évêque \(BE\)/i),
    ).toBeInTheDocument();

    // Les inputs adresse sont aussi pré-remplis depuis la ligne vendor.
    expect((screen.getByLabelText(/Rue et numéro/i) as HTMLInputElement).value).toBe(
      "Rue de la Procession 23",
    );
    expect((screen.getByLabelText(/Code postal/i) as HTMLInputElement).value).toBe("7822");
    expect((screen.getByLabelText(/Ville/i) as HTMLInputElement).value).toBe("Ath");
    expect((screen.getByLabelText(/Pays/i) as HTMLInputElement).value).toBe("BE");
  });
});

describe("BuyerActivationPage — activation", () => {
  it("INSERT dans customers avec les bons champs puis redirige vers /compte/statut", async () => {
    await renderPage();

    // Attendre le pré-remplissage
    await screen.findByText("Destock Pharma SRL");

    // Sélectionner le profil acheteur "Pharmacien"
    fireEvent.click(screen.getByRole("button", { name: /pharmacien/i }));

    // Cliquer sur le CTA d'activation
    fireEvent.click(
      screen.getByRole("button", { name: /Activer mon compte acheteur/i }),
    );

    await waitFor(() => expect(customersInsertSpy).toHaveBeenCalledTimes(1));

    expect(customersInsertSpy).toHaveBeenCalledWith({
      auth_user_id: "vendor-user-1",
      company_name: "Destock Pharma SRL",
      email: "tv@destockpharma.com",
      phone: "+32 471 00 00 00",
      vat_number: "BE0788250902",
      country_code: "BE",
      address_line1: "Rue de la Procession 23",
      city: "Ath",
      postal_code: "7822",
      customer_type: "pharmacy", // pharmacist → pharmacy
      is_verified: false,
    });

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/compte/statut", { replace: true }),
    );

    // ReStock OFF par défaut : aucune ligne restock_buyers ne doit être créée
    expect(restockInsertSpy).not.toHaveBeenCalled();
  });

  it("ne redirige pas et n'appelle pas insert si le profil acheteur n'est pas sélectionné", async () => {
    await renderPage();
    await screen.findByText("Destock Pharma SRL");

    const cta = screen.getByRole("button", { name: /Activer mon compte acheteur/i });
    // Le CTA reste désactivé tant qu'aucun profil n'est sélectionné
    expect(cta).toBeDisabled();
    fireEvent.click(cta);

    expect(customersInsertSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
