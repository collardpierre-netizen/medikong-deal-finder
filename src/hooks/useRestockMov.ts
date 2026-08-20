import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RestockMov {
  movCents: number;
  source: "seller" | "global";
}

/**
 * MOV (montant minimum de commande) applicable à une offre ReStock.
 * Cascade serveur : override vendeur (`restock_buyers.restock_mov_min_cents`)
 * → réglage global (`restock_settings.mov_min_eur`). 0 = désactivé.
 */
export function useRestockMov(offerId: string | null | undefined) {
  return useQuery({
    queryKey: ["restock-mov", offerId],
    enabled: !!offerId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RestockMov> => {
      const { data, error } = await supabase.rpc("restock_resolve_mov_cents", {
        _offer_id: offerId!,
      });
      if (error) throw error;
      const r = (data || {}) as { mov_cents?: number; source?: string };
      return {
        movCents: Number(r.mov_cents ?? 0),
        source: r.source === "seller" ? "seller" : "global",
      };
    },
  });
}

export function isBelowRestockMov(amountEurHt: number, movCents: number): boolean {
  if (!movCents || movCents <= 0) return false;
  return Math.round(amountEurHt * 100) < movCents;
}

export const RESTOCK_MOV_ERROR_CODE = "RESTOCK_MOV_NOT_REACHED";

export function formatMovEur(movCents: number): string {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(movCents / 100);
}
