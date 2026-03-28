import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Download, Shield, TrendingUp, Users, Globe, ChevronDown, ShoppingCart, Lock, BarChart3, CheckCircle2, Building2 } from "lucide-react";
import { useState, useEffect } from "react";

/* ───────── DATA ───────── */

const leveeCards = [
  { label: "Valorisation pré-money", value: "9 000 000 €" },
  { label: "Montant recherché", value: "1 000 000 €" },
  { label: "Valorisation post-money", value: "10 000 000 €" },
  { label: "Part cédée", value: "10%" },
  { label: "Ticket minimum", value: "1 000 €" },
  { label: "Type d'instrument", value: "Actions ordinaires" },
];

const platformFeatures = [
  { icon: ShoppingCart, title: "Marketplace B2B médical", desc: "Catalogue de 40 000+ références. Pharmacies, hôpitaux et MR/MRS commandent en quelques clics auprès de vendeurs vérifiés." },
  { icon: Lock, title: "Transactions sécurisées", desc: "Paiement escrow, traçabilité complète et conformité réglementaire sur chaque transaction." },
  { icon: BarChart3, title: "Intelligence de marché", desc: "Comparaison de prix en temps réel, alertes et analytics pour optimiser les achats de fournitures médicales." },
  { icon: Globe, title: "Marché européen en expansion", desc: "Présent en Belgique, France et Luxembourg avec une ambition de couverture européenne complète." },
  { icon: TrendingUp, title: "Modèle marketplace récurrent", desc: "Commissions sur chaque transaction + abonnements vendeurs : revenus prévisibles et scalables." },
  { icon: Users, title: "Équipe expérimentée", desc: "Fondateurs avec 20+ ans d'expérience dans le secteur médical et le commerce B2B." },
];

const tamSamSom = [
  { label: "TAM Europe", value: "52 Mrd €", desc: "Marché total de la distribution de produits de santé en Europe." },
  { label: "SAM Belgique", value: "2,4 Mrd €", desc: "Marché adressable : pharmacies, hôpitaux et MR/MRS." },
  { label: "SOM – Objectif Y5", value: "150 M €", desc: "Volume de transactions visé — 6,25% de part de marché belge." },
];

const phases = [
  { tag: "En cours", tagColor: "bg-emerald-500", period: "Phase 1", title: "Distribution digitale", desc: "Digitalisation des flux logistiques existants. Connexion API avec pharmacies et institutions. Optimisation des opérations courantes." },
  { tag: "2026-2027", tagColor: "bg-blue-500", period: "Phase 2", title: "Marketplace ouverte", desc: "Onboarding de fournisseurs tiers. Élargissement du catalogue au-delà du stock propre. Commissions sur le GMV sans risque de stock." },
  { tag: "2027+", tagColor: "bg-purple-500", period: "Phase 3", title: "Monétisation des données", desc: "Vente d'intelligence tarifaire et de tendances marché aux fabricants. Revenus SaaS à forte marge en complément de la logistique." },
];

const tractionMetrics = [
  { value: "12 000 €", label: "Revenus en 2 semaines", sub: "Post-lancement, 0 € de marketing" },
  { value: "62", label: "MR/MRS en discussion", sub: "Onboarding en cours pour pilote" },
  { value: "1M€+", label: "Pipeline commercial", sub: "Dont Febelco (grossiste pharma)" },
  { value: "40 000+", label: "Références produits", sub: "Catalogue en croissance continue" },
  { value: "50+", label: "Vendeurs vérifiés", sub: "Réseau de fournisseurs européens" },
  { value: "BE, FR, LU", label: "Pays couverts", sub: "Ambition européenne" },
];

