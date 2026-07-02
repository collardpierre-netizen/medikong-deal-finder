import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * KPIs mensuels enrichis pour le tableau de bord vendeur :
 *  - GMV TTC (Σ line_total_incl_vat des lignes non-forecast facturables)
 *  - Marge brute (Σ line_margin) — cohérent avec useVendorDashboardKpis
 *  - Commission MediKong (Σ order_lines.commission_amount)
 *  - Marge nette = marge brute − commission
 *  - Série journalière du CA HTVA (1..N jours du mois en cours)
 *  - Ventilation TTC par profil client (customers.customer_type)
 *  - Palier de commission négociée (placeholder — voir NEGOTIATED_TIERS)
 *
 * NB commission : `order_lines.commission_amount` est stocké au moment de la
 * commande (source de vérité côté finance) ; on somme directement plutôt que
 * de rejouer la RPC `resolve_effective_commission` (perf + cohérence).
 *
 * NB paliers : aucune table `vendor_commission_negotiated_tiers` n'existe
 * encore côté DB — j'utilise ici une échelle locale par défaut (5k / 15k / 30k
 * EUR TTC) à titre de démonstration. À remplacer par la vraie source dès
 * qu'elle est modélisée. Aucun changement de schéma effectué (strict scope).
 */

export interface CustomerTypeSlice {
  type: string;
  amountCents: number;
}

export interface CommissionTierState {
  isPlaceholder: boolean;
  currentPct: number | null;
  nextPct: number | null;
  thresholdCents: number | null;
  gmvCents: number;
  progressPct: number;
  remainingCents: number;
}

export interface VendorMonthlyDashboard {
  gmvCents: number;
  revenueExclVatCents: number;
  grossMarginCents: number;
  commissionCents: number;
  netMarginCents: number;
  dailySeries: Array<{ day: number; date: string; revenueCents: number }>;
  customerTypeBreakdown: CustomerTypeSlice[];
  commissionTier: CommissionTierState | null;
}

// Placeholder — à remplacer par la source réelle des paliers négociés.
const NEGOTIATED_TIERS: Array<{ upToGmvCents: number; ratePct: number }> = [
  { upToGmvCents: 500_000, ratePct: 20 }, //   0 –  5 000 EUR : 20 %
  { upToGmvCents: 1_500_000, ratePct: 17 }, // 5 000 – 15 000 EUR : 17 %
  { upToGmvCents: 3_000_000, ratePct: 15 }, // 15 000 – 30 000 EUR : 15 %
  { upToGmvCents: Number.POSITIVE_INFINITY, ratePct: 12 }, // > 30 000 EUR : 12 %
];

const EXCLUDED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "refunded",
  "failed",
  "rejected",
]);

function resolveTier(gmvCents: number): CommissionTierState {
  let cumulative = 0;
  for (let i = 0; i < NEGOTIATED_TIERS.length; i++) {
    const tier = NEGOTIATED_TIERS[i];
    if (gmvCents < tier.upToGmvCents) {
      const next = NEGOTIATED_TIERS[i + 1];
      const rangeStart = cumulative;
      const rangeEnd = Number.isFinite(tier.upToGmvCents)
        ? tier.upToGmvCents
        : rangeStart + gmvCents; // dernier palier : pas de barre
      const progressPct = Number.isFinite(tier.upToGmvCents)
        ? Math.min(100, ((gmvCents - rangeStart) / (rangeEnd - rangeStart)) * 100)
        : 100;
      return {
        isPlaceholder: true,
        currentPct: tier.ratePct,
        nextPct: next ? next.ratePct : null,
        thresholdCents: Number.isFinite(tier.upToGmvCents) ? tier.upToGmvCents : null,
        gmvCents,
        progressPct,
        remainingCents: Number.isFinite(tier.upToGmvCents)
          ? Math.max(0, tier.upToGmvCents - gmvCents)
          : 0,
      };
    }
    cumulative = tier.upToGmvCents;
  }
  const last = NEGOTIATED_TIERS[NEGOTIATED_TIERS.length - 1];
  return {
    isPlaceholder: true,
    currentPct: last.ratePct,
    nextPct: null,
    thresholdCents: null,
    gmvCents,
    progressPct: 100,
    remainingCents: 0,
  };
}

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
