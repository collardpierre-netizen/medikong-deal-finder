import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountMembersPanel } from "./AccountMembersPanel";

// Mock supabase client
const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const memberRow = {
    id: "m1",
    user_id: "user-1",
    role: "member",
    status: "active",
    invited_email: "sarah@example.com",
    accepted_at: "2026-01-01",
    created_at: "2026-01-01",
  };

  const builder = (rows: any[]) => {
    const result = Promise.resolve({ data: rows, error: null });
    const b: any = {
      select: () => b,
      eq: () => b,
      in: () => b,
      is: () => b,
      order: () => result,
      then: (...args: any[]) => result.then(...args),
    };
    return b;
  };

  return {
    supabase: {
      from: (table: string) => {
        if (table === "account_memberships") return builder([memberRow]);
        if (table === "profiles")
          return builder([{ id: "user-1", full_name: "Sarah Test" }]);
        if (table === "account_invitations") return builder([]);
        return builder([]);
      },
      functions: { invoke: (...args: any[]) => invokeMock(...args) },
      rpc: vi.fn(),
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AccountMembersPanel
        accountKind="vendor"
        accountId="acc-1"
        canManage={true}
        ownerUserId={null}
      />
    </QueryClientProvider>,
  );
}

describe("AccountMembersPanel — reset password failure", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("affiche le détail d'erreur quand l'envoi de l'email échoue", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "SMTP refused: invalid recipient" },
    });

    renderPanel();

    // Attendre que le membre soit affiché
    await waitFor(() =>
      expect(screen.getByText("Sarah Test")).toBeInTheDocument(),
    );

    // Cliquer sur le bouton Reset MDP (titre du Button)
    const resetBtn = screen.getByTitle(
      "Envoyer un email de réinitialisation du mot de passe",
    );
    fireEvent.click(resetBtn);

    // Confirmer dans l'AlertDialog
    const confirmBtn = await screen.findByRole("button", { name: /confirmer/i });
    fireEvent.click(confirmBtn);

    // Le dialogue d'erreur s'affiche avec le détail
    await waitFor(() =>
      expect(screen.getByText("Erreur d'envoi")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("L'email n'a pas pu être envoyé."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("SMTP refused: invalid recipient"),
    ).toBeInTheDocument();
  });
});
