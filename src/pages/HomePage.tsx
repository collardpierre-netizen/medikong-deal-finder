import { Layout } from "@/components/layout/Layout";
import { Link, useNavigate } from "react-router-dom";
import { Search, Shield, Truck, Award, Package, Heart, Activity, Droplet, Droplets, Wrench, ChevronRight, Check, Armchair, TrendingDown, ArrowRight, Globe, Zap, ShoppingCart, FileSearch, BarChart3, ChevronDown } from "lucide-react";
import { categories, formatPrice } from "@/data/mock";
import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/PageTransition";
import { HeroImageGallery } from "@/components/home/HeroImageGallery";

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

const heroStats = [
  { value: "350+", label: "Fournisseurs vérifiés" },
  { value: "12 500+", label: "Produits" },
  { value: "500+", label: "Pharmacies partenaires" },
];

const valueProps = [
  { icon: <TrendingDown size={22} />, title: "Meilleurs prix B2B", desc: "Comparez les offres de 350+ grossistes, marques et distributeurs dans un catalogue unifié." },
  { icon: <ShoppingCart size={22} />, title: "Commandes simplifiées", desc: "MOQ bas, paiement intégré et livraison suivie. Accédez aux prix de gros habituellement réservés aux grandes structures." },
  { icon: <Shield size={22} />, title: "Authenticité garantie", desc: "Chaque produit provient de fournisseurs vérifiés. 100% conforme CE et FAGG." },
];

const comparisonOld = [
  "Contrats fournisseurs rigides",
  "Commandes minimum élevées (10K€+)",
  "Processus de négociation long",
  "Ruptures de stock fréquentes",
  "Comparaison manuelle des catalogues",
  "Aucune protection en cas d'erreur",
];

const comparisonNew = [
  "Sans contrat, sans engagement",
  "MOV à partir de 150€ HT",
  "Accès instantané à 350+ fournisseurs",
  "15+ fournisseurs par référence",
  "Analyse en temps réel des stocks",
  "Protection acheteur incluse",
];

const howItWorks = [
  { step: "1", title: "Recherchez & sélectionnez", desc: "Parcourez le catalogue pour trouver les meilleures offres et ajoutez-les au panier." },
  { step: "2", title: "Comparez & ajustez", desc: "Vérifiez votre panier, comparez les offres directes et externes, ajustez les quantités." },
  { step: "3", title: "Commandez & payez", desc: "Validez et réglez par carte, virement ou paiement différé (30/60 jours)." },
  { step: "4", title: "Livraison & support", desc: "Expédition sous 24-48h. Un problème ? Résolution garantie sous 24h." },
];

const faqs = [
  { q: "Comment fonctionne MediKong ?", a: "MediKong est un marketplace B2B qui regroupe les offres de 350+ fournisseurs médicaux vérifiés. Vous pouvez acheter directement via la marketplace, comparer les prix du marché, ou être redirigé vers les offres externes les plus compétitives." },
  { q: "Quels professionnels peuvent s'inscrire ?", a: "Tous les professionnels de santé en Belgique : pharmacies, hôpitaux, cliniques, MR/MRS, cabinets médicaux, kinésithérapeutes, dentistes, centrales d'achat et revendeurs agréés." },
  { q: "Les prix incluent-ils la TVA ?", a: "Les prix affichés sont hors TVA (HT). La TVA applicable est ajoutée au moment du checkout selon votre statut et localisation." },
  { q: "Comment fonctionne la livraison ?", a: "Les commandes sont expédiées sous 24-48h depuis les entrepôts de nos fournisseurs en Belgique et en Europe. Le suivi est intégré dans votre espace client." },
];

