import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { CtaBanner } from "@/components/entreprise/CtaBanner";
import { FaqAccordion } from "@/components/entreprise/FaqAccordion";
import { HelpCategoryCard } from "@/components/trust/HelpCategoryCard";
import { helpCategories, helpFaqItems } from "@/data/trust-process-data";
import { Search } from "lucide-react";
import { useState } from "react";

export default function HelpCenterPage() {
  const [q, setQ] = useState("");

  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="light"
        badge="Aide"
        title="Centre d'aide MediKong"
        subtitle="Trouvez rapidement les réponses à vos questions."
      />
      <Section>
        <div className="max-w-[560px] mx-auto mb-10">
          <div className="flex border border-mk-line rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="flex items-center pl-4"><Search size={18} className="text-mk-sec" /></div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher dans l'aide..." className="flex-1 px-3 py-3.5 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {helpCategories.map(cat => <HelpCategoryCard key={cat.title} {...cat} />)}
        </div>
      </Section>
      <Section bg="gray" title="Questions les plus fréquentes">
        <FaqAccordion items={helpFaqItems} />
      </Section>
      <CtaBanner
        variant="blue"
        title="Vous n'avez pas trouvé votre réponse ?"
        subtitle="Notre équipe est disponible du lundi au vendredi de 9h à 18h."
        buttons={[{ label: "Contactez-nous →", variant: "white", to: "/contact" }]}
      />
    </TrustProcessLayout>
  );
}
