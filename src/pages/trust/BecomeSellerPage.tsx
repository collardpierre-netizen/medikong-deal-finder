import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { SplitSection } from "@/components/entreprise/SplitSection";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { CommissionTiersCards } from "@/components/trust/CommissionTiers";
import { ProcessStepsVertical } from "@/components/trust/ProcessStepsVertical";
import { commissionTiers } from "@/data/trust-process-data";

const sellerSteps = [
  { number: 1, title: "Créez votre compte vendeur", description: "Inscription gratuite en 5 minutes. Renseignez vos informations d'entreprise, numéro BCE et licence de distribution.", tags: ["BCE", "TVA", "Licence"] },
  { number: 2, title: "Vérification KYC/KYB", description: "Notre équipe vérifie vos documents sous 48h : identité, assurance RC, conformité réglementaire.", tags: ["KYC", "Assurance", "Conformité"] },
  { number: 3, title: "Importez votre catalogue", description: "Importez vos produits via CSV, API ou saisie manuelle. Notre PIM centralise toutes les données produit.", tags: ["CSV", "API", "PIM"] },
  { number: 4, title: "Commencez à vendre", description: "Vos produits sont en ligne ! Gérez vos commandes, stocks et prix depuis votre dashboard vendeur.", tags: ["Dashboard", "Analytics", "Support"] },
];

export default function BecomeSellerPage() {
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="pink"
        badge="Vendeurs"
        title="Vendez sur MediKong et touchez 500+ pharmacies"
        subtitle="Rejoignez la marketplace B2B médicale de référence en Belgique. Commission dégressive, support dédié et outils puissants."
        cta={[{ label: "Devenir vendeur →", onClick: () => window.location.href = "/onboarding", variant: "white" }]}
      />
      <Section label="EN 4 ÉTAPES" title="Comment devenir vendeur" subtitle="Un processus d'onboarding simple et rapide.">
        <ProcessStepsVertical steps={sellerSteps} />
      </Section>
      <Section bg="gray" title="Nos chiffres">
        <StatsRow stats={[
          { value: 350, suffix: "+", label: "Vendeurs actifs" },
          { value: 500, suffix: "+", label: "Pharmacies acheteuses" },
          { value: 12500, suffix: "+", label: "Produits en ligne" },
          { value: 3, suffix: "x", label: "Croissance moyenne vendeur" },
          { value: 7, suffix: "j", label: "Délai paiement (Gold)" },
        ]} />
      </Section>
      <Section title="Commissions dégressives" subtitle="Plus vous vendez, moins vous payez.">
        <CommissionTiersCards tiers={commissionTiers} />
      </Section>
      <Section bg="gray">
        <SplitSection
          tag={{ label: "Outils vendeur", color: "#E70866", bg: "#FFF1F3" }}
          title="Un dashboard vendeur complet"
          paragraphs={["Gérez votre activité depuis un seul endroit : catalogue, commandes, analytics, finances et logistique."]}
          checklist={["Gestion du catalogue et des prix", "Suivi des commandes en temps réel", "Analytics et rapports de vente", "Gestion financière et paiements", "Alertes et opportunités marché"]}
          imagePlaceholder="Dashboard vendeur"
          imageGradient="from-[#E70866] to-[#9333EA]"
          reverse
        />
      </Section>
      <CtaBanner
        variant="dark"
        title="Prêt à développer votre business ?"
        subtitle="Inscription gratuite, commission dégressive, paiement sous 15 jours."
        buttons={[{ label: "Devenir vendeur →", variant: "pink", to: "/onboarding" }]}
      />
    </TrustProcessLayout>
  );
}
