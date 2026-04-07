import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PriceAlert {
  id: string;
  product_id: string;
  alert_type: "market_price" | "external_offer";
  reference_price: number;
  best_medikong_price: number;
  gap_percentage: number;
  gap_amount: number;
  severity: "info" | "warning" | "critical";
  status: "new" | "seen" | "in_progress" | "resolved" | "auto_resolved";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  // joined
  product?: {
    id: string;
    name: string;
    gtin: string | null;
    image_url: string | null;
    brand_name: string | null;
    category_name: string | null;
  };
  vendor_count?: number;
}

export interface PriceAlertVendor {
  id: string;
  alert_id: string;
  vendor_id: string;
  vendor_price: number;
  suggested_price: number | null;
  vendor_gap_percentage: number;
  notification_sent: boolean;
  notification_sent_at: string | null;
  notification_read_at: string | null;
  price_adjusted: boolean;
  price_adjusted_at: string | null;
  old_price: number | null;
  new_price: number | null;
  created_at: string;
  vendor?: {
    id: string;
    company_name: string | null;
    display_code: string | null;
  };
}

export interface AlertSettings {
  info_threshold: number;
  warning_threshold: number;
  critical_threshold: number;
  competitive_margin: number;
  auto_notify_info: boolean;
  auto_notify_warning: boolean;
  auto_notify_critical: boolean;
  escalation_hours: number;
  superadmin_report_frequency: string;
}

export function usePriceAlerts(filters?: {
  severity?: string;
  status?: string;
  brandName?: string;
  minGap?: number;
}) {
  return useQuery({
    queryKey: ["price-alerts", filters],
    queryFn: async () => {
      let query = supabase
        .from("price_alerts")
        .select(`
          *,
          product:products!inner(id, name, gtin, image_url, brand_name, category_name)
        `)
        .order("gap_percentage", { ascending: false });

      if (filters?.severity) query = query.eq("severity", filters.severity);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.minGap) query = query.gte("gap_percentage", filters.minGap);

      const { data, error } = await query;
      if (error) throw error;

      // Get vendor counts per alert
      const alertIds = (data || []).map((a: any) => a.id);
      let vendorCounts: Record<string, number> = {};
      if (alertIds.length > 0) {
        const { data: vcData } = await supabase
          .from("price_alert_vendors")
          .select("alert_id")
          .in("alert_id", alertIds);
        if (vcData) {
          vcData.forEach((v: any) => {
            vendorCounts[v.alert_id] = (vendorCounts[v.alert_id] || 0) + 1;
          });
        }
      }

      return (data || []).map((a: any) => ({
        ...a,
        vendor_count: vendorCounts[a.id] || 0,
      })) as PriceAlert[];
    },
  });
}

export function usePriceAlertDetail(alertId: string | undefined) {
  return useQuery({
    queryKey: ["price-alert-detail", alertId],
    enabled: !!alertId,
    queryFn: async () => {
      const { data: alert, error } = await supabase
        .from("price_alerts")
        .select(`*, product:products!inner(id, name, gtin, image_url, brand_name, category_name)`)
        .eq("id", alertId!)
        .single();
      if (error) throw error;

      const { data: vendors } = await supabase
        .from("price_alert_vendors")
        .select(`*, vendor:vendors!inner(id, company_name, display_code)`)
        .eq("alert_id", alertId!);

      const { data: notifications } = await supabase
        .from("price_alert_notifications")
        .select("*")
        .in("alert_vendor_id", (vendors || []).map((v: any) => v.id))
        .order("sent_at", { ascending: false });

      const { data: adjustments } = await supabase
        .from("price_adjustment_log")
        .select("*")
        .eq("product_id", alert.product_id)
        .order("adjusted_at", { ascending: false });

      return {
        alert: alert as PriceAlert,
        vendors: (vendors || []) as PriceAlertVendor[],
        notifications: notifications || [],
        adjustments: adjustments || [],
      };
    },
  });
}

