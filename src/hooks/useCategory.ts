import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

type Locale = "fr" | "nl" | "en";

function normalizeLocale(raw: string | undefined): Locale {
  const lang = (raw || "fr").slice(0, 2).toLowerCase();
  if (lang === "nl") return "nl";
  if (lang === "en") return "en";
  return "fr";
}

export type CategoryRecord = {
  id: string;
  slug: string;
  name: string;
  name_fr: string | null;
  name_nl: string | null;
  name_en: string | null;
  parent_id: string | null;
  level: number | null;
};

/**
 * Fetch a single category by slug, including localized name columns.
 * Used to render H1 / active filter chips with the proper localized name
 * instead of the technical slug.
 */
export function useCategory(slug: string | undefined | null) {
  return useQuery({
    queryKey: ["category-by-slug", slug],
    enabled: !!slug,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<CategoryRecord | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, name_fr, name_nl, name_en, parent_id, level")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as CategoryRecord) ?? null;
    },
  });
}

/** Picks the best localized label, falling back across locales then to `name`. */
export function pickCategoryLabel(
  cat: Pick<CategoryRecord, "name" | "name_fr" | "name_nl" | "name_en" | "slug"> | null | undefined,
  language: string | undefined,
): string {
  if (!cat) return "";
  const locale = normalizeLocale(language);
  const candidates: (string | null | undefined)[] = [];
  if (locale === "fr") candidates.push(cat.name_fr, cat.name_en, cat.name_nl);
  else if (locale === "nl") candidates.push(cat.name_nl, cat.name_en, cat.name_fr);
  else candidates.push(cat.name_en, cat.name_fr, cat.name_nl);
  candidates.push(cat.name);
  const found = candidates.find((c) => c && c.trim().length > 0);
  return found ?? cat.slug ?? "";
}

/** Hook returning the localized label for a slug (empty string while loading). */
export function useCategoryLabel(slug: string | undefined | null): string {
  const { i18n } = useTranslation();
  const { data, isLoading } = useCategory(slug);
  if (!slug) return "";
  // During the first fetch we have no data yet; return "" so callers can show
  // a skeleton instead of flashing the technical slug.
  if (isLoading && !data) return "";
  return pickCategoryLabel(data, i18n.language) || slug;
}

/** Hook returning {label, isLoading} for callers that need a skeleton. */
export function useCategoryLabelStatus(slug: string | undefined | null): {
  label: string;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const { data, isLoading } = useCategory(slug);
  if (!slug) return { label: "", isLoading: false };
  const label = data ? pickCategoryLabel(data, i18n.language) || slug : "";
  return { label, isLoading: isLoading && !data };
}
