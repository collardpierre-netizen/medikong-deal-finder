import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CagnotteBalance {
  current_balance: number;
  next_expiry_date: string | null;
  amount_expiring_soon: number;
}

export interface CagnotteMovement {
  id: string;
  order_id: string | null;
  movement_type: "earn" | "spend" | "expire" | "adjustment" | "refund";
  amount_eur: number;
  balance_after: number;
  expires_on: string | null;
  description: string;
  created_at: string;
}

/** Solde cagnotte du pharmacien connecté. */
export function useCagnotteBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cagnotte-balance", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<CagnotteBalance> => {
      const { data, error } = await (supabase as any)
        .from("cagnotte_balance")
        .select("current_balance, next_expiry_date, amount_expiring_soon")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        current_balance: Number(data?.current_balance ?? 0),
        next_expiry_date: data?.next_expiry_date ?? null,
        amount_expiring_soon: Number(data?.amount_expiring_soon ?? 0),
      };
    },
  });
}

/** Derniers mouvements du ledger du pharmacien connecté. */
export function useCagnotteMovements(limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cagnotte-movements", user?.id, limit],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<CagnotteMovement[]> => {
      const { data, error } = await (supabase as any)
        .from("cagnotte_ledger")
        .select("id, order_id, movement_type, amount_eur, balance_after, expires_on, description, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CagnotteMovement[];
    },
  });
}

/** Paramètres publics du programme cagnotte (table settings). */
export function useCagnotteSettings() {
  return useQuery({
    queryKey: ["cagnotte-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("settings")
        .select("key, value")
        .like("key", "cagnotte%");
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      return {
        rate: Number(map.cagnotte_rate ?? 0.02),
        minCommissionEligibility: Number(map.cagnotte_min_commission_eligibility ?? 0.12),
        minSpend: Number(map.cagnotte_min_spend ?? 0.5),
        maxSpendPct: Number(map.cagnotte_max_spend_pct ?? 0.3),
        vatMode: String(map.cagnotte_vat_mode ?? "payment") as "discount" | "payment",
        raw: map,
      };
    },
  });
}

export function formatEur(value: number) {
  return `${value.toFixed(2).replace(".", ",")} €`;
}
