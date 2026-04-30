/**
 * Calcul de l'écart entre le prix MediKong (MK) et un prix marché concurrent.
 *
 * Convention (cf. ProductPage.tsx onglet "Prix du marché") :
 *   deltaAbs = mkHT − refPrice
 *     • < 0  → MK est moins cher (vert, signe "−")
 *     • > 0  → MK est plus cher  (rouge, signe "+")
 *   deltaPct = round(deltaAbs / mkHT * 100)  (référence = prix MK acheteur)
 *
 * Toutes les valeurs sont attendues à l'unité (€/u. HTVA), comme dans la page.
 * Le signe affiché et la classe couleur sont dérivés de `mkCheaper`.
 */

export type MarketDelta = {
  /** Écart absolu signé (€/u.) — null si non calculable */
  deltaAbs: number | null;
  /** Écart en % rapporté au prix MK, arrondi à l'entier — null si non calculable */
  deltaPct: number | null;
  /** true si MK est strictement moins cher que la référence */
  mkCheaper: boolean;
  /** Signe à afficher devant le montant et le % ("−" ou "+") */
  sign: "−" | "+" | "";
  /** Prix de référence concurrent retenu (cascade pharm > grossiste > public HTVA) */
  refPrice: number;
};

export type MarketDeltaInput = {
  /** Prix MediKong HTVA à l'unité (€/u.) */
  mkHT: number;
  /** Prix pharmacien HTVA à l'unité (€/u.) — 0 si source online ou indispo */
  pharmHT?: number | null;
  /** Prix grossiste HTVA à l'unité (€/u.) — 0 si indispo */
  grossisteHT?: number | null;
  /** Prix public HTVA à l'unité (€/u.) — dérivé du TTC pour les sources online */
  publicHTVA?: number | null;
};

/**
 * Sélectionne le prix de référence concurrent selon la cascade utilisée
 * dans l'onglet "Prix du marché" : pharmacien HT > grossiste HT > public HTVA.
 * Retourne 0 si aucune valeur exploitable.
 */
export function pickReferencePrice(input: Pick<MarketDeltaInput, "pharmHT" | "grossisteHT" | "publicHTVA">): number {
  const pharm = Number(input.pharmHT) || 0;
  const grossiste = Number(input.grossisteHT) || 0;
  const pub = Number(input.publicHTVA) || 0;
  return pharm || grossiste || pub || 0;
}

/**
 * Calcule l'écart MK vs concurrent pour une ligne de la table "Prix du marché".
 * Renvoie deltaAbs/deltaPct = null si le calcul n'est pas exploitable
 * (mkHT ≤ 0 ou aucune référence concurrente).
 */
export function computeMarketDelta(input: MarketDeltaInput): MarketDelta {
  const mkHT = Number(input.mkHT) || 0;
  const refPrice = pickReferencePrice(input);

  if (!refPrice || !mkHT) {
    return {
      deltaAbs: null,
      deltaPct: null,
      mkCheaper: false,
      sign: "",
      refPrice,
    };
  }

  const deltaAbs = mkHT - refPrice;
  const deltaPct = Math.round((deltaAbs / mkHT) * 100);
  const mkCheaper = deltaAbs < 0;

  return {
    deltaAbs,
    deltaPct,
    mkCheaper,
    sign: mkCheaper ? "−" : "+",
    refPrice,
  };
}
