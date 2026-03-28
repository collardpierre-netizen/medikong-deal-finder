import { EntrepriseLayout } from "@/components/entreprise/EntrepriseLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { VerticalTimeline } from "@/components/entreprise/VerticalTimeline";
import { EligibilityGrid } from "@/components/entreprise/EligibilityGrid";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { Disclaimer } from "@/components/entreprise/Disclaimer";
import { investTimeline } from "@/data/entreprise-data";
import { TrendingUp, CreditCard, Users } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const investStats = [
  { value: 160, suffix: "M€", label: "Valorisation phase 2" },
  { value: 45, suffix: "%", label: "Tax Shelter Belgique" },
  { value: 1000, suffix: "€", label: "Ticket minimum" },
  { value: 24, suffix: " mois", label: "Horizon de sortie" },
];

const whyInvest = [
  { icon: TrendingUp, color: "text-[#E70866]", bg: "bg-[#FFF1F5]", title: "Marché en croissance", desc: "Le marché des fournitures médicales B2B en Europe pèse 120 milliards d'euros, avec une digitalisation encore inférieure à 5%." },
  { icon: CreditCard, color: "text-[#1B5BDA]", bg: "bg-[#EFF6FF]", title: "Business model éprouvé", desc: "Commission sur transaction, récurrence naturelle des achats médicaux, et forte rétention client (>90% après 6 mois)." },
  { icon: Users, color: "text-[#059669]", bg: "bg-[#ECFDF5]", title: "Équipe expérimentée", desc: "Fondateurs avec 15+ ans d'expérience combinée dans la distribution médicale et le digital santé." },
];

const taxShelterSteps = [
  { title: "Investissez", desc: "Souscrivez à partir de 1 000€ dans le capital de MediKong via notre formulaire sécurisé." },
  { title: "Déduction fiscale", desc: "Bénéficiez d'une réduction d'impôt de 45% sur votre investissement dès l'année fiscale en cours." },
  { title: "Suivi et rendement", desc: "Suivez la performance de votre investissement via des rapports trimestriels et des assemblées annuelles." },
];

export default function InvestirPage() {
  return (
    <EntrepriseLayout>
      <EntrepriseHero
        variant="green"
        badge="Investissement"
        title="Investissez dans MediKong"
        subtitle="Participez à la transformation du secteur médical en Benelux et bénéficiez du Tax Shelter 45%."
        cta={[
          { label: "Demander le dossier investisseur", variant: "white", onClick: () => window.location.href = "/contact" },
          { label: "Souscrire maintenant", variant: "outline", onClick: () => window.location.href = "/invest" },
        ]}
      />

      <Section>
        <StatsRow stats={investStats} />
      </Section>

      <Section bg="gray" label="Opportunité" title="Pourquoi investir dans MediKong ?">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {whyInvest.map((w) => (
            <InvestCard key={w.title} {...w} />
          ))}
        </div>
      </Section>

      <Section label="Fiscalité" title="Comment ça marche : Tax Shelter">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {taxShelterSteps.map((s, i) => (
            <div key={i} className="p-6 rounded-2xl border border-border bg-white text-center">
              <div className="w-10 h-10 rounded-full bg-[#ECFDF5] text-[#059669] font-bold flex items-center justify-center mx-auto mb-4">{i + 1}</div>
              <h4 className="text-base font-bold text-[#1E293B] mb-2">{s.title}</h4>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="gray" title="Qui peut investir ?">
        <EligibilityGrid />
      </Section>

      <Section label="Roadmap" title="Timeline de levée de fonds">
        <VerticalTimeline nodes={investTimeline} />
      </Section>

      <CtaBanner
        variant="dark"
        title="Prêt à devenir actionnaire de MediKong ?"
        buttons={[
          { label: "Souscrire maintenant", variant: "white", to: "/invest" },
          { label: "Contacter l'équipe", variant: "outline", to: "/contact" },
        ]}
      />

      <Disclaimer />
    </EntrepriseLayout>
  );
}

function InvestCard({ icon: Icon, color, bg, title, desc }: { icon: any; color: string; bg: string; title: string; desc: string }) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`p-6 rounded-2xl border border-border bg-white hover:shadow-lg hover:translate-y-[-4px] transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <h4 className="text-base font-bold text-[#1E293B] mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
