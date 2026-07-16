import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "./useCurrentVendor";
import type { IntelligenceModule } from "./useIntelligenceEntitlement";

export type VmiStatus = "none" | "trial" | "active" | "expired" | "cancelled";
export type VmiBilling = "stripe" | "medikong_invoice";

export type VmiStatusRow = {
  vendor_id: string;
  vendor_name: string | null;
  status: VmiStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  subscription_started_at: string | null;
  subscription_current_period_end: string | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_label: string | null;
  monthly_price_cents: number | null;
  ean_quota: number | null;
  billing_method: VmiBilling | null;
  stripe_subscription_id: string | null;
  has_access: boolean;
};

/**
 * @deprecated Utiliser `useIntelligenceEntitlement('veille_marche')` pour tout nouveau code.
 * Wrapper de compat — lit la vue compat `vendor_market_intel_status_v` (module='veille_marche').
 */
export function useVendorMarketIntelEntitlement() {
  const { data: vendor } = useCurrentVendor();
  return useQuery({
    queryKey: ["vmi-entitlement", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async (): Promise<VmiStatusRow | null> => {
      const { data, error } = await supabase
        .from("vendor_market_intel_status_v" as any)
        .select("*")
        .eq("vendor_id", vendor!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/**
 * @deprecated Utiliser `useIntelligencePlans('veille_marche')` pour tout nouveau code.
 * Wrapper de compat — aplati `metric_config` en `ean_quota`.
 */
export function useVendorMarketIntelPlans() {
  return useQuery({
    queryKey: ["vmi-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_intelligence_plans" as any)
        .select("id, code, label, description, monthly_price_cents, currency, metric_config, sort_order, is_active")
        .eq("module", "veille_marche")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return ((data as any[]) || []).map((p) => ({
        ...p,
        ean_quota: p.metric_config?.kind === "ean_quota" ? p.metric_config.threshold ?? null : null,
      }));
    },
  });
}

export type { IntelligenceModule };
