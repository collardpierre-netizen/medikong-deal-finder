import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HelpCategoryData } from "@/data/trust-process-data";

export function HelpCategoryCard({ icon: Icon, title, description, articleCount, articles, categoryKey }: HelpCategoryData & { categoryKey?: string }) {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-border rounded-2xl p-6 md:p-7 hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 flex flex-col">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon size={22} className="text-primary" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>

      {articles && articles.length > 0 && (
        <ul className="space-y-2 mb-4 flex-1">
          {articles.map((a) => (
            <li key={a.label}>
              <Link
                to={a.href}
                className="text-sm text-foreground/80 hover:text-primary transition-colors leading-snug flex items-start gap-1.5 group"
              >
                <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {categoryKey ? (
        <Link to={`/centre-aide/categorie/${categoryKey}`} className="text-xs font-semibold text-primary flex items-center gap-1 mt-auto hover:gap-2 transition-all">
          {t("helpCenter.viewArticles", { count: articleCount })} <ChevronRight size={14} />
        </Link>
      ) : (
        <p className="text-xs font-semibold text-primary flex items-center gap-1 mt-auto cursor-pointer hover:gap-2 transition-all">
          {t("helpCenter.viewArticles", { count: articleCount })} <ChevronRight size={14} />
        </p>
      )}
    </div>
  );
}
