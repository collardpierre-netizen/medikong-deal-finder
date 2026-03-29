import { usePageImages } from "@/hooks/usePageImages";
import logisticsTrackingImg from "@/assets/pages/logistics-tracking.jpg";
import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { SplitSection } from "@/components/entreprise/SplitSection";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { FaqAccordion } from "@/components/entreprise/FaqAccordion";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { logisticsFaqItems } from "@/data/trust-process-data";
import { Truck, Clock, MapPin } from "lucide-react";

const deliveryOptions = [
  { icon: Truck, title: "Standard", delay: "2-5 jours", desc: "Livraison économique pour les commandes non urgentes." },
  { icon: Clock, title: "Express", delay: "24-48h", desc: "Livraison rapide pour les commandes urgentes." },
  { icon: MapPin, title: "Point relais", delay: "3-5 jours", desc: "Retrait dans l'un de nos 1 200 points relais en Belgique." },
];

export default function LogisticsPage() {
  const { getImage } = usePageImages("logistics");
  const trackImg = getImage("split-tracking");
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="dark"
        badge="Logistique"
        title="Livraison rapide et fiable dans toute la Belgique"
        subtitle="Nos entrepôts partenaires garantissent une expédition sous 24-48h avec un suivi en temps réel."
      />
      <Section title="Options de livraison" subtitle="Choisissez le mode de livraison adapté à vos besoins.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {deliveryOptions.map(d => (
            <div key={d.title} className="bg-white border border-mk-line rounded-2xl p-7 text-center hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-mk-blue/10 flex items-center justify-center mx-auto mb-5">
                <d.icon size={22} className="text-mk-blue" />
              </div>
              <h3 className="text-base font-bold text-mk-navy mb-1">{d.title}</h3>
              <p className="text-sm font-semibold text-mk-blue mb-2">{d.delay}</p>
              <p className="text-sm text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section bg="gray" title="Nos performances logistiques">
        <StatsRow stats={[
          { value: 24, suffix: "h", label: "Délai moyen d'expédition" },
          { value: 98, suffix: "%", label: "Livraisons à l'heure" },
          { value: 1200, suffix: "+", label: "Points relais" },
          { value: 0.5, suffix: "%", label: "Taux de colis endommagés" },
          { value: 4.8, suffix: "/5", label: "Note transporteurs" },
        ]} />
      </Section>
      <Section>
        <SplitSection
          title="Suivi en temps réel"
          paragraphs={["Suivez chaque étape de votre livraison directement depuis votre espace client. Notifications par email et SMS à chaque changement de statut."]}
          checklist={["Notification d'expédition", "Suivi en temps réel", "Alerte de livraison", "Preuve de livraison"]}
          imagePlaceholder="Suivi de livraison"
          imageGradient="from-[#1B5BDA] to-[#0F3280]"
          imageUrl={trackImg?.image_url}
          imageAlt={trackImg?.alt_text}
          reverse
        />
      </Section>
      <Section bg="gray" title="Questions fréquentes">
        <FaqAccordion items={logisticsFaqItems} />
      </Section>
      <CtaBanner
        variant="dark"
        title="Expédition sous 24h pour toute commande"
        subtitle="Livraison gratuite dès 500€ HT."
        buttons={[{ label: "Découvrir le catalogue →", variant: "white", to: "/" }]}
      />
    </TrustProcessLayout>
  );
}
