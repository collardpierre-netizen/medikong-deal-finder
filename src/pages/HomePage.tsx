import { Layout } from "@/components/layout/Layout";
import { Link, useNavigate } from "react-router-dom";
import { Search, Shield, Truck, Award, Package, Heart, Activity, Droplet, Droplets, Wrench, ChevronRight, Check, Armchair, TrendingDown, ArrowRight, Globe, Zap, ShoppingCart, FileSearch, BarChart3, ChevronDown } from "lucide-react";
import { categories, formatPrice } from "@/data/mock";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/PageTransition";
import { HeroImageGallery } from "@/components/home/HeroImageGallery";
import { Helmet } from "react-helmet-async";
import { HreflangTags } from "@/components/seo/HreflangTags";
import { HomeTestimonials } from "@/components/home/HomeTestimonials";
import TrustLogosBanner from "@/components/home/TrustLogosBanner";
import { useTranslation } from "react-i18next";
import { useCountry } from "@/contexts/CountryContext";
import { AnimatedCounter } from "@/components/entreprise/AnimatedCounter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyHiddenCategoryFilter } from "@/lib/catalog-filters";
import { InstantSearchBar } from "@/components/search/InstantSearchBar";
import { useMarketplaceMetrics } from "@/hooks/useMarketplaceMetrics";
import { formatCount } from "@/lib/formatCount";
import { RecentSearches } from "@/components/home/RecentSearches";
import { useHomeFeaturedBrands, useHomeFeaturedProducts, HOME_FEATURED_BADGE_LABEL } from "@/hooks/useHomeFeatured";
import { useTopPriceDeltas } from "@/hooks/useTopPriceDeltas";
import { useHomeShowcaseSettings } from "@/hooks/useHomeShowcaseSettings";
import { PriceDeltaShowcase } from "@/components/home/PriceDeltaShowcase";

// Tracking analytics minimal (GTM dataLayer) pour mesurer l'inversion des CTAs.
function trackHomeCta(type: "see_demo" | "create_account", extra?: Record<string, unknown>) {
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: "home_cta_clicked", type, ...(extra ?? {}) });
  } catch {
    /* no-op */
  }
}

const iconMap: Record<string, React.ReactNode> = {
  Shield: <Shield size={20} className="text-mk-navy" />,
  Droplets: <Droplets size={20} className="text-mk-navy" />,
  Wrench: <Wrench size={20} className="text-mk-navy" />,
  Heart: <Heart size={20} className="text-mk-navy" />,
  Activity: <Activity size={20} className="text-mk-navy" />,
  Droplet: <Droplet size={20} className="text-mk-navy" />,
  Armchair: <Armchair size={20} className="text-mk-navy" />,
  Package: <Package size={20} className="text-mk-navy" />,
};

// Brands loaded from DB now