const trustLogos = [
  { name: "Febelco", url: "https://www.febelco.be/", img: "https://www.medikong.pro/assets/febelco-CSYKVv36.png" },
  { name: "Emeis", url: "https://emeis.be/fr", img: "https://www.medikong.pro/assets/emeis-BmOiHRRq.png" },
  { name: "Dynaphar", url: "https://dynaphar.be/fr", img: "https://www.medikong.pro/assets/dynaphar-BUJAqh3T.png" },
  { name: "Fixmer Pharma", url: "https://www.fixmer-pharma.be/", img: "https://www.medikong.pro/assets/fixmer-pharma-CQ1CGzcC.png" },
  { name: "PharmaMed", url: "https://www.pharmamed.be/", img: "https://www.medikong.pro/assets/pharmamed-Cq4BJI1Z.svg" },
  { name: "Newtech", url: "https://newtech-ll.eu/", img: "https://www.medikong.pro/assets/newtech-ll-I3CS6HUK.png" },
  { name: "BNA Santé", url: "https://www.bnasantepolyclinique.be/", img: "https://www.medikong.pro/assets/bna-sante-sSfIBMVW.svg" },
  { name: "Continuing Care", url: "https://continuingcare.be/", img: "https://www.medikong.pro/assets/continuing-care-BaN_4bJV.png" },
];

const fundsAllocation = [
  { label: "Technologie & Produit", pct: 35 },
  { label: "Commercial & Business Dev", pct: 25 },
  { label: "Marketing & Communication", pct: 15 },
  { label: "Ressources Humaines & Recrutement", pct: 12 },
  { label: "Opérations & Logistique", pct: 8 },
  { label: "Frais généraux (SG&A)", pct: 5 },
];
const fundColors = ["#1B5BDA", "#059669", "#34D399", "#6B9FE8", "#10B981", "#CBD5E1"];

const investSteps = [
  { n: "01", title: "Inscrivez-vous", desc: "Créez votre compte sur la plateforme en 2 minutes" },
  { n: "02", title: "Choisissez votre montant", desc: "À partir de 1 000 € (multiples de 1 000 €)" },
  { n: "03", title: "Signez et transférez", desc: "Signature électronique + virement bancaire sécurisé" },
];

const faqs = [
  { q: "Quel est le montant minimum pour investir ?", a: "Vous pouvez investir à partir de 1 000 €. Les souscriptions se font par multiples de 1 000 €. Il n'y a pas de montant maximum, mais l'avantage fiscal Tax Shelter est plafonné à 15 000 € par personne par an." },
  { q: "Qu'est-ce que le Tax Shelter ?", a: "Le Tax Shelter est un incitant fiscal belge permettant aux investisseurs particuliers de récupérer 45% de leur investissement dans une startup via une réduction d'impôt sur les personnes physiques." },
  { q: "Pourquoi une fondation pour les actionnaires ?", a: "La fondation privée (SPV) regroupe tous les petits actionnaires en une seule entité juridique. Cela simplifie la gouvernance de MediKong, protège vos droits et facilite les futures opérations (dividendes, exit)." },
  { q: "Quand vais-je recevoir mes actions ?", a: "Après signature de la convention et réception de votre virement, vos actions sont émises sous 15 jours ouvrables. Vous recevez un certificat d'actionnaire et votre attestation Tax Shelter." },
  { q: "Puis-je revendre mes actions ?", a: "Pour bénéficier du Tax Shelter, les actions doivent être conservées pendant 4 ans minimum. Après cette période, elles peuvent être revendues selon les conditions du pacte d'actionnaires." },
  { q: "Quels sont les risques ?", a: "Comme tout investissement en startup, il existe un risque de perte totale du capital. MediKong est une jeune entreprise qui évolue dans un marché compétitif. Nous recommandons de n'investir que des montants que vous pouvez vous permettre de perdre." },
  { q: "Comment MediKong va utiliser les fonds levés ?", a: "Les fonds seront utilisés pour accélérer le développement produit (35%), recruter des profils commerciaux (25%), financer le marketing (15%), les ressources humaines (12%), les opérations (8%) et les frais généraux (5%)." },
  { q: "Quel est le marché adressable ?", a: "Le marché des fournitures médicales B2B en Belgique représente plus de 2,4 milliards d'euros par an. MediKong cible en priorité les pharmacies, maisons de repos et cabinets médicaux." },
  { q: "Quel est le modèle économique ?", a: "MediKong prélève une commission sur chaque transaction réalisée sur la marketplace (entre 6% et 15% selon la catégorie), ainsi que des revenus d'affiliation sur les offres externes." },
];

