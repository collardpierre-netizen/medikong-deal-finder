import { Link, useLocation } from "react-router-dom";

const tabs = [
  { label: "Shop", path: "/" },
  { label: "Promotions", path: "/promotions", pink: true },
  { label: "Categories", path: "/categorie/consommables" },
  { label: "Marques", path: "/marques" },
  { label: "Professionnels", path: "#" },
  { label: "Sourcing", path: "#" },
  { label: "Mon compte", path: "/compte" },
];

export function SubNav() {
  const { pathname } = useLocation();

  return (
    <div className="border-b border-mk-line">
      <div className="mk-container flex items-center gap-1">
        {tabs.map(tab => {
          const active = pathname === tab.path || (tab.path === "/" && pathname === "/");
          return (
            <Link
              key={tab.label}
              to={tab.path}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
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
