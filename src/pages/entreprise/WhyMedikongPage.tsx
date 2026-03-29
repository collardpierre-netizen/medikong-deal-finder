import { usePageImages } from "@/hooks/usePageImages";
import { EntrepriseLayout } from "@/components/entreprise/EntrepriseLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { SplitSection } from "@/components/entreprise/SplitSection";
import { ComparisonTable } from "@/components/entreprise/ComparisonTable";
import { TestimonialCard } from "@/components/entreprise/TestimonialCard";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { testimonials } from "@/data/entreprise-data";

export default function WhyMedikongPage() {
  const { getImage } = usePageImages("why-medikong");
  const compImg = getImage("split-comparateur");
  const analImg = getImage("split-analytics");
  const secImg = getImage("split-security");
  return (
    <EntrepriseLayout>
      <EntrepriseHero
        variant="blue"
        badge="La différence MediKong"
        title="Pourquoi choisir MediKong ?"
        subtitle="Trois raisons qui transforment vos achats médicaux au quotidien."
      />

      <Section>
        <div className="space-y-16 md:space-y-20">
          <SplitSection
            tag={{ label: "Comparaison", color: "#1B5BDA", bg: "#EFF6FF" }}
            title="Comparez les prix en un clic"
            paragraphs={[
              "Accédez aux offres de centaines de fournisseurs vérifiés sur une seule plateforme. Comparez les prix, les conditions de livraison et les stocks en temps réel.",
              "Notre algorithme de Buy Box identifie automatiquement la meilleure offre selon vos critères : prix, délai, vendeur favori.",
            ]}
            imagePlaceholder="Screenshot : comparateur de prix"
            imageGradient="from-blue-100 to-indigo-200"
            imageUrl={compImg?.image_url}
            imageAlt={compImg?.alt_text}
          />
          <SplitSection
            reverse
            tag={{ label: "Intelligence", color: "#1B5BDA", bg: "#EFF6FF" }}
            title="Market Intelligence intégrée"
            paragraphs={[
              "Suivez l'évolution des prix du marché grâce à notre veille concurrentielle automatisée. Recevez des alertes quand les prix baissent.",
              "Notre Pricing Coach vous aide à positionner vos offres de manière optimale, avec des recommandations basées sur l'IA.",
            ]}
            imagePlaceholder="Screenshot : dashboard analytique"
            imageGradient="from-blue-100 to-indigo-200"
            imageUrl={analImg?.image_url}
            imageAlt={analImg?.alt_text}
          />
          <SplitSection
            tag={{ label: "Sécurité", color: "#1B5BDA", bg: "#EFF6FF" }}
            title="Sécurité et conformité"
            paragraphs={[
              "Tous nos fournisseurs sont vérifiés : numéro AFMPS, licence de distribution, marquage CE. Aucun compromis sur la qualité.",
              "Paiement sécurisé via Stripe, paiement différé via Mondu, et protection litiges 24h pour une tranquillité d'esprit totale.",
            ]}
            imagePlaceholder="Illustration : bouclier de sécurité"
            imageGradient="from-blue-100 to-indigo-200"
            imageUrl={secImg?.image_url}
            imageAlt={secImg?.alt_text}
          />
        </div>
      </Section>

      <Section bg="gray" label="Comparatif" title="MediKong vs l'achat traditionnel">
        <ComparisonTable />
      </Section>

      <Section label="Témoignages" title="Ils nous font confiance">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <TestimonialCard key={t.authorName} {...t} />
          ))}
        </div>
      </Section>

      <CtaBanner
        variant="blue"
        title="Prêt à économiser ?"
        buttons={[
          { label: "Créer un compte gratuit", variant: "white", to: "/inscription" },
          { label: "Demander une démo", variant: "outline", to: "/contact" },
        ]}
      />
    </EntrepriseLayout>
  );
}
