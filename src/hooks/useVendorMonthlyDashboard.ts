import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  VENDOR_GMV_ORDER_COLUMNS,
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

export interface TopProductSlice {
  productId: string;
  productName: string;
  quantity: number;
  revenueCents: number;
  commissionCents: number;
  netMarginCents: number;
  hasCost: boolean;
}

export interface CommissionSplit {
  tradingCents: number;      // commission_basis = 'margin' (100% marge)
  marketplaceCents: number;  // commission_basis = 'ca' (% du CA)
  otherCents: number;        // basis inconnu / null
}

export interface SourceSplit {
  manualCents: number;       // orders.source = 'manual_admin' OU created_by_admin
  siteCents: number;         // le reste (checkout site)
  manualOrders: number;
  siteOrders: number;
  manualCommissionCents: number;
  siteCommissionCents: number;
}

export interface VendorMonthlyDashboard {
  gmvCents: number;
  revenueExclVatCents: number;
  grossMarginCents: number;
  commissionCents: number;
  netMarginCents: number;
  ordersCount: number;
  avgBasketCents: number;
  dailySeries: Array<{
    day: number;
    date: string;
    revenueCents: number;
    commissionCents: number;
    netMarginCents: number;
  }>;
  customerTypeBreakdown: CustomerTypeSlice[];
  topProducts: TopProductSlice[];
  commissionSplit: CommissionSplit;
  sourceSplit: SourceSplit;
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
          `product_id, quantity, line_total_incl_vat, line_total_excl_vat, line_margin, commission_amount, commission_computed, commission_basis,
           products:product_id ( name ),
           orders!inner ( ${VENDOR_GMV_ORDER_COLUMNS}, source, created_by_admin,
                          customers:customer_id ( customer_type ) )`,
        )
        .eq("vendor_id", vendorId!)
        .eq("orders.is_forecast", false)
        .eq("orders.is_test", false)
        .gte("orders.created_at", start.toISOString())
        .lte("orders.created_at", end.toISOString());
      if (error) throw error;

      const billable = (data ?? []).filter((l: any) => isBillableOrder(l.orders));

      const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100);

      let gmvCents = 0;
      let revenueExclVatCents = 0;
      let grossMarginCents = 0;
      let commissionCents = 0;
      const daily = Array.from({ length: dayCount }, () => ({
        revenue: 0,
        commission: 0,
        netMargin: 0,
      }));
      const perType = new Map<string, number>();
      const orderIds = new Set<string>();
      const manualOrderIds = new Set<string>();
      const siteOrderIds = new Set<string>();
      const perProduct = new Map<
        string,
        {
          productId: string;
          productName: string;
          quantity: number;
          revenueCents: number;
          commissionCents: number;
          netMarginCents: number;
          costKnown: boolean;
        }
      >();

      const commissionSplit: CommissionSplit = {
        tradingCents: 0,
        marketplaceCents: 0,
        otherCents: 0,
      };
      const sourceSplit: SourceSplit = {
        manualCents: 0,
        siteCents: 0,
        manualOrders: 0,
        siteOrders: 0,
        manualCommissionCents: 0,
        siteCommissionCents: 0,
      };

      for (const l of billable as any[]) {
        const incl = Number(l.line_total_incl_vat ?? 0);
        const excl = Number(l.line_total_excl_vat ?? 0);
        const margin = Number(l.line_margin ?? 0);
        const commission = Number(l.commission_amount ?? 0);
        const qty = Number(l.quantity ?? 0);
        const inclC = toCents(incl);
        const exclC = toCents(excl);
        const marginC = toCents(margin);
        const commC = toCents(commission);
        const netC = marginC - commC;
        gmvCents += inclC;
        revenueExclVatCents += exclC;
        grossMarginCents += marginC;
        commissionCents += commC;

        // Split commission trading vs marketplace via commission_basis
        const basis = (l.commission_basis as string | null) ?? null;
        if (basis === "margin") commissionSplit.tradingCents += commC;
        else if (basis === "ca") commissionSplit.marketplaceCents += commC;
        else commissionSplit.otherCents += commC;

        // Split ventes manuelles vs site (source='manual_admin' OU created_by_admin non null)
        const isManual =
          l.orders?.source === "manual_admin" || l.orders?.created_by_admin != null;
        if (isManual) {
          sourceSplit.manualCents += exclC;
          sourceSplit.manualCommissionCents += commC;
        } else {
          sourceSplit.siteCents += exclC;
          sourceSplit.siteCommissionCents += commC;
        }

        const oid = l.orders?.id;
        if (oid) {
          orderIds.add(oid);
          if (isManual) manualOrderIds.add(oid);
          else siteOrderIds.add(oid);
        }

        const createdAt = l.orders?.created_at ? new Date(l.orders.created_at) : null;
        if (createdAt) {
          const dayIdx = Math.floor(
            (createdAt.getTime() - start.getTime()) / (24 * 3600 * 1000),
          );
          if (dayIdx >= 0 && dayIdx < dayCount) {
            daily[dayIdx].revenue += exclC;
            daily[dayIdx].commission += commC;
            daily[dayIdx].netMargin += netC;
          }
        }
        const t = l.orders?.customers?.customer_type || "other";
        perType.set(t, (perType.get(t) || 0) + inclC);

        const pid = l.product_id as string | null;
        if (pid) {
          const prev = perProduct.get(pid) ?? {
            productId: pid,
            productName: l.products?.name || "Produit",
            quantity: 0,
            revenueCents: 0,
            commissionCents: 0,
            netMarginCents: 0,
            costKnown: false,
          };
          prev.quantity += qty;
          prev.revenueCents += exclC;
          prev.commissionCents += commC;
          prev.netMarginCents += netC;
          if (marginC !== 0) prev.costKnown = true;
          perProduct.set(pid, prev);
        }
      }

      sourceSplit.manualOrders = manualOrderIds.size;
      sourceSplit.siteOrders = siteOrderIds.size;

      const netMarginCents = grossMarginCents - commissionCents;
      const dailySeries = daily.map((d, i) => {
        const dt = new Date(start.getTime() + i * 24 * 3600 * 1000);
        return {
          day: i + 1,
          date: dt.toISOString().slice(0, 10),
          revenueCents: d.revenue,
          commissionCents: d.commission,
          netMarginCents: d.netMargin,
        };
      });

      const customerTypeBreakdown: CustomerTypeSlice[] = Array.from(perType.entries())
        .map(([type, amountCents]) => ({ type, amountCents }))
        .sort((a, b) => b.amountCents - a.amountCents);

      const topProducts: TopProductSlice[] = Array.from(perProduct.values())
        .map((p) => ({
          productId: p.productId,
          productName: p.productName,
          quantity: p.quantity,
          revenueCents: p.revenueCents,
          commissionCents: p.commissionCents,
          netMarginCents: p.netMarginCents,
          hasCost: p.costKnown,
        }))
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 8);

      const avgBasketCents = orderIds.size > 0 ? Math.round(revenueExclVatCents / orderIds.size) : 0;

      return {
        gmvCents,
        revenueExclVatCents,
        grossMarginCents,
        commissionCents,
        netMarginCents,
        ordersCount: orderIds.size,
        avgBasketCents,
        dailySeries,
        customerTypeBreakdown,
        topProducts,
        commissionSplit,
        sourceSplit,
      };
    },
  });
}
