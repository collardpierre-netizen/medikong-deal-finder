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
  formatEurBe as formatEurBeClient,
  roundEur as roundEurClient,
  type CagnotteVatMode,
} from "@/lib/cagnotte-vat";
import {
  computeVatBase as computeVatBaseServer,
  cagnotteVatModeLabel as labelServer,
  formatEurBe as formatEurBeServer,
  roundEur as roundEurServer,
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
  const formatEUR = formatEurBeServer;
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

/** Lit la chaîne affichée en face d'un libellé du récapitulatif rendu. */
function readRowText(label: string): string {
  const dt = screen.getByText(label, { selector: "dt, dt *" });
  const row = dt.closest("div");
  return (row?.querySelector("dd")?.textContent ?? "").trim();
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

      // 4 bis) Formatage belge strictement identique (virgule décimale, 2 décimales)
      expect(readRowText("Sous-total HT")).toBe(email.subtotalHt);
      expect(readRowText("Cagnotte MediKong utilisée")).toBe(`− ${email.cagnotteUsed}`);
      expect(readRowText("Base TVA")).toBe(email.vatBase);
      expect(readRowText("TVA")).toBe(email.vatAmount);
      expect(readRowText("Net à payer")).toBe(email.netToPay);
      for (const label of ["Sous-total HT", "Base TVA", "TVA", "Total TTC", "Net à payer"]) {
        expect(readRowText(label)).toMatch(/^-?\d{1,3}(\u00A0\d{3})*,\d{2}\u00A0€$/);
      }

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

  describe("arrondi et formatage belge", () => {
    it.each([
      [1.005, 1.01],
      [8.575, 8.58],
      [2.675, 2.68],
      [-1.005, -1.01],
      [0.004, 0],
    ])("roundEur(%s) === %s côté client et serveur", (input, expected) => {
      expect(roundEurClient(input)).toBe(expected);
      expect(roundEurServer(input)).toBe(expected);
    });

    it.each([
      [0, "0,00\u00A0€"],
      [9.5, "9,50\u00A0€"],
      [1234.5, "1\u00A0234,50\u00A0€"],
      [1234567.891, "1\u00A0234\u00A0567,89\u00A0€"],
      [-45, "-45,00\u00A0€"],
    ])("formatEurBe(%s) === %s côté client et serveur", (input, expected) => {
      expect(formatEurBeClient(input)).toBe(expected);
      expect(formatEurBeServer(input)).toBe(expected);
    });

    it("TVA + base = total TTC après arrondi (mode discount)", () => {
      const b = computeVatBaseClient(1234.567, 100.005, "discount", 0.21);
      expect(roundEurClient(b.vat_base + b.vat_amount)).toBe(b.total_ttc);
      expect(b.net_to_pay).toBe(b.total_ttc);
    });

    it("net à payer = total TTC − cagnotte après arrondi (mode payment)", () => {
      const b = computeVatBaseClient(1234.567, 100.005, "payment", 0.21);
      expect(roundEurClient(b.vat_base + b.vat_amount)).toBe(b.total_ttc);
      expect(roundEurClient(b.total_ttc - 100.01)).toBe(b.net_to_pay);
    });
  });
});
