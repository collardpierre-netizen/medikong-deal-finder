// Helpers for Peppol identifier handling.
// Format for Belgian companies: `0208:BE` + 10 digits (Belgian company/VAT number).
// Ex: 0208:BE0404014205

export const PEPPOL_BE_REGEX = /^0208:BE\d{10}$/;
export const PEPPOL_BE_PLACEHOLDER = "0208:BE0000000000";
export const PEPPOL_BE_EXAMPLE = "0208:BE0404014205";

/** Trim + uppercase the country/scheme prefix. */
export function normalizePeppolId(raw: string): string {
  return (raw || "").trim().replace(/^0208:be/i, "0208:BE");
}

/** True if the string looks like a valid Belgian Peppol ID. */
export function isValidBePeppolId(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return PEPPOL_BE_REGEX.test(normalizePeppolId(raw));
}

/** True if the vendor is Belgian (based on `country_code`). Case-insensitive. */
export function isBelgianVendor(country_code?: string | null): boolean {
  return (country_code || "").trim().toUpperCase() === "BE";
}

/** Convenience: `true` if this vendor needs a Peppol ID but is missing one. */
export function isBePeppolMissing(vendor: { country_code?: string | null; peppol_id?: string | null }): boolean {
  return isBelgianVendor(vendor.country_code) && !vendor.peppol_id;
}

// ────────────────────────────────────────────────────────────────────────────
// Generic (multi-scheme) Peppol identifier helpers — used by the buyer-side
// e-invoicing settings (Flux B). Belgian 0208 remains the default suggestion,
// but other schemes are accepted (9925 VAT BE, 0192 NO, 9930 DE, …).
// ────────────────────────────────────────────────────────────────────────────

/** `scheme:identifier` — 4 digits, then 4..50 alphanumerics (mirrors the SQL check). */
export const PEPPOL_ANY_REGEX = /^[0-9]{4}:[A-Za-z0-9]{4,50}$/;

export function normalizeAnyPeppolId(raw: string | null | undefined): string {
  return (raw || "").trim().replace(/[\s.\-\/]/g, "").toUpperCase();
}

export function isValidAnyPeppolId(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return PEPPOL_ANY_REGEX.test(normalizeAnyPeppolId(raw));
}

export function peppolScheme(raw: string | null | undefined): string | null {
  const v = normalizeAnyPeppolId(raw);
  return PEPPOL_ANY_REGEX.test(v) ? v.split(":")[0] : null;
}

/**
 * Suggest `0208:<BCE>` from a bare enterprise number or a Belgian VAT number.
 * Returns null when no 10-digit Belgian company number can be derived.
 */
export function suggestBePeppolId(raw: string | null | undefined): string | null {
  const digits = (raw || "").toUpperCase().replace(/^BE/, "").replace(/\D/g, "");
  if (digits.length === 9) return `0208:0${digits}`;
  if (digits.length === 10) return `0208:${digits}`;
  return null;
}

export type PeppolDirectoryStatus = "unknown" | "found" | "not_found" | "error";

export const PEPPOL_DIRECTORY_LABEL: Record<PeppolDirectoryStatus, string> = {
  found: "Trouvé sur le réseau Peppol",
  not_found: "Introuvable sur le réseau Peppol",
  error: "Erreur de lookup",
  unknown: "Non vérifié",
};
