import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function SubNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const tabs = [
    { label: t("nav.shop"), path: "/" },
    { label: t("nav.promotions"), path: "/promotions", pink: true },
    { label: t("nav.categories"), path: "/categories" },
    { label: t("nav.brands"), path: "/marques" },
    { label: t("nav.professionals"), path: "/professionnels" },
    { label: t("nav.sourcing"), path: "/sourcing" },
    { label: t("nav.account"), path: "/compte" },
  ];

  return (
    <div className="border-b border-mk-line overflow-x-auto">
      <div className="mk-container flex items-center gap-1 min-w-max">
        {tabs.map(tab => {
          const active = pathname === tab.path || (tab.path === "/" && pathname === "/");
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-3 md:px-4 py-3 text-xs md:text-sm font-medium transition-colors relative whitespace-nowrap ${
                tab.pink ? "text-mk-pink" : active ? "text-mk-navy font-bold" : "text-mk-sec hover:text-mk-text"
              }`}
            >
              {tab.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-mk-navy" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
