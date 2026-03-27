import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Search, Shield, Truck, Award, Package, Heart, Activity, Droplet, Droplets, Wrench, ChevronRight, Check, Armchair } from "lucide-react";
import { products, categories, formatPrice } from "@/data/mock";
import { ProductCard } from "@/components/shared/ProductCard";
import { useState } from "react";

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

  return (
    <Layout>
      {/* Hero */}
      <section className="py-14">
        <div className="mk-container text-center">
          <h1 className="text-[32px] font-bold text-mk-navy mb-3">La marketplace B2B pour les fournitures medicales en Belgique</h1>
          <p className="text-base text-mk-sec mb-6 max-w-2xl mx-auto">Comparez les prix de centaines de fournisseurs. Achetez directement ou trouvez la meilleure offre externe.</p>
          <form onSubmit={e => { e.preventDefault(); }} className="max-w-[520px] mx-auto mb-3">
            <div className="flex border border-mk-line rounded-md overflow-hidden">
              <div className="flex items-center pl-3">
                <Search size={16} className="text-mk-sec" />
              </div>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher produits, marques, CNK..."
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
              />
              <Link to={`/recherche?q=${encodeURIComponent(searchQuery)}`} className="bg-mk-blue text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90">
                Rechercher
              </Link>
            </div>
          </form>
          <div className="flex items-center justify-center gap-3 text-xs text-mk-ter">
            <span>Ex:</span>
            {["Gants nitrile", "Betadine", "TENA", "Masques FFP2"].map(ex => (
              <Link key={ex} to={`/recherche?q=${encodeURIComponent(ex)}`} className="text-mk-blue hover:underline">{ex}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-b border-mk-line py-6">
        <div className="mk-container flex items-center justify-center gap-16">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-mk-navy">{s.value}</div>
              <div className="text-xs text-mk-sec">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-10">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-mk-navy">Categories</h2>
            <Link to="/categorie/consommables" className="text-sm text-mk-blue hover:underline">Voir tout</Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {categories.map(cat => (
              <Link key={cat.slug} to={`/categorie/${cat.slug}`} className="flex items-center gap-3 border border-mk-line rounded-lg p-4 hover:shadow-sm transition-shadow">
                {iconMap[cat.icon]}
                <div>
                  <div className="text-sm font-medium text-mk-navy">{cat.name}</div>
                  <div className="text-xs text-mk-sec">{cat.count}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Pillars */}
      <section className="py-10">
        <div className="mk-container">
          <h2 className="text-xl font-bold text-mk-navy mb-5 text-center">Trois facons d'acheter sur MediKong</h2>
          <div className="grid grid-cols-3 gap-4">
            {pillars.map(p => (
              <div key={p.title} className="border border-mk-line rounded-lg p-6">
                <span className="text-xs font-medium text-mk-blue bg-mk-blue/10 px-2 py-1 rounded">{p.tag}</span>
                <h3 className="text-lg font-bold text-mk-navy mt-3 mb-2">{p.title}</h3>
                <p className="text-sm text-mk-sec">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Products */}
      <section className="py-10">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-mk-navy">Produits populaires</h2>
            <Link to="/recherche" className="text-sm text-mk-blue hover:underline">Voir tout</Link>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {products.slice(0, 5).map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Popular Brands */}
      <section className="py-10">
        <div className="mk-container">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-mk-navy">Marques populaires</h2>
            <Link to="/marques" className="text-sm text-mk-blue hover:underline">Toutes les marques</Link>
          </div>
          <div className="flex gap-3">
            {popularBrands.map(b => (
              <Link key={b} to={`/marque/${b.toLowerCase().replace('.', '-')}`} className="px-5 py-2.5 border border-mk-line rounded-md text-sm font-medium text-mk-navy hover:border-mk-navy transition-colors">
                {b}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-10">
        <div className="mk-container">
          <h2 className="text-xl font-bold text-mk-navy mb-5 text-center">Pourquoi MediKong ?</h2>
          <div className="grid grid-cols-4 gap-4">
            {trustItems.map(t => (
              <div key={t.title} className="text-center border border-mk-line rounded-lg p-6">
                <div className="w-10 h-10 rounded-full bg-mk-alt flex items-center justify-center mx-auto mb-3 text-mk-navy">{t.icon}</div>
                <h3 className="text-sm font-bold text-mk-navy mb-1">{t.title}</h3>
                <p className="text-xs text-mk-sec">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seller CTA */}
      <section className="py-10">
        <div className="mk-container">
          <div className="border border-mk-line rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-mk-navy mb-2">Vous etes fournisseur ?</h2>
            <p className="text-sm text-mk-sec mb-4">Rejoignez 350+ fournisseurs et touchez 500+ pharmacies en Belgique.</p>
            <Link to="/inscription" className="inline-block bg-mk-navy text-white font-bold text-sm px-6 py-2.5 rounded-md hover:opacity-90">Vendez via MediKong</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10">
        <div className="mk-container max-w-2xl">
          <h2 className="text-xl font-bold text-mk-navy mb-5">Questions frequentes</h2>
          {faqs.map(q => (
            <div key={q} className="flex items-center justify-between py-3 border-b border-mk-line">
              <span className="text-sm text-mk-text">{q}</span>
              <ChevronRight size={16} className="text-mk-sec" />
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
