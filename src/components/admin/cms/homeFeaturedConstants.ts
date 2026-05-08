/**
 * Helpers partagés pour les pages admin de curation home.
 * Les locales correspondent à l'enum SQL `home_featured_locale`.
 */
export const HOME_FEATURED_LOCALES = [
  { value: "all", label: "Toutes" },
  { value: "fr", label: "FR" },
  { value: "nl", label: "NL" },
  { value: "de", label: "DE" },
  { value: "en", label: "EN" },
] as const;

export type HomeFeaturedLocale = (typeof HOME_FEATURED_LOCALES)[number]["value"];

export const HOME_FEATURED_BADGES = [
  { value: "bestseller", label: "Bestseller" },
  { value: "top_vente", label: "Top vente" },
  { value: "nouveau", label: "Nouveau" },
  { value: "promo", label: "Promo" },
] as const;

export type HomeFeaturedBadgeValue = (typeof HOME_FEATURED_BADGES)[number]["value"];
