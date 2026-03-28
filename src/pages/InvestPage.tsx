import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Download, Shield, TrendingUp, Users, Globe, Package, Building2, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/PageTransition";

const keyFigures = [
  { value: "12 000 €", label: "Revenus en 2 semaines", sub: "Post-lancement, 0 € de marketing" },
  { value: "62", label: "MR/MRS en discussion", sub: "Onboarding en cours pour pilote" },
  { value: "1M€+", label: "Pipeline commercial", sub: "Dont Febelco (grossiste pharma)" },
  { value: "40 000+", label: "Références produits", sub: "Catalogue en croissance continue" },
  { value: "50+", label: "Vendeurs vérifiés", sub: "Réseau de fournisseurs européens" },
  { value: "BE, FR, LU", label: "Pays couverts", sub: "Ambition européenne" },
];

const taxShelterSteps = [
  { step: "1", title: "Souscrivez", desc: "Investissez à partir de 1 000 € dans MediKong." },
  { step: "2", title: "Recevez votre attestation", desc: "Vous recevez une attestation fiscale Tax Shelter." },
  { step: "3", title: "Déduisez 45%", desc: "Récupérez 45% de votre investissement via votre déclaration fiscale." },
];

const faqs = [
  { q: "Qu'est-ce que le Tax Shelter pour startups ?", a: "Le Tax Shelter est un incitant fiscal belge permettant aux investisseurs particuliers de récupérer 45% de leur investissement dans une startup via une réduction d'impôt sur les personnes physiques." },
  { q: "Quel est le montant minimum d'investissement ?", a: "Vous pouvez investir à partir de 1 000 €. Il n'y a pas de montant maximum, mais l'avantage fiscal est plafonné à 100 000 € par an par contribuable." },
  { q: "Comment MediKong va utiliser les fonds levés ?", a: "Les fonds seront utilisés pour accélérer le développement produit, recruter des profils commerciaux et tech, et financer l'expansion en France et au Luxembourg." },
  { q: "Quel est le marché adressable ?", a: "Le marché des fournitures médicales B2B en Belgique représente plus de 2 milliards d'euros par an. MediKong cible en priorité les pharmacies, maisons de repos et cabinets médicaux." },
  { q: "Quel est le modèle économique ?", a: "MediKong prélève une commission sur chaque transaction réalisée sur la marketplace (entre 6% et 15% selon la catégorie), ainsi que des revenus d'affiliation sur les offres externes." },
];

const navAnchors = [
  { id: "opportunite", label: "L'Opportunité" },
  { id: "chiffres", label: "Chiffres Clés" },
  { id: "taxshelter", label: "Tax Shelter" },
  { id: "comment", label: "Comment Investir" },
  { id: "faq", label: "FAQ" },
];

