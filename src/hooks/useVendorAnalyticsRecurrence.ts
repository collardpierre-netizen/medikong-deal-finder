import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeRange, useAnalyticsVendorId, type AnalyticsPeriod } from "./useVendorAnalytics";

export interface RecurrenceRow {
  new_customers: number;
  returning_customers: number;
  total_customers: number;
  avg_orders_per_customer: number;
  avg_days_between_orders: number;
  churn_risk_count: number;
}

export function useVendorAnalyticsRecurrence(period: AnalyticsPeriod) {
  const { from, to } = computeRange(period);
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-recurrence", period, vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_recurrence", {
        _from: from, _to: to, _vendor_id: vendorId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as RecurrenceRow | null;
    },
    staleTime: 60_000,
  });
}

export interface CohortRow {
  cohort_month: string;
  cohort_size: number;
  active_m1: number;
  active_m2: number;
  active_m3: number;
}

export function useVendorAnalyticsCohorts(months = 12) {
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-cohorts", months, vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_cohorts", {
        _months: months, _vendor_id: vendorId,
      });
      if (error) throw error;
      return (data ?? []) as CohortRow[];
    },
    staleTime: 60_000,
  });
}

export interface CustomerLocationRow {
  country_code: string;
  postal_code: string;
  city: string;
  customers_count: number;
  orders_count: number;
  ca_htva_cents: number;
}

export function useVendorAnalyticsCustomerLocations(period: AnalyticsPeriod, productId?: string | null) {
  const { from, to } = computeRange(period);
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-locations", period, vendorId, productId ?? null],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_customer_locations", {
        _from: from, _to: to, _vendor_id: vendorId, _product_id: productId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as CustomerLocationRow[];
    },
    staleTime: 5 * 60_000,
  });
}
