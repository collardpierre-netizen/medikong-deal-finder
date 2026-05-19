import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { useFeaturedProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import SearchTrivagoCard from "@/components/search/SearchTrivagoCard";
import { Star, ExternalLink, Heart, Download, Upload, Factory, Store, MapPin, ShoppingCart, Award, ChevronRight, Trophy } from "lucide-react";
import { useState } from "react";
import { CatalogViewToggle } from "@/components/catalog/CatalogViewToggle";
import { useCatalogViewMode } from "@/hooks/useCatalogViewMode";
import { BuyerImportModal } from "@/components/buyer/BuyerImportModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getVendorPublicName } from "@/lib/vendor-display";
import { BrandFactSheet } from "@/components/brand/BrandFactSheet";
import { Badge } from "@/components/ui/badge";
import { useCountry } from "@/contexts/CountryContext";


export default function BrandDetailPage() {
  const { slug } = useParams();
  const { country } = useCountry();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { data: products = [] } = useFeaturedProducts(200, { brandSlug: slug, categoryName: activeCat || undefined });
  const { view, setView } = useCatalogViewMode();
  const [showFilters, setShowFilters] = useState(false);
  const [showAllSellers, setShowAllSellers] = useState(false);
  const { data: brandData } = useQuery({
    queryKey: ["brand-detail", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, description, logo_url, website_url, product_count, manufacturer_id, parent_company, country_hq, main_category, subcategories, year_entered_be_market, afmps_status, ce_marking, certifications, manufacturing_countries, inami_reimbursement_pct, inami_categories, google_trends_12m, google_trends_trend_pct, officinal_coverage_pct, press_mentions_12m, distribution_type, is_top20, sources_last_updated, manufacturers(name, slug)")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Live reference count — mirrors the catalog page logic so the badge
  // ("X références") always matches what the user sees in /catalogue.
  // Uses the country-aware view when a country is selected, else falls back
  // to the global products table. Avoids drift with the denormalized
  // brands.product_count which is only refreshed by an admin job.
  const { data: liveCount } = useQuery({
    queryKey: ["brand-live-product-count", brandData?.id, country],
    enabled: !!brandData?.id,
    queryFn: async () => {
      if (country) {
        const { count, error } = await supabase
          .from("products_with_country_stats_v")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("brand_id", brandData!.id)
          .or(`country_code.eq.${country},country_code.is.null`);
        if (error) throw error;
        return count ?? 0;
      }
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("brand_id", brandData!.id);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: brandSellers = [] } = useQuery({
    queryKey: ["brand-sellers", brandData?.id],
    enabled: !!brandData?.id,
    queryFn: async () => {
      // Étape 1 : récupérer les vendor_id distincts pour cette marque (offres actives)
      const { data: offerRows, error } = await supabase
        .from("offers")
        .select("vendor_id, products!inner(brand_id)")
        .eq("is_active", true)
        .eq("products.brand_id", brandData!.id)
        .limit(2000);
      if (error) throw error;

      // Comptage offres par vendeur (pour afficher "N offres" et trier)
      const offerCountByVendor = new Map<string, number>();
      for (const r of (offerRows || []) as any[]) {
        if (!r.vendor_id) continue;
        offerCountByVendor.set(r.vendor_id, (offerCountByVendor.get(r.vendor_id) || 0) + 1);
      }

      // Étape 2 : récupérer les infos vendeurs publiques (vue vendors_public, sans PII)
      const vendorIds = Array.from(offerCountByVendor.keys());
      if (vendorIds.length === 0) return [];

      // Étape 3 : récupère uniquement les champs publics non-PII. `name`,
      // `company_name`, `show_real_name` ne sont JAMAIS sélectionnés côté buyer
      // (cf. Vendor Anonymity Guardrail).
      const { data: vendorsData, error: vErr } = await supabase
        .from("vendors_public" as any)
        .select("id, display_name, slug, is_verified, rating, total_sales, country_code, display_code")
        .in("id", vendorIds);
      if (vErr) throw vErr;

      const dedup = new Map<string, {
        id: string;
        name: string;
        slug: string;
        displayCode: string | null;
        verified: boolean;
        topRated: boolean;
        location: string;
        rating: number;
        orders: number;
        offerCount: number;
      }>();

      for (const v of (vendorsData || []) as any[]) {
        if (!v?.id || dedup.has(v.id)) continue;
        dedup.set(v.id, {
          id: v.id,
          // 🔒 Anonymisation : libellé public uniquement, jamais name/company_name brut.
          name: getVendorPublicName({ display_code: v.display_code }),
          slug: v.slug || "",
          displayCode: v.display_code || null,
          verified: !!v.is_verified,
          topRated: (Number(v.rating) || 0) >= 4.5,
          location: v.country_code || "BE",
          rating: Number(v.rating) || 0,
          orders: Number(v.total_sales) || 0,
          offerCount: offerCountByVendor.get(v.id) || 0,
        });
      }

      // Tri : plus d'offres d'abord, puis vérifiés, puis rating
      return [...dedup.values()].sort((a, b) => {
        if (b.offerCount !== a.offerCount) return b.offerCount - a.offerCount;
        if (Number(b.verified) !== Number(a.verified)) return Number(b.verified) - Number(a.verified);
        return b.rating - a.rating;
      });
    },
  });

  const { data: siblingBrands = [] } = useQuery({
    queryKey: ["brand-siblings", brandData?.manufacturer_id, brandData?.slug],
    enabled: !!brandData?.manufacturer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("name, slug, product_count")
        .eq("is_active", true)
        .eq("manufacturer_id", brandData!.manufacturer_id)
        .neq("slug", brandData!.slug)
        .order("product_count", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: catChips = [] } = useQuery({
    queryKey: ["brand-category-chips", brandData?.id],
    enabled: !!brandData?.id,
    queryFn: async () => {
      // Get product category IDs for this brand
      const { data: prodCats, error: pcErr } = await supabase
        .from("products")
        .select("category_name")
        .eq("brand_id", brandData!.id)
        .eq("is_active", true);
      if (pcErr) throw pcErr;

      // Count occurrences per category_name
      const counts = new Map<string, number>();
      for (const row of prodCats || []) {
        const name = row.category_name || "Autres";
        counts.set(name, (counts.get(name) || 0) + 1);
      }

      // Get all categories to filter out parents (keep only leaf-level names)
      const { data: allCats } = await supabase
        .from("categories")
        .select("name, parent_id")
        .eq("is_active", true);

      // Build a set of category names that are parents
      const parentNames = new Set<string>();
      const catByName = new Map<string, any>();
      for (const c of allCats || []) {
        catByName.set(c.name, c);
      }
      // A category is a parent if another category has parent_id pointing to it
      const parentIds = new Set((allCats || []).filter(c => c.parent_id).map(c => c.parent_id));
      for (const c of allCats || []) {
        if (parentIds.has(c.name)) continue; // name != id, need different approach
      }
      // Simpler: just check if any category name in our counts also has children in allCats
      const catIdByName = new Map<string, string>();
      // We need IDs - fetch with id
      const { data: catsWithId } = await supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("is_active", true);
      const parentIdSet = new Set((catsWithId || []).filter(c => c.parent_id).map(c => c.parent_id));
      for (const c of catsWithId || []) {
        if (parentIdSet.has(c.id)) {
          parentNames.add(c.name);
        }
      }

      // Filter out parent categories from chips
      return [...counts.entries()]
        .filter(([name]) => !parentNames.has(name))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));
    },
  });

  const brand = {
    name: brandData?.name || slug || "Marque",
    slug: brandData?.slug || slug || "marque",
    count: typeof liveCount === "number" ? liveCount : (Number(brandData?.product_count) || products.length),
    manufacturer: (brandData?.manufacturers as any)?.name || "Fabricant non renseigné",
    manufacturerSlug: (brandData?.manufacturers as any)?.slug || "",
    description: brandData?.description || "Marque partenaire disponible sur MediKong pour les professionnels de santé.",
    logoUrl: brandData?.logo_url || null,
    websiteUrl: brandData?.website_url || null,
  };

  return (
    <Layout>
      {/* Hero — sans étoiles, avec badge Top 20 conditionnel */}
      <div className="py-8 md:py-10" style={{ background: "linear-gradient(135deg, #EFF6FF, #F0FDF4)" }}>
        <div className="mk-container">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg flex items-center justify-center text-xs text-mk-ter shrink-0 overflow-hidden">
              {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-2" /> : "Logo"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">{brand.name}</h1>
                {(brandData as any)?.is_top20 && (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 inline-flex items-center gap-1">
                    <Trophy size={12} /> Top 20 ventes
                  </Badge>
                )}
              </div>
              {/* Société mère + pays HQ */}
              {((brandData as any)?.parent_company || (brandData as any)?.country_hq) && (
                <p className="text-xs text-mk-sec mb-1">
                  {(brandData as any)?.parent_company}
                  {(brandData as any)?.parent_company && (brandData as any)?.country_hq && " · "}
                  {(brandData as any)?.country_hq}
                </p>
              )}
              {/* Métadonnées en ligne */}
              <p className="text-xs text-mk-sec mb-3">
                {brand.count.toLocaleString("fr-BE")} référence{brand.count > 1 ? "s" : ""}
                {(brandData as any)?.main_category && ` · ${(brandData as any).main_category}`}
              </p>
              {/* Manufacturer link */}
              <div className="flex items-center gap-2 mb-3">
                <Factory size={14} className="text-mk-sec" />
                <span className="text-sm text-mk-sec">Fabricant :</span>
                {brand.manufacturerSlug ? (
                  <Link to={`/fabricant/${brand.manufacturerSlug}`} className="text-sm font-semibold text-mk-blue hover:underline">
                    {brand.manufacturer}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-mk-navy">{brand.manufacturer}</span>
                )}
              </div>
              <p className="text-sm text-mk-sec max-w-[700px] mb-4">{brand.description}</p>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={brand.websiteUrl || undefined}
                  target={brand.websiteUrl ? "_blank" : undefined}
                  rel={brand.websiteUrl ? "noreferrer" : undefined}
                  className={`border border-mk-line text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5 ${brand.websiteUrl ? "text-mk-sec hover:border-mk-blue" : "text-mk-ter cursor-not-allowed"}`}
                >
                  <ExternalLink size={13} /> Site officiel
                </a>
                <button onClick={() => document.getElementById("brand-products")?.scrollIntoView({ behavior: "smooth" })} className="bg-mk-blue text-white text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5">
                  <Download size={13} /> Voir les produits
                </button>
                <button className="border border-mk-line text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5 text-mk-sec"><Heart size={13} /> Suivre</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fact sheet "Transparence" — 5 sections sourcées, sans note globale */}
      {brandData && (
        <div className="bg-white border-y border-mk-line py-6 md:py-8">
          <div className="mk-container">
            <BrandFactSheet brand={brandData as any} />
          </div>
        </div>
      )}

      <div id="brand-products" className="mk-container py-6 md:py-8">
        {/* Sellers for this brand */}
        {brandSellers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-mk-navy mb-1 flex items-center gap-2">
              <Store size={18} /> Vendeurs proposant {brand.name}
              <span className="text-sm font-normal text-mk-sec">({brandSellers.length})</span>
            </h2>
            <p className="text-xs text-mk-sec mb-3">
              Sur l'ensemble des {brand.count} références {brand.name}. Le nombre d'offres par produit peut varier.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {brandSellers.slice(0, showAllSellers ? undefined : 6).map(s => (
                <Link key={s.id} to={s.displayCode ? `/vendeur/${s.displayCode}?brand=${brand.slug}` : "#"} className="border border-mk-line rounded-lg p-4 flex items-center gap-3 hover:shadow-sm hover:border-mk-blue transition-all">
                  <div className="w-10 h-10 rounded-full bg-mk-alt flex items-center justify-center text-sm font-bold text-mk-navy shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-mk-navy truncate">{s.name}</span>
                      {s.verified && <span className="text-[10px] bg-mk-deal text-mk-green px-1.5 py-0.5 rounded font-medium">Vérifié</span>}
                      {s.topRated && <span className="text-[10px] bg-mk-deal text-mk-green px-1.5 py-0.5 rounded font-medium">Top</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-mk-sec mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin size={10} />{s.location}</span>
                      <span className="flex items-center gap-1"><Star size={10} fill="currentColor" className="text-mk-amber" />{s.rating || "-"}</span>
                      <span className="flex items-center gap-1" title={`${s.offerCount} offre(s) actives sur cette marque`}>
                        <Store size={10} />{s.offerCount} offre{s.offerCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {brandSellers.length > 6 && !showAllSellers && (
              <button
                onClick={() => setShowAllSellers(true)}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline mx-auto"
              >
                Voir tous les vendeurs ({brandSellers.length}) <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}

        {/* Sibling brands from same manufacturer */}
        {siblingBrands.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-mk-navy mb-3 flex items-center gap-2"><Award size={18} /> Autres marques de {brand.manufacturer}</h2>
            <div className="flex gap-2 flex-wrap">
              {siblingBrands.map(b => (
                <Link key={b.slug} to={`/marque/${b.slug}`} className="border border-mk-line rounded-full px-4 py-1.5 text-sm text-mk-sec hover:border-mk-blue hover:text-mk-blue transition-colors">
                  {b.name} ({b.product_count || 0})
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Import CTA */}
        <div className="bg-mk-alt border border-mk-line rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-mk-blue shrink-0" />
            <span className="text-sm text-mk-navy">Importez votre liste de produits pour des prix personnalisés</span>
          </div>
          <button onClick={() => setImportOpen(true)} className="bg-mk-blue text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 whitespace-nowrap">
            <Upload size={13} /> Importer
          </button>
        </div>
        <BuyerImportModal open={importOpen} onOpenChange={setImportOpen} />

        {/* Category chips */}
        {catChips.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {catChips.map((c) => (
              <button
                key={c.name}
                onClick={() => setActiveCat(activeCat === c.name ? null : c.name)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${activeCat === c.name ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec hover:border-mk-blue"}`}
              >
                {c.name} ({c.count})
              </button>
            ))}
          </div>
        )}

        {/* Group buy CTA — disabled for now */}

        <div className="flex gap-7">
          {/* Sidebar */}
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-[220px] shrink-0 lg:sticky lg:top-20 lg:self-start ${showFilters ? 'mb-4' : ''}`}>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Préférences</h4>
              {["Tout afficher", "Mes favoris", "Prix cible atteint"].map((p, i) => (
                <label key={p} className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                  <input type="radio" name="pref" defaultChecked={i === 0} className="text-mk-navy" /> {p}
                </label>
              ))}
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Prix</h4>
              <div className="flex gap-2">
                <input placeholder="Min" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
                <input placeholder="Max" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Disponibilité</h4>
              <label className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                <input type="checkbox" /> En stock
              </label>
              <label className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                <input type="checkbox" /> MediKong uniquement
              </label>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {(() => {
              const filtered = products;
              return (
                <>
                  <div className="flex items-center justify-between mb-5 gap-3">
                    <span className="text-sm text-mk-sec">{filtered.length.toLocaleString("fr-BE")} produits</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setShowFilters(!showFilters)} className="lg:hidden border border-mk-line text-sm px-3 py-1.5 rounded-md text-mk-sec">Filtres</button>
                      <CatalogViewToggle view={view} setView={setView} />
                    </div>
                  </div>
                  {view === "trivago" ? (
                    <div className="space-y-3">
                      {filtered.map((p) => (
                        <SearchTrivagoCard key={p.id} product={p} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
