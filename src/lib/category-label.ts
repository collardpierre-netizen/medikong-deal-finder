/**
 * Lightweight client-side dictionary used to patch category labels that
 * remain untranslated in the database (typically Dutch terms inherited
 * from legacy imports). The DB-level localisation (`name_fr/name_nl/name_de`)
 * always wins when present — this is only a final, per-segment fallback.
 */

type Lang = "fr" | "nl" | "de";

const DICT: Record<string, Partial<Record<Lang, string>>> = {
  Aanbiedingen: { fr: "Promotions", nl: "Aanbiedingen", de: "Angebote" },
  Nieuwigheden: { fr: "Nouveautés", nl: "Nieuwigheden", de: "Neuheiten" },
  Promoties: { fr: "Promotions", nl: "Promoties", de: "Angebote" },
  Geneesmiddelen: { fr: "Médicaments", nl: "Geneesmiddelen", de: "Arzneimittel" },
  Verzorging: { fr: "Soins", nl: "Verzorging", de: "Pflege" },
  Hygiëne: { fr: "Hygiène", nl: "Hygiëne", de: "Hygiene" },
  Welzijn: { fr: "Bien-être", nl: "Welzijn", de: "Wohlbefinden" },
  Voeding: { fr: "Nutrition", nl: "Voeding", de: "Ernährung" },
  Kinderen: { fr: "Enfants", nl: "Kinderen", de: "Kinder" },
  Baby: { fr: "Bébé", nl: "Baby", de: "Baby" },
  Mama: { fr: "Maman", nl: "Mama", de: "Mama" },
  Cadeaus: { fr: "Cadeaux", nl: "Cadeaus", de: "Geschenke" },
  Huidverzorging: { fr: "Soins de la peau", nl: "Huidverzorging", de: "Hautpflege" },
  Haarverzorging: { fr: "Soins capillaires", nl: "Haarverzorging", de: "Haarpflege" },
  Mondverzorging: { fr: "Soins bucco-dentaires", nl: "Mondverzorging", de: "Mundpflege" },
};

function translateSegment(segment: string, lang: Lang): string {
  const trimmed = segment.trim();
  const hit = DICT[trimmed];
  if (hit && hit[lang]) return hit[lang]!;
  return trimmed;
}

/**
 * Cleans a category label for sidebar display.
 *
 * - If the value contains "A > B > C" (legacy breadcrumb stored as the name),
 *   keep only the most specific (last) segment.
 * - Translate any remaining segment with the local dictionary.
 *
 * Returns `{ short, full }` so callers can show the cleaned label and keep
 * the full breadcrumb as a tooltip.
 */
export function cleanCategoryLabel(
  rawName: string | null | undefined,
  lang: string = "fr"
): { short: string; full: string } {
  const safe = (rawName || "").trim();
  if (!safe) return { short: "—", full: "" };
  const l = (lang.substring(0, 2) as Lang);
  const useLang: Lang = l === "nl" || l === "de" ? l : "fr";

  if (safe.includes(">")) {
    const segments = safe.split(">").map((s) => translateSegment(s, useLang));
    const short = segments[segments.length - 1] || segments[0];
    return { short, full: segments.join(" › ") };
  }

  const translated = translateSegment(safe, useLang);
  return { short: translated, full: translated };
}
