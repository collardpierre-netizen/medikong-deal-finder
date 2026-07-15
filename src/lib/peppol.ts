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