const navAnchors = [
  { id: "opportunite", label: "L'Opportunité" },
  { id: "chiffres", label: "Chiffres Clés" },
  { id: "taxshelter", label: "Tax Shelter" },
  { id: "comment", label: "Comment Investir" },
  { id: "faq", label: "FAQ" },
];

/* ───────── TAX SHELTER SLIDER ───────── */
function TaxShelterSimulator() {
  const [amount, setAmount] = useState(10000);
  const reduction = Math.round(amount * 0.45);
  const net = amount - reduction;
  const remaining = 15000 - amount;
  const pct = ((amount - 1000) / (15000 - 1000)) * 100;

  return (
    <div className="rounded-2xl p-6 md:p-8" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1a365d 100%)" }}>
      <h3 className="text-lg font-bold text-white mb-1">Simulateur Tax Shelter</h3>
      <p className="text-sm text-white/50 mb-6">Déplacez le curseur pour ajuster votre investissement</p>

      {/* Labels + selected amount */}
      <div className="flex items-end justify-between mb-2">
        <span className="text-xs text-white/40">1 000 €</span>
        <span className="text-xl font-bold text-white">{amount.toLocaleString("fr-BE")} €</span>
        <span className="text-xs text-white/40">15 000 €</span>
      </div>

      {/* Custom slider track */}
      <div className="relative h-2 rounded-full bg-white/10 mb-8">
        <div className="absolute inset-y-0 left-0 rounded-full bg-mk-green" style={{ width: `${pct}%` }} />
        <input type="range" min={1000} max={15000} step={500} value={amount} onChange={e => setAmount(Number(e.target.value))}
          className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(5,150,105,0.5)] [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent" />
      </div>

      {/* Breakdown rows */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm border-b border-white/10 pb-3">
          <span className="text-white/60">Montant investi</span>
          <span className="font-semibold text-white">{amount.toLocaleString("fr-BE")} €</span>
        </div>
        <div className="flex justify-between text-sm border-b border-white/10 pb-3">
          <span className="text-white/60">Montant éligible</span>
          <span className="font-semibold text-white">{amount.toLocaleString("fr-BE")} €</span>
        </div>
        <div className="flex justify-between text-sm border-b border-white/10 pb-3">
          <span className="text-white/60">Réduction d'impôt (45%)</span>
          <span className="font-semibold text-mk-green">– {reduction.toLocaleString("fr-BE")} €</span>
        </div>
        <div className="bg-white/5 rounded-lg px-4 py-3 flex justify-between text-sm">
          <span className="font-bold text-white">Coût réel net</span>
          <span className="font-bold text-mk-green text-lg">{net.toLocaleString("fr-BE")} €</span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between text-sm pt-1">
            <span className="text-white/40">Solde Tax Shelter disponible</span>
            <span className="font-medium text-white/70">{remaining.toLocaleString("fr-BE")} €</span>
          </div>
        )}
      </div>
      <p className="text-xs text-white/30 mt-5">
        Éligible de 5 000 € à 15 000 € / an (personnes physiques).{" "}
        <a href="https://economie.fgov.be/fr/themes/entreprises/pme-et-independants-en/tax-shelter" target="_blank" rel="noopener noreferrer" className="text-mk-green hover:underline">Voir le site officiel du SPF Économie →</a>
      </p>
    </div>
  );
}

