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

  // Si la version localisée existe en DB, on l'utilise directement — pas d'appel edge.
  if (typeof dbLocalized === "string" && dbLocalized.trim()) {
    return dbLocalized;
  }

  // 2) Sinon on tente une traduction (write-through cache) avec l'auto-translate hook.
  //    useAutoTranslate est un hook — on doit toujours l'appeler, même si on n'en a
  //    finalement pas besoin (source vide) pour respecter l'ordre des hooks.
  const { translated } = useAutoTranslate(source, {
    productId: productId || undefined,
    field,
  });

  return translated || source;
}
