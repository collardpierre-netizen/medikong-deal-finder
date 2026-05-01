import { Link } from "react-router-dom";
import { Clock, X, Tag, FolderOpen, Package, ChevronRight } from "lucide-react";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProductImageSrc, isQogitaPlaceholder, isValidProductImage, MEDIKONG_PLACEHOLDER } from "@/lib/image-utils";

/**
 * Bloc "Reprenez là où vous en étiez" — inspiré de Trivago.
 * Affiché sur la HomePage sous la barre de recherche, uniquement si
 * l'utilisateur a déjà interagi avec le site (sinon = caché, zéro pollution
 * pour le 1er visit).
 *
 * UX :
 * - Une seule rangée de raccourcis (termes + taxons) dédoublonnés et alignés à gauche
 *   (les marques/catégories priment sur un terme tapé qui matche leur nom).
 * - Une rangée scrollable de produits consultés, plus aérée, avec libellé de marque.
 * - Header sobre avec compteur discret et bouton "Effacer" plus lisible.
 */
export function RecentSearches() {
  const { terms, products, taxons, isEmpty, clear } = useRecentSearches();
  const productIds = useMemo(() => products.map((p) => p.id).filter(Boolean), [products]);

  const { data: productMeta = {} } = useQuery({
    queryKey: ["recent-product-meta", productIds.join("|")],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, image_urls, image_url, brand_name")
        .in("id", productIds);

      return Object.fromEntries(
        (data || []).map((row: any) => {
          const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
          const firstValid =
            imageUrls.find((url: string) => isValidProductImage(url)) ??
            (isValidProductImage(row.image_url) ? row.image_url : null);
          return [
            row.id,
            {
              image: firstValid ? getProductImageSrc(firstValid) : null,
              brand: row.brand_name as string | null,
            },
          ];
        })
      ) as Record<string, { image: string | null; brand: string | null }>;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Dédoublonnage termes vs taxons : si un terme tapé matche le nom d'une marque/catégorie
  // déjà visitée, on n'affiche que le taxon (plus actionnable).
  const taxonNames = useMemo(
    () => new Set(taxons.map((t) => t.name.trim().toLowerCase())),
    [taxons]
  );
  const filteredTerms = useMemo(
    () => terms.filter((t) => !taxonNames.has(t.q.trim().toLowerCase())),
    [terms, taxonNames]
  );

  const totalShortcuts = filteredTerms.length + taxons.length;

  if (isEmpty) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      className="max-w-[920px] mx-auto mt-6 mb-2 px-2"
      aria-label="Reprenez votre exploration"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-mk-navy">
          <Clock size={15} className="text-mk-blue" />
          <span>Reprenez là où vous en étiez</span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-mk-ter hover:text-destructive inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-destructive/5 transition-colors"
          aria-label="Effacer l'historique récent"
        >
          <X size={12} />
          <span>Effacer</span>
        </button>
      </div>

      {/* Raccourcis : termes + taxons fusionnés sur une rangée alignée à gauche */}
      {totalShortcuts > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {/* Taxons d'abord (plus actionnables : page dédiée) */}
          {taxons.map((t) => {
            const Icon = t.type === "brand" ? Tag : FolderOpen;
            const typeLabel = t.type === "brand" ? "Marque" : "Catégorie";
            return (
              <Link
                key={`${t.type}-${t.slug}`}
                to={t.type === "brand" ? `/marques/${t.slug}` : `/categorie/${t.slug}`}
                className="group inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border border-mk-line bg-white hover:border-mk-blue hover:bg-mk-blue/5 transition-colors"
                title={`${typeLabel} · ${t.name}`}
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mk-blue/10 text-mk-blue">
                  <Icon size={11} />
                </span>
                <span className="text-xs font-semibold text-mk-navy">{t.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-mk-ter group-hover:text-mk-blue transition-colors">
                  {typeLabel}
                </span>
              </Link>
            );
          })}

          {/* Puis termes tapés */}
          {filteredTerms.map((t) => (
            <Link
              key={t.q}
              to={`/catalogue?q=${encodeURIComponent(t.q)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-mk-line bg-mk-bg/40 hover:border-mk-blue hover:bg-mk-blue/5 transition-colors"
              title={`Recherche · ${t.q}`}
            >
              <Clock size={11} className="text-mk-ter" />
              <span className="text-xs text-mk-navy">{t.q}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Produits consultés récemment */}
      {products.length > 0 && (
        <div className="mt-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium text-mk-ter">
              <Package size={12} />
              <span>Produits consultés récemment</span>
              <span className="text-mk-ter/60">· {products.length}</span>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x scroll-smooth">
            {products.map((p) => {
              const meta = productMeta[p.id];
              const imageSrc = meta?.image || (isValidProductImage(p.image) ? p.image : null);
              const brand = meta?.brand;
              return (
                <Link
                  key={p.id}
                  to={`/produit/${p.slug}`}
                  className="shrink-0 snap-start w-[160px] bg-white rounded-xl border border-mk-line hover:border-mk-blue hover:shadow-md transition-all overflow-hidden group flex flex-col"
                >
                  <div className="aspect-square bg-mk-bg flex items-center justify-center overflow-hidden relative">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={p.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onLoad={(e) => {
                          if (isQogitaPlaceholder(e.currentTarget)) e.currentTarget.src = MEDIKONG_PLACEHOLDER;
                        }}
                        onError={(e) => {
                          e.currentTarget.src = MEDIKONG_PLACEHOLDER;
                        }}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Package size={28} className="text-mk-ter/40" />
                    )}
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col gap-1">
                    {brand && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-mk-blue truncate">
                        {brand}
                      </p>
                    )}
                    <p className="text-[12px] font-medium text-mk-navy line-clamp-2 leading-snug min-h-[2.4em]">
                      {p.name}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-0.5 text-[10px] font-medium text-mk-ter group-hover:text-mk-blue transition-colors">
                      Revoir <ChevronRight size={10} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </motion.section>
  );
}
