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
 * Enrichit une liste d'offres ReStock avec `catalog_image_url` en résolvant
 * l'image du catalogue MediKong via EAN (products.gtin) puis CNK (products.cnk_code).
 * Ne requête que pour les offres qui n'ont aucune image propre.
 */
export async function attachRestockCatalogImages<T extends Record<string, any>>(offers: T[]): Promise<T[]> {
  if (!offers.length) return offers;

  const needs = offers.filter((o) => !resolveRestockOfferImage(o));
  if (!needs.length) return offers;

  const eans = [...new Set(needs.map((o) => norm(o.ean)).filter(Boolean))];
  const cnks = [...new Set(needs.map((o) => norm(o.cnk)).filter(Boolean))];

  const byEan: Record<string, string> = {};
  const byCnk: Record<string, string> = {};

  const queries: Promise<void>[] = [];
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

  return offers.map((o) => {
    if (resolveRestockOfferImage(o)) return o;
    const hit = byEan[norm(o.ean)] || byCnk[norm(o.cnk)];
    return hit ? ({ ...o, catalog_image_url: hit } as T) : o;
  });
}
