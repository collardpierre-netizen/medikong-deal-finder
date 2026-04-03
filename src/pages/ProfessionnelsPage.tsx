import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Building2, Heart, Home, Stethoscope, Smile, PawPrint, TrendingDown, Truck, CreditCard, Headphones, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/PageTransition";

const segments = [
  { icon: <Building2 size={28} />, title: "Pharmacies", desc: "Accédez aux prix de gros sur des milliers de références. MOQ bas adaptés aux officines.", link: "/pharmacies" },
  { icon: <Heart size={28} />, title: "Hôpitaux", desc: "Approvisionnement centralisé pour les établissements hospitaliers. Volumes importants, tarifs négociés.", link: "/hopitaux" },
  { icon: <Home size={28} />, title: "Maisons de repos", desc: "Fournitures d'hygiène, incontinence et soins pour les résidents. Livraison régulière programmée.", link: "/ehpad" },
  { icon: <Stethoscope size={28} />, title: "Cabinets médicaux", desc: "Consommables, instruments et diagnostic pour les praticiens indépendants.", link: "/cabinets-medicaux" },
  { icon: <Smile size={28} />, title: "Dentistes", desc: "Matériel dentaire, consommables et produits d'hygiène spécialisés.", link: "/dentistes" },
  { icon: <PawPrint size={28} />, title: "Vétérinaires", desc: "Fournitures médicales adaptées aux cliniques et cabinets vétérinaires.", link: "/veterinaires" },
];

const advantages = [
  { icon: <TrendingDown size={22} />, title: "Prix de gros", desc: "Accédez aux tarifs professionnels habituellement réservés aux grandes structures." },
  { icon: <Truck size={22} />, title: "Livraison rapide", desc: "Expédition sous 24-48h depuis nos entrepôts en Belgique et en Europe." },
  { icon: <CreditCard size={22} />, title: "Paiement différé", desc: "Réglez vos factures à 30 ou 60 jours. Sans frais supplémentaires." },
  { icon: <Headphones size={22} />, title: "Support dédié", desc: "Un interlocuteur unique pour tous vos besoins d'approvisionnement." },
];

export default function ProfessionnelsPage() {
  return (
    <Layout
      title="Solutions pour professionnels de santé | MediKong"
      description="Solutions MediKong pour pharmacies, hôpitaux, maisons de repos et cabinets médicaux en Belgique."
    >
      {/* Hero */}
      <section className="py-16 md:py-24 bg-mk-alt/30">
        <div className="mk-container text-center max-w-3xl mx-auto">
          <motion.h1
            className="text-3xl md:text-4xl font-bold text-mk-navy mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Solutions pour chaque professionnel de santé
          </motion.h1>
          <motion.p
            className="text-base text-gray-600 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Quel que soit votre secteur, MediKong vous donne accès aux meilleures offres de fournitures médicales en Belgique.
          </motion.p>
        </div>
      </section>

      {/* Segments */}
      <AnimatedSection className="py-16 md:py-20">
        <StaggerContainer className="mk-container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {segments.map(seg => (
            <StaggerItem key={seg.title}>
              <div className="border border-mk-line rounded-xl p-6 bg-white hover:shadow-md transition-shadow h-full">
                <div className="w-14 h-14 rounded-2xl bg-mk-alt flex items-center justify-center mb-4 text-mk-blue">
                  {seg.icon}
                </div>
                <h3 className="text-lg font-bold text-mk-navy mb-2">{seg.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{seg.desc}</p>
                <Link to="/recherche" className="text-sm text-mk-blue hover:underline flex items-center gap-1">
                  Découvrir les offres <ArrowRight size={14} />
                </Link>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </AnimatedSection>

      {/* Avantages */}
      <AnimatedSection className="py-16 md:py-20 bg-mk-alt/30">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-10 text-center">Les avantages MediKong</h2>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {advantages.map(a => (
              <StaggerItem key={a.title} className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-mk-line flex items-center justify-center shrink-0 text-mk-blue">
                  {a.icon}
                </div>
                <div>
                  <h3 className="font-bold text-mk-navy mb-1">{a.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{a.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="mk-container text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-mk-navy mb-4">Rejoignez les 500+ professionnels qui nous font confiance</h2>
          <p className="text-sm text-gray-600 mb-8">Créez votre compte en 2 minutes et accédez immédiatement au catalogue.</p>
          <Link to="/onboarding" className="inline-flex items-center gap-2 bg-mk-blue text-white font-semibold text-sm px-8 py-3.5 rounded-lg hover:opacity-90 transition-opacity">
            Créer un compte professionnel <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
