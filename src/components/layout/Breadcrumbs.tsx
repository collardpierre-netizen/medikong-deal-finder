import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Helmet } from "react-helmet-async";

const routeLabels: Record<string, string> = {
  recherche: "Recherche",
  produit: "Produit",
  marques: "Marques",
  marque: "Marque",
  fabricant: "Fabricant",
  fabricants: "Fabricants",
  vendeur: "Vendeur",
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
  catalogue: "Catalogue",
};

// Singular segments that should link to their plural list page
const parentRoutes: Record<string, string> = {
  marque: "/marques",
  fabricant: "/fabricants",
  categorie: "/categories",
  produit: "/catalogue",
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Don't show on homepage
  if (segments.length === 0) return null;
  // Don't show on admin pages (they have their own navigation)
  if (segments[0] === "admin") return null;
  // Don't show on product pages (they have their own breadcrumb)
  if (segments[0] === "produit") return null;

  const crumbs = segments.map((seg, i) => {
    const rawPath = "/" + segments.slice(0, i + 1).join("/");
    const path = parentRoutes[seg] && i < segments.length - 1 ? parentRoutes[seg] : rawPath;
    const isLast = i === segments.length - 1;
    // For vendor slug segments, show generic "Fournisseur [CODE]" instead of raw slug
    const prevSeg = i > 0 ? segments[i - 1] : "";
    let label = routeLabels[seg];
    if (!label) {
      const decoded = decodeURIComponent(seg).replace(/-/g, " ");
      // Sanitize any "qogita" reference from breadcrumb labels
      label = decoded.replace(/qogita\s*/gi, "").trim();
      if (!label) label = prevSeg === "vendeur" ? "Fournisseur" : "–";
      // If it's a vendor slug child, prefix with "Fournisseur"
      if (prevSeg === "vendeur" && !label.toLowerCase().startsWith("fournisseur")) {
        label = `Fournisseur ${label.replace(/^\w/, (c) => c.toUpperCase())}`;
      } else {
        label = label.replace(/^\w/, (c) => c.toUpperCase());
      }
    }

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
