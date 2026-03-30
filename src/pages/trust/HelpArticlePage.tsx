import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { getArticleBySlug, getArticlesByCategory } from "@/data/help-articles";
import { ChevronRight, ArrowLeft } from "lucide-react";

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const article = slug ? getArticleBySlug(slug) : undefined;

  if (!article) {
    return (
      <TrustProcessLayout>
        <div className="max-w-[800px] mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Article introuvable</h1>
          <p className="text-muted-foreground mb-6">Cet article n'existe pas ou a été déplacé.</p>
          <Link to="/centre-aide" className="text-primary font-semibold hover:underline">
            ← {t("helpCenter.title")}
          </Link>
        </div>
      </TrustProcessLayout>
    );
  }

  const categoryTitle = t(`helpCenter.categories.${article.categoryKey}.title`);
  const relatedArticles = getArticlesByCategory(article.categoryKey).filter((a) => a.slug !== slug);

  return (
    <TrustProcessLayout>
      {/* Breadcrumb */}
      <div className="bg-muted/40 border-b border-border">
        <div className="max-w-[800px] mx-auto px-6 py-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/centre-aide" className="hover:text-primary transition-colors">
            {t("helpCenter.title")}
          </Link>
          <ChevronRight size={14} />
          <span className="text-foreground/70">{categoryTitle}</span>
          <ChevronRight size={14} />
          <span className="text-foreground font-medium truncate max-w-[300px]">{t(article.titleKey)}</span>
        </div>
      </div>

      {/* Article content */}
      <article className="max-w-[800px] mx-auto px-6 py-10 md:py-16">
        <Link
          to="/centre-aide"
          className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline mb-6"
        >
          <ArrowLeft size={14} />
          {t("helpCenter.title")}
        </Link>

        <div className="mb-3">
          <span className="inline-block bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
            {categoryTitle}
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mb-8 leading-tight">
          {t(article.titleKey)}
        </h1>

        <div className="prose prose-sm max-w-none">
          {article.sections.map((section, i) => (
            <div key={i} className="mb-8">
              <h2 className="text-lg font-bold text-foreground mb-3">{t(section.headingKey)}</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{t(section.bodyKey)}</p>
            </div>
          ))}
        </div>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <h3 className="text-base font-bold text-foreground mb-4">
              {t("helpArticles.relatedArticles")}
            </h3>
            <ul className="space-y-2">
              {relatedArticles.map((ra) => (
                <li key={ra.slug}>
                  <Link
                    to={`/centre-aide/${ra.slug}`}
                    className="text-sm text-foreground/80 hover:text-primary transition-colors flex items-center gap-1.5 group"
                  >
                    <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    {t(ra.titleKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-12 bg-muted/50 border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">{t("helpCenter.contactTitle")}</p>
          <Link to="/contact" className="text-sm font-semibold text-primary hover:underline">
            {t("helpCenter.contactUs")} →
          </Link>
        </div>
      </article>
    </TrustProcessLayout>
  );
}
