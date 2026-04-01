import { useI18n, Lang } from "@/contexts/I18nContext";
import { Search, Home, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface AdminTopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const langLabels: Record<Lang, string> = { fr: "FR", nl: "NL", de: "DE" };

const segmentLabels: Record<string, string> = {
  admin: "Dashboard",
  vendeurs: "Vendeurs",
  onboarding: "Onboarding",
  produits: "Produits",
  categories: "Catégories",
  marques: "Marques",
  "schemas-pim": "Schémas PIM",
  commandes: "Commandes",
  litiges: "Litiges",
  finances: "Finances",
  "veille-prix": "Veille prix",
  leads: "Leads & Affiliation",
  analytics: "Analytics",
  reglementaire: "Réglementaire",
  "import-export": "Import / Export",
  crm: "CRM",
  cms: "CMS",
  logistique: "Logistique",
  equipe: "Équipe & Rôles",
  parametres: "Paramètres",
  logs: "Logs",
};

const AdminTopBar = ({ title, subtitle, actions }: AdminTopBarProps) => {
  const { lang, setLang } = useI18n();
  const location = useLocation();

  // Build breadcrumb from pathname: /admin/vendeurs/123 → [Dashboard, Vendeurs, 123]
  const pathParts = location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  // pathParts = ["admin", "vendeurs", "123"]
  const crumbs: { label: string; path: string }[] = [
    { label: "Dashboard", path: "/admin" },
  ];
  for (let i = 1; i < pathParts.length; i++) {
    const segment = pathParts[i];
    const path = "/" + pathParts.slice(0, i + 1).join("/");
    const label = segmentLabels[segment] || decodeURIComponent(segment);
    crumbs.push({ label, path });
  }

  return (
    <header className="mb-6">
      {/* Breadcrumbs */}
      {crumbs.length > 1 && (
        <nav className="flex items-center gap-1.5 mb-3">
          {crumbs.map((crumb, i) => (
            <div key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} style={{ color: "#8B95A5" }} />}
              {i === crumbs.length - 1 ? (
                <span className="text-[12px] font-medium" style={{ color: "#1D2530" }}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="text-[12px] hover:underline"
                  style={{ color: "#8B95A5" }}
                >
                  {i === 0 ? (
                    <span className="flex items-center gap-1">
                      <Home size={12} />
                      {crumb.label}
                    </span>
                  ) : (
                    crumb.label
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1D2530" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px]"
            style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
          >
            <Search size={14} style={{ color: "#8B95A5" }} />
            <span style={{ color: "#8B95A5" }}>Rechercher...</span>
          </div>
          <div
            className="flex rounded-md overflow-hidden"
            style={{ border: "1px solid #E2E8F0" }}
          >
            {(Object.keys(langLabels) as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                style={{
                  backgroundColor: lang === l ? "#1B5BDA" : "#fff",
                  color: lang === l ? "#fff" : "#616B7C",
                }}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminTopBar;
