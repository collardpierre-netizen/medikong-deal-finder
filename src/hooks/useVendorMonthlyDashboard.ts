import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * KPIs mensuels enrichis pour le tableau de bord vendeur :
 *  - GMV TTC (Σ line_total_incl_vat des lignes non-forecast facturables)
 *  - Marge brute (Σ line_margin)
 *  - Commission MediKong (Σ order_lines.commission_amount)
 *  - Marge nette = marge brute − commission
 *  - Série journalière du CA HTVA
 *  - Ventilation TTC par profil client
 *
 * Les paliers de commission négociée sont désormais exposés séparément via
 * `useVendorGmvProgress` (source : table margin_rule_tiers).
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
  dailySeries: Array<{ day: number; date: string; revenueCents: number }>;
  customerTypeBreakdown: CustomerTypeSlice[];
}

const EXCLUDED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "refunded",
  "failed",
  "rejected",
]);


export function useVendorMonthlyDashboard(vendorId: string | undefined) {
  const { start, daysInMonth } = useMemo(() => {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: s, daysInMonth: end.getDate() };
  }, []);

  return useQuery<VendorMonthlyDashboard>({
    queryKey: ["vendor-monthly-dashboard", vendorId, start.toISOString()],
    enabled: !!vendorId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(
          `line_total_incl_vat, line_total_excl_vat, line_margin, commission_amount,
           orders!inner ( id, created_at, is_forecast, status, hidden_from_list, deleted_at,
                          customers:customer_id ( customer_type ) )`,
        )
        .eq("vendor_id", vendorId!)
        .eq("orders.is_forecast", false)
        .gte("orders.created_at", start.toISOString());
      if (error) throw error;

      const billable = (data ?? []).filter((l: any) => {
        const o = l.orders;
        if (!o || o.hidden_from_list || o.deleted_at) return false;
        return !EXCLUDED_STATUSES.has(String(o.status ?? "").toLowerCase());
      });

      const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 1;

      let gmvCents = 0;
      let revenueExclVatCents = 0;
      let grossMarginCents = 0;
      let commissionCents = 0;
      const daily = new Array(daysInMonth).fill(0);
      const perType = new Map<string, number>();

      for (const l of billable as any[]) {
        const incl = Number(l.line_total_incl_vat ?? 0);
        const excl = Number(l.line_total_excl_vat ?? 0);
        const margin = Number(l.line_margin ?? 0);
        const commission = Number(l.commission_amount ?? 0);
        gmvCents += toCents(incl);
        revenueExclVatCents += toCents(excl);
        grossMarginCents += toCents(margin);
        commissionCents += toCents(commission);

        const createdAt = l.orders?.created_at ? new Date(l.orders.created_at) : null;
        if (createdAt) {
          const dayIdx = createdAt.getDate() - 1;
          if (dayIdx >= 0 && dayIdx < daysInMonth) {
            daily[dayIdx] += toCents(excl);
          }
        }
        const t = l.orders?.customers?.customer_type || "other";
        perType.set(t, (perType.get(t) || 0) + toCents(incl));
      }

      const netMarginCents = grossMarginCents - commissionCents;
      const dailySeries = daily.map((cents: number, i: number) => {
        const d = new Date(start.getFullYear(), start.getMonth(), i + 1);
        return { day: i + 1, date: d.toISOString().slice(0, 10), revenueCents: cents };
      });

      const customerTypeBreakdown: CustomerTypeSlice[] = Array.from(perType.entries())
        .map(([type, amountCents]) => ({ type, amountCents }))
        .sort((a, b) => b.amountCents - a.amountCents);

      const commissionTier = resolveTier(gmvCents);

      return {
        gmvCents,
        revenueExclVatCents,
        grossMarginCents,
        commissionCents,
        netMarginCents,
        dailySeries,
        customerTypeBreakdown,
        commissionTier,
      };
    },
  });
}
