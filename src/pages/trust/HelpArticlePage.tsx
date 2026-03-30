import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { getArticleBySlug, getArticlesByCategory } from "@/data/help-articles";
import { ChevronRight, ArrowLeft, ArrowRight, HelpCircle, Mail } from "lucide-react";

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const article = slug ? getArticleBySlug(slug) : undefined;

  if (!article) {
    return (
      <TrustProcessLayout>
        <div className="max-w-[800px] mx-auto px-6 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <HelpCircle size={32} className="text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Article introuvable</h1>
          <p className="text-muted-foreground mb-6">Cet article n'existe pas ou a été déplacé.</p>
          <Link
            to="/centre-aide"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={16} />
            {t("helpCenter.title")}
          </Link>
        </div>
      </TrustProcessLayout>
    );
  }

  const categoryTitle = t(`helpCenter.categories.${article.categoryKey}.title`);
  const relatedArticles = getArticlesByCategory(article.categoryKey).filter((a) => a.slug !== slug);

  return (
    <TrustProcessLayout>
      {/* Navy breadcrumb bar */}
      <div className="bg-[hsl(var(--mk-navy))]">
        <div className="max-w-[800px] mx-auto px-6 py-3 flex items-center gap-1.5 text-sm text-white/60">
          <Link to="/centre-aide" className="hover:text-white transition-colors">
            {t("helpCenter.title")}
          </Link>
          <ChevronRight size={14} />
          <Link
            to={`/centre-aide/categorie/${article.categoryKey}`}
            className="hover:text-white transition-colors"
          >
            {categoryTitle}
          </Link>
          <ChevronRight size={14} />
          <span className="text-white font-medium truncate max-w-[300px]">{t(article.titleKey)}</span>
        </div>
      </div>

      {/* Hero band */}
      <section className="bg-[hsl(var(--mk-navy))] text-white pb-12 pt-6">
        <div className="max-w-[800px] mx-auto px-6">
          <Link
            to={`/centre-aide/categorie/${article.categoryKey}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white font-medium mb-5 transition-colors"
          >
            <ArrowLeft size={14} />
            {categoryTitle}
          </Link>

          <span className="inline-block bg-[hsl(var(--mk-blue))]/20 text-[hsl(var(--mk-blue))] text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-[hsl(var(--mk-blue))]/30">
            {categoryTitle}
          </span>

          <h1 className="text-2xl md:text-[34px] font-extrabold tracking-tight leading-tight">
            {t(article.titleKey)}
          </h1>
        </div>
      </section>

      {/* Article body */}
      <article className="max-w-[800px] mx-auto px-6 py-10 md:py-14">
        <div className="space-y-10">
          {article.sections.map((section, i) => (
            <div key={i} className="relative pl-6 border-l-2 border-[hsl(var(--mk-blue))]/20">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[hsl(var(--mk-blue))]/10 border-2 border-[hsl(var(--mk-blue))] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--mk-blue))]" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-3">{t(section.headingKey)}</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-[15px]">{t(section.bodyKey)}</p>
            </div>
          ))}
        </div>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-14 pt-8 border-t border-border">
            <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-[hsl(var(--mk-blue))]" />
              {t("helpArticles.relatedArticles")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {relatedArticles.map((ra) => (
                <Link
                  key={ra.slug}
                  to={`/centre-aide/${ra.slug}`}
                  className="flex items-center justify-between bg-muted/50 hover:bg-[hsl(var(--mk-blue))]/5 border border-border hover:border-[hsl(var(--mk-blue))]/30 rounded-xl px-4 py-3.5 group transition-all"
                >
                  <span className="text-sm font-medium text-foreground group-hover:text-[hsl(var(--mk-blue))] transition-colors">
                    {t(ra.titleKey)}
                  </span>
                  <ArrowRight size={15} className="text-muted-foreground group-hover:text-[hsl(var(--mk-blue))] transition-colors shrink-0 ml-3" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Contact CTA — MediKong branded */}
        <div className="mt-14 bg-[hsl(var(--mk-navy))] text-white rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--mk-blue))]/20 flex items-center justify-center mx-auto mb-4">
            <Mail size={22} className="text-[hsl(var(--mk-blue))]" />
          </div>
          <p className="font-bold text-lg mb-1">{t("helpCenter.contactTitle")}</p>
          <p className="text-white/50 text-sm mb-5">{t("helpCenter.contactSubtitle")}</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-[hsl(var(--mk-blue))] text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("helpCenter.contactUs")}
            <ArrowRight size={15} />
          </Link>
        </div>
      </article>
    </TrustProcessLayout>
  );
}
