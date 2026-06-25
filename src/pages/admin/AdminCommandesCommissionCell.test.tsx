import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdminCommandesCommissionCell } from "./AdminCommandesCommissionCell";
import { computeCommissionFromLines } from "@/lib/order-commission-fallback";
import type { VendorCommissionConfig } from "@/lib/vendorMargin";

/**
 * Garde-fou /admin/commandes : quand aucun override n'est stocké et que
 * draft_payload est vide, la cellule Commission doit afficher le montant
 * recalculé par computeCommissionFromLines (et JAMAIS "—").
 */
function renderCell(props: React.ComponentProps<typeof AdminCommandesCommissionCell>) {
  return render(
    <table>
      <tbody>
        <tr>
          <AdminCommandesCommissionCell {...props} />
        </tr>
      </tbody>
    </table>,
  );
}

describe("AdminCommandesCommissionCell (fallback commission /admin/commandes)", () => {
  it("affiche le montant recalculé (pas '—') quand stored vide + draft vide + lines fallback > 0", () => {
    const vendors = new Map<string, VendorCommissionConfig>([
      ["v-flat", { commission_model: "flat_percentage", commission_rate: 10 }],
    ]);
    const commission = computeCommissionFromLines(
      [{ vendor_id: "v-flat", quantity: 10, unit_price_excl_vat: 12, cost_price: 8 }],
      vendors,
    );
    expect(commission).toBeCloseTo(12, 5);

    const ca = 10 * 12;
    renderCell({
      commissionEur: commission,
      commissionPct: (commission / ca) * 100,
      commissionSource: "computed",
    });

    const cell = screen.getByTestId("commission-cell");
    expect(within(cell).queryByText("—")).toBeNull();
    expect(within(cell).getByText("12,00")).toBeInTheDocument();
    expect(within(cell).getByText("10.00 %")).toBeInTheDocument();
    expect(cell.getAttribute("title")).toContain("recalculée depuis les lignes");
  });

  it("affiche '—' uniquement quand commission = 0 (override 0 % ou aucune donnée)", () => {
    renderCell({ commissionEur: 0, commissionPct: 0, commissionSource: "none" });
    const cell = screen.getByTestId("commission-cell");
    expect(within(cell).getByText("—")).toBeInTheDocument();
    expect(cell.getAttribute("title")).toBe("Aucune commission enregistrée");
  });

  it("source 'stored' → tooltip mentionne l'override enregistré", () => {
    renderCell({ commissionEur: 42, commissionPct: 7, commissionSource: "stored" });
    const cell = screen.getByTestId("commission-cell");
    expect(cell.getAttribute("title")).toContain("override enregistré");
    expect(within(cell).queryByText("—")).toBeNull();
  });

  it("source 'draft' → tooltip mentionne le brouillon", () => {
    renderCell({ commissionEur: 5, commissionPct: 5, commissionSource: "draft" });
    expect(screen.getByTestId("commission-cell").getAttribute("title")).toContain("calculé depuis le brouillon");
  });
});
