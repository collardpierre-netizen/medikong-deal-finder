import { Layout } from "@/components/layout/Layout";
import { Link, useNavigate } from "react-router-dom";
import { Search, Shield, Truck, Award, Package, Heart, Activity, Droplet, Droplets, Wrench, ChevronRight, Check, Armchair } from "lucide-react";
import { categories, formatPrice } from "@/data/mock";
import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { useState } from "react";
import { motion } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/PageTransition";
import heroMedical from "@/assets/hero-medical-supplies.png";
import heroPackages from "@/assets/hero-packages.png";

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

const stats = [
  { value: "12 500+", label: "Produits references" },
  { value: "350+", label: "Fournisseurs actifs" },
  { value: "500+", label: "Pharmacies partenaires" },
  { value: "-45%", label: "Economie moyenne" },
];

const pillars = [
  { tag: "Achat direct", title: "Marketplace", desc: "Achetez directement aupres de vendeurs verifies sur MediKong. Paiement integre, livraison suivie." },
  { tag: "Redirection", title: "Offres externes", desc: "Comparez les prix des fournisseurs externes et accedez a leurs offres en un clic." },
  { tag: "Consultation", title: "Prix du marche", desc: "Consultez les prix des concurrents pour une veille tarifaire complete du marche belge." },
];

const trustItems = [
  { icon: <Shield size={20} />, title: "100% Authentique", desc: "Produits certifies CE et conformes FAGG" },
  { icon: <Award size={20} />, title: "Meilleurs prix", desc: "Comparez et economisez jusqu'a 65%" },
  { icon: <Truck size={20} />, title: "Livraison rapide", desc: "Expedition sous 24-48h en Belgique" },
  { icon: <Check size={20} />, title: "Support dedie", desc: "Equipe experte a votre service" },
];

const faqs = [
  "Comment fonctionne MediKong ?",
  "Quels professionnels peuvent s'inscrire ?",
  "Les prix incluent-ils la TVA ?",
  "Comment fonctionne la livraison ?",
];

