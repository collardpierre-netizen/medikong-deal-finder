import { EntrepriseLayout } from "@/components/entreprise/EntrepriseLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { JobCard } from "@/components/entreprise/JobCard";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { jobListings } from "@/data/entreprise-data";
import { Star, Home, Heart, BookOpen } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const careerStats = [
  { value: 7, suffix: "", label: "Postes ouverts" },
  { value: 12, suffix: "", label: "Nationalités représentées" },
  { value: 100, suffix: "%", label: "Remote-friendly" },
];

const perks = [
  { icon: Star, color: "text-[#E70866]", bg: "bg-[#FFF1F5]", title: "Equity", desc: "Participation au capital dès le premier jour. Vous construisez, vous possédez." },
  { icon: Home, color: "text-[#1B5BDA]", bg: "bg-[#EFF6FF]", title: "Remote-first", desc: "Travaillez d'où vous voulez. Réunions async, horaires flexibles." },
  { icon: Heart, color: "text-[#059669]", bg: "bg-[#ECFDF5]", title: "Impact santé", desc: "Votre travail améliore directement l'accès aux soins de milliers de patients." },
  { icon: BookOpen, color: "text-[#7C3AED]", bg: "bg-[#F5F3FF]", title: "Formation continue", desc: "1 500€/an de budget formation, conférences et livres inclus." },
];

export default function CareersPage() {
  return (
    <EntrepriseLayout>
      <EntrepriseHero
        variant="pink"
        badge="On recrute"
        title="Rejoignez l'aventure MediKong"
        subtitle="Construisez la marketplace médicale de demain avec nous."
      />

      <Section>
        <StatsRow stats={careerStats} />
      </Section>

      <Section bg="gray" label="Avantages" title="Pourquoi nous rejoindre">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {perks.map((p) => (
            <PerkCard key={p.title} {...p} />
          ))}
        </div>
      </Section>

      <Section label="Postes ouverts" title="Trouvez votre prochain défi">
        <div className="max-w-[800px] mx-auto">
          {jobListings.map((j) => (
            <JobCard key={j.title} {...j} />
          ))}
        </div>
      </Section>

      <CtaBanner
        variant="dark"
        title="Vous ne voyez pas le poste idéal ?"
        subtitle="Envoyez-nous votre profil, nous aimons les candidatures spontanées."
        buttons={[{ label: "Envoyer mon CV", variant: "pink", to: "/contact" }]}
      />
    </EntrepriseLayout>
  );
}

function PerkCard({ icon: Icon, color, bg, title, desc }: { icon: any; color: string; bg: string; title: string; desc: string }) {
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
