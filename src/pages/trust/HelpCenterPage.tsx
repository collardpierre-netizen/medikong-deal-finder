import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { Section } from "@/components/entreprise/Section";
import { FaqAccordion } from "@/components/entreprise/FaqAccordion";
import { HelpCategoryCard } from "@/components/trust/HelpCategoryCard";
import { getHelpCategories, getHelpFaqItems } from "@/data/trust-process-data";
import { Search, Mail, Phone, MessageCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

export default function HelpCenterPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");

  const categories = useMemo(() => getHelpCategories(t), [t]);
  const faqItems = useMemo(() => getHelpFaqItems(t), [t]);

  const filtered = q.trim()
    ? categories.filter(
        (c) =>
          c.title.toLowerCase().includes(q.toLowerCase()) ||
          c.description.toLowerCase().includes(q.toLowerCase()) ||
          c.articles?.some((a) => a.label.toLowerCase().includes(q.toLowerCase()))
      )
    : categories;

  return (
    <TrustProcessLayout>
      {/* Dark hero with integrated search */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
          <h1 className="text-3xl md:text-[42px] font-extrabold tracking-tight leading-tight mb-3">
            {t("helpCenter.title")}
          </h1>
          <p className="text-white/60 text-base md:text-lg mb-8 max-w-[520px]">
            {t("helpCenter.subtitle")}
          </p>
          <div className="max-w-[600px]">
            <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-lg">
              <div className="flex items-center pl-4">
                <Search size={18} className="text-muted-foreground" />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("helpCenter.searchPlaceholder")}
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
            {t("helpCenter.noResults", { query: q })}{" "}
            <a href="/contact" className="text-primary underline">{t("helpCenter.contactUs")}</a>.
          </p>
        )}
      </Section>

      <Section bg="gray" title={t("helpCenter.faqTitle")}>
        <FaqAccordion items={faqItems} />
      </Section>

      {/* Contact section with 3 channels */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-2">
            {t("helpCenter.contactTitle")}
          </h2>
          <p className="text-white/60 mb-10">
            {t("helpCenter.contactSubtitle")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-[750px] mx-auto">
            <a
              href="mailto:support@medikong.com"
              className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Mail size={22} className="text-primary" />
              </div>
              <span className="font-bold text-sm">{t("helpCenter.email")}</span>
              <span className="text-white/60 text-xs">support@medikong.com</span>
            </a>
            <a
              href="tel:+3222000000"
              className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Phone size={22} className="text-primary" />
              </div>
              <span className="font-bold text-sm">{t("helpCenter.phone")}</span>
              <span className="text-white/60 text-xs">+32 2 XXX XX XX</span>
            </a>
            <a
              href="https://wa.me/32470000000"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                <MessageCircle size={22} className="text-[#25D366]" />
              </div>
              <span className="font-bold text-sm">{t("helpCenter.whatsapp")}</span>
              <span className="text-white/60 text-xs">{t("helpCenter.whatsappSub")}</span>
            </a>
          </div>
        </div>
      </section>
    </TrustProcessLayout>
  );
}
