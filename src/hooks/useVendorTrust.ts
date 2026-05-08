import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VendorTrust = {
  vendorId: string;
  displayMode: "anonymous" | "public";
  publicIdentifier: string;
  companyName: string | null;
  joinedAt: string;
  isKycVerified: boolean;
  isFaggVerified: boolean;
  shipsFromCountry: string | null;
  monthsActive: number;
  onTimePct90d: number | null;
  orders90dCount: number;
  avgScore: number | null;
  ratingsCount: number;
  totalOrders: number;
};

/**
 * Récupère les signaux de confiance pour une liste de vendeurs.
 * Lit la vue `public_vendor_trust_signals` (security_invoker, lecture publique).
 */
export function useVendorTrust(vendorIds: string[]) {
  const ids = Array.from(new Set(vendorIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["vendor-trust", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 60 * 6, // 6h
    queryFn: async (): Promise<Record<string, VendorTrust>> => {
      const { data, error } = await supabase
        .from("public_vendor_trust_signals" as any)
        .select("*")
        .in("vendor_id", ids);
      if (error) throw error;
      const map: Record<string, VendorTrust> = {};
      for (const v of (data ?? []) as any[]) {
        map[v.vendor_id] = {
          vendorId: v.vendor_id,
          displayMode: v.display_mode,
          publicIdentifier: v.public_identifier,
          // Defense in depth : masque côté client si anonymous
          companyName: v.display_mode === "public" ? v.company_name ?? null : null,
          joinedAt: v.joined_at,
          isKycVerified: !!v.is_kyc_verified,
          isFaggVerified: !!v.is_fagg_verified,
          shipsFromCountry: v.ships_from_country,
          monthsActive: v.months_active ?? 0,
          onTimePct90d: v.on_time_pct_90d,
          orders90dCount: v.orders_90d_count ?? 0,
          avgScore: v.avg_score !== null ? Number(v.avg_score) : null,
          ratingsCount: v.ratings_count ?? 0,
          totalOrders: v.total_orders ?? 0,
        };
      }
      return map;
    },
  });
}
