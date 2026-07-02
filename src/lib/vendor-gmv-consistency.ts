import type { VendorMonthlyDashboard } from "@/hooks/useVendorMonthlyDashboard";
import type { VendorReconciliation } from "@/hooks/useVendorReconciliation";

/**
 * Vérifications de cohérence côté client entre les deux totalisateurs
 * CA HTVA / GMV TTC calculés à partir de `order_lines` :
 *  - `useVendorMonthlyDashboard`  → totaux affichés dans les KPI + carte commission
 *  - `useVendorReconciliation`    → totaux affichés dans la carte réconciliation
 *
 * Les deux hooks lisent la même source (order_lines + orders!inner) avec le
 * même modèle de filtre partagé (`src/lib/vendor-gmv-filters.ts`, aligné sur la
 * RPC `get_vendor_gmv_progress`). Un écart signale forcément une divergence
 * (données changées entre les 2 requêtes, filtre oublié, cache incohérent, ou
 * régression de la RPC). On tolère 1 centime par ligne pour absorber les
 * arrondis euros → cents.
 */

export type ConsistencyIssue =
  | {
      code: "gmv_mismatch";
      message: string;
      details: { monthlyCents: number; reconciliationCents: number; deltaCents: number };
    }
  | {
      code: "revenue_mismatch";
      message: string;
      details: { monthlyCents: number; reconciliationCents: number; deltaCents: number };
    }
  | {
      code: "orders_mismatch";
      message: string;
      details: { monthlyCount: number; reconciliationCount: number };
    }
  | {
      code: "vat_arithmetic";
      message: string;
      details: { expectedCents: number; reportedCents: number; deltaCents: number };
    };

export interface ConsistencyReport {
  ok: boolean;
  issues: ConsistencyIssue[];
  toleranceCents: number;
}

function toleranceFor(rows: number): number {
  // 1 cent d'arrondi par ligne agrégée, plancher à 2 cents.
  return Math.max(2, rows);
}

export function checkVendorTotalsConsistency(
  monthly: VendorMonthlyDashboard | undefined | null,
  reconciliation: VendorReconciliation | undefined | null,
): ConsistencyReport {
  if (!monthly || !reconciliation) {
    return { ok: true, issues: [], toleranceCents: 0 };
  }

  const includedRows = reconciliation.rows.filter((r) => r.included);
  const tol = toleranceFor(includedRows.length);
  const issues: ConsistencyIssue[] = [];

  const gmvDelta =
    monthly.gmvCents - reconciliation.includedGmvInclVatCents;
  if (Math.abs(gmvDelta) > tol) {
    issues.push({
      code: "gmv_mismatch",
      message:
        "Écart GMV TTC détecté entre les KPI mensuels et la carte de réconciliation.",
      details: {
        monthlyCents: monthly.gmvCents,
        reconciliationCents: reconciliation.includedGmvInclVatCents,
        deltaCents: gmvDelta,
      },
    });
  }

  const revenueDelta =
    monthly.revenueExclVatCents - reconciliation.includedRevenueExclVatCents;
  if (Math.abs(revenueDelta) > tol) {
    issues.push({
      code: "revenue_mismatch",
      message:
        "Écart CA HTVA détecté entre les KPI mensuels et la carte de réconciliation.",
      details: {
        monthlyCents: monthly.revenueExclVatCents,
        reconciliationCents: reconciliation.includedRevenueExclVatCents,
        deltaCents: revenueDelta,
      },
    });
  }

  const reconciliationOrdersCount = includedRows.reduce(
    (acc, r) => acc + r.ordersCount,
    0,
  );
  // Une commande peut avoir plusieurs statuts n'a pas de sens (1 order = 1 status)
  // donc les compteurs doivent coïncider exactement.
  if (monthly.ordersCount !== reconciliationOrdersCount) {
    issues.push({
      code: "orders_mismatch",
      message:
        "Nombre de commandes divergent entre les KPI mensuels et la carte de réconciliation.",
      details: {
        monthlyCount: monthly.ordersCount,
        reconciliationCount: reconciliationOrdersCount,
      },
    });
  }

  const expectedVat =
    reconciliation.includedGmvInclVatCents -
    reconciliation.includedRevenueExclVatCents;
  const vatDelta = expectedVat - reconciliation.vatCents;
  if (Math.abs(vatDelta) > tol) {
    issues.push({
      code: "vat_arithmetic",
      message:
        "La TVA collectée annoncée ne correspond pas à GMV − CA sur la même période.",
      details: {
        expectedCents: expectedVat,
        reportedCents: reconciliation.vatCents,
        deltaCents: vatDelta,
      },
    });
  }

  return { ok: issues.length === 0, issues, toleranceCents: tol };
}
