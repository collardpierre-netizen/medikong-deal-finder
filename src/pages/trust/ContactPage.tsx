import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { EntrepriseHero } from "@/components/entreprise/EntrepriseHero";
import { Section } from "@/components/entreprise/Section";
import { ContactForm } from "@/components/trust/ContactForm";
import { contactSubjects } from "@/data/trust-process-data";
import { Mail, Phone, MapPin, Store, TrendingUp } from "lucide-react";

const infos = [
  { icon: Mail, label: "Support général", value: "support@medikong.pro" },
  { icon: Store, label: "Devenir vendeur", value: "vendeurs@medikong.pro" },
  { icon: TrendingUp, label: "Investissement", value: "invest@medikong.pro" },
];

export default function ContactPage() {
  return (
    <TrustProcessLayout>
      <EntrepriseHero
        variant="light"
        badge="Contact"
        title="Contactez-nous"
        subtitle="Une question ? Notre équipe vous répond sous 24h ouvrées."
      />
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
          <div className="lg:col-span-3 bg-white border border-mk-line rounded-2xl p-7 md:p-9">
            <h2 className="text-xl font-bold text-mk-navy mb-6">Envoyez-nous un message</h2>
            <ContactForm subjects={contactSubjects} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-mk-line rounded-2xl p-7">
              <h3 className="text-base font-bold text-mk-navy mb-4">Nos contacts</h3>
              <div className="space-y-4">
                {infos.map(info => (
                  <div key={info.label} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-mk-blue/10 flex items-center justify-center shrink-0">
                      <info.icon size={16} className="text-mk-blue" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{info.label}</div>
                      <div className="text-sm font-medium text-mk-navy">{info.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-mk-line rounded-2xl p-7">
              <h3 className="text-base font-bold text-mk-navy mb-3">Adresse</h3>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-mk-blue shrink-0 mt-1" />
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Balooh SRL<br />23 rue de la Procession<br />B-7822 Ath, Belgique
                </div>
              </div>
            </div>
            <div className="bg-white border border-mk-line rounded-2xl p-7">
              <h3 className="text-base font-bold text-mk-navy mb-3">Horaires</h3>
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-mk-blue shrink-0 mt-1" />
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Lundi — Vendredi<br />9h00 — 18h00 (CET)
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </TrustProcessLayout>
  );
}
