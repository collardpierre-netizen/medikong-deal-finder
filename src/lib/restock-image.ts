import { supabase } from "@/integrations/supabase/client";
import { isValidProductImage } from "@/lib/image-utils";

/**
 * Cascade d'affichage image pour une offre ReStock :
 * product_image_url → photos[0] → photo_url → image produit MediKong rattaché
 * → image catalogue résolue par EAN/CNK (champ `catalog_image_url` injecté par
 *   `attachRestockCatalogImages`).
 * Retourne null si aucune image valide → le composant affiche son placeholder.
 */
export function resolveRestockOfferImage(offer: any): string | null {
  if (!offer) return null;
  const photos: unknown = offer.photos;
  const firstPhoto = Array.isArray(photos)
    ? photos.map((p) => (typeof p === "string" ? p : (p as any)?.url)).find((p) => typeof p === "string" && p.trim())
    : null;

  const candidates = [
    offer.product_image_url,
    firstPhoto,
    offer.photo_url,
    offer.medikong_product?.image_url,
    offer.catalog_image_url,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && isValidProductImage(c)) return c;
  }
  return null;
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : v ? String(v).trim() : "");

/**
 * Cache mémoire des résolutions d'images catalogue par EAN/CNK.
 * `null` = code déjà interrogé sans résultat (évite de re-requêter en boucle).
 */
const CATALOG_IMAGE_TTL_MS = 10 * 60 * 1000;
type CacheEntry = { url: string | null; at: number };
const eanImageCache = new Map<string, CacheEntry>();
const cnkImageCache = new Map<string, CacheEntry>();

function cacheGet(cache: Map<string, CacheEntry>, key: string): CacheEntry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CATALOG_IMAGE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit;
}

const cacheSet = (cache: Map<string, CacheEntry>, key: string, url: string | null) =>
  cache.set(key, { url, at: Date.now() });

/** Vide le cache mémoire (tests / invalidation manuelle). */
export function clearRestockCatalogImageCache() {
  eanImageCache.clear();
  cnkImageCache.clear();
}

/**
 * Enrichit une liste d'offres ReStock avec `catalog_image_url` en résolvant
 * l'image du catalogue MediKong via EAN (products.gtin) puis CNK (products.cnk_code).
 * Ne requête que pour les offres qui n'ont aucune image propre et dont le code
 * n'est pas déjà mémorisé.
 */
export async function attachRestockCatalogImages<T extends Record<string, any>>(offers: T[]): Promise<T[]> {
  if (!offers.length) return offers;

  const needs = offers.filter((o) => !resolveRestockOfferImage(o));
  if (!needs.length) return offers;

  const eans = [...new Set(needs.map((o) => norm(o.ean)).filter(Boolean))].filter(
    (e) => !cacheGet(eanImageCache, e),
  );
  const cnks = [...new Set(needs.map((o) => norm(o.cnk)).filter(Boolean))].filter(
    (c) => !cacheGet(cnkImageCache, c),
  );

  const byEan: Record<string, string> = {};
  const byCnk: Record<string, string> = {};

  const queries: PromiseLike<void>[] = [];

  if (eans.length) {
    queries.push(
      supabase
        .from("products")
        .select("gtin, image_url")
        .in("gtin", eans.slice(0, 500))
        .not("image_url", "is", null)
        .then(({ data }) => {
          (data || []).forEach((p: any) => {
            const k = norm(p.gtin);
            if (k && p.image_url && !byEan[k]) byEan[k] = p.image_url;
          });
        }),
    );
  }
  if (cnks.length) {
    queries.push(
      supabase
        .from("products")
        .select("cnk_code, image_url")
        .in("cnk_code", cnks.slice(0, 500))
        .not("image_url", "is", null)
        .then(({ data }) => {
          (data || []).forEach((p: any) => {
            const k = norm(p.cnk_code);
            if (k && p.image_url && !byCnk[k]) byCnk[k] = p.image_url;
          });
        }),
    );
  }

  try {
    await Promise.all(queries);
  } catch {
    return offers;
  }

  // Mémorise résultats et misses pour les codes réellement interrogés
  eans.forEach((e) => cacheSet(eanImageCache, e, byEan[e] ?? null));
  cnks.forEach((c) => cacheSet(cnkImageCache, c, byCnk[c] ?? null));

  return offers.map((o) => {
    if (resolveRestockOfferImage(o)) return o;
    const ean = norm(o.ean);
    const cnk = norm(o.cnk);
    const hit =
      (ean ? cacheGet(eanImageCache, ean)?.url : null) || (cnk ? cacheGet(cnkImageCache, cnk)?.url : null);
    return hit ? ({ ...o, catalog_image_url: hit } as T) : o;

  });
}
