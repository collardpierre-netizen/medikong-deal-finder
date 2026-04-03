export const MEDIKONG_PLACEHOLDER = "/medikong-placeholder.png";

const KNOWN_PLACEHOLDER_HASHES = [
  "6f37ced36498c7df3a3897a9dbbb3384",
];

const BLOCKED_URL_PATTERNS = [
  /qogita/i,
];

export function isValidProductImage(url: string | undefined | null): boolean {
  if (!url || url.trim() === "") return false;
  if (/no.?image/i.test(url)) return false;
  if (KNOWN_PLACEHOLDER_HASHES.some(h => url.includes(h))) return false;
  if (BLOCKED_URL_PATTERNS.some(p => p.test(url))) return false;
  return true;
}

export function getProductImageSrc(url: string | undefined | null): string {
  return isValidProductImage(url) ? url! : MEDIKONG_PLACEHOLDER;
}
