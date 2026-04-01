/**
 * Vendor anonymization utility.
 * By default all vendors are anonymized on the public site.
 * The admin can toggle `show_real_name` per vendor to reveal the real name.
 */

export interface VendorDisplayInput {
  display_code?: string | null;
  company_name?: string | null;
  name?: string | null;
  show_real_name?: boolean | null;
  type?: string | null;
}

/**
 * Returns the public-facing display name for a vendor.
 * - If `show_real_name` is true → company_name or name
 * - Otherwise → "Fournisseur <display_code>" (anonymized)
 */
export function getVendorPublicName(vendor: VendorDisplayInput): string {
  if (vendor.show_real_name && (vendor.company_name || vendor.name)) {
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
