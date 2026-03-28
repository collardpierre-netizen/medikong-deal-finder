import { EntrepriseLayout } from "@/components/entreprise/EntrepriseLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { StepsRow } from "@/components/entreprise/StepsRow";
import { CommissionTiers } from "@/components/entreprise/CommissionTiers";
import { FaqAccordion } from "@/components/entreprise/FaqAccordion";
import { commissionTiers, faqItems } from "@/data/entreprise-data";

const buyerSteps = [
  { number: 1, title: "Créez votre compte", description: "Inscription gratuite en 2 minutes avec vérification professionnelle.", color: "pink" as const },
  { number: 2, title: "Parcourez et comparez", description: "40 000+ références, filtres avancés, comparaison de prix en temps réel.", color: "blue" as const },
  { number: 3, title: "Commandez en sécurité", description: "Paiement sécurisé, différé ou SEPA. Confirmation instantanée.", color: "purple" as const },
  { number: 4, title: "Recevez et validez", description: "Suivi de livraison, contrôle qualité et support litiges 24h.", color: "green" as const },
];

const sellerSteps = [
  { number: 1, title: "Inscrivez-vous", description: "Demande d'accès vendeur avec vérification AFMPS et licence.", color: "pink" as const },
  { number: 2, title: "Importez votre catalogue", description: "Import CSV/API, mapping automatique, enrichissement IA.", color: "blue" as const },
  { number: 3, title: "Gérez vos offres", description: "Prix, stocks, promotions — tout en temps réel depuis votre dashboard.", color: "purple" as const },
  { number: 4, title: "Encaissez", description: "Commission transparente, paiement garanti sous 30 jours.", color: "green" as const },
];

export default function HowItWorksPage() {
  return (
    <EntrepriseLayout>
      <EntrepriseHero
        variant="dark"
        badge="Guide"
        title="Comment fonctionne MediKong ?"
        subtitle="Un système simple, sécurisé et transparent pour acheteurs et vendeurs."
      />

      <Section label="Acheteurs" title="Achetez en 4 étapes">
        <StepsRow steps={buyerSteps} />
      </Section>

      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        <div className="h-[200px] md:h-[280px] rounded-[20px] bg-gradient-to-br from-[#0F172A] to-[#334155] flex items-center justify-center">
          <span className="text-white/50 text-sm">Photo : professionnel de santé passant commande sur tablette</span>
        </div>
      </div>

      <Section label="Vendeurs" title="Vendez en 4 étapes">
        <StepsRow steps={sellerSteps} />
      </Section>

      <Section bg="gray" label="Tarification" title="Le modèle MediKong">
        <CommissionTiers tiers={commissionTiers} />
        <p className="text-center text-sm text-muted-foreground mt-8">Pour les acheteurs : <strong className="text-[#1E293B]">100% gratuit.</strong></p>
      </Section>

      <Section label="FAQ" title="Questions fréquentes">
        <FaqAccordion items={faqItems} />
      </Section>
    </EntrepriseLayout>
  );
}
