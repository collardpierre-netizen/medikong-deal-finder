import { EntrepriseLayout } from "@/components/entreprise/EntrepriseLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { TeamCard } from "@/components/entreprise/TeamCard";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { teamMembers } from "@/data/entreprise-data";
import { MessageSquare, Shield, BookOpen } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const culture = [
  { icon: MessageSquare, color: "text-[#E70866]", bg: "bg-[#FFF1F5]", title: "Communication directe", desc: "Feedback transparent, décisions rapides, zéro politique interne." },
  { icon: Shield, color: "text-[#1B5BDA]", bg: "bg-[#EFF6FF]", title: "Ownership et autonomie", desc: "Chaque membre de l'équipe est propriétaire de ses projets et décisions." },
  { icon: BookOpen, color: "text-[#059669]", bg: "bg-[#ECFDF5]", title: "Apprentissage continu", desc: "Budget formation, conférences et temps dédié à l'exploration technique." },
];

export default function TeamPage() {
  return (
    <EntrepriseLayout>
      <EntrepriseHero
        variant="dark"
        badge="L'équipe"
        title="Les visages derrière MediKong"
        subtitle="Une équipe passionnée par l'innovation dans le secteur médical."
      />

      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[800px] mx-auto">
          {teamMembers.map((m) => (
            <TeamCard key={m.name} {...m} />
          ))}
        </div>
      </Section>

      <Section bg="gray" label="Culture" title="Notre façon de travailler">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {culture.map((c) => (
            <CultureCard key={c.title} {...c} />
          ))}
        </div>
      </Section>

      <CtaBanner
        variant="blue"
        title="Envie de rejoindre l'aventure ?"
        buttons={[
          { label: "Voir les offres d'emploi", variant: "white", to: "/carrieres" },
          { label: "Nous contacter", variant: "outline", to: "/contact" },
        ]}
      />
    </EntrepriseLayout>
  );
}

function CultureCard({ icon: Icon, color, bg, title, desc }: { icon: any; color: string; bg: string; title: string; desc: string }) {
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
