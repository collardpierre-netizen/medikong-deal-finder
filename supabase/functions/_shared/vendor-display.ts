/**
 * 🔒 Source canonique du helper d'anonymisation vendeur.
 *
 * Ce module est volontairement sans dépendance (pas d'import React, pas
 * d'import Deno, pas de `npm:` / `https:`) afin d'être consommé à la fois :
 *  - par le bundle Vite/React (`src/lib/vendor-display.ts` ré-exporte d'ici)
 *  - par les Edge Functions Deno (`import { getVendorPublicName } from "../_shared/vendor-display.ts"`)
 *
 * Cf. memory "Vendor Anonymity Guardrail" : tout rendu vendeur public DOIT
 * passer par `getVendorPublicName`, qui ignore systématiquement `show_real_name`
 * et les noms réels (`name` / `company_name`).
 */

export interface VendorDisplayInput {
  display_code?: string | null;
  company_name?: string | null;
  name?: string | null;
  show_real_name?: boolean | null;
  type?: string | null;
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