export default function HomePage() {
  const { t } = useTranslation();
  
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { data: curatedProducts = [] } = useHomeFeaturedProducts();
  const { country, currentCountry } = useCountry();
  const navigate = useNavigate();
  const { data: metrics } = useMarketplaceMetrics();
  const metricsMaxOffers = metrics?.maxOffersPerProduct ?? 0;
  // Top SKU multi-vendeurs du jour : alimente la démo + le CTA "voir une comparaison".
  const { data: topDeltas } = useTopPriceDeltas(1);
  // Produit configurable en admin pour le CTA "Voir un exemple de comparaison".
  const { data: showcaseSettings } = useHomeShowcaseSettings();
  const { data: demoCtaProduct } = useQuery({
    queryKey: ["home-demo-cta-product", showcaseSettings?.demo_cta_product_id],
    enabled: !!showcaseSettings?.demo_cta_product_id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("slug")
        .eq("id", showcaseSettings!.demo_cta_product_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const demoSlug = demoCtaProduct?.slug ?? topDeltas?.[0]?.slug ?? null;

  const { data: countryStats, isLoading: isCountryStatsLoading, isError: isCountryStatsError } = useQuery({
    queryKey: ["homepage-stats", country],
    queryFn: async () => {
      // Compute the cascade of inactive categories so the home counter matches
      // what the catalogue actually shows (admin-disabled families like Perfumes
      // must be excluded everywhere, not just on /catalogue).
      // NB: lecture explicite jusqu'à 10 000 lignes — la limite par défaut
      // Supabase est de 1 000, ce qui tronquait l'arbre des catégories.
      const { data: allCats } = await supabase
        .from("categories")
        .select("id, parent_id, is_active")
        .range(0, 9999);
      const cats = (allCats || []) as Array<{ id: string; parent_id: string | null; is_active: boolean }>;
      const childrenByParent = new Map<string, string[]>();
      for (const c of cats) {
        if (!c.parent_id) continue;
        const list = childrenByParent.get(c.parent_id);
        if (list) list.push(c.id);
        else childrenByParent.set(c.parent_id, [c.id]);
      }
      const inactiveSet = new Set<string>(cats.filter((c) => !c.is_active).map((c) => c.id));
      const queue: string[] = [...inactiveSet];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const kids = childrenByParent.get(current);
        if (!kids) continue;
        for (const kid of kids) {
          if (!inactiveSet.has(kid)) {
            inactiveSet.add(kid);
            queue.push(kid);
          }
        }
      }
      const inactiveIds = Array.from(inactiveSet);

      let productsQuery = applyHiddenCategoryFilter(
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
      );
      // Garde-fou : au-delà de 500 UUIDs, l'URL PostgREST devient trop longue
      // et renvoie HTTP 400. Le filtre mots-clés couvre déjà l'essentiel.
      if (inactiveIds.length > 0 && inactiveIds.length <= 500) {
        productsQuery = productsQuery.not("category_id", "in", `(${inactiveIds.join(",")})`);
      }

      const [productsRes, offersRes, brandsRes, vendorsRes] = await Promise.all([
        productsQuery,
        // RPC publiques : les tables offers/vendors sont protégées par RLS
        // (PII, marges, prix d'achat) et invisibles aux visiteurs anonymes.
        // Les fonctions SECURITY DEFINER renvoient juste un compteur sûr.
        supabase.rpc("public_active_offers_count", { _country_code: country }),
        supabase.from("brands").select("id", { count: "estimated", head: true }).eq("is_active", true).gt("product_count", 0),
        supabase.rpc("public_verified_vendors_count"),
      ]);

      const queryError = productsRes.error || offersRes.error || brandsRes.error || vendorsRes.error;
      if (queryError) throw queryError;

      return {
        products: productsRes.count || 0,
        offers: Number(offersRes.data) || 0,
        brands: brandsRes.count || 0,
        vendors: Number(vendorsRes.data) || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());

  // Curation pilotable depuis l'admin (table home_featured_brands)
  const { data: curatedBrands = [] } = useHomeFeaturedBrands();

  const brandsSource: any[] = curatedBrands.map((b) => ({
    id: b.brand_id,
    name: b.brand_name,
    slug: b.brand_slug,
    logo_url: b.logo_url,
    website_url: b.website_url,
  }));

  const featuredBrands = brandsSource.filter((b: any) => !failedLogos.has(b.id));

  const getBrandLogoUrl = (b: any) => {
    if (b.logo_url) return b.logo_url;
    if (b.website_url) {
      try {
        const domain = new URL(b.website_url.startsWith("http") ? b.website_url : `https://${b.website_url}`).hostname;
        return `https://logo.clearbit.com/${domain}?size=160`;
      } catch { /* ignore */ }
    }
    return null;
  };

  const countryLabel = currentCountry?.name || "Belgique";

  const renderCountryStat = (value?: number) => {
    if (isCountryStatsLoading) {
      return <span className="inline-block h-7 w-14 animate-pulse rounded-md bg-muted align-middle" aria-hidden="true" />;
    }

    if (isCountryStatsError) {
      return <span aria-label="Statistique indisponible">—</span>;
    }

    return <AnimatedCounter target={value || 0} suffix="+" />;
  };

  const suppliersTxt = countryStats?.vendors
    ? formatCount(countryStats.vendors, { suffix: "+" })
    : "—";
  const maxOffersTxt = metricsMaxOffers > 0 ? metricsMaxOffers.toString() : "—";

  const valueProps = [
    { icon: <TrendingDown size={22} />, title: t("valueProps.bestPrices"), desc: t("valueProps.bestPricesDesc", { suppliers: suppliersTxt }) },
    { icon: <ShoppingCart size={22} />, title: t("valueProps.simpleOrders"), desc: t("valueProps.simpleOrdersDesc") },
    { icon: <Shield size={22} />, title: t("valueProps.guaranteed"), desc: t("valueProps.guaranteedDesc") },
  ];

  const comparisonOld = [
    t("comparison.trad1"), t("comparison.trad2"), t("comparison.trad3"),
    t("comparison.trad4"), t("comparison.trad5"), t("comparison.trad6"),
  ];

  const comparisonNew = [
    t("comparison.mk1"), t("comparison.mk2"),
    t("comparison.mk3", { suppliers: suppliersTxt }),
    t("comparison.mk4", { maxOffers: maxOffersTxt }),
    t("comparison.mk5"), t("comparison.mk6"),
  ];

  const howItWorks = [
    { step: "1", title: t("howToOrder.step1Title"), desc: t("howToOrder.step1Desc") },
    { step: "2", title: t("howToOrder.step2Title"), desc: t("howToOrder.step2Desc") },
    { step: "3", title: t("howToOrder.step3Title"), desc: t("howToOrder.step3Desc") },
    { step: "4", title: t("howToOrder.step4Title"), desc: t("howToOrder.step4Desc") },
  ];

  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1", { suppliers: suppliersTxt }) },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
  ];

  const searchExamples = [
    { label: t("hero.exampleGloves"), q: "Gants nitrile" },
    { label: t("hero.exampleBetadine"), q: "Betadine" },
    { label: t("hero.exampleTena"), q: "TENA" },
    { label: t("hero.exampleMasks"), q: "Masques FFP2" },
  ];


  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "MediKong",
    "url": "https://medikong-deal-finder.lovable.app",
    "logo": "https://medikong-deal-finder.lovable.app/logo-pwa-512.png",
    "description": "Marketplace B2B de fournitures médicales en Belgique",
    "address": { "@type": "PostalAddress", "streetAddress": "23 rue de la Procession", "addressLocality": "Ath", "postalCode": "7822", "addressCountry": "BE" },
    "taxID": "BE 1005.771.323"
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } }))
  };

  return (
    <Layout title={t("seo.homeTitle")} description={t("seo.homeDescription")}>
      <HreflangTags />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      {/* ═══ HERO — centered, clean ═══ */}
      <section className="pt-10 md:pt-20 pb-6 md:pb-10 bg-white">
        <div className="mk-container text-center max-w-2xl mx-auto">
          <motion.h1
            className="text-3xl md:text-[44px] leading-[1.15] font-bold text-mk-navy mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("hero.titleBefore")}
            <span className="text-mk-blue">{t("hero.titleAccent")}</span>
            {t("hero.titleAfter")}
          </motion.h1>
          <motion.p
            className="text-base md:text-lg text-mk-sec mb-8 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {t("hero.subtitle")}
          </motion.p>

          {/* Search */}
          <motion.div
            className="max-w-[560px] mx-auto mb-5"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <InstantSearchBar variant="hero" placeholder={t("common.searchPlaceholder")} />
          </motion.div>

          <RecentSearches />

          <motion.div
            className="flex items-center justify-center gap-4 text-xs text-mk-ter flex-wrap mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <span>{t("hero.searchExamples")}</span>
            {searchExamples.map(ex => (
              <Link key={ex.q} to={`/recherche?q=${encodeURIComponent(ex.q)}`} className="text-mk-blue hover:underline">{ex.label}</Link>
            ))}
          </motion.div>

          {/* Preuve chiffrée live — top SKU multi-vendeurs */}
          <PriceDeltaShowcase />
          {/* Inline stats — dynamic per country */}
          <motion.div
            className="grid grid-cols-2 sm:flex sm:items-center sm:justify-center sm:gap-0 sm:divide-x sm:divide-mk-line gap-y-3 max-w-md sm:max-w-none mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="px-3 sm:px-4 md:px-6 text-center">
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.vendors)}
              </div>
              <div className="text-[11px] sm:text-xs text-mk-sec mt-0.5">{t("stats.suppliers")}</div>
            </div>
            <div className="px-3 sm:px-4 md:px-6 text-center">
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.brands)}
              </div>
              <div className="text-[11px] sm:text-xs text-mk-sec mt-0.5">{t("stats.brands")}</div>
            </div>
            <div className="px-3 sm:px-4 md:px-6 text-center">
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.products)}
              </div>
              <div className="text-[11px] sm:text-xs text-mk-sec mt-0.5">{t("stats.products")} {countryLabel}</div>
            </div>
            <div className="px-3 sm:px-4 md:px-6 text-center">
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.offers)}
              </div>
              <div className="text-[11px] sm:text-xs text-mk-sec mt-0.5">{t("stats.offers", "Offres")}</div>
            </div>
          </motion.div>

          {/* CTA — primaire = voir une comparaison live, secondaire = créer un compte */}
          <motion.div
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {demoSlug && (
              <Link
                to={`/produit/${demoSlug}`}
                onClick={() => trackHomeCta("see_demo", { productSlug: demoSlug, location: "hero" })}
                className="inline-flex items-center gap-2 bg-mk-blue text-white font-semibold text-sm px-7 py-3 rounded-lg hover:opacity-90 transition-opacity shadow-sm"
              >
                {t("hero.ctaSeeDemo", "Voir un exemple de comparaison")} <ArrowRight size={16} />
              </Link>
            )}
            <Link
              to="/onboarding"
              onClick={() => trackHomeCta("create_account", { location: "hero" })}
              className={
                demoSlug
                  ? "inline-flex items-center gap-2 border border-mk-navy text-mk-navy font-semibold text-sm px-7 py-3 rounded-lg hover:bg-mk-navy hover:text-white transition-colors"
                  : "inline-flex items-center gap-2 bg-mk-navy text-white font-semibold text-sm px-7 py-3 rounded-lg hover:opacity-90 transition-opacity"
              }
            >
              {t("hero.ctaCreateAccount", "Créer mon compte (gratuit, 1 min)")} <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ BANNER SLIDESHOW ═══ */}
      <section className="pb-10 md:pb-16">
        <div className="mk-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <HeroImageGallery />
          </motion.div>
        </div>
      </section>

      {/* ═══ 3 VALUE PROPS ═══ */}
      <AnimatedSection className="py-14 md:py-20 border-t border-mk-line">
        <StaggerContainer className="mk-container grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {valueProps.map(vp => (
            <StaggerItem key={vp.title} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-mk-alt flex items-center justify-center mx-auto mb-5 text-mk-navy">
                {vp.icon}
              </div>
              <h3 className="text-lg font-bold text-mk-navy mb-2">{vp.title}</h3>
              <p className="text-sm text-mk-sec leading-relaxed max-w-xs mx-auto">{vp.desc}</p>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </AnimatedSection>

       {featuredBrands.length > 0 && (
       <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container">
          <h2 className="text-2xl md:text-3xl font-bold text-mk-navy mb-8 text-center">{t("brands.title")}</h2>
          
          {/* Infinite scrolling marquee */}
          <div className="relative overflow-hidden mb-8">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            
            <motion.div
              className="flex gap-6"
              animate={{ x: featuredBrands.length > 0 ? [0, -(featuredBrands.length * 180)] : 0 }}
              transition={{ x: { repeat: Infinity, repeatType: "loop", duration: featuredBrands.length * 3, ease: "linear" } }}
            >
              {/* Duplicate brands for seamless loop */}
              {[...featuredBrands, ...featuredBrands].map((b: any, i: number) => {
                const logoSrc = getBrandLogoUrl(b);
                if (!logoSrc) return null;
                return (
                <Link key={`${b.id}-${i}`} to={`/marque/${b.slug}`} className="shrink-0 w-[160px] group">
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-mk-alt to-white border border-mk-line flex items-center justify-center mb-2 overflow-hidden group-hover:shadow-md group-hover:border-mk-navy/20 transition-all">
                    <img
                      src={logoSrc}
                      alt={b.name}
                      className="w-24 h-24 object-contain"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setFailedLogos(prev => new Set([...prev, b.id]));
                      }}
                    />
                  </div>
                  <p className="text-xs font-semibold text-mk-navy text-center uppercase tracking-wide group-hover:text-mk-blue transition-colors">{b.name}</p>
                </Link>
                );
              })}
            </motion.div>
          </div>
          
          <div className="text-center mt-8">
            <Link to="/marques" className="inline-flex items-center gap-2 px-8 py-3 border border-mk-line rounded-lg text-sm font-semibold text-mk-navy hover:border-mk-navy hover:shadow-sm transition-all">
              {t("common.allBrands")}
            </Link>
          </div>
        </div>
      </AnimatedSection>
       )}

      {/* ═══ COMPARISON TABLE ═══ */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-10 text-center">{t("comparison.title")}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-mk-line rounded-2xl p-6 md:p-8">
              <h3 className="text-sm font-bold text-mk-ter uppercase tracking-wider mb-5">{t("comparison.traditional")}</h3>
              <div className="space-y-3.5">
                {comparisonOld.map(item => (
                  <div key={item} className="flex items-start gap-3 text-sm text-mk-sec">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-red-50 text-red-400 flex items-center justify-center shrink-0 text-xs">✕</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-mk-navy text-white rounded-2xl p-6 md:p-8 shadow-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-5 text-white/60">{t("comparison.medikong")}</h3>
              <div className="space-y-3.5">
                {comparisonNew.map(item => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center shrink-0"><Check size={12} /></span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ═══ CATEGORIES ═══ */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container">
          <h2 className="text-2xl md:text-3xl font-bold text-mk-navy mb-10 text-center">{t("categories.title")}</h2>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
            {categories.map(cat => (
              <StaggerItem key={cat.slug}>
                <Link to={`/categorie/${cat.slug}`} className="group block relative rounded-xl overflow-hidden aspect-[4/3]">
                  <div className="absolute inset-0 bg-gradient-to-br from-mk-blue/20 to-mk-navy/40 transition-all group-hover:from-mk-blue/30 group-hover:to-mk-navy/50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white/20">
                      {iconMap[cat.icon] ? <div className="w-16 h-16 flex items-center justify-center [&_svg]:w-16 [&_svg]:h-16 [&_svg]:text-white/30">{iconMap[cat.icon]}</div> : null}
                    </div>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="bg-white text-mk-navy text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                      {cat.count}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-sm md:text-base font-bold text-white uppercase tracking-wide drop-shadow-md">{cat.name}</h3>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* ═══ CURATED PRODUCTS — groupés par catégorie ═══
          Priorité explicite : Compléments alimentaires & Nutrition d'abord,
          puis le reste dans l'ordre alphabétique. Permet à un admin qui
          remplit la curation de voir tout de suite "compléments / nutrition"
          en haut de la home plutôt qu'un mélange aléatoire. */}
      {curatedProducts.length > 0 && (() => {
        const PRIORITY_KEYWORDS = ["complément", "complement", "nutrition"];
        const matchPriority = (label: string | null): number => {
          const lc = (label || "").toLowerCase();
          for (let i = 0; i < PRIORITY_KEYWORDS.length; i++) {
            if (lc.includes(PRIORITY_KEYWORDS[i])) return i;
          }
          return 999;
        };

        const groups = new Map<string, { label: string; priority: number; items: typeof curatedProducts }>();
        for (const p of curatedProducts) {
          const key = p.category_id ?? "__none__";
          const label = p.category_name ?? "Autres best-sellers";
          if (!groups.has(key)) {
            groups.set(key, { label, priority: matchPriority(label), items: [] });
          }
          groups.get(key)!.items.push(p);
        }
        const orderedGroups = Array.from(groups.values()).sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.label.localeCompare(b.label, "fr");
        });

        return (
          <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
            <div className="mk-container space-y-12">
              {orderedGroups.map((g, idx) => (
                <div key={g.label}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-mk-navy">
                      {idx === 0 && g.priority < 999 ? `Best-sellers — ${g.label}` : g.label}
                    </h2>
                    <Link to="/recherche" className="text-sm text-mk-blue hover:underline flex items-center gap-1">
                      {t("common.viewAll")} <ChevronRight size={14} />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {g.items.slice(0, 10).map((p) => {
                      const img = p.image_url || (Array.isArray(p.image_urls) ? p.image_urls[0] : null);
                      return (
                        <Link
                          key={p.id}
                          to={`/produits/${p.product_slug}`}
                          className="group relative bg-white rounded-xl border border-mk-line overflow-hidden hover:shadow-md transition-all"
                        >
                          {p.badge && (
                            <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-mk-blue text-white text-[10px] font-semibold uppercase tracking-wide">
                              {HOME_FEATURED_BADGE_LABEL[p.badge]}
                            </span>
                          )}
                          <div className="aspect-square bg-mk-alt/40 flex items-center justify-center overflow-hidden">
                            {img ? (
                              <img src={img} alt={p.product_name} className="w-full h-full object-contain p-3" referrerPolicy="no-referrer" />
                            ) : (
                              <Package size={32} className="text-mk-sec/40" />
                            )}
                          </div>
                          <div className="p-3">
                            {p.brand_name && <p className="text-[10px] uppercase tracking-wide text-mk-sec font-semibold truncate">{p.brand_name}</p>}
                            <p className="text-xs font-semibold text-mk-navy mt-0.5 line-clamp-2 min-h-[32px]">{p.product_name}</p>
                            {p.best_price_excl_vat != null && (
                              <p className="text-sm font-bold text-mk-navy mt-1">{formatPrice(Number(p.best_price_excl_vat))} <span className="text-[10px] font-normal text-mk-sec">HTVA</span></p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        );
      })()}

      {/* ═══ HOW IT WORKS ═══ */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-10 text-center">{t("howToOrder.title")}</h2>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {howItWorks.map(s => (
              <StaggerItem key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-mk-blue text-white flex items-center justify-center mx-auto mb-4 text-sm font-bold">{s.step}</div>
                <h3 className="text-sm font-bold text-mk-navy mb-2">{s.title}</h3>
                <p className="text-xs text-mk-sec leading-relaxed">{s.desc}</p>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* ═══ FAQ ACCORDION ═══ */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container max-w-2xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-8">{t("faq.title")}</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                className="bg-white border border-mk-line rounded-xl overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-sm font-semibold text-mk-navy pr-4">{faq.q}</span>
                  <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={16} className="text-mk-sec shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-5 pb-5 text-sm text-mk-sec leading-relaxed border-t border-mk-line pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ═══ TESTIMONIALS — masqué, à réactiver via CMS ═══ */}
      {/* <HomeTestimonials /> */}

      {/* ═══ TRUST LOGOS (CMS placement = "invest", partagé avec /invest) ═══ */}
      <TrustLogosBanner placement="invest" />

      {/* ═══ FINAL CTA BANNER ═══ */}
      <section className="py-16 md:py-24">
        <div className="mk-container max-w-3xl text-center">
          <motion.div
            className="bg-mk-navy rounded-2xl p-10 md:p-16 text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {t("cta.title")}
            </h2>
            <p className="text-sm text-white/60 mb-8 max-w-md mx-auto">
              {t("cta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {demoSlug && (
                <Link
                  to={`/produit/${demoSlug}`}
                  onClick={() => trackHomeCta("see_demo", { productSlug: demoSlug, location: "final_cta" })}
                  className="inline-flex items-center gap-2 bg-white text-mk-navy font-bold text-sm px-8 py-3.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {t("hero.ctaSeeDemo", "Voir un exemple de comparaison")} <ArrowRight size={16} />
                </Link>
              )}
              <Link
                to="/onboarding"
                onClick={() => trackHomeCta("create_account", { location: "final_cta" })}
                className={
                  demoSlug
                    ? "inline-flex items-center gap-2 border border-white/40 text-white font-semibold text-sm px-8 py-3.5 rounded-lg hover:bg-white/10 transition-colors"
                    : "inline-flex items-center gap-2 bg-white text-mk-navy font-bold text-sm px-8 py-3.5 rounded-lg hover:bg-gray-100 transition-colors"
                }
              >
                {t("hero.ctaCreateAccount", "Créer mon compte (gratuit, 1 min)")} <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
