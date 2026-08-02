import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

/**
 * Éligibilité cagnotte des lignes du panier (niveau OFFRE).
 * Source de vérité : offers.cagnotte_eligible (colonne générée, Sprint 1.5).
 */
export function useCartOffersCagnotteEligibility(offerIds: string[]) {
  const key = [...new Set(offerIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["cart-offers-cagnotte", key.join(",")],
    enabled: key.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await (supabase as any)
        .from("offers")
        .select("id, cagnotte_eligible")
        .in("id", key);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) map[row.id] = !!row.cagnotte_eligible;
      return map;
    },
  });
}

export interface ApplyCagnotteResult {
  success: boolean;
  balance_after?: number;
  error?: string;
}

/**
 * Applique la cagnotte sur une commande (mouvement 'spend').
 * À appeler UNIQUEMENT à la validation finale du paiement — jamais au mouvement du slider.
 */
export function useApplyCagnotte() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { orderId: string; amount: number }): Promise<ApplyCagnotteResult> => {
      const { data, error } = await supabase.functions.invoke("apply-cagnotte", {
        body: { order_id: vars.orderId, amount_to_use: vars.amount },
      });
      if (error && !data) {
        return { success: false, error: error.message || "Application de la cagnotte impossible" };
      }
      return (data ?? { success: false, error: "Réponse invalide" }) as ApplyCagnotteResult;
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["cagnotte-balance"] });
        queryClient.invalidateQueries({ queryKey: ["cagnotte-movements"] });
      }
    },
  });
}

export type CagnotteHistoryFilter = "tous" | "gains" | "depenses" | "expirations";

/** Historique paginé du ledger (20 par 20) avec filtre par type de mouvement. */
export async function loadCagnotteHistory(
  userId: string,
  filter: CagnotteHistoryFilter = "tous",
  offset = 0,
  limit = 20,
): Promise<CagnotteMovement[]> {
  let query = (supabase as any)
    .from("cagnotte_ledger")
    .select("id, order_id, movement_type, amount_eur, balance_after, expires_on, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === "gains") query = query.eq("movement_type", "earn");
  if (filter === "depenses") query = query.eq("movement_type", "spend");
  if (filter === "expirations") query = query.eq("movement_type", "expire");

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CagnotteMovement[];
}

/** Historique complet (tous mouvements) pour l'export CSV. */
export async function loadFullCagnotteHistory(userId: string): Promise<CagnotteMovement[]> {
  const { data, error } = await (supabase as any)
    .from("cagnotte_ledger")
    .select("id, order_id, movement_type, amount_eur, balance_after, expires_on, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as CagnotteMovement[];
}
