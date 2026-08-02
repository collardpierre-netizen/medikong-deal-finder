/**
 * Test end-to-end (contrat UI ↔ email) — Cagnotte MediKong & TVA.
 *
 * Vérifie que le récapitulatif affiché sur la page de confirmation
 * (composant `OrderCagnotteRecap`, helper client `src/lib/cagnotte-vat.ts`)
 * correspond EXACTEMENT aux montants injectés dans l'email transactionnel
 * `order-confirmation` (helper serveur `supabase/functions/_shared/cagnotte-vat.ts`,
 * payload construit par `stripe-webhook` / `check-session-status`),
 * dans les deux modes TVA : `payment` et `discount`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  computeVatBase as computeVatBaseClient,
  cagnotteVatModeLabel as labelClient,
  type CagnotteVatMode,
} from "@/lib/cagnotte-vat";
import {
  computeVatBase as computeVatBaseServer,
  cagnotteVatModeLabel as labelServer,
} from "../../supabase/functions/_shared/cagnotte-vat.ts";

// --- Mock du hook settings (piloté par /admin/cagnotte en prod) --------------
let mockSettings: { vatMode: CagnotteVatMode; raw: Record<string, unknown> } = {
  vatMode: "payment",
  raw: { cagnotte_vat_rate: 0.21 },
};

vi.mock("@/hooks/useCagnotte", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCagnotte")>("@/hooks/useCagnotte");
  return {
    ...actual,
    useCagnotteSettings: () => ({ data: mockSettings }),
  };
});

// Import après le mock
const { OrderCagnotteRecap } = await import("@/components/cagnotte/OrderCagnotteRecap");

/** Miroir exact du payload email construit côté edge functions. */
function buildEmailPayload(
  subtotalHt: number,
  cagnotteUsed: number,
  vatMode: CagnotteVatMode,
  vatRate: number,
  fullVatAmount?: number,
) {
  const formatEUR = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  const b = computeVatBaseServer(subtotalHt, cagnotteUsed, vatMode, vatRate, fullVatAmount);
  return {
    cagnotteUsed: formatEUR(cagnotteUsed),
    subtotalHt: formatEUR(subtotalHt),
    vatBase: formatEUR(b.vat_base),
    vatAmount: formatEUR(b.vat_amount),
    vatBaseHint:
      vatMode === "discount"
        ? "HT net (sous-total − cagnotte)"
        : "HT plein (la cagnotte est un moyen de paiement)",
    vatModeLabel: labelServer(vatMode),
    netToPay: formatEUR(b.net_to_pay),
  };
}

/** Extrait un nombre d'un libellé monétaire FR ("1 234,56 €" / "− 45,00 €"). */
function toNumber(text: string): number {
  const normalized = text
    .replace(/[\u00A0\u202F\s]/g, "")
    .replace(/[€]|EUR/g, "")
    .replace(/[−–-]/g, "-")
    .replace(",", ".");
  return Number(normalized);
}

/** Lit la valeur affichée en face d'un libellé du récapitulatif rendu. */
function readRow(label: string): number {
  const dt = screen.getByText(label, { selector: "dt, dt *" });
  const row = dt.closest("div");
  const value = row?.querySelector("dd")?.textContent ?? "";
  return toNumber(value);
}

const CASES: Array<{
  mode: CagnotteVatMode;
  subtotalHt: number;
  cagnotteUsed: number;
  vatRate: number;
  fullVatAmount?: number;
}> = [
  { mode: "payment", subtotalHt: 1000, cagnotteUsed: 45, vatRate: 0.21 },
  { mode: "discount", subtotalHt: 1000, cagnotteUsed: 45, vatRate: 0.21 },
  // TVA réelle multi-taux (6 % / 21 %) fournie par orders.vat_amount
  { mode: "payment", subtotalHt: 5456, cagnotteUsed: 109.12, vatRate: 0.21, fullVatAmount: 742.35 },
  { mode: "discount", subtotalHt: 5456, cagnotteUsed: 109.12, vatRate: 0.21, fullVatAmount: 742.35 },
  // Cagnotte plafonnée par le sous-total
  { mode: "discount", subtotalHt: 80.5, cagnotteUsed: 24.15, vatRate: 0.06 },
];

describe("Cagnotte MediKong & TVA — confirmation UI == email transactionnel", () => {
  beforeEach(() => cleanup());

  it.each(CASES)(
    "mode $mode : HT $subtotalHt / cagnotte $cagnotteUsed → montants identiques UI et email",
    ({ mode, subtotalHt, cagnotteUsed, vatRate, fullVatAmount }) => {
      mockSettings = { vatMode: mode, raw: { cagnotte_vat_rate: vatRate } };

      // 1) Les deux helpers (client + miroir serveur) doivent être strictement alignés
      const client = computeVatBaseClient(subtotalHt, cagnotteUsed, mode, vatRate, fullVatAmount);
      const server = computeVatBaseServer(subtotalHt, cagnotteUsed, mode, vatRate, fullVatAmount);
      expect(client).toEqual(server);
      expect(labelClient(mode)).toBe(labelServer(mode));

      // 2) Payload email
      const email = buildEmailPayload(subtotalHt, cagnotteUsed, mode, vatRate, fullVatAmount);

      // 3) Rendu de la page de confirmation
      render(
        <OrderCagnotteRecap
          subtotalHt={subtotalHt}
          cagnotteUsed={cagnotteUsed}
          fullVatAmount={fullVatAmount}
        />,
      );

      // 4) Comparaison ligne par ligne
      expect(readRow("Sous-total HT")).toBeCloseTo(toNumber(email.subtotalHt), 2);
      expect(Math.abs(readRow("Cagnotte MediKong utilisée"))).toBeCloseTo(
        toNumber(email.cagnotteUsed),
        2,
      );
      expect(readRow("Base TVA")).toBeCloseTo(toNumber(email.vatBase), 2);
      expect(readRow("TVA")).toBeCloseTo(toNumber(email.vatAmount), 2);
      expect(readRow("Net à payer")).toBeCloseTo(toNumber(email.netToPay), 2);

      // 5) Libellés de mode et note de base TVA identiques
      expect(screen.getByText(email.vatModeLabel)).toBeTruthy();
      expect(screen.getByText(email.vatBaseHint)).toBeTruthy();
    },
  );

  it("n'affiche rien si aucune cagnotte n'a été utilisée (l'email n'inclut pas le bloc non plus)", () => {
    mockSettings = { vatMode: "payment", raw: { cagnotte_vat_rate: 0.21 } };
    const { container } = render(<OrderCagnotteRecap subtotalHt={1000} cagnotteUsed={0} />);
    expect(container.textContent).toBe("");
  });
});
