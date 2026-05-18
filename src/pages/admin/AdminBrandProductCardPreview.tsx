import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { BrandProductCard, type BrandProductCardItem } from "@/components/brand/BrandProductCard";

/**
 * Page admin isolée pour valider visuellement le BrandProductCard.
 * Sélectionne 8 produits actifs avec offre pour la marque "Nivea"
 * (la plus chargée d'après l'EXPLAIN ANALYZE).
 */
export default function AdminBrandProductCardPreview() {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ["admin-brand-card-preview"],
    queryFn: async (): Promise<BrandProductCardItem[]> => {
      const { data: brand } = await supabase
        .from("brands")
        .select("id, name, slug")
        .eq("slug", "nivea")
        .maybeSingle();
      if (!brand) return [];

      const { data, error } = await supabase
        .from("products_with_country_stats_v")
        .select(
          "id, slug, name, name_fr, name_nl, name_de, brand_name, gtin, cnk_code, image_url, image_urls, short_description, is_promotion, promotion_label, country_best_price_excl_vat, country_best_price_incl_vat, country_offer_count, country_total_stock, country_is_in_stock"
        )
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .eq("country_code", "BE")
        .gt("country_offer_count", 0)
        .order("country_offer_count", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        name_fr: row.name_fr,
        name_nl: row.name_nl,
        name_de: row.name_de,
        brand_name: row.brand_name,
        gtin: row.gtin,
        cnk_code: row.cnk_code,
        image_url: row.image_url,
        image_urls: row.image_urls,
        short_description: row.short_description,
        is_promotion: row.is_promotion,
        promotion_label: row.promotion_label,
        best_price_excl_vat: row.country_best_price_excl_vat,
        best_price_incl_vat: row.country_best_price_incl_vat,
        offer_count: row.country_offer_count,
        total_stock: row.country_total_stock,
        is_in_stock: row.country_is_in_stock,
      })) as BrandProductCardItem[];
    },
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <Helmet>
        <title>Preview · BrandProductCard | Admin MediKong</title>
      </Helmet>

      <header className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link to="/admin" className="hover:underline">Admin</Link> /
          <span className="ml-1">Preview composants</span>
        </p>
        <h1 className="text-2xl font-semibold mt-1">BrandProductCard — preview isolée</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sprint 1 fiche marque. 8 produits Nivea (top par nombre d'offres).
          Vérifier : nom localisé, EAN+CNK, prix HT+TTC, badge PVP inline,
          stock, compteur d'offres, CTA gated selon profil.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && (
        <p className="text-sm text-destructive">Erreur : {(error as Error).message}</p>
      )}

      {products && (
        <>
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Grille standard (sans nom de marque — contexte fiche marque)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p, i) => (
                <BrandProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Variante avec marque visible (debug)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.slice(0, 4).map((p, i) => (
                <BrandProductCard key={`b-${p.id}`} product={{ ...p, avg_delivery_days: 4 }} index={i} showBrand />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Les 4 cartes ci-dessus injectent <code>avg_delivery_days = 4</code> pour valider l'affichage "~4 j".
            </p>
          </section>
        </>
      )}
    </div>
  );
}
