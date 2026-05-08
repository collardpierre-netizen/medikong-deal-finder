import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export type MasterCategory = {
  id: string;
  slug: string;
  parent_id: string | null;
  level: number;
  position: number;
  icon: string | null;
  is_featured_top: boolean;
  name: string;
  description: string | null;
};

type Locale = "fr" | "nl" | "en";

function normalizeLocale(raw: string | undefined): Locale {
  const lang = (raw || "fr").slice(0, 2).toLowerCase();
  if (lang === "nl") return "nl";
  if (lang === "en") return "en";
  return "fr";
}

/**
 * Lit la taxonomie maîtresse MediKong filtrée par niveau et localisée.
 * Fallback EN puis FR si la traduction de la locale demandée est absente.
 */
export function useCategories(level: 1 | 2 | 3 = 1) {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);

  return useQuery({
    queryKey: ["master-categories", level, locale],
    queryFn: async (): Promise<MasterCategory[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select(
          `id, slug, parent_id, level, display_order, icon, is_featured_top,
           translations:category_translations(locale, name, description)`
        )
        .eq("level", level)
        .eq("is_active", true)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;

      return (data || []).map((row: any) => {
        const list: { locale: string; name: string; description: string | null }[] =
          row.translations || [];
        const pick =
          list.find((t) => t.locale === locale) ||
          list.find((t) => t.locale === "en") ||
          list.find((t) => t.locale === "fr") ||
          null;
        return {
          id: row.id,
          slug: row.slug,
          parent_id: row.parent_id,
          level: row.level,
          position: row.display_order ?? 0,
          icon: row.icon,
          is_featured_top: !!row.is_featured_top,
          name: pick?.name ?? row.slug,
          description: pick?.description ?? null,
        } satisfies MasterCategory;
      });
    },
    staleTime: 1000 * 60 * 60,
  });
}

/** Sous-ensemble : catégories niveau 1 marquées en avant pour la home / hero catalogue. */
export function useFeaturedTopCategories() {
  const q = useCategories(1);
  return {
    ...q,
    data: (q.data || []).filter((c) => c.is_featured_top),
  };
}
