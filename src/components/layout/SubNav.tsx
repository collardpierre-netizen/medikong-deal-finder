import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";

export function SubNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const tabs = [
    { label: t("nav.shop"), path: "/" },
    { label: t("nav.brands"), path: "/marques" },
    { label: t("nav.promotions"), path: "/promotions" },
    { label: t("nav.sourcing"), path: "/sourcing" },
    { label: t("nav.professionals"), path: "/professionnels" },
  ];

  return (
    <div className="border-b border-border bg-white">
      <div className="mk-container flex items-center gap-1 overflow-x-auto">
        {/* Categories button */}
        <Link
          to="/categories"
          className={`flex items-center gap-2 px-4 py-2.5 my-1 rounded-lg text-sm font-semibold transition-colors shrink-0 ${
            pathname === "/categories"
              ? "bg-primary text-primary-foreground"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          <LayoutGrid size={16} />
          {t("nav.categories")}
        </Link>

        {/* Links */}
        {tabs.map(tab => {
          const active = pathname === tab.path || (tab.path === "/" && pathname === "");
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-3 md:px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
