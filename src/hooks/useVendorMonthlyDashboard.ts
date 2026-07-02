import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  VENDOR_GMV_ORDER_COLUMNS,
  applyVendorGmvOrderFilters,
  isBillableOrder,
} from "@/lib/vendor-gmv-filters";


/**
 * KPIs enrichis (période paramétrable) pour le tableau de bord vendeur.
 *
 * Source unique : `order_lines` joint sur `orders` (non-forecast + non supprimées
 * + statut facturable), afin d'unifier « CA HTVA », « GMV TTC », « Commandes »,
 * « Marge brute » et « Commission ».
 *
 * ⚠️ Les valeurs de `order_lines` (line_total_incl_vat, line_total_excl_vat,
 * line_margin, commission_amount) sont stockées **en euros** ; on convertit en
 * centimes ici pour rester cohérent avec le reste du dashboard.
 */

export interface CustomerTypeSlice {
  type: string;
  amountCents: number;
}

export interface VendorMonthlyDashboard {
  gmvCents: number;
  revenueExclVatCents: number;
  grossMarginCents: number;
  commissionCents: number;
  netMarginCents: number;
  ordersCount: number;
  dailySeries: Array<{ day: number; date: string; revenueCents: number }>;
  customerTypeBreakdown: CustomerTypeSlice[];
}

/**
 * Voir `src/lib/vendor-gmv-filters.ts` — modèle de filtre partagé aligné
 * strictement sur la RPC `get_vendor_gmv_progress` (source de vérité GMV /
 * paliers commission). Toute exclusion (statuts + drapeaux structurels) est
 * définie une seule fois là-bas.
 */

export interface DashboardPeriod {
  start: Date;
  end: Date;
}


export interface DashboardPeriod {
  start: Date;
  end: Date;
}

function defaultMonthPeriod(): DashboardPeriod {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function useVendorMonthlyDashboard(
  vendorId: string | undefined,
  period?: DashboardPeriod,
) {
  const { start, end, dayCount } = useMemo(() => {
    const p = period ?? defaultMonthPeriod();
    const s = new Date(p.start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(p.end);
    e.setHours(23, 59, 59, 999);
    const diffDays = Math.max(
      1,
      Math.floor((e.getTime() - s.getTime()) / (24 * 3600 * 1000)) + 1,
    );
    return { start: s, end: e, dayCount: diffDays };
  }, [period?.start?.getTime(), period?.end?.getTime()]);

  return useQuery<VendorMonthlyDashboard>({
    queryKey: [
      "vendor-monthly-dashboard",
      vendorId,
      start.toISOString(),
      end.toISOString(),
    ],
    enabled: !!vendorId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(
          `line_total_incl_vat, line_total_excl_vat, line_margin, commission_amount,
           orders!inner ( id, created_at, is_forecast, is_test, status, hidden_from_list, deleted_at,
                          customers:customer_id ( customer_type ) )`,
        )
        .eq("vendor_id", vendorId!)
        .eq("orders.is_forecast", false)
        .eq("orders.is_test", false)
        .gte("orders.created_at", start.toISOString())
        .lte("orders.created_at", end.toISOString());
      if (error) throw error;

      const billable = (data ?? []).filter((l: any) => {
        const o = l.orders;
        if (!o || o.hidden_from_list || o.deleted_at) return false;
        if (o.is_forecast || o.is_test) return false;
        return !EXCLUDED_STATUSES.has(String(o.status ?? "").toLowerCase());
      });

      const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100);

      let gmvCents = 0;
      let revenueExclVatCents = 0;
      let grossMarginCents = 0;
      let commissionCents = 0;
      const daily = new Array(dayCount).fill(0);
      const perType = new Map<string, number>();
      const orderIds = new Set<string>();

      for (const l of billable as any[]) {
        const incl = Number(l.line_total_incl_vat ?? 0);
        const excl = Number(l.line_total_excl_vat ?? 0);
        const margin = Number(l.line_margin ?? 0);
        const commission = Number(l.commission_amount ?? 0);
        gmvCents += toCents(incl);
        revenueExclVatCents += toCents(excl);
        grossMarginCents += toCents(margin);
        commissionCents += toCents(commission);

        const oid = l.orders?.id;
        if (oid) orderIds.add(oid);

        const createdAt = l.orders?.created_at ? new Date(l.orders.created_at) : null;
        if (createdAt) {
          const dayIdx = Math.floor(
            (createdAt.getTime() - start.getTime()) / (24 * 3600 * 1000),
          );
          if (dayIdx >= 0 && dayIdx < dayCount) {
            daily[dayIdx] += toCents(excl);
          }
        }
        const t = l.orders?.customers?.customer_type || "other";
        perType.set(t, (perType.get(t) || 0) + toCents(incl));
      }

      const netMarginCents = grossMarginCents - commissionCents;
      const dailySeries = daily.map((cents: number, i: number) => {
        const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
        return {
          day: i + 1,
          date: d.toISOString().slice(0, 10),
          revenueCents: cents,
        };
      });

      const customerTypeBreakdown: CustomerTypeSlice[] = Array.from(perType.entries())
        .map(([type, amountCents]) => ({ type, amountCents }))
        .sort((a, b) => b.amountCents - a.amountCents);

      return {
        gmvCents,
        revenueExclVatCents,
        grossMarginCents,
        commissionCents,
        netMarginCents,
        ordersCount: orderIds.size,
        dailySeries,
        customerTypeBreakdown,
      };
    },
  });
}
