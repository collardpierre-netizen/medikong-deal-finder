import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardPeriod } from "./useVendorMonthlyDashboard";
import {
  VENDOR_GMV_ORDER_COLUMNS,
  isBillableStatus,
  normalizeOrderStatus,
} from "@/lib/vendor-gmv-filters";

/**
 * Réconciliation CA HTVA ↔ GMV TTC sur la période.
 *
 * Récupère TOUTES les lignes non-forecast/non-test/non-masquées/non-supprimées
 * du vendeur, groupées par statut de commande, avec pour chacun :
 *  - montant HTVA (CA)
 *  - montant TTC (GMV)
 *  - nombre de commandes
 *  - inclus / exclu du calcul CA & GMV
 *
 * Les statuts inclus/exclus proviennent du modèle de filtre partagé
 * `src/lib/vendor-gmv-filters.ts` (aligné sur la RPC `get_vendor_gmv_progress`).
 */


export interface StatusReconciliationRow {
  status: string;
  included: boolean;
  revenueExclVatCents: number;
  gmvInclVatCents: number;
  ordersCount: number;
}

export interface ReconciliationOrder {
  orderId: string;
  orderNumber: string | null;
  createdAt: string | null;
  revenueExclVatCents: number;
  gmvInclVatCents: number;
  linesCount: number;
}

export interface VendorReconciliation {
  rows: StatusReconciliationRow[];
  includedRevenueExclVatCents: number;
  includedGmvInclVatCents: number;
  excludedRevenueExclVatCents: number;
  excludedGmvInclVatCents: number;
  vatCents: number; // GMV inclus - CA inclus
  /**
   * Détail des commandes par statut, trié par GMV décroissant.
   * Alimente le drill-down « cliquer sur une ligne » du composant
   * ReconciliationCard.
   */
  ordersByStatus: Record<string, ReconciliationOrder[]>;
}


export function useVendorReconciliation(
  vendorId: string | undefined,
  period: DashboardPeriod,
) {
  const { startISO, endISO } = useMemo(() => {
    const s = new Date(period.start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(period.end);
    e.setHours(23, 59, 59, 999);
    return { startISO: s.toISOString(), endISO: e.toISOString() };
  }, [period.start?.getTime(), period.end?.getTime()]);

  return useQuery<VendorReconciliation>({
    queryKey: ["vendor-reconciliation", vendorId, startISO, endISO],
    enabled: !!vendorId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(
          `line_total_incl_vat, line_total_excl_vat,
           orders!inner ( ${VENDOR_GMV_ORDER_COLUMNS}, order_number )`,
        )
        .eq("vendor_id", vendorId!)
        .eq("orders.is_forecast", false)
        .eq("orders.is_test", false)
        .gte("orders.created_at", startISO)
        .lte("orders.created_at", endISO);
      if (error) throw error;

      const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
      const perStatus = new Map<
        string,
        { excl: number; incl: number; orderIds: Set<string> }
      >();
      // Détail par (statut, order_id) pour alimenter le drill-down.
      const perStatusOrders = new Map<string, Map<string, ReconciliationOrder>>();

      for (const l of (data ?? []) as any[]) {
        const o = l.orders;
        if (!o || o.hidden_from_list || o.deleted_at) continue;
        const status = normalizeOrderStatus(o.status) || "unknown";
        const cur =
          perStatus.get(status) ??
          { excl: 0, incl: 0, orderIds: new Set<string>() };
        const excl = toCents(l.line_total_excl_vat);
        const incl = toCents(l.line_total_incl_vat);
        cur.excl += excl;
        cur.incl += incl;
        if (o.id) cur.orderIds.add(o.id);
        perStatus.set(status, cur);

        if (o.id) {
          let bucket = perStatusOrders.get(status);
          if (!bucket) {
            bucket = new Map<string, ReconciliationOrder>();
            perStatusOrders.set(status, bucket);
          }
          const existing = bucket.get(o.id);
          if (existing) {
            existing.revenueExclVatCents += excl;
            existing.gmvInclVatCents += incl;
            existing.linesCount += 1;
          } else {
            bucket.set(o.id, {
              orderId: o.id,
              orderNumber: o.order_number ?? null,
              createdAt: o.created_at ?? null,
              revenueExclVatCents: excl,
              gmvInclVatCents: incl,
              linesCount: 1,
            });
          }
        }
      }

      const rows: StatusReconciliationRow[] = Array.from(perStatus.entries())
        .map(([status, v]) => ({
          status,
          included: isBillableStatus(status),
          revenueExclVatCents: v.excl,
          gmvInclVatCents: v.incl,
          ordersCount: v.orderIds.size,
        }))
        .sort((a, b) => {
          if (a.included !== b.included) return a.included ? -1 : 1;
          return b.gmvInclVatCents - a.gmvInclVatCents;
        });

      let includedRevenueExclVatCents = 0;
      let includedGmvInclVatCents = 0;
      let excludedRevenueExclVatCents = 0;
      let excludedGmvInclVatCents = 0;
      for (const r of rows) {
        if (r.included) {
          includedRevenueExclVatCents += r.revenueExclVatCents;
          includedGmvInclVatCents += r.gmvInclVatCents;
        } else {
          excludedRevenueExclVatCents += r.revenueExclVatCents;
          excludedGmvInclVatCents += r.gmvInclVatCents;
        }
      }

      const ordersByStatus: Record<string, ReconciliationOrder[]> = {};
      for (const [status, bucket] of perStatusOrders.entries()) {
        ordersByStatus[status] = Array.from(bucket.values()).sort(
          (a, b) => b.gmvInclVatCents - a.gmvInclVatCents,
        );
      }

      return {
        rows,
        includedRevenueExclVatCents,
        includedGmvInclVatCents,
        excludedRevenueExclVatCents,
        excludedGmvInclVatCents,
        vatCents: includedGmvInclVatCents - includedRevenueExclVatCents,
        ordersByStatus,
      };
    },
  });
}

