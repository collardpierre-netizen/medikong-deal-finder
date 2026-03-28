import { EntrepriseLayout } from "@/components/entreprise/EntrepriseLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { PressCard } from "@/components/entreprise/PressCard";
import { pressArticles } from "@/data/entreprise-data";
import { Mail, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PressPage() {
  return (
    <EntrepriseLayout>
      <EntrepriseHero
        variant="dark"
        badge="Médias"
        title="MediKong dans les médias"
        subtitle="Suivez notre actualité et nos annonces les plus récentes."
        cta={[{ label: "Télécharger le dossier de presse", variant: "pink" }]}
      />

      <Section label="Actualités" title="Articles récents">
        <div className="max-w-[900px] mx-auto">
          {pressArticles.map((a) => (
            <PressCard key={a.title} {...a} />
          ))}
        </div>
      </Section>

      <Section bg="gray">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-[900px] mx-auto">
          <div>
            <h3 className="text-2xl font-bold text-[#1E293B] mb-4">Contact presse</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Pour toute demande média, interview ou partenariat éditorial, contactez notre équipe communication.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Mail className="w-4 h-4" /> presse@medikong.pro
            </div>
          </div>
          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center">
            <span className="text-sm text-rose-400">Photo : équipe communication</span>
          </div>
        </div>
      </Section>

      <Section label="Ressources" title="Logos et assets">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[900px] mx-auto">
          {[
            { label: "Logo couleur", gradient: "from-white to-gray-50 border border-border" },
            { label: "Logo fond sombre", gradient: "from-[#0F172A] to-[#1E293B]" },
            { label: "Logo monochrome", gradient: "from-gray-100 to-gray-200" },
          ].map((l) => (
            <div key={l.label} className="text-center">
              <div className={`aspect-[3/2] rounded-xl bg-gradient-to-br ${l.gradient} flex items-center justify-center mb-3`}>
                <span className="text-sm text-muted-foreground font-bold">MK</span>
              </div>
              <p className="text-sm font-medium text-[#1E293B] mb-2">{l.label}</p>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Télécharger
              </Button>
            </div>
          ))}
        </div>
      </Section>
    </EntrepriseLayout>
  );
}
