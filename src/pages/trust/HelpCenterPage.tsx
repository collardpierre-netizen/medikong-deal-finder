import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { Section } from "@/components/entreprise/Section";
import { FaqAccordion } from "@/components/entreprise/FaqAccordion";
import { HelpCategoryCard } from "@/components/trust/HelpCategoryCard";
import { helpCategories, helpFaqItems } from "@/data/trust-process-data";
import { Search, Mail, Phone, MessageCircle } from "lucide-react";
import { useState } from "react";

export default function HelpCenterPage() {
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? helpCategories.filter(
        (c) =>
          c.title.toLowerCase().includes(q.toLowerCase()) ||
          c.description.toLowerCase().includes(q.toLowerCase()) ||
          c.articles?.some((a) => a.label.toLowerCase().includes(q.toLowerCase()))
      )
    : helpCategories;

  return (
    <TrustProcessLayout>
      {/* Dark hero with integrated search */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
          <h1 className="text-3xl md:text-[42px] font-extrabold tracking-tight leading-tight mb-3">
            Centre d'aide MediKong
          </h1>
          <p className="text-white/60 text-base md:text-lg mb-8 max-w-[520px]">
            Trouvez rapidement les réponses à vos questions sur les commandes, la livraison, les paiements et plus encore.
          </p>
          <div className="max-w-[600px]">
            <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-lg">
              <div className="flex items-center pl-4">
                <Search size={18} className="text-muted-foreground" />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher dans l'aide..."
                className="flex-1 px-3 py-3.5 text-sm text-foreground focus:outline-none bg-white"
              />
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((cat) => (
            <HelpCategoryCard key={cat.title} {...cat} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">
            Aucun résultat pour « {q} ». Essayez un autre terme ou{" "}
            <a href="/contact" className="text-primary underline">contactez-nous</a>.
          </p>
        )}
      </Section>

      <Section bg="gray" title="Questions les plus fréquentes">
        <FaqAccordion items={helpFaqItems} />
      </Section>

      {/* Contact section with 3 channels */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-2">
            Vous n'avez pas trouvé votre réponse ?
          </h2>
          <p className="text-white/60 mb-10">
            Notre équipe est disponible du lundi au vendredi de 9h à 18h.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-[750px] mx-auto">
            {/* Email */}
            <a
              href="mailto:support@medikong.com"
              className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Mail size={22} className="text-primary" />
              </div>
              <span className="font-bold text-sm">Email</span>
              <span className="text-white/60 text-xs">support@medikong.com</span>
            </a>
            {/* Téléphone */}
            <a
              href="tel:+3222000000"
              className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Phone size={22} className="text-primary" />
              </div>
              <span className="font-bold text-sm">Téléphone</span>
              <span className="text-white/60 text-xs">+32 2 XXX XX XX</span>
            </a>
            {/* WhatsApp */}
            <a
              href="https://wa.me/32470000000"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                <MessageCircle size={22} className="text-[#25D366]" />
              </div>
              <span className="font-bold text-sm">WhatsApp</span>
              <span className="text-white/60 text-xs">Réponse rapide</span>
            </a>
          </div>
        </div>
      </section>
    </TrustProcessLayout>
  );
}
