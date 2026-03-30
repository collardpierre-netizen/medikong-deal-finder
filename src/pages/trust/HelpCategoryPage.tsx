import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";
import { getArticlesByCategory } from "@/data/help-articles";
import { getHelpCategories } from "@/data/trust-process-data";
import { ChevronRight, ArrowRight } from "lucide-react";
import { useMemo } from "react";

const CATEGORY_KEYS = [
  "gettingStarted", "orders", "delivery", "vat", "claims",
  "account", "sellers", "quality", "features", "resources",
] as const;

export default function HelpCategoryPage() {
  const { key } = useParams<{ key: string }>();
  const { t } = useTranslation();

  const categories = useMemo(() => getHelpCategories(t), [t]);
  const category = categories.find((_, i) => CATEGORY_KEYS[i] === key);
  const categoryKey = key as string;
  const articles = useMemo(() => getArticlesByCategory(categoryKey), [categoryKey]);

  if (!category || !CATEGORY_KEYS.includes(key as any)) {
    return (
      <TrustProcessLayout>
        <div className="max-w-[800px] mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">{t("helpCenter.categoryNotFound", "Catégorie introuvable")}</h1>
          <Link to="/centre-aide" className="text-primary font-semibold hover:underline">
            ← {t("helpCenter.title")}
          </Link>
        </div>
      </TrustProcessLayout>
    );
  }

  const IconComponent = category.icon;

  return (
    <TrustProcessLayout>
      {/* Breadcrumb */}
      <div className="bg-muted/40 border-b border-border">
        <div className="max-w-[800px] mx-auto px-6 py-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/centre-aide" className="hover:text-primary transition-colors">
            {t("helpCenter.title")}
          </Link>
          <ChevronRight size={14} />
          <span className="text-foreground font-medium">{category.title}</span>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-12">
        {/* Category header */}
        <div className="flex items-start gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconComponent size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">{category.title}</h1>
            <p className="text-muted-foreground">{category.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("helpCenter.articleCount", { count: articles.length }).replace("{{count}}", String(articles.length))}
            </p>
          </div>
        </div>

        {/* Articles list */}
        <div className="space-y-0 border border-border rounded-xl overflow-hidden">
          {articles.map((article, i) => (
            <Link
              key={article.slug}
              to={`/centre-aide/${article.slug}`}
              className={`flex items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors group ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {t(article.titleKey)}
              </span>
              <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-4" />
            </Link>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-8">
          <Link
            to="/centre-aide"
            className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            ← {t("helpCenter.backToCenter", "Retour au centre d'aide")}
          </Link>
        </div>
      </div>
    </TrustProcessLayout>
  );
}