export function usePriceAlertStats() {
  return useQuery({
    queryKey: ["price-alert-stats"],
    queryFn: async () => {
      const { data: alerts } = await supabase
        .from("price_alerts")
        .select("id, severity, status, gap_percentage, resolved_at, created_at")
        .in("status", ["new", "seen", "in_progress"]);

      const all = alerts || [];
      const total = all.length;
      const bySeverity = {
        info: all.filter(a => a.severity === "info").length,
        warning: all.filter(a => a.severity === "warning").length,
        critical: all.filter(a => a.severity === "critical").length,
      };

      const avgGap = total > 0
        ? all.reduce((s, a) => s + Number(a.gap_percentage), 0) / total
        : 0;

      // Unique products
      const { data: productAlerts } = await supabase
        .from("price_alerts")
        .select("product_id")
        .in("status", ["new", "seen", "in_progress"]);
      const uniqueProducts = new Set((productAlerts || []).map(a => a.product_id)).size;

      // Unique vendors
      const alertIds = all.map(a => a.id);
      let uniqueVendors = 0;
      if (alertIds.length > 0) {
        const { data: vd } = await supabase
          .from("price_alert_vendors")
          .select("vendor_id")
          .in("alert_id", alertIds);
        uniqueVendors = new Set((vd || []).map(v => v.vendor_id)).size;
      }

      // Alignment rate (resolved in last 30 days / total created in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: recentAll } = await supabase
        .from("price_alerts")
        .select("id, status")
        .gte("created_at", thirtyDaysAgo);
      const recentResolved = (recentAll || []).filter(a => a.status === "resolved" || a.status === "auto_resolved").length;
      const alignmentRate = (recentAll || []).length > 0
        ? Math.round((recentResolved / (recentAll || []).length) * 100)
        : 0;

      return { total, bySeverity, avgGap: Math.round(avgGap * 10) / 10, uniqueProducts, uniqueVendors, alignmentRate };
    },
  });
}

export function useAlertSettings() {
  return useQuery({
    queryKey: ["price-alert-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_alert_settings")
        .select("setting_key, setting_value");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
      return {
        info_threshold: Number(map.info_threshold ?? 0),
        warning_threshold: Number(map.warning_threshold ?? 5),
        critical_threshold: Number(map.critical_threshold ?? 15),
        competitive_margin: Number(map.competitive_margin ?? 1),
        auto_notify_info: map.auto_notify_info === "true",
        auto_notify_warning: map.auto_notify_warning === "true",
        auto_notify_critical: map.auto_notify_critical === "true",
        escalation_hours: Number(map.escalation_hours ?? 48),
        superadmin_report_frequency: map.superadmin_report_frequency ?? "daily",
      } as AlertSettings;
    },
  });
}

export function useUpdateAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<AlertSettings>) => {
      const entries = Object.entries(settings);
      for (const [key, value] of entries) {
        await supabase
          .from("price_alert_settings")
          .update({ setting_value: String(value), updated_at: new Date().toISOString() })
          .eq("setting_key", key);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-alert-settings"] }),
  });
}

export function useUpdateAlertStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status, updated_at: new Date().toISOString() };
      if (status === "resolved" || status === "auto_resolved") update.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("price_alerts").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-alerts"] });
      qc.invalidateQueries({ queryKey: ["price-alert-stats"] });
    },
  });
}

// Vendor-specific hooks
export function useVendorPriceAlerts(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-price-alerts", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_alert_vendors")
        .select(`
          *,
          alert:price_alerts!inner(
            id, product_id, alert_type, reference_price, best_medikong_price,
            gap_percentage, gap_amount, severity, status, created_at,
            product:products!inner(id, name, gtin, image_url, brand_name)
          )
        `)
        .eq("vendor_id", vendorId!)
        .in("alert.status", ["new", "seen", "in_progress"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
