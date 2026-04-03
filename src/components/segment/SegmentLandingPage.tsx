import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/PageTransition";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { SegmentPageData } from "@/data/segment-pages-data";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  data: SegmentPageData;
}

export default function SegmentLandingPage({ data }: Props) {
  return (
    <Layout title={data.seoTitle} description={data.seoDescription}>
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-muted/50 to-background">
        <div className="mk-container">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <motion.div
                className="inline-flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 rounded-full px-4 py-1.5 mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span>{data.badgeEmoji}</span> {data.badge}
              </motion.div>

              <motion.h1
                className="text-3xl md:text-[42px] leading-tight font-bold text-foreground mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                {data.title}{" "}
                <span className="text-primary">{data.titleHighlight}</span>
              </motion.h1>

              <motion.p
                className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {data.subtitle}
              </motion.p>

              <motion.div
                className="flex flex-wrap gap-3 mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Link
                  to={data.ctaPrimary.href}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
                >
                  {data.ctaPrimary.label} <ArrowRight size={16} />
                </Link>
                <Link
                  to={data.ctaSecondary.href}
                  className="inline-flex items-center gap-2 border border-border text-foreground font-semibold text-sm px-6 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  {data.ctaSecondary.label}
                </Link>
              </motion.div>

              <p className="text-xs text-muted-foreground">{data.trustLine}</p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <img
                src={data.heroImage}
                alt={data.badge}
                width={1280}
                height={864}
                className="w-full rounded-2xl shadow-lg object-cover aspect-[3/2]"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border">
        <div className="mk-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {data.stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <AnimatedSection className="py-16 md:py-20">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-center">{data.painTitle}</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">{data.painSubtitle}</p>
          <StaggerContainer className="grid md:grid-cols-3 gap-6">
            {data.painPoints.map((pp, i) => (
              <StaggerItem key={i}>
                <div className="border border-border rounded-xl p-6 bg-card text-center">
                  <span className="text-3xl mb-3 block">{pp.emoji}</span>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pp.text}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* Features */}
      <AnimatedSection className="py-16 md:py-20 bg-muted/30">
        <div className="mk-container">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-10 text-center">{data.featuresTitle}</h2>
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.features.map((feat, i) => (
              <StaggerItem key={i}>
                <div className="border border-border rounded-xl p-6 bg-card h-full">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 text-sm font-bold">
                    {i + 1}
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* Process */}
      <AnimatedSection className="py-16 md:py-20">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 text-center">{data.processTitle}</h2>
          <p className="text-muted-foreground text-center mb-10">{data.processSubtitle}</p>
          <div className="space-y-6">
            {data.steps.map((step, i) => (
              <motion.div
                key={i}
                className="flex gap-4 items-start"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Comparisons (optional — pharmacies) */}
      {data.comparisons && data.comparisons.length > 0 && (
        <AnimatedSection className="py-16 md:py-20 bg-muted/30">
          <div className="mk-container max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-10 text-center">
              Pourquoi MediKong change la donne
            </h2>
            <StaggerContainer className="space-y-6">
              {data.comparisons.map((comp, i) => (
                <StaggerItem key={i}>
                  <div className="border border-border rounded-xl p-6 bg-card">
                    <h3 className="font-bold text-foreground mb-2">{comp.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{comp.description}</p>
                    <blockquote className="text-sm italic text-primary border-l-2 border-primary pl-4">
                      "{comp.quote}"
                    </blockquote>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </AnimatedSection>
      )}

      {/* Categories */}
      <AnimatedSection className={`py-16 md:py-20 ${data.comparisons ? "" : "bg-muted/30"}`}>
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-10 text-center">{data.categoriesTitle}</h2>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.categories.map((cat, i) => (
              <StaggerItem key={i}>
                <Link to="/catalogue" className="block border border-border rounded-xl p-5 bg-card hover:shadow-md transition-shadow text-center h-full">
                  <h3 className="font-bold text-foreground text-sm mb-1">{cat.title}</h3>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <div className="text-center mt-8">
            <Link to="/catalogue" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Voir le catalogue complet <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </AnimatedSection>

      {/* FAQ */}
      <AnimatedSection className="py-16 md:py-20">
        <div className="mk-container max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {data.faq.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </AnimatedSection>

      {/* Contact / CTA */}
      <section className="py-16 md:py-20 bg-primary/5" id="contact-form">
        <div className="mk-container max-w-xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 text-center">{data.contactTitle}</h2>
          <p className="text-muted-foreground text-center mb-8">{data.contactSubtitle}</p>
          <ContactForm ctaLabel={data.contactCta} />
        </div>
      </section>
    </Layout>
  );
}

function ContactForm({ ctaLabel }: { ctaLabel: string }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Merci ! Nous vous recontactons rapidement.");
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          required
          placeholder="Société *"
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <input
          required
          placeholder="Nom / Fonction *"
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          placeholder="Téléphone"
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <input
          required
          type="email"
          placeholder="Email *"
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>
      <textarea
        rows={3}
        placeholder="Message (optionnel)"
        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "Envoi en cours…" : ctaLabel}
      </button>
    </form>
  );
}
