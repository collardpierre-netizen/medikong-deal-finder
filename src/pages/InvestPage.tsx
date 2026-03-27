import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Download, Shield, TrendingUp, Users, Globe, Package, Building2, ChevronDown } from "lucide-react";
import { useState } from "react";
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

export default function InvestPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-mk-navy text-white py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-mk-navy via-[hsl(215,33%,13%)] to-[hsl(221,77%,20%)] opacity-80" />
        <div className="mk-container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6 backdrop-blur-sm">
              <Shield size={14} className="text-mk-green" />
              Tax Shelter : récupérez 45% de votre investissement
            </span>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Investissez dans le futur
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(160,88%,50%)] to-[hsl(160,88%,70%)]">
                de la santé digitale
              </span>
            </h1>
            <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              MediKong est la marketplace B2B qui connecte les professionnels de santé aux meilleurs fournisseurs en Europe. Rejoignez notre levée de fonds et participez à la transformation du commerce médical.
            </p>
          </motion.div>

          {/* Progress card */}
          <motion.div
            className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold">€ 70 000 levés</span>
              <span className="text-white/60">Objectif : € 1 000 000</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[hsl(160,88%,40%)] to-[hsl(160,88%,55%)] rounded-full" style={{ width: "7%" }} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-2xl font-bold">7%</span>
                <p className="text-xs text-white/60 mt-0.5">financé</p>
              </div>
              <div>
                <span className="text-2xl font-bold">12</span>
                <p className="text-xs text-white/60 mt-0.5">investisseurs</p>
              </div>
              <div>
                <span className="text-2xl font-bold">90</span>
                <p className="text-xs text-white/60 mt-0.5">jours restants</p>
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
              className="inline-flex items-center justify-center gap-2 bg-mk-green text-white px-6 py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Souscrire dès 1 000 € <ArrowRight size={16} />
            </a>
            <a
              href="#memo"
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-white/15 transition-colors"
            >
              <Download size={16} /> Mémo d'investissement
            </a>
          </motion.div>
        </div>
      </section>

      {/* Opportunity section */}
      <AnimatedSection>
        <section className="py-14 md:py-20 bg-white">
          <div className="mk-container">
            <div className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-widest text-mk-blue mb-2 block">L'Opportunité</span>
              <h2 className="text-2xl md:text-3xl font-bold text-mk-navy mb-3">
                Le commerce médical B2B est prêt à être digitalisé
              </h2>
              <p className="text-mk-sec max-w-2xl mx-auto text-sm md:text-base">
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
                  <h3 className="font-semibold text-mk-navy mb-2">{item.title}</h3>
                  <p className="text-sm text-mk-sec leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Key figures */}
      <AnimatedSection>
        <section className="py-14 md:py-20 bg-mk-alt">
          <div className="mk-container">
            <div className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-widest text-mk-blue mb-2 block">Chiffres Clés</span>
              <h2 className="text-2xl md:text-3xl font-bold text-mk-navy mb-3">
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
        <section className="py-14 md:py-20 bg-white">
          <div className="mk-container">
            <div className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-widest text-mk-green mb-2 block">Tax Shelter</span>
              <h2 className="text-2xl md:text-3xl font-bold text-mk-navy mb-3">
                Récupérez 45% de votre investissement
              </h2>
              <p className="text-mk-sec max-w-xl mx-auto text-sm">
                Grâce au Tax Shelter pour startups, les investisseurs particuliers bénéficient d'une réduction d'impôt de 45% sur le montant investi.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {taxShelterSteps.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-mk-green/10 text-mk-green font-bold text-lg flex items-center justify-center mx-auto mb-3">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-mk-navy mb-1">{s.title}</h3>
                  <p className="text-sm text-mk-sec">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Example calc */}
            <div className="max-w-md mx-auto mt-10 border border-mk-green/20 bg-mk-green/5 rounded-xl p-6">
              <h4 className="font-semibold text-mk-navy mb-3 text-center">Exemple : investissement de 10 000 €</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-mk-sec">Montant investi</span><span className="font-semibold text-mk-navy">10 000 €</span></div>
                <div className="flex justify-between"><span className="text-mk-sec">Réduction d'impôt (45%)</span><span className="font-semibold text-mk-green">– 4 500 €</span></div>
                <div className="border-t border-mk-green/20 pt-2 flex justify-between"><span className="font-medium text-mk-navy">Coût réel net</span><span className="font-bold text-mk-navy">5 500 €</span></div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* How to invest */}
      <AnimatedSection>
        <section className="py-14 md:py-20 bg-mk-alt">
          <div className="mk-container text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-mk-blue mb-2 block">Comment Investir</span>
            <h2 className="text-2xl md:text-3xl font-bold text-mk-navy mb-3">
              Investir en 3 étapes simples
            </h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-8">
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
        <section className="py-14 md:py-20 bg-white">
          <div className="mk-container max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-mk-navy text-center mb-8">
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
      <section className="bg-mk-navy text-white py-14 md:py-20">
        <div className="mk-container text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Prêt à investir dans l'avenir de la santé ?
          </h2>
          <p className="text-white/70 max-w-lg mx-auto mb-8 text-sm">
            Rejoignez les premiers investisseurs de MediKong et bénéficiez du Tax Shelter.
          </p>
          <a
            href="mailto:invest@medikong.pro?subject=Souscription%20MediKong"
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-white/15 transition-colors"
          >
            Souscrire maintenant — dès 1 000 € <ArrowRight size={16} />
          </a>
          <p className="text-white/50 text-xs mt-4">
            Vous avez des questions ? Contactez-nous à{" "}
            <a href="mailto:invest@medikong.pro" className="underline hover:text-white">invest@medikong.pro</a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
