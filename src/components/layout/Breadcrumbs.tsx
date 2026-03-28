import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Helmet } from "react-helmet-async";

const routeLabels: Record<string, string> = {
  recherche: "Recherche",
  produit: "Produit",
  marques: "Marques",
  marque: "Marque",
  fabricant: "Fabricant",
  panier: "Panier",
  compte: "Mon compte",
  checkout: "Commande",
  confirmation: "Confirmation",
  commande: "Commande",
  connexion: "Connexion",
  inscription: "Inscription",
  categorie: "Catégorie",
  promotions: "Promotions",
  "seller-onboarding": "Devenir vendeur",
  professionnels: "Professionnels",
  sourcing: "Sourcing",
  categories: "Catégories",
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Don't show on homepage
  if (segments.length === 0) return null;
  // Don't show on admin pages (they have their own navigation)
  if (segments[0] === "admin") return null;

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    const label = routeLabels[seg] || decodeURIComponent(seg).replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

    return { path, label, isLast };
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://medikong-deal-finder.lovable.app/" },
      ...crumbs.map((c, i) => ({
        "@type": "ListItem",
        "position": i + 2,
        "name": c.label,
        "item": `https://medikong-deal-finder.lovable.app${c.path}`
      }))
    ]
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>
      <nav aria-label="Fil d'Ariane" className="mk-container py-3">
      <ol className="flex items-center gap-1.5 text-[12px] flex-wrap">
        <li className="inline-flex items-center">
          <Link to="/" className="inline-flex items-center gap-1 text-mk-sec hover:text-mk-blue transition-colors">
            <Home size={13} />
            <span>Accueil</span>
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.path} className="inline-flex items-center gap-1.5">
            <ChevronRight size={12} className="text-mk-ter" />
            {crumb.isLast ? (
              <span className="font-semibold text-mk-navy">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="text-mk-sec hover:text-mk-blue transition-colors">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      </nav>
    </>
  );
}
