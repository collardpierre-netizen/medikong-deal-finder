export const MEDIKONG_PLACEHOLDER = "/medikong-placeholder.png";

const KNOWN_PLACEHOLDER_HASHES = [
  "6f37ced36498c7df3a3897a9dbbb3384",
];

const BLOCKED_URL_PATTERNS = [
  /image[._-]?non/i,
  /default[_-]?image/i,
  /no[._-]?image/i,
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const IMAGE_PROXY_PATH = "/functions/v1/image-proxy?url=";

// Hosts that serve images directly with permissive CORS / valid certs.
// We bypass the proxy and let the browser load them directly (CSP must allow them).
const PROXY_BYPASS_HOSTS = new Set<string>([
  "www.fresubin.be",
  "fresubin.be",
  "www.delical.fr",
  "delical.fr",
]);

export function isValidProductImage(url: string | undefined | null): boolean {
  if (!url || url.trim() === "") return false;
  if (/no.?image/i.test(url)) return false;
  if (KNOWN_PLACEHOLDER_HASHES.some(h => url.includes(h))) return false;
  if (BLOCKED_URL_PATTERNS.some(p => p.test(url))) return false;
  return true;
}

export function isMediKongProductImage(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.includes("/storage/v1/object/public/product-images/");
}

export function getPreferredProductImageUrls(urls: (string | null | undefined)[] | undefined | null): string[] {
  const unique = Array.from(new Set((urls || []).filter((url): url is string => isValidProductImage(url))));
  return unique.sort((a, b) => Number(isMediKongProductImage(b)) - Number(isMediKongProductImage(a)));
}

function isProxyUrl(url: string): boolean {
  return url.includes(IMAGE_PROXY_PATH);
}

function shouldProxyImage(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isProxyUrl(url)) return false;
  if (url.includes("/storage/v1/object/public/product-images/")) return false;
  if (SUPABASE_URL && url.startsWith(SUPABASE_URL)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (PROXY_BYPASS_HOSTS.has(host)) return false;
  } catch {
    // ignore parse errors, fall through to proxy
  }
  return true;
}

function buildProxyUrl(url: string): string {
  if (!SUPABASE_URL) return url;
  return `${SUPABASE_URL}${IMAGE_PROXY_PATH}${encodeURIComponent(url)}`;
}

export function getProductImageSrc(url: string | undefined | null): string {
  if (!isValidProductImage(url)) return MEDIKONG_PLACEHOLDER;
  const normalizedUrl = url!.trim();
  return shouldProxyImage(normalizedUrl) ? buildProxyUrl(normalizedUrl) : normalizedUrl;
}

/** Call in onLoad to detect Qogita "No Image Available" placeholder (618×602 with Q logo) */
export function isQogitaPlaceholder(img: HTMLImageElement): boolean {
  return img.naturalWidth === 618 && img.naturalHeight === 602;
}
