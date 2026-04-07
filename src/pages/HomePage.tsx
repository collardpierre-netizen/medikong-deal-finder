import { Layout } from "@/components/layout/Layout";
import { Link, useNavigate } from "react-router-dom";
import { Search, Shield, Truck, Award, Package, Heart, Activity, Droplet, Droplets, Wrench, ChevronRight, Check, Armchair, TrendingDown, ArrowRight, Globe, Zap, ShoppingCart, FileSearch, BarChart3, ChevronDown } from "lucide-react";
import { categories, formatPrice } from "@/data/mock";
import { useFeaturedProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/PageTransition";
import { HeroImageGallery } from "@/components/home/HeroImageGallery";
import { Helmet } from "react-helmet-async";
import { HomeTestimonials } from "@/components/home/HomeTestimonials";
import { useTranslation } from "react-i18next";
import { useCountry } from "@/contexts/CountryContext";
import { AnimatedCounter } from "@/components/entreprise/AnimatedCounter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InstantSearchBar } from "@/components/search/InstantSearchBar";

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
  const { data: products = [] } = useFeaturedProducts(5);
  const { country, currentCountry } = useCountry();
  const navigate = useNavigate();

  const { data: countryStats, isLoading: isCountryStatsLoading, isError: isCountryStatsError } = useQuery({
    queryKey: ["homepage-stats", country],
    queryFn: async () => {
      const [productsRes, offersRes, brandsRes, vendorsRes] = await Promise.all([
        supabase.from("products").select("id", { count: "estimated" }).eq("is_active", true).range(0, 0),
        supabase.from("offers").select("id", { count: "estimated" }).eq("country_code", country).eq("is_active", true).range(0, 0),
        supabase.from("brands").select("id", { count: "estimated" }).eq("is_active", true).gt("product_count", 0).range(0, 0),
        supabase.from("vendors").select("id", { count: "estimated" }).eq("is_active", true).eq("is_verified", true).range(0, 0),
      ]);

      const queryError = productsRes.error || offersRes.error || brandsRes.error || vendorsRes.error;
      if (queryError) throw queryError;

      return {
        products: productsRes.count || 0,
        offers: offersRes.count || 0,
        brands: brandsRes.count || 0,
        vendors: vendorsRes.count || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: featuredBrands = [] } = useQuery({
    queryKey: ["featured-brands-homepage"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name, slug, logo_url, product_count")
        .eq("is_active", true)
        .gt("product_count", 0)
        .not("logo_url", "is", null)
        .order("product_count", { ascending: false })
        .limit(20);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

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

  const valueProps = [
    { icon: <TrendingDown size={22} />, title: t("valueProps.bestPrices"), desc: t("valueProps.bestPricesDesc") },
    { icon: <ShoppingCart size={22} />, title: t("valueProps.simpleOrders"), desc: t("valueProps.simpleOrdersDesc") },
    { icon: <Shield size={22} />, title: t("valueProps.guaranteed"), desc: t("valueProps.guaranteedDesc") },
  ];

  const comparisonOld = [
    t("comparison.trad1"), t("comparison.trad2"), t("comparison.trad3"),
    t("comparison.trad4"), t("comparison.trad5"), t("comparison.trad6"),
  ];

  const comparisonNew = [
    t("comparison.mk1"), t("comparison.mk2"), t("comparison.mk3"),
    t("comparison.mk4"), t("comparison.mk5"), t("comparison.mk6"),
  ];

  const howItWorks = [
    { step: "1", title: t("howToOrder.step1Title"), desc: t("howToOrder.step1Desc") },
    { step: "2", title: t("howToOrder.step2Title"), desc: t("howToOrder.step2Desc") },
    { step: "3", title: t("howToOrder.step3Title"), desc: t("howToOrder.step3Desc") },
    { step: "4", title: t("howToOrder.step4Title"), desc: t("howToOrder.step4Desc") },
  ];

  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
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
    <Layout title="MediKong — Fournitures médicales B2B en Belgique | Comparez & Commandez" description="MediKong.pro : marketplace B2B + comparateur de prix pour fournitures médicales en Belgique. Comparez, commandez, économisez.">
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
            <span className="relative inline-block pb-1">
              Tout le médical
              <span className="absolute left-0 right-0 bottom-0 h-[8px] bg-mk-blue/25 rounded-full" />
            </span>
            , tous les prix,
            <br />
            un seul endroit
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

          {/* Inline stats — dynamic per country */}
          <motion.div
            className="flex items-center justify-center gap-0 divide-x divide-mk-line"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="px-4 md:px-6 text-center">
              <div className="text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.vendors)}
              </div>
              <div className="text-xs text-mk-sec mt-0.5">{t("stats.suppliers")}</div>
            </div>
            <div className="px-4 md:px-6 text-center">
              <div className="text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.brands)}
              </div>
              <div className="text-xs text-mk-sec mt-0.5">Marques</div>
            </div>
            <div className="px-4 md:px-6 text-center">
              <div className="text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.products)}
              </div>
              <div className="text-xs text-mk-sec mt-0.5">{t("stats.products")} {countryLabel}</div>
            </div>
            <div className="px-4 md:px-6 text-center">
              <div className="text-xl md:text-2xl font-bold text-mk-navy">
                {renderCountryStat(countryStats?.offers)}
              </div>
              <div className="text-xs text-mk-sec mt-0.5">{t("stats.offers", "Offres")}</div>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Link to="/onboarding" className="inline-flex items-center gap-2 bg-mk-navy text-white font-semibold text-sm px-7 py-3 rounded-lg hover:opacity-90 transition-opacity">
              {t("common.signup")} <ArrowRight size={16} />
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
              {[...featuredBrands, ...featuredBrands].map((b: any, i: number) => (
                <Link key={`${b.id}-${i}`} to={`/marque/${b.slug}`} className="shrink-0 w-[160px] group">
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-mk-alt to-white border border-mk-line flex items-center justify-center mb-2 overflow-hidden group-hover:shadow-md group-hover:border-mk-navy/20 transition-all">
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt={b.name}
                        className="w-24 h-24 object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <span className={`text-lg font-bold text-mk-navy/70 ${b.logo_url ? "hidden" : ""}`}>{b.name}</span>
                  </div>
                  <p className="text-xs font-semibold text-mk-navy text-center uppercase tracking-wide group-hover:text-mk-blue transition-colors">{b.name}</p>
                </Link>
              ))}
            </motion.div>
          </div>
          
          <div className="text-center mt-8">
            <Link to="/marques" className="inline-flex items-center gap-2 px-8 py-3 border border-mk-line rounded-lg text-sm font-semibold text-mk-navy hover:border-mk-navy hover:shadow-sm transition-all">
              {t("common.allBrands")}
            </Link>
          </div>
        </div>
      </AnimatedSection>

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

      {/* ═══ POPULAR PRODUCTS ═══ */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-mk-navy">{t("popularProducts.title")}</h2>
            <Link to="/recherche" className="text-sm text-mk-blue hover:underline flex items-center gap-1">
              {t("common.viewAll")} <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {products.slice(0, 5).map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </AnimatedSection>

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
            <Link to="/onboarding" className="inline-flex items-center gap-2 bg-white text-mk-navy font-bold text-sm px-8 py-3.5 rounded-lg hover:bg-gray-100 transition-colors">
              {t("common.signup")} <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
