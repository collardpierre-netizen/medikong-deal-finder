import { describe, it, expect } from "vitest";
import { checkVendorTotalsConsistency } from "./vendor-gmv-consistency";
import type { VendorMonthlyDashboard } from "@/hooks/useVendorMonthlyDashboard";
import type { VendorReconciliation } from "@/hooks/useVendorReconciliation";

function monthly(over: Partial<VendorMonthlyDashboard> = {}): VendorMonthlyDashboard {
  return {
    gmvCents: 12_100,
    revenueExclVatCents: 10_000,
    grossMarginCents: 3_000,
    commissionCents: 1_000,
    netMarginCents: 2_000,
    ordersCount: 2,
    avgBasketCents: 5_000,
    dailySeries: [],
    customerTypeBreakdown: [],
    topProducts: [],
    commissionSplit: { tradingCents: 0, marketplaceCents: 0, otherCents: 0 },
    sourceSplit: {
      manualCents: 0,
      siteCents: 0,
      manualOrders: 0,
      siteOrders: 0,
      manualCommissionCents: 0,
      siteCommissionCents: 0,
    },
    ...over,
  };
}

function reconciliation(over: Partial<VendorReconciliation> = {}): VendorReconciliation {
  const base: VendorReconciliation = {
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
    ordersByStatus: {},
    ...over,
  };

  return base;
}

describe("checkVendorTotalsConsistency", () => {
  it("no data → ok, no issues", () => {
    const r = checkVendorTotalsConsistency(undefined, undefined);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("cohérent → ok, aucune anomalie", () => {
    const r = checkVendorTotalsConsistency(monthly(), reconciliation());
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("tolère 1 centime d'arrondi par ligne incluse", () => {
    // 2 lignes incluses → tolérance = max(2, 2) = 2 centimes
    const r = checkVendorTotalsConsistency(
      monthly({ gmvCents: 12_102, revenueExclVatCents: 10_002 }),
      reconciliation(),
    );
    expect(r.ok).toBe(true);
    expect(r.toleranceCents).toBe(2);
  });

  it("détecte un écart GMV au-delà de la tolérance", () => {
    const r = checkVendorTotalsConsistency(
      monthly({ gmvCents: 12_500 }),
      reconciliation(),
    );
    expect(r.ok).toBe(false);
    const gmv = r.issues.find((i) => i.code === "gmv_mismatch");
    expect(gmv).toBeDefined();
    expect(gmv && "deltaCents" in gmv.details && gmv.details.deltaCents).toBe(400);
  });

  it("détecte un écart CA HTVA au-delà de la tolérance", () => {
    const r = checkVendorTotalsConsistency(
      monthly({ revenueExclVatCents: 9_500 }),
      reconciliation(),
    );
    expect(r.issues.some((i) => i.code === "revenue_mismatch")).toBe(true);
  });

  it("détecte un écart de nombre de commandes (sans tolérance)", () => {
    const r = checkVendorTotalsConsistency(
      monthly({ ordersCount: 3 }),
      reconciliation(),
    );
    const orders = r.issues.find((i) => i.code === "orders_mismatch");
    expect(orders).toBeDefined();
  });

  it("détecte une TVA arithmétique incohérente (vatCents ≠ GMV − CA)", () => {
    const r = checkVendorTotalsConsistency(
      monthly(),
      reconciliation({ vatCents: 999 }),
    );
    const vat = r.issues.find((i) => i.code === "vat_arithmetic");
    expect(vat).toBeDefined();
    expect(vat && "deltaCents" in vat.details && vat.details.deltaCents).toBe(2_100 - 999);
  });

  it("les lignes exclues ne comptent pas dans la tolérance ni dans les totaux inclus", () => {
    // La ligne cancelled (excluded=true) ne doit pas gonfler la tolérance
    const r = checkVendorTotalsConsistency(monthly(), reconciliation());
    expect(r.toleranceCents).toBe(2); // 2 rows included, pas 3
  });
});
