import { Link, useLocation } from "react-router-dom";

const navItems = [
  { label: "À propos", path: "/a-propos" },
  { label: "Pourquoi MediKong", path: "/pourquoi-medikong" },
  { label: "Comment ça marche", path: "/comment-ca-marche" },
  { label: "Notre équipe", path: "/equipe" },
  { label: "Carrières", path: "/carrieres" },
  { label: "Presse", path: "/presse" },
  { label: "Investir", path: "/investir" },
];

export function EntrepriseSubNav() {
  const { pathname } = useLocation();

  return (
    <div className="sticky top-[52px] z-[99] bg-white border-b border-border">
      <div className="mk-container overflow-x-auto">
        <nav className="flex gap-0 whitespace-nowrap min-w-max">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "text-[#E70866] border-[#E70866]"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