export default function InvestPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    navAnchors.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Layout>
      {/* Hero — full navy gradient like original */}
      <section className="bg-mk-navy text-white py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(217,40%,16%)] to-[hsl(213,55%,22%)]" />
        <div className="mk-container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 text-sm mb-8 backdrop-blur-sm">
              <Shield size={14} className="text-[hsl(162,72%,55%)]" />
              Tax Shelter : récupérez 45% de votre investissement
            </span>
            <h1 className="text-4xl md:text-[56px] font-bold mb-5 leading-[1.1] tracking-tight">
              Investissez dans le futur
              <br />
              <span className="text-[hsl(162,72%,55%)]">
                de la santé digitale
              </span>
            </h1>
            <p className="text-white/60 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              MediKong est la marketplace B2B qui connecte les professionnels de santé aux meilleurs fournisseurs en Europe. Rejoignez notre levée de fonds et participez à la transformation du commerce médical.
            </p>
          </motion.div>

          {/* Progress card */}
          <motion.div
            className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold">€ 70 000 levés</span>
              <span className="text-white/50">Objectif : € 1 000 000</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full mb-5 overflow-hidden">
              <div className="h-full bg-[hsl(162,72%,55%)] rounded-full" style={{ width: "7%" }} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-2xl md:text-3xl font-bold">7%</span>
                <p className="text-xs text-white/50 mt-0.5">financé</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">12</span>
                <p className="text-xs text-white/50 mt-0.5">investisseurs</p>
              </div>
              <div>
                <span className="text-2xl md:text-3xl font-bold">90</span>
                <p className="text-xs text-white/50 mt-0.5">jours restants</p>
              </div>
            </div>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <a
              href="mailto:invest@medikong.pro?subject=Souscription%20MediKong"
              className="inline-flex items-center justify-center gap-2 bg-[hsl(162,72%,45%)] hover:bg-[hsl(162,72%,40%)] text-white px-7 py-3.5 rounded-lg font-semibold text-sm transition-colors"
            >
              Souscrire dès 1 000 € <ArrowRight size={16} />
            </a>
            <a
              href="#memo"
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-7 py-3.5 rounded-lg font-semibold text-sm hover:bg-white/15 transition-colors"
            >
              <Download size={16} /> Mémo d'investissement
            </a>
          </motion.div>
        </div>
      </section>

      {/* Sticky nav with anchors */}
      <nav className="sticky top-0 z-30 bg-white border-b border-mk-line shadow-sm">
        <div className="mk-container flex items-center justify-between overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1">
            {navAnchors.map((anchor) => (
              <a
                key={anchor.id}
                href={`#${anchor.id}`}
                className={`whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  activeSection === anchor.id
                    ? "text-mk-navy border-mk-navy"
                    : "text-mk-sec border-transparent hover:text-mk-navy"
                }`}
              >
                {anchor.label}
              </a>
            ))}
          </div>
          <a
            href="mailto:invest@medikong.pro?subject=Souscription%20MediKong"
            className="hidden md:inline-flex items-center gap-2 bg-mk-navy text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shrink-0 ml-4"
          >
            Souscrire maintenant
          </a>
        </div>
      </nav>

      {/* Opportunity section */}
      <AnimatedSection>
        <section id="opportunite" className="py-16 md:py-24 bg-white scroll-mt-14">
          <div className="mk-container">
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-mk-blue mb-2 block">L'Opportunité</span>
              <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">
                Le commerce médical B2B est prêt à être digitalisé
              </h2>
              <p className="text-mk-sec max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                Un marché de +2 milliards € en Belgique, encore dominé par les fax, les appels et les catalogues papier. MediKong apporte la transparence tarifaire et l'efficacité du e-commerce.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Building2, title: "Marché fragmenté", desc: "Milliers de pharmacies, MRS et hôpitaux commandent auprès de dizaines de fournisseurs différents." },
                { icon: TrendingUp, title: "Aucune transparence prix", desc: "Chaque établissement négocie seul — sans visibilité sur les prix du marché ni les alternatives." },
                { icon: Globe, title: "Ambition européenne", desc: "Le modèle se réplique en France, Luxembourg puis dans toute l'Europe avec les mêmes dynamiques." },
              ].map((item) => (
                <div key={item.title} className="border border-mk-line rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-mk-alt flex items-center justify-center mb-4">
                    <item.icon size={20} className="text-mk-blue" />
                  </div>
                  <h3 className="font-semibold text-mk-navy mb-2 text-lg">{item.title}</h3>
                  <p className="text-sm text-mk-sec leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Key figures */}
      <AnimatedSection>
        <section id="chiffres" className="py-16 md:py-24 bg-mk-alt scroll-mt-14">
          <div className="mk-container">
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-mk-blue mb-2 block">Chiffres Clés</span>
              <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">
                Traction validée par le marché
              </h2>
              <p className="text-mk-sec max-w-xl mx-auto text-sm">
                100% de croissance organique — le marché cherche activement cette solution de transparence tarifaire.
              </p>
            </div>
            <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {keyFigures.map((kf) => (
                <StaggerItem key={kf.label}>
                  <div className="border border-mk-line rounded-xl bg-white p-5 text-center hover:shadow-sm transition-shadow">
                    <span className="text-2xl md:text-3xl font-bold text-mk-navy block">{kf.value}</span>
                    <span className="text-sm font-medium text-mk-navy mt-1 block">{kf.label}</span>
                    <span className="text-xs text-mk-sec mt-0.5 block">{kf.sub}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>
      </AnimatedSection>

      {/* Tax Shelter */}
      <AnimatedSection>
        <section id="taxshelter" className="py-16 md:py-24 bg-white scroll-mt-14">
          <div className="mk-container">
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-[hsl(162,72%,45%)] mb-2 block">Tax Shelter</span>
              <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">
                Récupérez 45% de votre investissement
              </h2>
              <p className="text-mk-sec max-w-xl mx-auto text-sm">
                Grâce au Tax Shelter pour startups, les investisseurs particuliers bénéficient d'une réduction d'impôt de 45% sur le montant investi.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {taxShelterSteps.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[hsl(162,72%,55%)]/10 text-[hsl(162,72%,45%)] font-bold text-lg flex items-center justify-center mx-auto mb-3">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-mk-navy mb-1">{s.title}</h3>
                  <p className="text-sm text-mk-sec">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Example calc */}
            <div className="max-w-md mx-auto mt-10 border border-[hsl(162,72%,55%)]/20 bg-[hsl(162,72%,55%)]/5 rounded-xl p-6">
              <h4 className="font-semibold text-mk-navy mb-3 text-center">Exemple : investissement de 10 000 €</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-mk-sec">Montant investi</span><span className="font-semibold text-mk-navy">10 000 €</span></div>
                <div className="flex justify-between"><span className="text-mk-sec">Réduction d'impôt (45%)</span><span className="font-semibold text-[hsl(162,72%,45%)]">– 4 500 €</span></div>
                <div className="border-t border-[hsl(162,72%,55%)]/20 pt-2 flex justify-between"><span className="font-medium text-mk-navy">Coût réel net</span><span className="font-bold text-mk-navy">5 500 €</span></div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* How to invest */}
      <AnimatedSection>
        <section id="comment" className="py-16 md:py-24 bg-mk-alt scroll-mt-14">
          <div className="mk-container text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-mk-blue mb-2 block">Comment Investir</span>
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy mb-3">
              Investir en 3 étapes simples
            </h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-10">
              {[
                { n: "1", title: "Contactez-nous", desc: "Envoyez un email à invest@medikong.pro ou cliquez sur « Souscrire »." },
                { n: "2", title: "Signez la convention", desc: "Vous recevez les documents juridiques à signer électroniquement." },
                { n: "3", title: "Recevez vos parts", desc: "Votre investissement est confirmé et vous recevez votre attestation Tax Shelter." },
              ].map((s) => (
                <div key={s.n} className="bg-white border border-mk-line rounded-xl p-6">
                  <div className="w-10 h-10 rounded-full bg-mk-blue/10 text-mk-blue font-bold flex items-center justify-center mx-auto mb-3">{s.n}</div>
                  <h3 className="font-semibold text-mk-navy mb-1">{s.title}</h3>
                  <p className="text-sm text-mk-sec">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* FAQ */}
      <AnimatedSection>
        <section id="faq" className="py-16 md:py-24 bg-white scroll-mt-14">
          <div className="mk-container max-w-2xl">
            <h2 className="text-2xl md:text-4xl font-bold text-mk-navy text-center mb-10">
              Questions fréquentes
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-mk-line rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-mk-alt transition-colors"
                  >
                    <span className="font-medium text-mk-navy text-sm">{faq.q}</span>
                    <ChevronDown size={18} className={`text-mk-sec transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="px-4 pb-4"
                    >
                      <p className="text-sm text-mk-sec leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Final CTA */}
      <section className="bg-mk-navy text-white py-16 md:py-24">
        <div className="mk-container text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">
            Prêt à investir dans l'avenir de la santé ?
          </h2>
          <p className="text-white/60 max-w-lg mx-auto mb-10 text-sm md:text-base">
            Rejoignez les premiers investisseurs de MediKong et bénéficiez du Tax Shelter.
          </p>
          <a
            href="mailto:invest@medikong.pro?subject=Souscription%20MediKong"
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-7 py-3.5 rounded-lg font-semibold text-sm hover:bg-white/15 transition-colors"
          >
            Souscrire maintenant — dès 1 000 € <ArrowRight size={16} />
          </a>
          <p className="text-white/40 text-xs mt-5">
            Vous avez des questions ? Contactez-nous à{" "}
            <a href="mailto:invest@medikong.pro" className="underline hover:text-white">invest@medikong.pro</a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