const popularBrands = ["3M", "TENA", "Hartmann", "B.Braun", "Essity", "Molnlycke", "Ecolab", "Kolmi"];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { data: products = [] } = useProducts();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/recherche?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <Layout>
      {/* ═══ HERO — centered, clean ═══ */}
      <section className="pt-10 md:pt-20 pb-6 md:pb-10">
        <div className="mk-container text-center max-w-2xl mx-auto">
          <motion.h1
            className="text-3xl md:text-[44px] leading-[1.15] font-bold text-mk-navy mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            La marketplace médicale B2B de référence en Belgique
          </motion.h1>
          <motion.p
            className="text-base md:text-lg text-mk-sec mb-8 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Comparez les prix de centaines de fournisseurs. Achetez directement ou trouvez la meilleure offre externe.
          </motion.p>

          {/* Search */}
          <motion.form
            onSubmit={handleSearch}
            className="max-w-[560px] mx-auto mb-5"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex border border-mk-line rounded-xl overflow-hidden shadow-md bg-white">
              <div className="flex items-center pl-4">
                <Search size={18} className="text-mk-sec" />
              </div>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher produits, marques, CNK..."
                className="flex-1 px-3 py-3.5 text-sm focus:outline-none min-w-0"
              />
              <button type="submit" className="bg-mk-blue text-white px-6 py-3.5 text-sm font-semibold hover:opacity-90 whitespace-nowrap transition-opacity">
                Rechercher
              </button>
            </div>
          </motion.form>

          <motion.div
            className="flex items-center justify-center gap-4 text-xs text-mk-ter flex-wrap mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <span>Ex:</span>
            {["Gants nitrile", "Betadine", "TENA", "Masques FFP2"].map(ex => (
              <Link key={ex} to={`/recherche?q=${encodeURIComponent(ex)}`} className="text-mk-blue hover:underline">{ex}</Link>
            ))}
          </motion.div>

          {/* Inline stats — Qogita style */}
          <motion.div
            className="flex items-center justify-center gap-0 divide-x divide-mk-line"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {heroStats.map(s => (
              <div key={s.label} className="px-6 md:px-8 text-center">
                <div className="text-xl md:text-2xl font-bold text-mk-navy">{s.value}</div>
                <div className="text-xs text-mk-sec mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Link to="/onboarding" className="inline-flex items-center gap-2 bg-mk-navy text-white font-semibold text-sm px-7 py-3 rounded-lg hover:opacity-90 transition-opacity">
              Créer un compte gratuit <ArrowRight size={16} />
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

      {/* ═══ 3 VALUE PROPS — Qogita style ═══ */}
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

      {/* ═══ POPULAR BRANDS — horizontal scroll ═══ */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-mk-navy">Marques populaires</h2>
            <Link to="/marques" className="text-sm text-mk-blue hover:underline flex items-center gap-1">
              Toutes les marques <ChevronRight size={14} />
            </Link>
          </div>
          <StaggerContainer className="flex gap-3 flex-wrap">
            {popularBrands.map(b => (
              <StaggerItem key={b}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                  <Link to={`/marque/${b.toLowerCase().replace('.', '-')}`} className="flex items-center justify-center px-6 py-3 border border-mk-line rounded-xl text-sm font-medium text-mk-navy hover:border-mk-navy hover:shadow-sm transition-all bg-white">
                    {b}
                  </Link>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* ═══ COMPARISON TABLE — Qogita style ═══ */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-10 text-center">MediKong vs. sourcing traditionnel</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Old way */}
            <div className="bg-white border border-mk-line rounded-2xl p-6 md:p-8">
              <h3 className="text-sm font-bold text-mk-ter uppercase tracking-wider mb-5">Sourcing traditionnel</h3>
              <div className="space-y-3.5">
                {comparisonOld.map(item => (
                  <div key={item} className="flex items-start gap-3 text-sm text-mk-sec">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-red-50 text-red-400 flex items-center justify-center shrink-0 text-xs">✕</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            {/* MediKong */}
            <div className="bg-mk-navy text-white rounded-2xl p-6 md:p-8 shadow-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-5 text-white/60">MediKong.pro</h3>
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
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-mk-navy">Catégories populaires</h2>
            <Link to="/categorie/consommables" className="text-sm text-mk-blue hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={14} />
            </Link>
          </div>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => (
              <StaggerItem key={cat.slug}>
                <HoverCard className="border border-mk-line rounded-xl bg-white">
                  <Link to={`/categorie/${cat.slug}`} className="flex items-center gap-3 p-4 md:p-5">
                    {iconMap[cat.icon]}
                    <div>
                      <div className="text-sm font-semibold text-mk-navy">{cat.name}</div>
                      <div className="text-xs text-mk-sec mt-0.5">{cat.count}</div>
                    </div>
                  </Link>
                </HoverCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* ═══ POPULAR PRODUCTS ═══ */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-mk-navy">Produits populaires</h2>
            <Link to="/recherche" className="text-sm text-mk-blue hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {products.slice(0, 5).map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ═══ HOW IT WORKS — Qogita style ═══ */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-10 text-center">Comment commander</h2>
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

      {/* ═══ FAQ ACCORDION — Qogita style ═══ */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container max-w-2xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-8">Questions fréquentes</h2>
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

      {/* ═══ FINAL CTA BANNER — Qogita style ═══ */}
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
              Trouvez les meilleures offres sur des milliers de références médicales.
            </h2>
            <p className="text-sm text-white/60 mb-8 max-w-md mx-auto">
              Un seul endroit pour tous vos achats médicaux B2B.
            </p>
            <Link to="/onboarding" className="inline-flex items-center gap-2 bg-white text-mk-navy font-bold text-sm px-8 py-3.5 rounded-lg hover:bg-gray-100 transition-colors">
              Créer un compte gratuit <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
