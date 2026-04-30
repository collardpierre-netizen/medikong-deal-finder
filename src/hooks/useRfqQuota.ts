import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RfqQuotaInfo {
  allowed: boolean;
  unlimited: boolean;
  reason: string;
  monthly_quota: number;
  monthly_remaining: number;
  permanent_credits: number;
  total_remaining?: number;
  active_plan_id?: string | null;
  plan_expires_at?: string | null;
}

/** Quota côté client pour gating UI. La vérité reste serveur (trigger). */
export function useRfqQuota() {
  const { user } = useAuth();

  return useQuery<RfqQuotaInfo | null>({
    queryKey: ["rfq-quota", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rfq_check_quota", { _user_id: user!.id });
      if (error) throw error;
      return (data as unknown) as RfqQuotaInfo;
    },
  });
}

export interface RfqPlan {
  id: string;
  code: string;
  label: string;
  description: string | null;
  plan_type: "free_quota" | "credit_pack" | "monthly_plan" | "unlimited_plan";
  monthly_quota: number;
  credits_included: number;
  is_unlimited: boolean;
  price_cents: number;
  currency: string;
  duration_days: number | null;
  sort_order: number;
}

export function useRfqPlans() {
  return useQuery<RfqPlan[]>({
    queryKey: ["rfq-plans"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_plans")
        .select("id, code, label, description, plan_type, monthly_quota, credits_included, is_unlimited, price_cents, currency, duration_days, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as RfqPlan[];
    },
  });
}

export function useRfqLedger(limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rfq-ledger", user?.id ?? "anon", limit],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_credit_ledger")
        .select("id, kind, delta_quota, delta_permanent, rfq_id, plan_id, reason, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}
