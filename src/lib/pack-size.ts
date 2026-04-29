/**
 * Helpers pour deviner le conditionnement (nombre d'unites par pack) d'un produit
 * a partir de son nom commercial.
 *
 * Priorite cote front pour resoudre le pack effectif d'une offre externe :
 *   1. external_offers.pack_size_override (saisi en admin)
 *   2. products.pack_size (override admin sur le produit)
 *   3. extractPackSizeFromName(product.name) (heuristique regex)
 *   4. 1 (fallback)
 *
 * Le RPC SQL `resolve_effective_pack_size` couvre les 3 premiers niveaux cote DB,
 * mais on garde l'extraction depuis le nom cote front pour eviter un round-trip
 * et pour les produits jamais saisis en admin.
 */

export type PackSizeSource =
  | "offer_override"
  | "product"
  | "name_heuristic"
  | "fallback";

export interface ResolvedPackSize {
  packSize: number;
  source: PackSizeSource;
}

/**
 * Tente d'extraire le nombre d'unites par pack depuis le nom commercial du produit.
 *
 * Patterns reconnus (insensibles a la casse, espaces flexibles) :
 *   - "4 x 125 ml", "4x125ml", "4 X 125 mL"          -> 4
 *   - "30 caps", "30 capsules", "60 cps", "30 gel."  -> 30
 *   - "30 comprimes", "30 cp", "30 cpr"              -> 30
 *   - "30 sachets", "20 sticks", "10 ampoules"       -> 30/20/10
 *   - "Boite de 30", "Pack de 4"                     -> 30/4
 *
 * Retourne null si rien d'exploitable trouve. On ne retourne JAMAIS un nombre
 * qui pourrait etre un dosage pur (ex: "500 mg" seul -> ignore).
 */
export function extractPackSizeFromName(name: string | null | undefined): number | null {
  if (!name || typeof name !== "string") return null;
  const cleaned = name.trim();
  if (!cleaned) return null;

  // 1) "N x Q unite" (ex: "4 x 125 ml") -> on prend N
  //    On exige une unite de volume/masse derriere le Q pour eviter les faux positifs.
  const multiPack = cleaned.match(
    /\b(\d{1,3})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(ml|cl|l|g|mg|kg|cc)\b/i
  );
  if (multiPack) {
    const n = Number(multiPack[1]);
    if (n >= 2 && n <= 500) return n;
  }

  // 2) "N <forme galenique>" (caps, capsules, comprimes, gelules, sachets, sticks, ampoules, doses, sprays, patchs)
  const galenicForms =
    /\b(\d{1,4})\s*(caps?|capsules?|cps|comprim[eé]s?|cpr?|c[oó]mp|g[eé]lules?|gel\.?|sachets?|sticks?|ampoules?|amp\.?|doses?|sprays?|patchs?|tabl(?:ettes)?|pastilles?|suppositoires?|supp\.?|ovules?|lingettes?|pi[èe]ces?|pcs?)\b/i;
  const galenicMatch = cleaned.match(galenicForms);
  if (galenicMatch) {
    const n = Number(galenicMatch[1]);
    if (n >= 2 && n <= 1000) return n;
  }

  // 3) "Boite/Pack/Lot de N" (FR) ou "Box/Pack of N" (EN)
  const containerOf = cleaned.match(
    /\b(?:bo[iî]te|pack|lot|paquet|box|set)\s*(?:de|d['’]|of)\s*(\d{1,4})\b/i
  );
  if (containerOf) {
    const n = Number(containerOf[1]);
    if (n >= 2 && n <= 1000) return n;
  }

  return null;
}

/**
 * Resout le pack effectif a appliquer sur une offre externe pour calculer
 * le prix unitaire affichable cote front.
 */
export function resolvePackSize(args: {
  offerOverride?: number | null;
  productPackSize?: number | null;
  productName?: string | null;
}): ResolvedPackSize {
  const { offerOverride, productPackSize, productName } = args;

  if (offerOverride && offerOverride > 0) {
    return { packSize: offerOverride, source: "offer_override" };
  }
  if (productPackSize && productPackSize > 0) {
    return { packSize: productPackSize, source: "product" };
  }
  const heur = extractPackSizeFromName(productName);
  if (heur && heur > 0) {
    return { packSize: heur, source: "name_heuristic" };
  }
  return { packSize: 1, source: "fallback" };
}

export function packSizeSourceLabel(source: PackSizeSource): string {
  switch (source) {
    case "offer_override":
      return "Conditionnement renseigné sur l'offre";
    case "product":
      return "Conditionnement renseigné sur la fiche produit";
    case "name_heuristic":
      return "Conditionnement déduit du nom du produit";
    case "fallback":
      return "Conditionnement inconnu (1 unité supposée)";
  }
}
