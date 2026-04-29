import { Link } from "react-router-dom";
import { Clock, X, Tag, FolderOpen, Package } from "lucide-react";
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
 */
export function RecentSearches() {
  const { terms, products, taxons, isEmpty, clear } = useRecentSearches();
  const productIds = useMemo(() => products.map((p) => p.id).filter(Boolean), [products]);

  const { data: productImages = {} } = useQuery({
    queryKey: ["recent-product-images", productIds.join("|")],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, image_urls, image_url")
        .in("id", productIds);

      return Object.fromEntries(
        (data || []).map((row: any) => {
          const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
          const firstValid =
            imageUrls.find((url: string) => isValidProductImage(url)) ??
            (isValidProductImage(row.image_url) ? row.image_url : null);
          return [row.id, firstValid ? getProductImageSrc(firstValid) : null];
        })
      ) as Record<string, string | null>;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  if (isEmpty) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      className="max-w-[920px] mx-auto mt-6 mb-2 px-2"
      aria-label="Reprenez votre exploration"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-mk-navy">
          <Clock size={15} className="text-mk-blue" />
          <span>Reprenez là où vous en étiez</span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-mk-ter hover:text-mk-navy inline-flex items-center gap-1"
          aria-label="Effacer l'historique récent"
        >
          <X size={12} /> Effacer
        </button>
      </div>

      {/* Termes récents */}
      {terms.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 justify-center">
          {terms.map((t) => (
            <Link
              key={t.q}
              to={`/catalogue?q=${encodeURIComponent(t.q)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-mk-line bg-white hover:border-mk-blue hover:bg-mk-blue/5 transition-colors text-xs text-mk-navy"
            >
              <Clock size={11} className="text-mk-ter" />
              <span className="font-medium">{t.q}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Marques / catégories visitées */}
      {taxons.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 justify-center">
          {taxons.map((t) => (
            <Link
              key={`${t.type}-${t.slug}`}
              to={t.type === "brand" ? `/marques/${t.slug}` : `/categorie/${t.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-mk-line bg-white hover:border-mk-blue hover:bg-mk-blue/5 transition-colors text-xs text-mk-navy"
            >
              {t.type === "brand" ? (
                <Tag size={11} className="text-mk-blue" />
              ) : (
                <FolderOpen size={11} className="text-mk-blue" />
              )}
              <span className="font-medium">{t.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Produits consultés récemment */}
      {products.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2 text-xs text-mk-ter">
            <Package size={12} />
            <span>Produits consultés récemment</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
            {products.map((p) => {
              const imageSrc = productImages[p.id] || (isValidProductImage(p.image) ? p.image : null);
              return (
              <Link
                key={p.id}
                to={`/produit/${p.slug}`}
                className="shrink-0 snap-start w-[140px] bg-white rounded-xl border border-mk-line hover:border-mk-blue hover:shadow-sm transition-all overflow-hidden group"
              >
                <div className="aspect-square bg-mk-bg flex items-center justify-center overflow-hidden">
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
                <div className="p-2">
                  <p className="text-[11px] font-medium text-mk-navy line-clamp-2 leading-tight">
                    {p.name}
                  </p>
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
