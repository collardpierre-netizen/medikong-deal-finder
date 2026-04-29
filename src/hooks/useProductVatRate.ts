import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VatRateSource =
  | "product_override"
  | "cnk_exact"
  | `cnk_prefix:${string}`
  | "category"
  | "fallback";

export interface ResolvedVatRate {
  vat_rate: number;
  source: VatRateSource;
}

/**
 * Résout dynamiquement le taux TVA d'un produit en suivant la priorité :
 * override produit → mapping CNK exact → mapping CNK préfixe → vat_rate catégorie → fallback 21%.
 */
export function useProductVatRate(productId: string | undefined, countryCode = "BE") {
  return useQuery<ResolvedVatRate>({
    queryKey: ["product-vat-rate", productId, countryCode],
    queryFn: async () => {
      if (!productId) return { vat_rate: 21, source: "fallback" };
      const { data, error } = await supabase.rpc("resolve_product_vat_rate", {
        _product_id: productId,
        _country_code: countryCode,
      });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        return { vat_rate: 21, source: "fallback" };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        vat_rate: Number((row as any).vat_rate ?? 21),
        source: ((row as any).source ?? "fallback") as VatRateSource,
      };
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000,
  });
}

export function vatSourceLabel(src: VatRateSource): string {
  if (src === "product_override") return "Override produit";
  if (src === "cnk_exact") return "CNK (exact)";
  if (typeof src === "string" && src.startsWith("cnk_prefix:")) return `CNK (préfixe ${src.slice(11)})`;
  if (src === "category") return "Catégorie";
  return "Fallback 21%";
}
