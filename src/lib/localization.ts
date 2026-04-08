import i18n from "i18next";

/**
 * Returns the localized name for a DB entity that has name + name_fr/name_nl/name_de columns.
 * Falls back to the original name if no translation exists.
 */
export function getLocalizedName(
  item: { name: string; name_fr?: string | null; name_nl?: string | null; name_de?: string | null },
  lang?: string
): string {
  const currentLang = lang || i18n.language?.substring(0, 2) || "fr";
  if (currentLang === "fr" && item.name_fr) return item.name_fr;
  if (currentLang === "nl" && item.name_nl) return item.name_nl;
  if (currentLang === "de" && item.name_de) return item.name_de;
  return item.name;
}

/**
 * Returns the localized description for a product.
 */
export function getLocalizedDescription(
  item: { description?: string | null; description_fr?: string | null; description_nl?: string | null; description_de?: string | null; short_description?: string | null },
  lang?: string
): string | undefined {
  const currentLang = lang || i18n.language?.substring(0, 2) || "fr";
  if (currentLang === "fr" && item.description_fr) return item.description_fr;
  if (currentLang === "nl" && item.description_nl) return item.description_nl;
  if (currentLang === "de" && item.description_de) return item.description_de;
  return item.description || item.short_description || undefined;
}
