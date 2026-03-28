import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { SplitSection } from "@/components/entreprise/SplitSection";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { FaqAccordion } from "@/components/entreprise/FaqAccordion";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { Shield, Award, RotateCcw } from "lucide-react";
import { qualityFaqItems } from "@/data/trust-process-data";

const guarantees = [
  { icon: Shield, title: "Conformité CE garantie", desc: "Tous les dispositifs médicaux sont vérifiés via EUDAMED. Le marquage CE est contrôlé avant la mise en ligne." },
  { icon: Award, title: "Fournisseurs certifiés", desc: "Chaque vendeur passe un audit complet : BCE, TVA, licence de distribution, assurance RC professionnelle." },
  { icon: RotateCcw, title: "Garantie 14 jours", desc: "Produit non conforme ? Retour gratuit sous 14 jours. Remboursement intégral dès réception." },
];

export default function QualityGuaranteePage() {
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="green"
        badge="Qualité"
        title="Votre garantie qualité sur chaque commande"
        subtitle="Chaque produit sur MediKong est conforme, tracé et garanti. Notre engagement : 0 compromis sur la qualité."
      />
      <Section title="Notre triple garantie" subtitle="Des engagements concrets pour protéger vos achats.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {guarantees.map(g => (
            <div key={g.title} className="bg-white border border-mk-line rounded-2xl p-7 text-center hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-mk-green/10 flex items-center justify-center mx-auto mb-5">
                <g.icon size={22} className="text-mk-green" />
              </div>
              <h3 className="text-base font-bold text-mk-navy mb-2">{g.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{g.desc}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section bg="gray" title="En chiffres">
        <StatsRow stats={[
          { value: 100, suffix: "%", label: "Produits conformes CE" },
          { value: 0, suffix: "", label: "Faux produits acceptés" },
          { value: 14, suffix: "j", label: "Garantie retour" },
          { value: 24, suffix: "h", label: "Délai résolution" },
          { value: 99, suffix: "%", label: "Satisfaction client" },
        ]} />
      </Section>
      <Section bg="gray">
        <SplitSection
          title="Traçabilité complète"
          paragraphs={["Chaque produit est tracé de bout en bout : du fabricant à votre porte. Numéros de lot, dates d'expiration et certificats disponibles dans votre espace client."]}
          checklist={["Numéros de lot intégrés", "Dates d'expiration vérifiées", "Certificats téléchargeables", "Historique de commande complet"]}
          imagePlaceholder="Traçabilité produit"
          imageGradient="from-[#059669] to-[#065F46]"
          reverse
        />
      </Section>
      <Section title="Questions fréquentes">
        <FaqAccordion items={qualityFaqItems} />
      </Section>
      <CtaBanner
        variant="dark"
        title="Commandez en toute confiance"
        subtitle="Garantie qualité sur chaque produit, chaque commande."
        buttons={[{ label: "Découvrir le catalogue →", variant: "pink", to: "/" }]}
      />
    </TrustProcessLayout>
  );
}
