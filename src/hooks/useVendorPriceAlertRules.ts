import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RuleScope = "global" | "ean" | "brand" | "category";
export type RuleMetric = "gap_vs_median" | "gap_vs_best";

export interface VendorPriceAlertRule {
  id: string;
  vendor_id: string;
  scope: RuleScope;
  ean: string | null;
  brand_id: string | null;
  category_id: string | null;
  threshold_median_pct: number;
  metric: RuleMetric;
  is_active: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorPriceAlertEvent {
  id: string;
  vendor_id: string;
  rule_id: string | null;
  product_id: string;
  country_code: string;
  metric: RuleMetric;
  threshold_pct: number;
  observed_pct: number;
  my_price: number;
  median_price: number | null;
  best_price: number | null;
  status: "new" | "seen" | "resolved";
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  product?: { id: string; name: string; gtin: string | null; image_url: string | null; brand_name: string | null };
}

export function useVendorPriceAlertRules(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-price-alert-rules", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_price_alert_rules")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("scope", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendorPriceAlertRule[];
    },
  });
}

export function useUpsertPriceAlertRule(vendorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<VendorPriceAlertRule> & { vendor_id: string; scope: RuleScope; threshold_median_pct: number; metric: RuleMetric }) => {
      if (rule.id) {
        const { error } = await (supabase as any).from("vendor_price_alert_rules").update(rule).eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("vendor_price_alert_rules").insert(rule);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-price-alert-rules", vendorId] });
    },
  });
}

export function useDeletePriceAlertRule(vendorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("vendor_price_alert_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-price-alert-rules", vendorId] }),
  });
}

export function useVendorPriceAlertEvents(vendorId: string | undefined, opts?: { autoEvaluate?: boolean }) {
  return useQuery({
    queryKey: ["vendor-price-alert-events", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (opts?.autoEvaluate) {
        try { await (supabase as any).rpc("evaluate_vendor_price_alerts", { _vendor_id: vendorId }); } catch {}
      }
      const { data, error } = await (supabase as any)
        .from("vendor_price_alert_events")
        .select(`*, product:products!inner(id,name,gtin,image_url,brand_name)`)
        .eq("vendor_id", vendorId)
        .in("status", ["new", "seen"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as VendorPriceAlertEvent[];
    },
    refetchOnWindowFocus: false,
  });
}

export function usePriceAlertEventsCount(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-price-alert-events-count", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("vendor_price_alert_events")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId)
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60000,
  });
}

export function useMarkPriceAlertEvent(vendorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "seen" | "resolved" }) => {
      const patch: any = { status };
      if (status === "seen") patch.read_at = new Date().toISOString();
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      const { error } = await (supabase as any).from("vendor_price_alert_events").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-price-alert-events", vendorId] });
      qc.invalidateQueries({ queryKey: ["vendor-price-alert-events-count", vendorId] });
    },
  });
}
