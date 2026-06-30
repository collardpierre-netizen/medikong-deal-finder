import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyHiddenCategoryFilter } from "@/lib/catalog-filters";
import { Package, ExternalLink, Award, Factory, Tag, Store, MapPin, ChevronRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CatalogViewToggle } from "@/components/catalog/CatalogViewToggle";
import type { CatalogView } from "@/hooks/useCatalogViewMode";
import SearchTrivagoCard from "@/components/search/SearchTrivagoCard";
import { BestOffersProvider } from "@/contexts/BestOffersContext";
import { ProductCard } from "@/components/shared/ProductCard";
import { mapDbProduct } from "@/hooks/useProducts";
import { getVendorPublicName } from "@/lib/vendor-display";
import { SocialLinksDisplay } from "@/components/shared/SocialLinks";
import { MediaGallery } from "@/components/shared/MediaGallery";

const FLAG: Record<string, string> = { BE: "🇧🇪", FR: "🇫🇷", DE: "🇩🇪", NL: "🇳🇱", SE: "🇸🇪", DK: "🇩🇰", GB: "🇬🇧", US: "🇺🇸", CH: "🇨🇭", JP: "🇯🇵" };

const useManufacturer = (slug: string) =>
  useQuery({
    queryKey: ["manufacturer", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("manufacturers").select("*").eq("slug", slug).single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

const useManufacturerBrands = (id: string | null) =>
  useQuery({
    queryKey: ["manufacturer-brands", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase.from("brands").select("*").eq("manufacturer_id", id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

const useManufacturerProducts = (id: string | null) =>
  useQuery({
    queryKey: ["manufacturer-products-full", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await applyHiddenCategoryFilter(
        supabase
          .from("products")
          .select("id, slug, name, brand_name, brand_id, gtin, cnk_code, image_urls, short_description, is_promotion, promotion_label, best_price_excl_vat, best_price_incl_vat, offer_count, total_stock, is_in_stock, category_name, brands(slug)")
          .eq("manufacturer_id", id)
          .eq("is_active", true)
      )
        .order("offer_count", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...mapDbProduct(row),
        brandSlug: row.brands?.slug,
      }));
    },
    enabled: !!id,
  });

const useManufacturerSellers = (id: string | null) =>
  useQuery({
    queryKey: ["manufacturer-sellers", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: offerRows, error } = await supabase
        .from("offers")
        .select("vendor_id, products!inner(manufacturer_id)")
        .eq("is_active", true)
        .eq("products.manufacturer_id", id!)
        .limit(2000);
      if (error) throw error;

      const offerCountByVendor = new Map<string, number>();
      for (const r of (offerRows || []) as any[]) {
        if (!r.vendor_id) continue;
        offerCountByVendor.set(r.vendor_id, (offerCountByVendor.get(r.vendor_id) || 0) + 1);
      }
      const vendorIds = Array.from(offerCountByVendor.keys());
      if (vendorIds.length === 0) return [];

      const { data: vendorsData, error: vErr } = await supabase
        .from("vendors_public" as any)
        .select("id, display_name, slug, is_verified, rating, total_sales, country_code, display_code")
        .in("id", vendorIds);
      if (vErr) throw vErr;

      const dedup = new Map<string, any>();
      for (const v of (vendorsData || []) as any[]) {
        if (!v?.id || dedup.has(v.id)) continue;
        dedup.set(v.id, {
          id: v.id,
          name: getVendorPublicName({ display_code: v.display_code }),
          slug: v.slug || "",
          verified: !!v.is_verified,
          topRated: (Number(v.rating) || 0) >= 4.5,
          location: v.country_code || "BE",
          rating: Number(v.rating) || 0,
          offerCount: offerCountByVendor.get(v.id) || 0,
        });
      }
      return [...dedup.values()].sort((a, b) => {
        if (b.offerCount !== a.offerCount) return b.offerCount - a.offerCount;
        if (Number(b.verified) !== Number(a.verified)) return Number(b.verified) - Number(a.verified);
        return b.rating - a.rating;
      });
    },
  });

export default function ManufacturerPage() {
  const { slug } = useParams();
  const { data: manufacturer, isLoading } = useManufacturer(slug || "");
  const { data: brands = [] } = useManufacturerBrands(manufacturer?.id || null);
  const { data: products = [] } = useManufacturerProducts(manufacturer?.id || null);
  const { data: sellers = [] } = useManufacturerSellers(manufacturer?.id || null);

  // Trivago forcée par défaut sur /fabricant/:slug ; toggle vers grid possible.
  const [view, setView] = useState<CatalogView>("trivago");
  const [showAllSellers, setShowAllSellers] = useState(false);

  if (isLoading) {
    return <Layout><div className="mk-container py-12 text-center text-mk-sec">Chargement...</div></Layout>;
  }

  if (!manufacturer) {
    return <Layout><div className="mk-container py-12 text-center"><h1 className="text-xl font-bold text-mk-navy mb-2">Fabricant introuvable</h1><Link to="/fabricants" className="text-mk-blue text-sm">← Retour aux fabricants</Link></div></Layout>;
  }

  return (
    <Layout>
      <div className="mk-container py-3">
        <nav className="text-xs text-mk-sec flex items-center gap-1">
          <Link to="/" className="hover:text-mk-blue">Accueil</Link>
          <span>/</span>
          <Link to="/fabricants" className="hover:text-mk-blue">Fabricants</Link>
          <span>/</span>
          <span className="text-mk-navy font-medium">{manufacturer.name}</span>
        </nav>
      </div>

      <div className="bg-mk-alt py-8 md:py-10">
        <div className="mk-container">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            {manufacturer.logo_url ? (
              <img src={manufacturer.logo_url} alt={manufacturer.name} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg object-contain p-2" />
            ) : (
              <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg flex items-center justify-center">
                <Factory size={32} className="text-mk-ter" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">{manufacturer.name}</h1>
                {manufacturer.is_active && <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded font-medium">Vérifié</span>}
              </div>
              <p className="text-xs text-mk-sec mb-2">
                {manufacturer.country_of_origin && <>{FLAG[manufacturer.country_of_origin]} {manufacturer.country_of_origin}</>}
                {manufacturer.year_founded && <> · Fondé en {manufacturer.year_founded}</>}
                {manufacturer.legal_name && <> · {manufacturer.legal_name}</>}
              </p>
              {manufacturer.description && <p className="text-sm text-mk-sec max-w-[600px] mb-4">{manufacturer.description}</p>}
              <div className="flex gap-2 flex-wrap items-center">
                {manufacturer.website_url && (
                  <a href={manufacturer.website_url} target="_blank" rel="noopener noreferrer" className="border border-mk-line text-sm px-4 py-2 rounded-md flex items-center gap-1.5 text-mk-sec hover:border-mk-blue transition-colors">
                    <ExternalLink size={13} /> Site officiel
                  </a>
                )}
                <SocialLinksDisplay links={(manufacturer as any)?.social_links} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-mk-line py-4 overflow-x-auto">
        <div className="mk-container flex justify-center gap-6 md:gap-12 min-w-max">
          {[
            [String(brands.length), "Marques"],
            [String(manufacturer.product_count || products.length || 0), "Produits"],
            [String(sellers.length), "Vendeurs"],
          ].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-lg font-bold text-mk-navy">{v}</div>
              <div className="text-xs text-mk-sec">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        {manufacturer?.id && (
          <MediaGallery owner={{ manufacturerId: manufacturer.id as string }} title={`Médias officiels — ${manufacturer.name}`} />
        )}
        {/* Vendeurs liés au fabricant — au-dessus de la liste produits */}
        {sellers.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-mk-navy flex items-center gap-2">
                <Store size={18} /> Vendeurs proposant les produits {manufacturer.name}
                <span className="text-sm font-normal text-mk-sec">({sellers.length})</span>
              </h2>
              {sellers.length > 6 && (
                <button onClick={() => setShowAllSellers((v) => !v)} className="text-sm text-mk-blue hover:underline">
                  {showAllSellers ? "Voir moins" : "Voir tous"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(showAllSellers ? sellers : sellers.slice(0, 6)).map((s) => (
                <Link
                  key={s.id}
                  to={s.slug ? `/vendeur/${s.slug}` : "#"}
                  className="border border-mk-line rounded-lg p-3 hover:border-mk-blue hover:shadow-sm transition-all flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded bg-mk-alt flex items-center justify-center shrink-0">
                    <Store size={16} className="text-mk-sec" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-mk-navy truncate">{s.name}</span>
                      {s.verified && (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[10px] px-1.5 py-0">Vérifié</Badge>
                      )}
                      {s.topRated && (
                        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-[10px] px-1.5 py-0 inline-flex items-center gap-0.5">
                          <Star size={9} /> Top
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-mk-sec flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5"><MapPin size={10} />{s.location}</span>
                      <span>·</span>
                      <span>{s.offerCount} offre{s.offerCount > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-mk-ter shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {(manufacturer.certifications || []).length > 0 && (
          <>
            <h2 className="text-xl font-bold text-mk-navy mb-4">Certifications</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {(manufacturer.certifications as string[]).map(c => (
                <div key={c} className="border border-mk-line rounded-lg p-5 text-center">
                  <Award size={24} className="mx-auto text-mk-navy mb-2" />
                  <span className="text-sm font-medium text-mk-navy">{c}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Brands */}
        {brands.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-mk-navy mb-4 flex items-center gap-2"><Tag size={20} /> Marques de ce fabricant</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {brands.map(b => (
                <Link key={b.id} to={`/marque/${b.slug}`} className="border border-mk-line rounded-lg p-5 hover:shadow-sm transition-shadow hover:border-mk-blue">
                  <div className="flex items-center gap-3 mb-2">
                    {b.logo_url ? <img src={b.logo_url} alt={b.name} className="w-8 h-8 rounded object-contain" /> : <Tag size={16} className="text-mk-sec" />}
                    <h3 className="text-base font-bold text-mk-navy">{b.name}</h3>
                  </div>
                  <p className="text-xs text-mk-sec mb-2">{b.product_count || 0} produits</p>
                  <span className="text-xs text-mk-blue font-medium">Voir les produits →</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Products — vue Trivago forcée par défaut, toggle disponible */}
        {products.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-mk-navy flex items-center gap-2">
                <Package size={20} /> Produits {manufacturer.name}
                <span className="text-sm font-normal text-mk-sec">({products.length})</span>
              </h2>
              <CatalogViewToggle view={view} setView={setView} />
            </div>
            {view === "trivago" ? (
              <div className="space-y-3">
                {products.map((p: any) => (
                  <SearchTrivagoCard key={p.id} product={p as any} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((p: any, i: number) => (
                  <ProductCard key={p.id} product={p as any} index={i} />
                ))}
              </div>
            )}
          </>
        )}

        {products.length === 0 && brands.length === 0 && (
          <div className="text-center py-12">
            <Factory size={48} className="mx-auto text-mk-ter mb-3" />
            <p className="text-mk-sec">Aucun produit ou marque lié à ce fabricant pour le moment.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