const popularBrands = ["3M", "TENA", "Hartmann", "B.Braun", "Essity", "Molnlycke", "Ecolab", "Kolmi"];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: products = [] } = useProducts();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/recherche?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <Layout>
      {/* Hero — split layout with illustration */}
      <section className="py-12 md:py-24 overflow-hidden">
        <div className="mk-container">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left — text + search */}
            <div className="text-center md:text-left max-w-xl mx-auto md:mx-0">
              <motion.h1
                className="text-3xl md:text-[42px] leading-tight font-bold text-mk-navy mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                La marketplace B2B pour les fournitures médicales en Belgique
              </motion.h1>
              <motion.p
                className="text-base md:text-lg text-mk-sec mb-8"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                Comparez les prix de centaines de fournisseurs. Achetez directement ou trouvez la meilleure offre externe.
              </motion.p>
              <motion.form
                onSubmit={handleSearch}
                className="max-w-[560px] mx-auto md:mx-0 mb-4"
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex border border-mk-line rounded-lg overflow-hidden shadow-sm">
                  <div className="flex items-center pl-4">
                    <Search size={18} className="text-mk-sec" />
                  </div>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher produits, marques, CNK..."
                    className="flex-1 px-3 py-3.5 text-sm focus:outline-none min-w-0"
                  />
                  <Link to={`/recherche?q=${encodeURIComponent(searchQuery)}`} className="bg-mk-blue text-white px-6 py-3.5 text-sm font-semibold hover:opacity-90 whitespace-nowrap">
                    Rechercher
                  </Link>
                </div>
              </motion.form>
              <motion.div
                className="flex items-center justify-center md:justify-start gap-4 text-xs text-mk-ter flex-wrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.35 }}
              >
                <span>Ex:</span>
                {["Gants nitrile", "Betadine", "TENA", "Masques FFP2"].map(ex => (
                  <Link key={ex} to={`/recherche?q=${encodeURIComponent(ex)}`} className="text-mk-blue hover:underline">{ex}</Link>
                ))}
              </motion.div>
            </div>

            {/* Right — hero illustration */}
            <motion.div
              className="relative hidden md:flex items-center justify-center"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={heroMedical}
                alt="Fournitures médicales professionnelles"
                width={480}
                height={360}
                className="w-full max-w-[480px] drop-shadow-xl"
              />
              {/* Floating packages card */}
              <motion.div
                className="absolute -bottom-4 -left-6 bg-white rounded-xl shadow-lg p-3 border border-mk-line/50"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <img src={heroPackages} alt="Livraison" width={120} height={120} className="w-[120px]" />
                <p className="text-[11px] font-medium text-mk-navy text-center mt-1">Livraison 24-48h</p>
              </motion.div>
              {/* Floating badge */}
              <motion.div
                className="absolute top-4 -right-2 bg-mk-blue text-white rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6, type: "spring" }}
              >
                -45% en moyenne
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <AnimatedSection className="border-t border-b border-mk-line py-10 md:py-12">
        <StaggerContainer className="mk-container grid grid-cols-2 md:flex md:items-center md:justify-center gap-8 md:gap-20">
          {stats.map(s => (
            <StaggerItem key={s.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-mk-navy">{s.value}</div>
              <div className="text-sm text-mk-sec mt-1">{s.label}</div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </AnimatedSection>

      {/* Categories */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-mk-navy">Categories</h2>
            <Link to="/categorie/consommables" className="text-sm text-mk-blue hover:underline">Voir tout</Link>
          </div>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => (
              <StaggerItem key={cat.slug}>
                <HoverCard className="border border-mk-line rounded-lg">
                  <Link to={`/categorie/${cat.slug}`} className="flex items-center gap-3 p-4 md:p-5">
                    {iconMap[cat.icon]}
                    <div>
                      <div className="text-sm font-medium text-mk-navy">{cat.name}</div>
                      <div className="text-xs text-mk-sec mt-0.5">{cat.count}</div>
                    </div>
                  </Link>
                </HoverCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* 3 Pillars */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container">
          <h2 className="text-2xl font-bold text-mk-navy mb-8 text-center">Trois facons d'acheter sur MediKong</h2>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map(p => (
              <StaggerItem key={p.title}>
                <HoverCard className="bg-white border border-mk-line rounded-xl p-7 h-full">
                  <span className="text-xs font-medium text-mk-blue bg-mk-blue/10 px-2.5 py-1 rounded-full">{p.tag}</span>
                  <h3 className="text-lg font-bold text-mk-navy mt-4 mb-2">{p.title}</h3>
                  <p className="text-sm text-mk-sec leading-relaxed">{p.desc}</p>
                </HoverCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* Popular Products */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-mk-navy">Produits populaires</h2>
            <Link to="/recherche" className="text-sm text-mk-blue hover:underline">Voir tout</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {products.slice(0, 5).map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Popular Brands */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-mk-navy">Marques populaires</h2>
            <Link to="/marques" className="text-sm text-mk-blue hover:underline">Toutes les marques</Link>
          </div>
          <StaggerContainer className="flex gap-3 flex-wrap">
            {popularBrands.map(b => (
              <StaggerItem key={b}>
                <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                  <Link to={`/marque/${b.toLowerCase().replace('.', '-')}`} className="block px-5 py-2.5 border border-mk-line rounded-lg text-sm font-medium text-mk-navy hover:border-mk-navy transition-colors">
                    {b}
                  </Link>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* Trust */}
      <AnimatedSection className="py-14 md:py-20 bg-mk-alt/30">
        <div className="mk-container">
          <h2 className="text-2xl font-bold text-mk-navy mb-8 text-center">Pourquoi MediKong ?</h2>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {trustItems.map(t => (
              <StaggerItem key={t.title}>
                <HoverCard className="text-center bg-white border border-mk-line rounded-xl p-6 md:p-8 h-full">
                  <motion.div
                    className="w-12 h-12 rounded-full bg-mk-alt flex items-center justify-center mx-auto mb-4 text-mk-navy"
                    whileHover={{ rotate: 10, scale: 1.15 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    {t.icon}
                  </motion.div>
                  <h3 className="text-sm font-bold text-mk-navy mb-1.5">{t.title}</h3>
                  <p className="text-xs text-mk-sec leading-relaxed">{t.desc}</p>
                </HoverCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* Seller CTA */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container max-w-3xl">
          <motion.div
            className="border border-mk-line rounded-xl p-8 md:p-12 text-center"
            whileHover={{ boxShadow: "0 16px 40px -12px rgba(0,0,0,0.08)" }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-mk-navy mb-3">Vous etes fournisseur ?</h2>
            <p className="text-sm text-mk-sec mb-6 max-w-lg mx-auto">Rejoignez 350+ fournisseurs et touchez 500+ pharmacies en Belgique.</p>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Link to="/inscription" className="inline-block bg-mk-navy text-white font-bold text-sm px-8 py-3 rounded-lg hover:opacity-90">Vendez via MediKong</Link>
            </motion.div>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* FAQ */}
      <AnimatedSection className="py-14 md:py-20">
        <div className="mk-container max-w-2xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-8">Questions frequentes</h2>
          {faqs.map((q, i) => (
            <motion.div
              key={q}
              className="flex items-center justify-between py-4 border-b border-mk-line cursor-pointer"
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08, ease: "easeOut" }}
              whileHover={{ x: 4 }}
            >
              <span className="text-sm text-mk-text">{q}</span>
              <motion.div whileHover={{ x: 3 }}>
                <ChevronRight size={16} className="text-mk-sec shrink-0" />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>
    </Layout>
  );
}
