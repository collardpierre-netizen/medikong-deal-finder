/**
 * Vendor anonymization utility — point d'entrée front.
 *
 * 🔒 La source canonique de `getVendorPublicName` / `getVendorAdminName` /
 * `sanitizeVendorLabel` vit dans `supabase/functions/_shared/vendor-display.ts`
 * pour pouvoir être importée à l'identique depuis les Edge Functions Deno.
 * Ce fichier se contente de ré-exporter, plus la logique de résolution
 * `vendor_visibility_rules` qui n'a de sens que côté UI.
 */

export {
  getVendorPublicName,
  getVendorAdminName,
  sanitizeVendorLabel,
  type VendorDisplayInput,
} from "../../supabase/functions/_shared/vendor-display";

import type { VendorDisplayInput } from "../../supabase/functions/_shared/vendor-display";

export interface VendorVisibilityRule {
  vendor_id: string;
  country_code: string | null;
  customer_type: string | null;
  show_real_name: boolean;
  priority: number;
}

/**
 * Resolves whether a vendor's real name should be shown,
 * considering granular visibility rules if available.
 *
 * Priority: matching rules (highest priority wins) > vendor-level show_real_name > false
 */
export function resolveVendorVisibility(
  vendor: VendorDisplayInput & { id?: string },
  rules: VendorVisibilityRule[],
  context?: { country?: string; customerType?: string }
): boolean {
  if (!context || !vendor.id || rules.length === 0) {
    return !!vendor.show_real_name;
  }

  const vendorRules = rules
    .filter(r => r.vendor_id === vendor.id)
    .filter(r => {
      const countryMatch = !r.country_code || r.country_code === context.country;
      const typeMatch = !r.customer_type || r.customer_type === context.customerType;
      return countryMatch && typeMatch;
    })
    .sort((a, b) => b.priority - a.priority);

  if (vendorRules.length > 0) {
    return vendorRules[0].show_real_name;
  }

  return !!vendor.show_real_name;
}
