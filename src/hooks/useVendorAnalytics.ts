import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "./useCurrentVendor";

export type AnalyticsPeriod = "30d" | "90d" | "12m" | "ytd";

export function computeRange(period: AnalyticsPeriod): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  if (period === "30d") from.setDate(from.getDate() - 30);
  else if (period === "90d") from.setDate(from.getDate() - 90);
  else if (period === "12m") from.setMonth(from.getMonth() - 12);
  else if (period === "ytd") {
    from.setMonth(0);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function useAnalyticsVendorId(): string | null {
  const { data } = useCurrentVendor();
  return (data?.id as string | undefined) ?? null;
}

export interface AnalyticsKpis {
  ca_htva_cents: number;
  margin_cents: number;
  commission_cents: number;
  orders_count: number;
  active_customers: number;
  avg_basket_cents: number;
  prev_ca_htva_cents: number;
  prev_margin_cents: number;
  prev_commission_cents: number;
  prev_orders_count: number;
  prev_active_customers: number;
  prev_avg_basket_cents: number;
}

export function useVendorAnalyticsKpis(period: AnalyticsPeriod) {
  const { from, to } = computeRange(period);
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-kpis", period, vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_kpis", {
        _from: from, _to: to, _vendor_id: vendorId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as AnalyticsKpis | null;
    },
    staleTime: 60_000,
  });
}

export interface ByCustomerTypeRow {
  customer_type: string;
  ca_htva_cents: number;
  orders_count: number;
  share: number;
}
export function useVendorAnalyticsByCustomerType(period: AnalyticsPeriod) {
  const { from, to } = computeRange(period);
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-by-type", period, vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_by_customer_type", {
        _from: from, _to: to, _vendor_id: vendorId,
      });
      if (error) throw error;
      return (data ?? []) as ByCustomerTypeRow[];
    },
    staleTime: 60_000,
  });
}

export interface ByCountryRow {
  country_code: string;
  ca_htva_cents: number;
  orders_count: number;
  share: number;
}
export function useVendorAnalyticsByCountry(period: AnalyticsPeriod) {
  const { from, to } = computeRange(period);
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-by-country", period, vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_by_country", {
        _from: from, _to: to, _vendor_id: vendorId,
      });
      if (error) throw error;
      return (data ?? []) as ByCountryRow[];
    },
    staleTime: 60_000,
  });
}

export interface TopCustomerRow {
  customer_id: string;
  company_name: string | null;
  customer_type: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  ca_htva_cents: number;
  orders_count: number;
  last_order_at: string | null;
  share: number;
}
export function useVendorAnalyticsTopCustomers(period: AnalyticsPeriod, limit = 20) {
  const { from, to } = computeRange(period);
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-top-customers", period, limit, vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_top_customers", {
        _from: from, _to: to, _limit: limit, _vendor_id: vendorId,
      });
      if (error) throw error;
      return (data ?? []) as TopCustomerRow[];
    },
    staleTime: 60_000,
  });
}

export interface TopProductRow {
  product_id: string | null;
  product_name: string | null;
  units: number;
  ca_htva_cents: number;
  margin_cents: number;
  commission_cents: number;
}
export function useVendorAnalyticsTopProducts(period: AnalyticsPeriod, limit = 20) {
  const { from, to } = computeRange(period);
  const vendorId = useAnalyticsVendorId();
  return useQuery({
    queryKey: ["vendor-analytics-top-products", period, limit, vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_analytics_top_products", {
        _from: from, _to: to, _limit: limit, _vendor_id: vendorId,
      });
      if (error) throw error;
      return (data ?? []) as TopProductRow[];
    },
    staleTime: 60_000,
  });
}
