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

import {
  getVendorPublicName as getVendorPublicNameInternal,
  type VendorDisplayInput,
} from "../../supabase/functions/_shared/vendor-display";


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

/**
 * 🟢 Résolveur CMS-driven du libellé vendeur pour les surfaces publiques
 * (cards offres, fiche produit, listes externes…).
 *
 * Contrairement à `getVendorPublicName` qui anonymise toujours, ce helper
 * honore les `vendor_visibility_rules` gérées par l'admin dans le CMS :
 * si une règle matchante (pays + profil acheteur) autorise `show_real_name`,
 * on retourne le vrai nom (company_name || name). Sinon, on retombe sur le
 * libellé anonymisé "Fournisseur <display_code>".
 *
 * Whitelisté par le linter d'anonymisation (cf. SAFE_CALLERS).
 */
export function resolveVendorLabel(
  vendor: VendorDisplayInput & { id?: string },
  rules: VendorVisibilityRule[],
  context?: { country?: string; customerType?: string }
): string {
  const showReal = resolveVendorVisibility(vendor, rules, context);
  if (showReal) {
    const real = (vendor.company_name || vendor.name || "").trim();
    if (real) return real;
  }
  const code = vendor.display_code || "XXXXXX";
  return `Fournisseur ${code}`;
}

/**
 * 🟡 EXCEPTION CIBLÉE — page boutique vendeur (`/vendeur/:code`).
 *
 * Sur la page boutique publique, l'identité du vendeur est déjà trivialement
 * dérivable (logo de marque, top marques, délégués…). On autorise donc
 * l'affichage du nom réel UNIQUEMENT si le backend l'autorise via
 * `vendor_visibility_rules` / `show_real_name`. Sinon on retombe sur
 * l'anonymisation standard "Fournisseur <display_code>".
 *
 * ⚠️ Ce helper est réservé à la page boutique. Toute autre surface
 * (panier, fiche produit, RFQ, emails, exports) DOIT continuer à utiliser
 * `getVendorPublicName`. L'allowlist du linter d'anonymisation autorise ce
 * helper uniquement dans `src/pages/VendorPublicPage.tsx`.
 */
export function getVendorBoutiqueDisplayName(
  vendor: VendorDisplayInput,
  showReal: boolean
): string {
  if (showReal) {
    const real = (vendor.company_name || vendor.name || "").trim();
    if (real) return real;
  }
  const code = vendor.display_code || "XXXXXX";
  return `Fournisseur ${code}`;
}

/**
 * 🟢 Mode d'affichage vendeur piloté par la surface (ex. ventes flash).
 *
 * - `inherit`   : suit la fiche vendeur + `vendor_visibility_rules` (comportement standard)
 * - `anonymous` : force "Fournisseur <display_code>" quelles que soient les règles
 * - `real`      : force le nom réel (choix éditorial admin, ex. promo co-brandée)
 */
export type VendorDisplayMode = "inherit" | "anonymous" | "real";

export function resolveVendorLabelWithMode(
  vendor: VendorDisplayInput & { id?: string },
  rules: VendorVisibilityRule[],
  context: { country?: string; customerType?: string } | undefined,
  mode: VendorDisplayMode | null | undefined,
): string {
  if (mode === "anonymous") return getVendorPublicNameInternal(vendor);
  if (mode === "real") {
    const real = (vendor.company_name || vendor.name || "").trim();
    if (real) return real;
  }
  return resolveVendorLabel(vendor, rules, context);
}
