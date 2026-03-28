import { EntrepriseLayout } from "@/components/entreprise/EntrepriseLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { StatsRow } from "@/components/entreprise/StatsRow";
import { SplitSection } from "@/components/entreprise/SplitSection";
import { HorizontalTimeline } from "@/components/entreprise/HorizontalTimeline";
import { Eye, Users, Star, CheckCircle, Mail, Phone, MapPin } from "lucide-react";
import { aboutTimeline, companyInfo } from "@/data/entreprise-data";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const stats = [
  { value: 40000, suffix: "+", label: "Références produits" },
  { value: 20, suffix: " ans", label: "D'expérience santé" },
  { value: 3, suffix: "", label: "Pays couverts" },
  { value: 24, suffix: "/7", label: "Plateforme en ligne" },
  { value: 500, suffix: "+", label: "Professionnels actifs" },
];

const values = [
  { icon: Eye, color: "text-[#E70866]", bg: "bg-[#FFF1F5]", title: "Transparence", desc: "Prix clairs, commissions visibles, aucun frais caché." },
  { icon: Users, color: "text-[#1B5BDA]", bg: "bg-[#EFF6FF]", title: "Collaboration", desc: "Acheteurs et vendeurs construisent ensemble un marché plus juste." },
  { icon: Star, color: "text-[#7C3AED]", bg: "bg-[#F5F3FF]", title: "Innovation", desc: "IA, market intelligence et outils de pricing avancés." },
  { icon: CheckCircle, color: "text-[#059669]", bg: "bg-[#ECFDF5]", title: "Excellence", desc: "Vérification fournisseurs, conformité AFMPS, qualité garantie." },
];

export default function AboutPage() {
  return (
    <EntrepriseLayout>
      <EntrepriseHero
        variant="image"
        badge="La marketplace médicale B2B"
        title="Là où transparence, innovation et santé s'unissent"
        subtitle="MediKong connecte les professionnels de santé avec des fournisseurs vérifiés pour des achats médicaux transparents, compétitifs et conformes."
        cta={[
          { label: "Découvrir la plateforme", variant: "pink", onClick: () => window.location.href = "/" },
          { label: "Nous contacter", variant: "white", onClick: () => window.location.href = "/contact" },
        ]}
      />

      <Section>
        <StatsRow stats={stats} />
      </Section>

      <Section bg="gray">
        <SplitSection
          tag={{ label: "Notre mission", color: "#E70866", bg: "#FFF1F5" }}
          title="Moderniser les échanges B2B dans le secteur médical"
          paragraphs={[
            "MediKong a été créée pour transformer la manière dont les professionnels de santé s'approvisionnent en fournitures médicales. Fini les catalogues papier, les appels chronophages et l'opacité des prix.",
            "Notre plateforme centralise l'offre de centaines de fournisseurs vérifiés, permettant aux acheteurs de comparer les prix en temps réel et de commander en toute sécurité.",
          ]}
          imagePlaceholder="Photo : équipe dans un entrepôt médical"
          imageGradient="from-blue-100 to-indigo-200"
        />
      </Section>

      <Section label="Ce qui nous guide" title="Nos valeurs" subtitle="Quatre piliers fondamentaux guident chacune de nos décisions.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((v) => (
            <ValueCard key={v.title} {...v} />
          ))}
        </div>
      </Section>

      <Section bg="gray" label="Notre parcours" title="Notre histoire" subtitle="De l'idée à la marketplace leader du Benelux.">
        <HorizontalTimeline nodes={aboutTimeline} />
      </Section>

      <Section>
        <div className="rounded-2xl border border-border p-8 md:p-10 bg-white shadow-sm max-w-[700px] mx-auto">
          <h3 className="text-lg font-bold text-[#1E293B] mb-4">{companyInfo.name}</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>TVA : {companyInfo.tva}</p>
            <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {companyInfo.address}</p>
            <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {companyInfo.email}</p>
            <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> {companyInfo.phone}</p>
          </div>
        </div>
      </Section>
    </EntrepriseLayout>
  );
}

function ValueCard({ icon: Icon, color, bg, title, desc }: { icon: any; color: string; bg: string; title: string; desc: string }) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`p-6 rounded-2xl border border-border bg-white hover:shadow-lg hover:border-transparent hover:translate-y-[-4px] transition-all duration-700 ${
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
