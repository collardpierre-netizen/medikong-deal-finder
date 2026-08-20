import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RestockMoqMin {
  moqMin: number;
  source: "seller" | "global";
}

export const RESTOCK_MOQ_ERROR_CODE = "RESTOCK_MOQ_MIN_NOT_REACHED";

/**
 * MOQ minimum (quantité minimum de commande) imposé aux offres ReStock partielles.
 * Cascade serveur : override vendeur (`restock_buyers.restock_moq_min`)
 * → réglage global (`restock_settings.moq_min`). 0 = désactivé.
 */
export function useRestockMoqMin(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["restock-moq-min", sellerId ?? "global"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RestockMoqMin> => {
      const { data, error } = await supabase.rpc("restock_resolve_moq_min", {
        _seller_id: sellerId ?? null,
      });
      if (error) throw error;
      const r = (data || {}) as { moq_min?: number; source?: string };
      return {
        moqMin: Number(r.moq_min ?? 0),
        source: r.source === "seller" ? "seller" : "global",
      };
    },
  });
}

export function isBelowRestockMoq(moq: number, moqMin: number): boolean {
  if (!moqMin || moqMin <= 0) return false;
  return (Number(moq) || 1) < moqMin;
}
