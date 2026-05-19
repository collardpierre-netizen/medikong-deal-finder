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
 * Anonymise tout libellé vendeur exposant la marque "Qogita" pour ne montrer
 * que l'ID public MediKong. À appliquer sur toute liste d'offres face à
 * acheteur OU vendeur — Qogita est un détail d'implémentation interne.
 */
export function sanitizeVendorLabel(name: string | null | undefined, displayCode?: string | null): string {
  const raw = (name ?? "").trim();
  if (!raw) return displayCode ? `Vendeur ${displayCode}` : "Vendeur MediKong";
  if (!/qogita/i.test(raw)) return raw;
  return displayCode ? `Vendeur ${displayCode}` : "Vendeur MediKong";
}

/**
 * 🔒 GARDE-FOU ANONYMISATION
 * Retourne TOUJOURS le nom anonymisé "Fournisseur <display_code>".
 * Le paramètre `showReal` et le flag DB `vendor.show_real_name` sont
 * volontairement IGNORÉS pour tout rendu public (table, cartes, tooltips,
 * emails, exports PDF/XLSX, logs). Pour le rendu admin interne, utiliser
 * `getVendorAdminName` (allowlist côté lint scripts/check-vendor-anonymity.ts).
 *
 * @deprecated Le second paramètre `showReal` n'a plus d'effet ; il est conservé
 * uniquement pour compatibilité d'appel. Tout retour expose désormais le code.
 */
export function getVendorPublicName(vendor: VendorDisplayInput, _showReal?: boolean): string {
  const code = vendor.display_code || vendor.name?.slice(0, 6)?.toUpperCase() || "XXXXXX";
  return `Fournisseur ${code}`;
}

/**
 * Returns the admin-facing display name (always real name, jamais anonymisé).
 * ⚠️ Allowlistée uniquement pour les pages `src/pages/admin/**` — toute
 * utilisation hors admin est bloquée par le script `check-vendor-anonymity`.
 */
export function getVendorAdminName(vendor: VendorDisplayInput): string {
  return vendor.company_name || vendor.name || `Vendeur ${vendor.display_code || "—"}`;
}

