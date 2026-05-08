/**
 * Wording centralisé des promesses livraison.
 *
 * Règles produit (cf. ticket "Aligner les promesses de livraison") :
 *  - Aucune mention de gratuité ni de seuil global.
 *  - Promesse globale = plancher honnête : "dès 2 à 3 jours ouvrables, selon le vendeur".
 *  - Le délai réel reste porté par chaque offre fournisseur (offer.deliveryDays).
 *  - Badge "Sous 48 h" sur les offres dont deliveryDays <= 2.
 */

export type ShippingCopyLocale = "fr" | "nl" | "en" | "de";

export const SHIPPING_COPY = {
  global: {
    fr: "Livraison dès 2 à 3 jours ouvrables, selon le vendeur",
    nl: "Levering vanaf 2 tot 3 werkdagen, afhankelijk van de leverancier",
    en: "Delivery from 2 to 3 working days, depending on supplier",
    de: "Lieferung ab 2 bis 3 Werktagen, je nach Anbieter",
  },
  short: {
    fr: "Livraison dès 2-3 jours ouvrables",
    nl: "Levering vanaf 2-3 werkdagen",
    en: "Delivery from 2-3 working days",
    de: "Lieferung ab 2-3 Werktagen",
  },
  pro: {
    fr: 'Délais variables selon le vendeur — dès 2 à 3 jours ouvrables. Filtrez sur "Le plus rapide" pour les expéditions sous 48 h.',
    nl: 'Levertijden variëren per leverancier — vanaf 2 tot 3 werkdagen. Filter op "Snelste levering" voor verzendingen binnen 48 u.',
    en: 'Delivery times vary by supplier — from 2 to 3 working days. Filter "Fastest" to see suppliers shipping within 48h.',
    de: 'Lieferzeiten variieren je nach Anbieter — ab 2 bis 3 Werktagen. Filtern Sie nach "Am schnellsten" für Versand innerhalb von 48 Std.',
  },
  fastBadge: {
    fr: "Sous 48 h",
    nl: "Binnen 48 u",
    en: "Within 48h",
    de: "Innerhalb 48 Std.",
  },
} as const;

const FALLBACK: ShippingCopyLocale = "fr";

function pickLocale(input?: string | null): ShippingCopyLocale {
  if (!input) return FALLBACK;
  const code = input.toLowerCase().slice(0, 2);
  return (["fr", "nl", "en", "de"] as ShippingCopyLocale[]).includes(code as ShippingCopyLocale)
    ? (code as ShippingCopyLocale)
    : FALLBACK;
}

export function shippingCopy(
  variant: keyof typeof SHIPPING_COPY,
  locale?: string | null,
): string {
  return SHIPPING_COPY[variant][pickLocale(locale)];
}

/** Seuil considéré "expédition rapide" pour le badge fastBadge. */
export const FAST_SHIPPING_MAX_DAYS = 2;
