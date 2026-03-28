import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { PricingCards } from "@/components/trust/PricingCards";
import { ProcessStepsVertical } from "@/components/trust/ProcessStepsVertical";
import { orderSteps, pricingCards } from "@/data/trust-process-data";

export default function HowToOrderPage() {
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="light"
        badge="Guide"
        title="Comment commander sur MediKong"
        subtitle="De l'inscription à la livraison, tout est conçu pour être simple, rapide et transparent."
        cta={[{ label: "Créer un compte gratuit →", onClick: () => window.location.href = "/onboarding", variant: "white" }]}
      />
      <Section label="EN 4 ÉTAPES" title="Un processus d'achat simplifié" subtitle="Commander sur MediKong, c'est aussi simple que 1-2-3-4.">
        <ProcessStepsVertical steps={orderSteps} />
      </Section>
      <Section bg="gray" title="Choisissez votre plan" subtitle="Un plan pour chaque taille d'entreprise.">
        <PricingCards cards={pricingCards} />
      </Section>
      <CtaBanner
        variant="blue"
        title="Prêt à commander ?"
        subtitle="Créez votre compte gratuitement et accédez aux meilleurs prix B2B."
        buttons={[{ label: "Commencer maintenant →", variant: "white", to: "/onboarding" }]}
      />
    </TrustProcessLayout>
  );
}
