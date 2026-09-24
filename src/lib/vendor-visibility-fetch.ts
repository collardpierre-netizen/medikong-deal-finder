import { supabase } from "@/integrations/supabase/client";
import type { VendorVisibilityRule } from "@/lib/vendor-display";

/**
 * Lecture publique des règles d'affichage vendeur via la fonction serveur
 * `resolve_vendor_visibility` (la table n'est lisible que par les admins).
 * Renvoie des règles synthétiques (1 par vendeur ayant une règle matchante,
 * sans pays/profil) : `resolveVendorLabel` donne donc le même résultat.
 */
export async function fetchVendorVisibilityRules(
  vendorIds: string[],
  country?: string | null,
  customerType?: string | null,
): Promise<VendorVisibilityRule[]> {
  if (vendorIds.length === 0) return [];
  const { data } = await supabase.rpc("resolve_vendor_visibility" as any, {
    _vendor_ids: vendorIds,
    _country: country || null,
    _customer_type: customerType || null,
  });
  return ((data as any[]) || []).map((r) => ({
    vendor_id: r.vendor_id,
    country_code: null,
    customer_type: null,
    show_real_name: !!r.show_real_name,
    priority: 0,
  }));
}
