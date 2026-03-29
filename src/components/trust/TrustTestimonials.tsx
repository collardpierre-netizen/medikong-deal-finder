import { Star, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/PageTransition";

const testimonials = [
  {
    name: "Dr. Sophie Vanderstraeten",
    role: "Pharmacienne titulaire, Bruxelles",
    initials: "SV",
    stars: 5,
    quote: "MediKong a transformé notre façon d'acheter. On économise en moyenne 18% sur nos commandes mensuelles.",
  },
  {
    name: "Marc Dupont",
    role: "Directeur des achats, CHU Liège",
    initials: "MD",
    stars: 4,
    quote: "La comparaison instantanée entre fournisseurs nous a permis de renégocier nos contrats existants.",
  },
  {
    name: "Isabelle Claes",
    role: "Gérante, Pharmacie du Parc",
    initials: "IC",
    stars: 5,
    quote: "L'onboarding est ultra simple et le support répond en moins d'une heure. Vraiment professionnel.",
  },
];

interface Props {
  title?: string;
  className?: string;
}

export function TrustTestimonials({ title = "La confiance de 500+ professionnels", className }: Props) {
  return (
    <AnimatedSection className={`py-14 md:py-20 bg-mk-alt/30 ${className ?? ""}`}>
      <div className="mk-container">
        <h2 className="text-2xl md:text-3xl font-bold text-mk-navy mb-3 text-center">{title}</h2>
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} size={20} className={s <= 4 ? "fill-mk-blue text-mk-blue" : "fill-mk-blue/20 text-mk-blue/20"} />
            ))}
          </div>
          <p className="text-xs text-mk-sec mt-1">Score 4.6/5 · basé sur 127 avis vérifiés</p>
        </div>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map(t => (
            <StaggerItem key={t.name}>
              <motion.div
                className="bg-white rounded-2xl border border-mk-line overflow-hidden h-full flex flex-col"
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="bg-gradient-to-br from-mk-blue to-mk-navy p-5 relative">
                  <div className="flex items-end gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">{t.initials}</div>
                    <div>
                      <div className="flex gap-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={12} className={s <= t.stars ? "fill-yellow-400 text-yellow-400" : "fill-white/20 text-white/20"} />
                        ))}
                      </div>
                      <div className="text-sm font-bold text-white">{t.name}</div>
                      <div className="text-xs text-white/70">{t.role}</div>
                    </div>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-sm text-mk-sec leading-relaxed flex-1">« {t.quote} »</p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <div className="text-center mt-8">
          <Link
            to="/temoignages"
            className="inline-flex items-center gap-2 px-8 py-3 border border-mk-line rounded-lg text-sm font-semibold text-mk-navy hover:border-mk-navy hover:shadow-sm transition-all"
          >
            Lire tous les avis <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </AnimatedSection>
  );
}
