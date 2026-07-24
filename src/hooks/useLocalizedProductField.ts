import { useTranslation } from "react-i18next";
import { useAutoTranslate } from "./useAutoTranslate";

type ProductField = "name" | "short_description" | "description";

/**
 * Résout un champ produit localisé selon la langue courante de l'UI.
 *
 * Cascade :
 *   1. Colonne DB préexistante `products.<field>_<lang>` (fetchée dans productDetails).
 *   2. Cache write-through via `useAutoTranslate` (edge function `translate-and-cache`),
 *      qui persiste dans products.<field>_<lang> pour les prochains visiteurs.
 *   3. Fallback : valeur source telle quelle.
 *
 * Utilisation :
 *   const displayName = useLocalizedProductField(product?.id, productDetails, "name", product?.name);
 */
export function useLocalizedProductField(
  productId: string | null | undefined,
  productDetails: Record<string, any> | null | undefined,
  field: ProductField,
  fallback: string | null | undefined,
): string {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.substring(0, 2) || "fr") as "fr" | "nl" | "en" | "de";

  // 1) Colonne DB déjà remplie ?
  const dbLocalized = productDetails?.[`${field}_${lang}`];
  const dbSource = productDetails?.[field];
  const source = (dbSource || fallback || "").toString();
  const hasDbLocalized = typeof dbLocalized === "string" && dbLocalized.trim().length > 0;

  // 2) On appelle toujours useAutoTranslate (hook au top-level) mais on lui passe
  //    une chaîne vide si la version DB est déjà connue → aucun appel edge.
  //    sourceLang="auto" pour ne pas court-circuiter la traduction si la source
  //    n'est pas en FR (ex. fiches Qogita rédigées en anglais).
  const { translated } = useAutoTranslate(hasDbLocalized ? "" : source, {
    productId: productId || undefined,
    field,
    sourceLang: "auto",
  });

  if (hasDbLocalized) return dbLocalized as string;
  return translated || source;
}
