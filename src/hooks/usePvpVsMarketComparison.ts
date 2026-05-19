import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PvpMarketComparison {
  productId: string;
  pvpTtcCents: number | null;
  marketHtvaCents: number | null; // mediane
  marketTtcCents: number | null;
  vatRatePct: number; // ex: 21 ou 6
  deltaCents: number | null; // pvp - marketTtc
  deltaPct: number | null;   // (pvp - marketTtc) / pvp * 100
}

/**
 * Charge en lot les valeurs PVP (TTC) et prix marché médian (HTVA → TTC)
 * pour une liste de product_id. Utilisé sur /bonnes-affaires pour afficher
 * le comparatif côte à côte PVP conseillé vs prix marché.
 */
export function usePvpVsMarketComparison(productIds: string[]) {
  const idsKey = [...new Set(productIds)].sort().join(",");

  return useQuery({
    queryKey: ["pvp-vs-market-comparison", idsKey],
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, PvpMarketComparison>> => {
      const ids = [...new Set(productIds)];

      const [prodRes, mpRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, pvp_ttc_cents, vat_rate_be, vat_rate_override")
          .in("id", ids),
        supabase
          .from("market_prices")
          .select("product_id, prix_grossiste, tva_rate")
          .in("product_id", ids)
          .not("prix_grossiste", "is", null),
      ]);

      if (prodRes.error) throw prodRes.error;
      if (mpRes.error) throw mpRes.error;

      // Agrégation marché : médiane des prix_grossiste HTVA (en cents)
      const groupedHtva = new Map<string, number[]>();
      const groupedVat = new Map<string, number[]>();
      (mpRes.data || []).forEach((r: any) => {
        const cents = Math.round(Number(r.prix_grossiste) * 100);
        if (!Number.isFinite(cents) || cents <= 0) return;
        const arr = groupedHtva.get(r.product_id) || [];
        arr.push(cents);
        groupedHtva.set(r.product_id, arr);
        if (r.tva_rate != null) {
          const v = Number(r.tva_rate);
          if (Number.isFinite(v) && v > 0) {
            const vArr = groupedVat.get(r.product_id) || [];
            vArr.push(v);
            groupedVat.set(r.product_id, vArr);
          }
        }
      });

      const median = (arr: number[]): number | null => {
        if (!arr.length) return null;
        const s = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
      };

      const result = new Map<string, PvpMarketComparison>();

      (prodRes.data || []).forEach((p: any) => {
        const pvp: number | null = p.pvp_ttc_cents ?? null;
        const marketHtva = median(groupedHtva.get(p.id) || []);

        // TVA : override produit > médiane TVA market_prices > vat_rate_be > 21
        const vatFromMarket = median(groupedVat.get(p.id) || []) ?? null;
        const vatRatePct: number =
          p.vat_rate_override != null
            ? Number(p.vat_rate_override)
            : vatFromMarket != null
            ? vatFromMarket
            : p.vat_rate_be != null
            ? Number(p.vat_rate_be)
            : 21;

        const marketTtc =
          marketHtva != null
            ? Math.round(marketHtva * (1 + vatRatePct / 100))
            : null;

        const deltaCents =
          pvp != null && marketTtc != null ? pvp - marketTtc : null;
        const deltaPct =
          pvp != null && marketTtc != null && pvp > 0
            ? Math.round((deltaCents! / pvp) * 1000) / 10
            : null;

        result.set(p.id, {
          productId: p.id,
          pvpTtcCents: pvp,
          marketHtvaCents: marketHtva,
          marketTtcCents: marketTtc,
          vatRatePct,
          deltaCents,
          deltaPct,
        });
      });

      return result;
    },
  });
}
