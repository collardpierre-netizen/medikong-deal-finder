/**
 * Hooks de lecture publique pour la curation pilotable de la home
 * (cf. mémoire `home-curation-pilotable`).
 *
 * - useHomeFeaturedBrands  → public_home_featured_brands_v
 * - useHomeFeaturedProducts → public_home_featured_products_v
 *
 * Filtrage automatique sur la locale courante (i18n) + 'all'.
 * Auto-masquage : si moins de N entrées éligibles, on renvoie [] pour que la
 * section UI puisse simplement ne pas s'afficher (préférable à un placeholder).
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export type HomeFeaturedBrand = {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  logo_url: string | null;
  website_url: string | null;
  position: number;
  locale: "fr" | "nl" | "de" | "en" | "all";
};

export type HomeFeaturedBadge = "bestseller" | "top_vente" | "nouveau" | "promo";

export type HomeFeaturedProduct = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string | null;
  image_urls: string[] | null;
  brand_id: string | null;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  best_price_excl_vat: number | null;
  best_price_incl_vat: number | null;
  offer_count: number | null;
  position: number;
  locale: "fr" | "nl" | "de" | "en" | "all";
  badge: HomeFeaturedBadge | null;
};

const MIN_BRANDS_TO_DISPLAY = 6;
const MIN_PRODUCTS_TO_DISPLAY = 4;

function useLocaleShort() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "fr").split("-")[0];
  if (lang === "nl" || lang === "de" || lang === "en") return lang;
  return "fr";
}

export function useHomeFeaturedBrands() {
  const locale = useLocaleShort();
  return useQuery({
    queryKey: ["home-featured-brands-curated", locale],
    queryFn: async (): Promise<HomeFeaturedBrand[]> => {
      const { data, error } = await supabase
        .from("public_home_featured_brands_v")
        .select("id,brand_id,brand_name,brand_slug,logo_url,website_url,position,locale")
        .in("locale", [locale, "all"])
        .order("position", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as HomeFeaturedBrand[];
      // Garde seulement les marques avec un logo ou un domaine pour Clearbit
      const usable = rows.filter((b) => b.logo_url || b.website_url);
      if (usable.length < MIN_BRANDS_TO_DISPLAY) return [];
      return usable;
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useHomeFeaturedProducts() {
  const locale = useLocaleShort();
  return useQuery({
    queryKey: ["home-featured-products-curated", locale],
    queryFn: async (): Promise<HomeFeaturedProduct[]> => {
      const { data, error } = await supabase
        .from("public_home_featured_products_v")
        .select(
          "id,product_id,product_name,product_slug,image_url,image_urls,brand_id,brand_name,category_id,category_name,best_price_excl_vat,best_price_incl_vat,offer_count,position,locale,badge",
        )
        .in("locale", [locale, "all"])
        .order("position", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as HomeFeaturedProduct[];
      if (rows.length < MIN_PRODUCTS_TO_DISPLAY) return [];
      return rows;
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export const HOME_FEATURED_BADGE_LABEL: Record<HomeFeaturedBadge, string> = {
  bestseller: "Bestseller",
  top_vente: "Top vente",
  nouveau: "Nouveau",
  promo: "Promo",
};