/* ───────── MAIN PAGE ───────── */
export default function InvestPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.id); }); },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    navAnchors.forEach(({ id }) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  return (
    <Layout>
      {/* ════════════ HERO ════════════ */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #122a4a 30%, #1a365d 60%, #0f2440 100%)" }}>
        {/* Animated orbs */}
        <div className="invest-orb-1" />
        <div className="invest-orb-2" />
        <div className="invest-orb-3" />
        <div className="invest-orb-4" />
        {/* Static patterns */}
        <div className="absolute inset-0 invest-dots" />
        <div className="absolute inset-0 invest-grid" />
        <div className="max-w-4xl mx-auto px-5 py-24 md:py-32 text-center text-white relative z-10">
          <motion.span className="inline-flex items-center gap-2 bg-mk-green/90 rounded-full px-5 py-2 text-sm mb-10 text-white font-medium"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Shield size={14} /> Tax Shelter : récupérez 45% de votre investissement
          </motion.span>

          <motion.h1 className="text-4xl sm:text-5xl md:text-[64px] font-bold leading-[1.08] tracking-tight mb-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            Investissez dans le futur<br /><span className="text-mk-green">de la santé digitale</span>
          </motion.h1>

          <motion.p className="text-white/60 text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            MediKong est la marketplace B2B qui connecte les professionnels de santé aux meilleurs fournisseurs en Europe. Rejoignez notre levée de fonds et participez à la transformation du commerce médical.
          </motion.p>

          {/* Progress card */}
          <motion.div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm mb-10"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold">€ 70 000 levés</span>
              <span className="text-white/50">Objectif : € 1 000 000</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
              <div className="h-full bg-mk-green rounded-full" style={{ width: "7%" }} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><span className="text-3xl md:text-4xl font-bold">7%</span><p className="text-xs text-white/50 mt-1">financé</p></div>
              <div><span className="text-3xl md:text-4xl font-bold">12</span><p className="text-xs text-white/50 mt-1">investisseurs</p></div>
              <div><span className="text-3xl md:text-4xl font-bold">90</span><p className="text-xs text-white/50 mt-1">jours restants</p></div>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div className="flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            <a href="mailto:invest@medikong.pro?subject=Souscription%20MediKong" className="inline-flex items-center justify-center gap-2 bg-mk-green hover:brightness-110 text-white px-8 py-4 rounded-xl font-semibold text-sm transition-all">
              Souscrire dès 1 000 € <ArrowRight size={16} />
            </a>
            <a href="https://www.medikong.pro/documents/MediKong_Fundraising_Pitch_Seed.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-8 py-4 rounded-xl font-semibold text-sm hover:bg-white/15 transition-all">
              <Download size={16} /> Mémo d'investissement
            </a>
          </motion.div>
        </div>
      </section>

      {/* ════════════ STICKY NAV ════════════ */}
      <nav className="sticky top-0 z-30 bg-white border-b border-mk-line shadow-sm">
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0">
            {navAnchors.map((a) => (
              <a key={a.id} href={`#${a.id}`} className={`whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors border-b-2 ${activeSection === a.id ? "text-mk-navy border-mk-blue" : "text-mk-sec border-transparent hover:text-mk-navy"}`}>{a.label}</a>
            ))}
          </div>
          <a href="mailto:invest@medikong.pro?subject=Souscription%20MediKong" className="hidden md:inline-flex items-center gap-2 bg-mk-blue text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shrink-0 ml-4">Souscrire maintenant</a>
        </div>
      </nav>

      {/* ════════════ CHIFFRES CLÉS LEVÉE ════════════ */}
      <section id="opportunite" className="relative py-16 md:py-24 bg-white scroll-mt-14">
        <div className="absolute inset-0 invest-light-dots" />
        <div className="max-w-5xl mx-auto px-5 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Chiffres clés de la levée</h2>
            <p className="text-mk-sec max-w-xl mx-auto text-sm md:text-base">Toutes les informations essentielles pour prendre votre décision d'investissement.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {leveeCards.map((c) => (
              <div key={c.label} className="border border-mk-line rounded-xl p-5 text-center hover:shadow-md transition-shadow bg-white">
                <p className="text-xs text-mk-sec mb-2 uppercase tracking-wide">{c.label}</p>
                <p className="text-xl md:text-2xl font-bold text-mk-navy">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ PLATEFORME ════════════ */}
      <section className="relative py-16 md:py-24 bg-mk-alt overflow-hidden">
        <div className="absolute inset-0 invest-light-grid" />
        <div className="max-w-5xl mx-auto px-5 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">La plateforme que les professionnels de santé attendaient</h2>
            <p className="text-mk-sec max-w-2xl mx-auto text-sm md:text-base">L'outil d'achat B2B qui modernise les échanges entre professionnels de santé et fournisseurs.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {platformFeatures.map((f) => (
              <div key={f.title} className="bg-white border border-mk-line rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-mk-blue/10 flex items-center justify-center mb-4"><f.icon size={20} className="text-mk-blue" /></div>
                <h3 className="font-semibold text-mk-navy mb-2">{f.title}</h3>
                <p className="text-sm text-mk-sec leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ MARCHÉ ════════════ */}
      <section id="chiffres" className="relative py-16 md:py-24 bg-white scroll-mt-14 overflow-hidden">
        <div className="absolute inset-0 invest-light-dots" />
        <div className="max-w-5xl mx-auto px-5 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Un marché colossal, une digitalisation naissante</h2>
            <p className="text-mk-sec max-w-2xl mx-auto text-sm md:text-base">Le secteur de la distribution de produits de santé reste dominé par un oligopole peu innovant. MediKong apporte la couche digitale qui manque à ce marché de €52 milliards.</p>
          </div>
          {/* TAM / SAM / SOM cards with colored backgrounds like reference */}
          <div className="grid md:grid-cols-3 gap-5 mb-14">
            {[
              { label: "TAM EUROPE", value: "52 Mrd €", desc: "Marché total de la distribution de produits de santé en Europe.", icon: Globe, bg: "bg-slate-100", iconBg: "bg-slate-200", iconColor: "text-slate-600" },
              { label: "SAM BELGIQUE", value: "2,4 Mrd €", desc: "Marché adressable : pharmacies, hôpitaux et MR/MRS.", icon: Shield, bg: "bg-emerald-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
              { label: "SOM – OBJECTIF Y5", value: "150 M €", desc: "Volume de transactions visé — 6,25% de part de marché belge.", icon: TrendingUp, bg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
            ].map((t) => (
              <div key={t.label} className={`${t.bg} rounded-2xl p-8 text-center`}>
                <div className={`w-12 h-12 ${t.iconBg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                  <t.icon size={22} className={t.iconColor} />
                </div>
                <p className="text-xs font-semibold text-mk-sec uppercase tracking-wider mb-3">{t.label}</p>
                <p className="text-3xl md:text-4xl font-bold text-mk-navy mb-3">{t.value}</p>
                <p className="text-sm text-mk-sec leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* ── POTENTIEL DE CRÉATION DE VALEUR — dark card ── */}
          <div className="relative rounded-2xl p-8 md:p-12 mb-8 overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #122a4a 40%, #1a365d 100%)" }}>
            <div className="invest-orb-1" style={{ width: 300, height: 300, top: "-20%", left: "-10%" }} />
            <div className="invest-orb-2" style={{ width: 250, height: 250, bottom: "-15%", right: "-5%" }} />
            <div className="absolute inset-0 invest-dots" />
            <div className="text-center mb-10">
              <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-2">✨ Potentiel de création de valeur ✨</p>
              <p className="text-white/50 text-sm max-w-xl mx-auto">Projection à 5 ans basée sur les multiples de valorisation des marketplaces B2B santé comparables.</p>
            </div>

            {/* EBITDA × Multiple = Valorisation */}
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-center mb-12">
              <div>
                <p className="text-4xl md:text-5xl font-bold text-white/80">16M€</p>
                <p className="text-xs font-semibold text-mk-blue uppercase tracking-wider mt-2">EBITDA Cible</p>
                <p className="text-[11px] text-white/40 mt-1">Rentabilité opérationnelle<br/>à maturité</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white/50 text-lg font-bold">×</span>
              </div>
              <div>
                <p className="text-4xl md:text-5xl font-bold text-mk-green">10x</p>
                <p className="text-xs font-semibold text-mk-green uppercase tracking-wider mt-2">Multiple</p>
                <p className="text-[11px] text-white/40 mt-1">Standard marketplaces<br/>B2B santé</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white/50 text-lg font-bold">=</span>
              </div>
              <div>
                <p className="text-4xl md:text-6xl font-bold text-amber-400">160M€</p>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mt-2">Valorisation visée</p>
                <p className="text-[11px] text-white/40 mt-1">Objectif à horizon 5 ans</p>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-white/10 pt-8">
              <p className="text-center text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Scénario investisseur illustratif</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
                <div className="bg-white/5 border border-white/10 rounded-xl px-8 py-5 text-center">
                  <p className="text-[11px] text-white/40 mb-1">Investissement aujourd'hui</p>
                  <p className="text-2xl md:text-3xl font-bold text-white">5 000 €</p>
                  <p className="text-xs text-mk-green mt-1 font-medium">Coût net : 2 750 € (Tax Shelter)</p>
                </div>
                <ArrowRight size={24} className="text-white/30 rotate-0 sm:rotate-0" />
                <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-8 py-5 text-center">
                  <p className="text-[11px] text-amber-400/60 mb-1">Potentiel à 5 ans*</p>
                  <p className="text-2xl md:text-3xl font-bold text-amber-400">x10 à x20</p>
                  <p className="text-xs text-white/40 mt-1">selon le scénario de sortie</p>
                </div>
              </div>
              <p className="text-center text-[10px] text-white/30 mt-6">* Illustration non contractuelle. Tout investissement comporte des risques, y compris la perte totale du capital.</p>
            </div>
          </div>

          {/* Pourquoi maintenant */}
          <div className="border border-mk-line rounded-xl p-6">
            <h3 className="font-semibold text-mk-navy mb-4">Pourquoi maintenant ?</h3>
            <ul className="space-y-2">
              {["Marges en compression pour les distributeurs traditionnels", "Faible innovation digitale dans le secteur", "Pression croissante pour plus de transparence sur les prix", "Risque de « Digital Layer Capture » : les plateformes tech captent l'interface client"].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-mk-sec"><CheckCircle2 size={16} className="text-mk-green shrink-0 mt-0.5" />{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ════════════ MODÈLE HYBRIDE ════════════ */}
      <section className="relative py-16 md:py-24 bg-mk-alt overflow-hidden">
        <div className="absolute inset-0 invest-light-grid" />
        <div className="max-w-5xl mx-auto px-5 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Un modèle hybride à forte scalabilité</h2>
            <p className="text-mk-sec max-w-2xl mx-auto text-sm md:text-base">Distribution + Marketplace + Data — à mesure que la part marketplace croît, les marges s'élèvent significativement.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {phases.map((p) => (
              <div key={p.period} className="bg-white border border-mk-line rounded-xl p-6">
                <span className={`inline-block text-[10px] font-semibold text-white px-2.5 py-1 rounded-full mb-3 ${p.tagColor}`}>{p.tag}</span>
                <p className="text-xs text-mk-ter font-medium mb-1">{p.period}</p>
                <h3 className="font-semibold text-mk-navy mb-2">{p.title}</h3>
                <p className="text-sm text-mk-sec leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ value: "15%", label: "Take-rate cible", sub: "Commission marketplace" }, { value: "30-40%", label: "Marge brute cible", sub: "À l'échelle (mix marketplace)" }, { value: "Année 3", label: "EBITDA breakeven", sub: "Rentabilité opérationnelle" }].map((k) => (
              <div key={k.label} className="bg-white border border-mk-line rounded-xl p-5 text-center">
                <p className="text-xl md:text-2xl font-bold text-mk-navy">{k.value}</p>
                <p className="text-xs font-medium text-mk-navy mt-1">{k.label}</p>
                <p className="text-[10px] text-mk-ter mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ TRACTION ════════════ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Traction validée par le marché</h2>
            <p className="text-mk-sec max-w-xl mx-auto text-sm">100% de croissance organique — le marché cherche activement cette solution de transparence tarifaire.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {tractionMetrics.map((m) => (
              <div key={m.label} className="border border-mk-line rounded-xl bg-white p-5 text-center hover:shadow-sm transition-shadow">
                <span className="text-2xl md:text-3xl font-bold text-mk-navy block">{m.value}</span>
                <span className="text-sm font-medium text-mk-navy mt-1 block">{m.label}</span>
                <span className="text-xs text-mk-sec mt-0.5 block">{m.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ TRUST LOGOS ════════════ */}
      <section className="py-12 bg-mk-alt border-y border-mk-line overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 text-center mb-8">
          <p className="text-xs font-semibold text-mk-sec uppercase tracking-widest mb-1">Ils nous font confiance</p>
          <h3 className="text-lg font-bold text-mk-navy">Des acteurs majeurs de la santé en Belgique</h3>
        </div>
        <div className="relative">
          <div className="flex animate-[marquee_30s_linear_infinite] gap-12 items-center">
            {[...trustLogos, ...trustLogos].map((logo, i) => (
              <a key={`${logo.name}-${i}`} href={logo.url} target="_blank" rel="noopener noreferrer" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" title={logo.name}>
                <img src={logo.img} alt={logo.name} className="h-10 md:h-12 w-auto object-contain" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ TAX SHELTER ════════════ */}
      <section id="taxshelter" className="py-16 md:py-24 bg-white scroll-mt-14">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-sm mb-2">🇧🇪</p>
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Récupérez 45% de votre investissement grâce au Tax Shelter</h2>
            <p className="text-mk-sec max-w-xl mx-auto text-sm">Le mécanisme fiscal belge le plus avantageux pour investir dans les startups</p>
            <p className="text-xs text-mk-ter mt-3 bg-mk-alt inline-block px-4 py-1.5 rounded-full">🇧🇪 Réservé exclusivement aux résidents fiscaux belges (personnes physiques)</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <TaxShelterSimulator />
            <div className="border border-mk-line rounded-2xl p-6 md:p-8">
              <h3 className="text-lg font-bold text-mk-navy mb-4">Conditions du Tax Shelter</h3>
              <ul className="space-y-3">
                {["Réduction d'impôt de 45% sur le montant investi", "Applicable dès 5 000 € d'investissement", "Maximum 15 000 € de réduction par personne par an", "Applicable jusqu'à 500 000 € investis", "Les actions doivent être conservées pendant 4 ans minimum", "Réservé aux personnes physiques (pas les sociétés)"].map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-sm text-mk-sec"><CheckCircle2 size={16} className="text-mk-green shrink-0 mt-0.5" />{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ SPV ════════════ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Vos actions, regroupées et protégées</h2>
            <p className="text-mk-sec max-w-xl mx-auto text-sm">Tous les investisseurs sont regroupés au sein d'une fondation privée (SPV) pour une gouvernance simplifiée.</p>
          </div>

          {/* Flow: Investisseurs → Fondation → MediKong */}
          <div className="flex items-center justify-center gap-3 md:gap-5 mb-10">
            {[
              { label: "Investisseurs", icon: <Users size={18} /> },
              { label: "Fondation", icon: <Shield size={18} /> },
              { label: "MediKong", icon: <Building2 size={18} /> },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-3 md:gap-5">
                <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-mk-line bg-white text-sm font-medium text-mk-navy">
                  <span className="text-mk-sec">{item.icon}</span>
                  {item.label}
                </div>
                {i < 2 && <ArrowRight size={16} className="text-mk-ter shrink-0" />}
              </div>
            ))}
          </div>

          {/* Bullet points */}
          <div className="space-y-4 max-w-xl mx-auto">
            {["Simplifie la gouvernance (une seule ligne au capital de MediKong)", "Protège les droits des petits actionnaires", "Facilite les futures opérations (revente, dividendes, exit)", "Donne accès à un reporting transparent et régulier"].map((b) => (
              <div key={b} className="flex items-start gap-3 text-sm text-mk-navy">
                <span className="w-2 h-2 rounded-full bg-mk-navy shrink-0 mt-1.5" />
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ FONDS ════════════ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Utilisation des fonds</h2>
            <p className="text-mk-sec max-w-xl mx-auto text-sm">Une allocation claire et orientée croissance pour accélérer le développement de MediKong.</p>
          </div>

          {/* Stacked horizontal bar */}
          <div className="flex h-4 rounded-full overflow-hidden mb-8">
            {fundsAllocation.map((f, i) => (
              <motion.div key={f.label} style={{ backgroundColor: fundColors[i], width: `${f.pct}%` }} initial={{ width: 0 }} whileInView={{ width: `${f.pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.1 }} />
            ))}
          </div>

          {/* List rows */}
          <div className="divide-y divide-mk-line">
            {fundsAllocation.map((f, i) => (
              <div key={f.label} className="flex items-center justify-between py-4 px-4">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fundColors[i] }} />
                  <span className="text-sm font-medium text-mk-navy">{f.label}</span>
                </div>
                <span className="text-sm font-bold text-mk-navy">{f.pct}%</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-mk-ter text-center mt-8">Priorité N°1 : investir massivement dans la technologie et le développement commercial pour accélérer la croissance de la plateforme.</p>
        </div>
      </section>

      {/* ════════════ COMMENT INVESTIR ════════════ */}
      <section id="comment" className="relative py-16 md:py-24 bg-mk-alt scroll-mt-14 overflow-hidden">
        <div className="absolute inset-0 invest-light-dots" />
        <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
          <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">Investissez en 3 étapes simples</h2>
          <p className="text-mk-sec text-sm mb-10">Un processus simple et sécurisé.</p>
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {investSteps.map((s) => (
              <div key={s.n} className="bg-white border border-mk-line rounded-xl p-6 text-center">
                <span className="text-[10px] font-bold text-mk-blue uppercase tracking-widest">ÉTAPE {s.n}</span>
                <h3 className="font-semibold text-mk-navy mt-3 mb-2">{s.title}</h3>
                <p className="text-sm text-mk-sec">{s.desc}</p>
              </div>
            ))}
          </div>
          <a href="mailto:invest@medikong.pro?subject=Souscription%20MediKong" className="inline-flex items-center gap-2 bg-mk-green hover:brightness-110 text-white px-8 py-4 rounded-xl font-semibold text-sm transition-all">
            Commencer ma souscription <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* ════════════ FAQ ════════════ */}
      <section id="faq" className="py-16 md:py-24 bg-white scroll-mt-14">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="text-2xl md:text-4xl font-bold text-mk-navy text-center mb-10">Questions fréquentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-mk-line rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left hover:bg-mk-alt/50 transition-colors">
                  <span className="font-medium text-mk-navy text-sm pr-4">{faq.q}</span>
                  <ChevronDown size={18} className={`text-mk-sec transition-transform shrink-0 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-4 pb-4">
                    <p className="text-sm text-mk-sec leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ FINAL CTA ════════════ */}
      <section className="py-16 md:py-24 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a365d 100%)" }}>
        <div className="absolute inset-0 invest-dots" />
        <div className="absolute inset-0 invest-grid" />
        <div className="absolute inset-0 invest-glow-tl" />
        <div className="max-w-3xl mx-auto px-5 text-center text-white relative z-10">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">Prêt à investir dans l'avenir de la santé ?</h2>
          <p className="text-white/60 max-w-lg mx-auto mb-10 text-sm md:text-base">Rejoignez les premiers investisseurs de MediKong et bénéficiez du Tax Shelter.</p>
          <a href="mailto:invest@medikong.pro?subject=Souscription%20MediKong" className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-8 py-4 rounded-xl font-semibold text-sm hover:bg-white/15 transition-all">
            Souscrire maintenant — dès 1 000 € <ArrowRight size={16} />
          </a>
          <p className="text-white/40 text-xs mt-6">Vous avez des questions ? Contactez-nous à <a href="mailto:invest@medikong.pro" className="underline hover:text-white">invest@medikong.pro</a></p>
        </div>
      </section>
    </Layout>
  );
}
