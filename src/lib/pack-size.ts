/**
 * Helpers pour deviner le conditionnement (nombre d'unites par pack) d'un produit
 * a partir de son nom commercial OU des metadonnees de l'offre externe.
 *
 * Priorite cote front pour resoudre le pack effectif d'une offre externe :
 *   1. external_offers.pack_size_override (saisi en admin)
 *   2. products.pack_size (override admin sur le produit)
 *   3. extractPackSizeFromName(offer.raw_title) (titre brut chez le vendeur)
 *   4. extractPackSizeFromUrl(offer.product_url)  (URL de l'offre)
 *   5. extractPackSizeFromName(product.name) (heuristique sur le nom MediKong)
 *   6. 1 (fallback)
 *
 * Important : le pack vendu chez le vendeur externe (ex: carton de 24 cups)
 * est souvent different du pack de reference de la fiche produit (1 cup).
 * On donne donc la priorite aux infos provenant du vendeur (titre/URL) avant
 * de retomber sur le nom du produit MediKong.
 */

export type PackSizeSource =
  | "offer_override"
  | "product"
  | "offer_title_heuristic"
  | "offer_url_heuristic"
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
 * Tente d'extraire le pack depuis l'URL d'une offre externe.
 *
 * Patterns reconnus (slugs e-commerce typiques) :
 *   - ".../fresubin-vanille-24-x-cup-125-gr_1"   -> 24
 *   - ".../diben-15-x-500-ml-easy-bag"            -> 15
 *   - ".../tena-comfort-46-pcs"                   -> 46
 *   - ".../boite-de-30"                           -> 30
 */
export function extractPackSizeFromUrl(url: string | null | undefined): number | null {
  if (!url || typeof url !== "string") return null;
  // Normalise : on remplace les separateurs URL par des espaces pour reutiliser la regex du nom
  const normalized = url
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[/_]+/g, " ")
    .replace(/-/g, " ");
  return extractPackSizeFromName(normalized);
}

/**
 * Resout le pack effectif a appliquer sur une offre externe pour calculer
 * le prix unitaire affichable cote front.
 */
export function resolvePackSize(args: {
  offerOverride?: number | null;
  productPackSize?: number | null;
  productName?: string | null;
  offerTitle?: string | null;
  offerUrl?: string | null;
}): ResolvedPackSize {
  const { offerOverride, productPackSize, productName, offerTitle, offerUrl } = args;

  if (offerOverride && offerOverride > 0) {
    return { packSize: offerOverride, source: "offer_override" };
  }
  if (productPackSize && productPackSize > 0) {
    return { packSize: productPackSize, source: "product" };
  }
  // On regarde d'abord le titre brut chez le vendeur (souvent "Fresubin ... 24 x cup 125g")
  const fromTitle = extractPackSizeFromName(offerTitle);
  if (fromTitle && fromTitle > 0) {
    return { packSize: fromTitle, source: "offer_title_heuristic" };
  }
  // Puis l'URL de l'offre (slug e-commerce)
  const fromUrl = extractPackSizeFromUrl(offerUrl);
  if (fromUrl && fromUrl > 0) {
    return { packSize: fromUrl, source: "offer_url_heuristic" };
  }
  // En dernier recours, le nom MediKong (souvent c'est le produit unitaire)
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
    case "offer_title_heuristic":
      return "Conditionnement déduit du titre du vendeur";
    case "offer_url_heuristic":
      return "Conditionnement déduit de l'URL de l'offre";
    case "name_heuristic":
      return "Conditionnement déduit du nom du produit";
    case "fallback":
      return "Conditionnement inconnu (1 unité supposée)";
  }
}
