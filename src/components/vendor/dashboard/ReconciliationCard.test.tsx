import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ReconciliationCard from "@/components/vendor/dashboard/ReconciliationCard";
import type { VendorReconciliation } from "@/hooks/useVendorReconciliation";

// Force la locale monétaire en fr-BE stable (sinon useTranslation → i18n non init).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "fr" }, t: (k: string) => k }),
}));

const data: VendorReconciliation = {
  rows: [
    { status: "paid", included: true, revenueExclVatCents: 8_000, gmvInclVatCents: 9_680, ordersCount: 1 },
    { status: "shipped", included: true, revenueExclVatCents: 2_000, gmvInclVatCents: 2_420, ordersCount: 1 },
    { status: "cancelled", included: false, revenueExclVatCents: 500, gmvInclVatCents: 605, ordersCount: 1 },
  ],
  includedRevenueExclVatCents: 10_000,
  includedGmvInclVatCents: 12_100,
  excludedRevenueExclVatCents: 500,
  excludedGmvInclVatCents: 605,
  vatCents: 2_100,
  ordersByStatus: {
    paid: [
      { orderId: "o-1", orderNumber: "MK-1001", createdAt: "2026-06-15T10:00:00Z", revenueExclVatCents: 8_000, gmvInclVatCents: 9_680, linesCount: 2 },
    ],
    shipped: [
      { orderId: "o-2", orderNumber: "MK-1002", createdAt: "2026-06-20T10:00:00Z", revenueExclVatCents: 2_000, gmvInclVatCents: 2_420, linesCount: 1 },
    ],
    cancelled: [
      { orderId: "o-3", orderNumber: "MK-1003", createdAt: "2026-06-22T10:00:00Z", revenueExclVatCents: 500, gmvInclVatCents: 605, linesCount: 1 },
    ],
  },
};


describe("ReconciliationCard · totaux et formule GMV − CA", () => {
  it("affiche le total inclus (CA HTVA et GMV TTC) tels que fournis par la source", () => {
    render(<ReconciliationCard data={data} loading={false} periodLabel="Ce mois" />);
    const totalRow = screen
      .getByText(/Total inclus \(= CA \/ GMV du dashboard\)/i)
      .closest("tr")!;
    // 10 000 cents = 100 €, 12 100 cents = 121 €
    expect(within(totalRow).getByText(/100,00/)).toBeInTheDocument();
    expect(within(totalRow).getByText(/121,00/)).toBeInTheDocument();
  });

  it("affiche la TVA collectée = GMV inclus − CA inclus (21 €)", () => {
    render(<ReconciliationCard data={data} loading={false} periodLabel="Ce mois" />);
    const vatLine = screen.getByText(/= TVA collectée/i).closest("div")!;
    // 12 100 − 10 000 = 2 100 cents = 21 €
    expect(within(vatLine).getByText(/21,00/)).toBeInTheDocument();
  });

  it("affiche une ligne « Total exclu » quand au moins un statut est exclu", () => {
    render(<ReconciliationCard data={data} loading={false} periodLabel="Ce mois" />);
    expect(screen.getByText(/Total exclu \(non comptabilisé\)/i)).toBeInTheDocument();
  });

  it("n'affiche pas la ligne « Total exclu » si aucune ligne exclue", () => {
    const clean: VendorReconciliation = {
      ...data,
      rows: data.rows.filter((r) => r.included),
      excludedRevenueExclVatCents: 0,
      excludedGmvInclVatCents: 0,
    };
    render(<ReconciliationCard data={clean} loading={false} periodLabel="Ce mois" />);
    expect(screen.queryByText(/Total exclu \(non comptabilisé\)/i)).not.toBeInTheDocument();
  });

  it("marque les statuts inclus/exclus avec le bon badge Oui/Non", () => {
    render(<ReconciliationCard data={data} loading={false} periodLabel="Ce mois" />);
    const paidRow = screen.getByText("Payée").closest("tr")!;
    const cancelledRow = screen.getByText("Annulée").closest("tr")!;
    expect(within(paidRow).getByText("Oui")).toBeInTheDocument();
    expect(within(cancelledRow).getByText("Non")).toBeInTheDocument();
  });

  it("affiche un état de chargement puis, sans lignes, un message vide", () => {
    const { rerender } = render(
      <ReconciliationCard data={undefined} loading={true} periodLabel="Ce mois" />,
    );
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
    rerender(
      <ReconciliationCard
        data={{
          rows: [],
          includedRevenueExclVatCents: 0,
          includedGmvInclVatCents: 0,
          excludedRevenueExclVatCents: 0,
          excludedGmvInclVatCents: 0,
          vatCents: 0,
        }}
        loading={false}
        periodLabel="Ce mois"
      />,
    );
    expect(screen.getByText(/Aucune commande sur la période/i)).toBeInTheDocument();
  });
});

describe("ReconciliationCard · cohérence arithmétique des totaux", () => {
  it("Σ des lignes incluses correspond aux totaux inclus affichés", () => {
    const sumRevenue = data.rows.filter((r) => r.included).reduce((a, r) => a + r.revenueExclVatCents, 0);
    const sumGmv = data.rows.filter((r) => r.included).reduce((a, r) => a + r.gmvInclVatCents, 0);
    expect(sumRevenue).toBe(data.includedRevenueExclVatCents);
    expect(sumGmv).toBe(data.includedGmvInclVatCents);
  });

  it("vatCents doit être égal à includedGmv − includedRevenue", () => {
    expect(data.vatCents).toBe(
      data.includedGmvInclVatCents - data.includedRevenueExclVatCents,
    );
  });
});
