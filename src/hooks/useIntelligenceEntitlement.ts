import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "./useCurrentVendor";

export type IntelligenceModule = "veille_marche" | "analytics" | "bundle";
export type IntelStatus = "none" | "trial" | "active" | "expired" | "cancelled";
export type IntelBilling = "stripe" | "medikong_invoice";

export type IntelMetricConfig = {
  kind: "ean_quota" | "monthly_gmv_cents" | "unlimited";
  threshold?: number;
  label_suffix?: string;
};

export type IntelEntitlementRow = {
  vendor_id: string;
  vendor_name: string | null;
  module: IntelligenceModule;
  status: IntelStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  subscription_started_at: string | null;
  subscription_current_period_end: string | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_label: string | null;
  monthly_price_cents: number | null;
  metric_config: IntelMetricConfig | null;
  billing_method: IntelBilling | null;
  stripe_subscription_id: string | null;
  is_permanent: boolean;
  granted_reason: string | null;
  has_access: boolean;
};

export type IntelPlan = {
  id: string;
  module: IntelligenceModule;
  code: string;
  label: string;
  description: string | null;
  monthly_price_cents: number;
  currency: string;
  metric_config: IntelMetricConfig;
  sort_order: number;
  is_active: boolean;
  stripe_price_id: string | null;
};

export type IntelTabFlag = {
  id: string;
  module: IntelligenceModule;
  tab_key: string;
  label: string;
  is_free: boolean;
  sort_order: number;
};

/**
 * Statut d'accès d'un vendeur au module Intelligence donné.
 * Lit `vendor_intelligence_status_v` filtré par module.
 */
export function useIntelligenceEntitlement(module: IntelligenceModule) {
  const { data: vendor } = useCurrentVendor();
  return useQuery({
    queryKey: ["intel-entitlement", module, vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async (): Promise<IntelEntitlementRow | null> => {
      const { data, error } = await supabase
        .from("vendor_intelligence_status_v" as any)
        .select("*")
        .eq("vendor_id", vendor!.id)
        .eq("module", module)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/**
 * Paliers actifs pour un module (triés).
 */
export function useIntelligencePlans(module: IntelligenceModule) {
  return useQuery({
    queryKey: ["intel-plans", module],
    queryFn: async (): Promise<IntelPlan[]> => {
      const { data, error } = await supabase
        .from("vendor_intelligence_plans" as any)
        .select("id, module, code, label, description, monthly_price_cents, currency, metric_config, sort_order, is_active, stripe_price_id")
        .eq("module", module)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

/**
 * Réglages CMS d'un module (durée essai, label, description, metric_kind).
 */
export function useIntelligenceModuleSettings(module: IntelligenceModule) {
  return useQuery({
    queryKey: ["intel-module-settings", module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intelligence_module_settings" as any)
        .select("*")
        .eq("module", module)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/**
 * Flags is_free par onglet pour un module.
 */
export function useIntelligenceTabFlags(module: IntelligenceModule) {
  return useQuery({
    queryKey: ["intel-tab-flags", module],
    queryFn: async (): Promise<IntelTabFlag[]> => {
      const { data, error } = await supabase
        .from("intelligence_module_tab_flags" as any)
        .select("*")
        .eq("module", module)
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

/**
 * Accès effectif à un onglet : true si l'onglet est is_free OU si le vendeur a l'entitlement du module.
 */
export function useTabAccess(module: IntelligenceModule, tabKey: string) {
  const { data: ent } = useIntelligenceEntitlement(module);
  const { data: flags = [] } = useIntelligenceTabFlags(module);
  const flag = flags.find((f) => f.tab_key === tabKey);
  const isFree = flag?.is_free ?? false;
  const hasEntitlement = !!ent?.has_access;
  return {
    canView: isFree || hasEntitlement,
    isFree,
    hasEntitlement,
    entitlement: ent,
  };
}
