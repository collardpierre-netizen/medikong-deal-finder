import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { useCurrentBuyerProfile } from "@/hooks/useCurrentBuyerProfile";
import {
  getVendorPublicName,
  resolveVendorLabel,
  type VendorVisibilityRule,
} from "@/lib/vendor-display";

/**
 * 🟢 Résolution unifiée du libellé vendeur pour les surfaces acheteur
 * (panier, checkout, page de confirmation, détail commande).
 *
 * Lit `vendors_public` + `vendor_visibility_rules` puis délègue à
 * `resolveVendorLabel(vendor, rules, { country, customerType })` :
 * - si une règle CMS matchante autorise `show_real_name` → vrai nom
 * - sinon → "Fournisseur <display_code>" (via getVendorPublicName)
 *
 * `getLabel(vendorId, fallbackName?)` retombe sur `fallbackName` puis sur
 * "Vendeur" en dernier recours (utile quand le serveur renvoie déjà un nom
 * pour un vendeur non chargé dans la vue).
 */
export function useVendorLabels(vendorIds: Array<string | null | undefined>) {
  const ids = useMemo(
    () =>
      Array.from(
        new Set((vendorIds || []).filter((v): v is string => !!v)),
      ).sort(),
    [vendorIds],
  );
  const { country } = useCountry();
  const { data: buyerProfileId } = useCurrentBuyerProfile();

  const { data } = useQuery({
    queryKey: ["vendor-labels", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [vRes, rRes] = await Promise.all([
        supabase
          .from("vendors_public" as any)
          .select("id, slug, display_code, name, company_name, show_real_name")
          .in("id", ids),
        supabase
          .from("vendor_visibility_rules" as any)
          .select("vendor_id, country_code, customer_type, show_real_name, priority")
          .in("vendor_id", ids),
      ]);
      return {
        vendors: (vRes.data || []) as any[],
        rules: ((rRes.data || []) as unknown) as VendorVisibilityRule[],
      };
    },
  });

  const labelsById = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    const vendors = data?.vendors || [];
    const rules = data?.rules || [];
    const ctx = { country: country || undefined, customerType: buyerProfileId || undefined };
    for (const v of vendors) {
      out[v.id] = resolveVendorLabel(
        {
          id: v.id,
          display_code: v.display_code,
          name: v.name,
          company_name: v.company_name,
          show_real_name: v.show_real_name,
        },
        rules,
        ctx,
      );
    }
    return out;
  }, [data, country, buyerProfileId]);

  const getLabel = (
    vendorId: string | null | undefined,
    fallbackName?: string | null,
  ): string => {
    if (vendorId && labelsById[vendorId]) return labelsById[vendorId];
    if (fallbackName && fallbackName.trim()) return fallbackName;
    if (vendorId) return getVendorPublicName({ display_code: undefined });
    return "Vendeur";
  };

  return { labelsById, getLabel };
}
