import { usePageImages } from "@/hooks/usePageImages";
import bnplMonduImg from "@/assets/pages/bnpl-mondu.jpg";
import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { SplitSection } from "@/components/entreprise/SplitSection";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { FaqAccordion } from "@/components/entreprise/FaqAccordion";
import type { FaqItem } from "@/data/entreprise-data";

const bnplFaq: FaqItem[] = [
  { question: "Comment activer le paiement différé ?", answer: "Lors du checkout, sélectionnez 'Paiement différé' comme mode de paiement. Une vérification instantanée est effectuée par notre partenaire Mondu." },
  { question: "Quels sont les critères d'éligibilité ?", answer: "Vous devez être une entreprise enregistrée en Belgique avec un numéro BCE valide et au moins 6 mois d'activité." },
  { question: "Y a-t-il des frais supplémentaires ?", answer: "Aucun frais pour le paiement à 30 jours. Le paiement à 60 jours entraîne des frais de 1,5% du montant de la commande." },
];

export default function BuyNowPayLaterPage() {
  const { getImage } = usePageImages("buy-now-pay-later");
  const monduImg = getImage("split-mondu");
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="dark"
        badge="Financement"
        title="Paiement différé : achetez maintenant, payez plus tard"
        subtitle="Grâce à notre partenaire Mondu, payez vos commandes à 30 ou 60 jours sans frais cachés. Idéal pour gérer votre trésorerie."
      />
      <Section title="Comment ça marche ?" subtitle="Le paiement différé en 3 étapes simples.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { num: "1", title: "Commandez normalement", desc: "Remplissez votre panier et sélectionnez 'Paiement différé' au checkout." },
            { num: "2", title: "Vérification instantanée", desc: "Mondu vérifie votre éligibilité en quelques secondes. Aucun document à fournir." },
            { num: "3", title: "Payez à 30 ou 60 jours", desc: "Recevez une facture par email. Réglez par virement SEPA à l'échéance." },
          ].map(s => (
            <div key={s.num} className="bg-white border border-mk-line rounded-2xl p-7 text-center">
              <div className="w-12 h-12 rounded-full bg-mk-navy text-white flex items-center justify-center mx-auto mb-4 text-lg font-bold">{s.num}</div>
              <h3 className="text-base font-bold text-mk-navy mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section bg="gray">
        <SplitSection
          tag={{ label: "Mondu", color: "#1B5BDA", bg: "#EFF6FF" }}
          title="Propulsé par Mondu, le leader du BNPL B2B"
          paragraphs={["Mondu est la solution de paiement différé de référence en Europe pour les entreprises B2B. Plus de 5 000 entreprises utilisent Mondu pour gérer leur trésorerie."]}
          checklist={["Vérification instantanée", "Aucun document requis", "Protection anti-fraude", "Intégration transparente"]}
          imagePlaceholder="Partenariat Mondu"
          imageGradient="from-[#0F172A] to-[#334155]"
          imageUrl={monduImg?.image_url}
          imageAlt={monduImg?.alt_text}
        />
      </Section>
      <Section title="Questions fréquentes">
        <FaqAccordion items={bnplFaq} />
      </Section>
      <CtaBanner
        variant="blue"
        title="Gérez votre trésorerie intelligemment"
        subtitle="Payez vos commandes à 30 ou 60 jours, sans frais cachés."
        buttons={[{ label: "Tester le paiement différé →", variant: "white", to: "/onboarding" }]}
      />
    </TrustProcessLayout>
  );
}
