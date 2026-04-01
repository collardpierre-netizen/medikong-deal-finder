/**
 * Vendor anonymization utility.
 * By default all vendors are anonymized on the public site.
 * The admin can toggle `show_real_name` per vendor to reveal the real name.
 * Granular rules in `vendor_visibility_rules` allow overriding per country/customer_type.
 */

export interface VendorDisplayInput {
  display_code?: string | null;
  company_name?: string | null;
  name?: string | null;
  show_real_name?: boolean | null;
  type?: string | null;
}

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

  // Filter rules for this vendor
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

/**
 * Returns the public-facing display name for a vendor.
 * - If `show_real_name` is true → company_name or name
 * - Otherwise → "Fournisseur <display_code>" (anonymized)
 */
export function getVendorPublicName(vendor: VendorDisplayInput, showReal?: boolean): string {
  const reveal = showReal !== undefined ? showReal : !!vendor.show_real_name;
  if (reveal && (vendor.company_name || vendor.name)) {
    return vendor.company_name || vendor.name || "Fournisseur";
  }
  const code = vendor.display_code || vendor.name?.slice(0, 6)?.toUpperCase() || "XXXXXX";
  return `Fournisseur ${code}`;
}

/**
 * Returns the admin-facing display name (always real name).
 */
export function getVendorAdminName(vendor: VendorDisplayInput): string {
  return vendor.company_name || vendor.name || `Vendeur ${vendor.display_code || "—"}`;
}
