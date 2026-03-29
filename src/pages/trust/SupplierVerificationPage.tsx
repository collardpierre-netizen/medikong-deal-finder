import { usePageImages } from "@/hooks/usePageImages";
import supplierPartnersImg from "@/assets/pages/supplier-partners.jpg";
import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { SplitSection } from "@/components/entreprise/SplitSection";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { ProcessStepsVertical } from "@/components/trust/ProcessStepsVertical";
import { ComparisonTable } from "@/components/trust/ComparisonTable";
import { verificationSteps, comparisonRows } from "@/data/trust-process-data";

export default function SupplierVerificationPage() {
  const { getImage } = usePageImages("supplier-verification");
  const partImg = getImage("split-partners");
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="blue"
        badge="Confiance & Sécurité"
        title="Chaque fournisseur est vérifié avant de rejoindre MediKong"
        subtitle="Notre processus de vérification en 4 étapes garantit que vous achetez uniquement auprès de fournisseurs fiables, conformes et assurés."
      />
      <Section label="NOTRE PROCESSUS" title="Vérification en 4 étapes" subtitle="Un processus rigoureux pour garantir la qualité de chaque partenaire.">
        <ProcessStepsVertical steps={verificationSteps} />
      </Section>
      <Section bg="gray" title="MediKong vs. le sourcing traditionnel" subtitle="Comparez les garanties offertes par notre marketplace.">
        <ComparisonTable rows={comparisonRows} />
      </Section>
      <Section title="Nos chiffres parlent d'eux-mêmes">
        <StatsRow stats={[
          { value: 350, suffix: "+", label: "Fournisseurs vérifiés" },
          { value: 100, suffix: "%", label: "Conformité CE" },
          { value: 48, suffix: "h", label: "Délai de vérification" },
          { value: 12500, suffix: "+", label: "Produits certifiés" },
          { value: 99, suffix: "%", label: "Taux de satisfaction" },
        ]} />
      </Section>
      <Section bg="gray">
        <SplitSection
          tag={{ label: "Partenariats", color: "#1B5BDA", bg: "#EFF6FF" }}
          title="Des partenariats solides avec les leaders du marché"
          paragraphs={["Nous collaborons directement avec les plus grands fabricants et distributeurs européens pour vous garantir les meilleurs prix et une disponibilité optimale."]}
          checklist={["Accords directs avec les fabricants", "Prix négociés et exclusifs", "Stock garanti sur les références clés", "Support technique dédié"]}
          imagePlaceholder="Partenariats fournisseurs"
          imageGradient="from-[#1B5BDA] to-[#0F3280]"
          imageUrl={partImg?.image_url}
          imageAlt={partImg?.alt_text}
        />
      </Section>
      <CtaBanner
        variant="blue"
        title="Rejoignez les 500+ pharmacies qui nous font confiance"
        subtitle="Inscription gratuite, sans engagement."
        buttons={[{ label: "Créer un compte →", variant: "white", to: "/onboarding" }]}
      />
    </TrustProcessLayout>
  );
}
