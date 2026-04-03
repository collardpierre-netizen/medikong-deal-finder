import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getVendorPublicName } from "@/lib/vendor-display";

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
  if (segments[0] === "admin") return null;
  if (segments[0] === "produit") return null;

  // Fetch vendor display name when on /vendeur/:slug
  const vendorSlug = segments[0] === "vendeur" && segments[1] ? segments[1] : null;
  const { data: vendorLabel } = useQuery({
    queryKey: ["breadcrumb-vendor", vendorSlug],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("name, company_name, display_code, show_real_name")
        .eq("slug", vendorSlug!)
        .single();
      if (!data) return null;
      return getVendorPublicName(data);
    },
    enabled: !!vendorSlug,
    staleTime: 5 * 60 * 1000,
  });

  const crumbs = segments.map((seg, i) => {
    const rawPath = "/" + segments.slice(0, i + 1).join("/");
    const path = parentRoutes[seg] && i < segments.length - 1 ? parentRoutes[seg] : rawPath;
    const isLast = i === segments.length - 1;
    const prevSeg = i > 0 ? segments[i - 1] : "";

    let label = routeLabels[seg];
    if (!label) {
      // For vendor slug, use the fetched public name
      if (prevSeg === "vendeur" && vendorLabel) {
        label = vendorLabel;
      } else {
        const decoded = decodeURIComponent(seg).replace(/-/g, " ");
        label = decoded.replace(/qogita\s*/gi, "").trim();
        if (!label) label = prevSeg === "vendeur" ? "Fournisseur" : "–";
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
