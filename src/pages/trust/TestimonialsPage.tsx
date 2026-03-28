import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { TestimonialCard } from "@/components/trust/TestimonialCard";
import { testimonials } from "@/data/trust-process-data";

export default function TestimonialsPage() {
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="light"
        badge="Témoignages"
        title="Ils font confiance à MediKong"
        subtitle="Découvrez les retours d'expérience de nos clients et vendeurs."
      />
      <Section title="Ce que nos utilisateurs disent">
        <StatsRow stats={[
          { value: 500, suffix: "+", label: "Pharmacies partenaires" },
          { value: 350, suffix: "+", label: "Vendeurs actifs" },
          { value: 4.8, suffix: "/5", label: "Note moyenne" },
          { value: 18, suffix: "%", label: "Économies moyennes" },
          { value: 99, suffix: "%", label: "Taux de satisfaction" },
        ]} />
      </Section>
      <Section bg="gray" title="Témoignages clients & vendeurs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map(t => <TestimonialCard key={t.authorName} {...t} />)}
        </div>
      </Section>
      <CtaBanner
        variant="blue"
        title="Rejoignez-les et faites confiance à MediKong"
        subtitle="Inscription gratuite, sans engagement."
        buttons={[
          { label: "Je souhaite acheter →", variant: "white", to: "/onboarding" },
          { label: "Je souhaite vendre →", variant: "outline", to: "/onboarding" },
        ]}
      />
    </TrustProcessLayout>
  );
}
