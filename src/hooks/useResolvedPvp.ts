import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PvpSource = "apb" | "pmr" | "manufacturer" | "distributor" | "manual";

export interface ResolvedPvp {
  pvpTtcCents: number;
  pvpTtc: number; // euros
  source: PvpSource;
  sourceLabel: string;
  vendorId: string | null;
  vendorName: string | null;
  updatedAt: string | null;
}

/**
 * Resolves the "Prix Public Conseillé" (PVP) to display to a buyer for a given product.
 * Priority cascade handled server-side by RPC `resolve_product_pvp`:
 *   1. Official PVP encoded on products (APB / PMR / admin manual)
 *   2. Best PVP suggested by an authorized vendor (manufacturer / official distributor)
 */
export function useResolvedPvp(productId: string | undefined, countryCode = "BE") {
  return useQuery({
    queryKey: ["resolved-pvp", productId, countryCode],
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ResolvedPvp | null> => {
      const { data, error } = await supabase.rpc("resolve_product_pvp", {
        _product_id: productId!,
        _country_code: countryCode,
      });
      if (error) {
        console.warn("[useResolvedPvp] RPC error", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || row.pvp_ttc_cents == null) return null;
      return {
        pvpTtcCents: row.pvp_ttc_cents,
        pvpTtc: row.pvp_ttc_cents / 100,
        source: row.source as PvpSource,
        sourceLabel: row.source_label,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        updatedAt: row.updated_at,
      };
    },
  });
}

/**
 * Computes the buyer's potential resale margin given a PVP TTC and a buyer purchase price (HTVA or TTC).
 */
export function computeResaleMargin(
  pvpTtc: number,
  buyerPriceTtc: number,
): { marginAmount: number; marginPct: number } | null {
  if (!pvpTtc || pvpTtc <= 0 || !buyerPriceTtc || buyerPriceTtc <= 0) return null;
  const marginAmount = pvpTtc - buyerPriceTtc;
  const marginPct = (marginAmount / pvpTtc) * 100;
  return { marginAmount, marginPct };
}
