/**
 * 🔒 GARDE-FOU ANONYMISATION — résolveur partagé pour les exports.
 *
 * Source unique de vérité pour transformer une liste de `vendor_id` en
 * libellés anonymisés "Fournisseur <display_code>". Lit UNIQUEMENT depuis
 * la vue `vendors_public` (jamais `vendors` brut) et passe chaque ligne par
 * `getVendorPublicName` — `show_real_name` est volontairement ignoré.
 *
 * À utiliser dans TOUS les exports acheteur/public (XLSX, CSV, PDF).
 * Pour les renders admin internes uniquement, utiliser `getVendorAdminName`.
 */
import { supabase } from "@/integrations/supabase/client";
import { getVendorPublicName, sanitizeVendorLabel } from "@/lib/vendor-display";

export type VendorAnonMap = Map<string, string>;

/**
 * Résout les vendor_id passés en libellés anonymisés via `vendors_public`.
 * Retourne une Map<vendor_id, "Fournisseur XXXXXX">.
 *
 * Les IDs introuvables ne sont pas ajoutés à la map ; le caller doit retomber
 * sur `sanitizeVendorLabel(rawName, null)` pour ces cas (au minimum neutralise
 * "Qogita").
 */
export async function resolveVendorAnonMap(
  vendorIds: Array<string | null | undefined>,
): Promise<VendorAnonMap> {
  const map: VendorAnonMap = new Map();
  const ids = Array.from(
    new Set(vendorIds.filter((id): id is string => !!id)),
  );
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("vendors_public")
    .select("id, display_code, name, company_name")
    .in("id", ids);

  if (error) {
    // En cas d'échec, on retourne une map vide — le caller doit fallback sur
    // `sanitizeVendorLabel` (neutralise Qogita) pour ne JAMAIS exposer le nom brut.
    console.error("[resolveVendorAnonMap] failed", error);
    return map;
  }

  (data || []).forEach((v: any) => {
    map.set(v.id, getVendorPublicName(v));
  });
  return map;
}

/**
 * Helper d'appoint : retourne le libellé anonymisé pour un vendor_id,
 * avec fallback sanitizeVendorLabel(rawName) si l'ID n'est pas dans la map.
 */
export function resolveVendorLabel(
  map: VendorAnonMap,
  vendorId: string | null | undefined,
  rawName?: string | null,
): string {
  if (vendorId && map.has(vendorId)) return map.get(vendorId)!;
  return sanitizeVendorLabel(rawName ?? "", null);
}
