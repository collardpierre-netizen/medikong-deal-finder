import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
  const hideBreadcrumbs = segments.length === 0 || segments[0] === "admin" || segments[0] === "produit";

  // Fetch vendor display name when on /vendeur/:slug
  const vendorSlug = !hideBreadcrumbs && segments[0] === "vendeur" && segments[1] ? segments[1] : null;
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
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
    retry: false,
  });

  // Fetch localized category name when on /categorie/:slug or /catalogue/:slug
  // Sans cela, le breadcrumb capitalise mécaniquement le slug ("Mk Otc Medicaments").
  const categorySlug =
    !hideBreadcrumbs &&
    (segments[0] === "categorie" || segments[0] === "catalogue") &&
    segments[1]
      ? segments[1]
      : null;
  const { data: categoryRow, isPending: isCategoryPending } = useQuery({
    queryKey: ["breadcrumb-category", categorySlug],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("name, name_fr, name_nl, name_en")
        .eq("slug", categorySlug!)
        .maybeSingle();
      return data;
    },
    enabled: !!categorySlug,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const categoryLabel = categoryRow
    ? (categoryRow.name_fr || categoryRow.name_en || categoryRow.name || "")
        .replace(/^MK\s*·\s*/i, "")
        .trim()
    : null;
  // Skeleton only on the true first fetch (no cached/placeholder data yet);
  // when navigating between categories, keepPreviousData provides a label
  // immediately so we never flash a skeleton.
  const categoryLabelPending = !!categorySlug && !categoryRow && isCategoryPending;
  const vendorLabelPending = !!vendorSlug && !vendorLabel;

  // Don't show on homepage
  if (hideBreadcrumbs) return null;

  const crumbs = segments.map((seg, i) => {
    const rawPath = "/" + segments.slice(0, i + 1).join("/");
    const path = parentRoutes[seg] && i < segments.length - 1 ? parentRoutes[seg] : rawPath;
    const isLast = i === segments.length - 1;
    const prevSeg = i > 0 ? segments[i - 1] : "";

    let label = routeLabels[seg];
    let pending = false;
    if (!label) {
      // For vendor slug, use the fetched public name
      if (prevSeg === "vendeur" && vendorLabel) {
        label = vendorLabel;
      } else if (prevSeg === "vendeur" && vendorLabelPending) {
        label = "";
        pending = true;
      } else if ((prevSeg === "categorie" || prevSeg === "catalogue") && categoryLabel) {
        label = categoryLabel;
      } else if ((prevSeg === "categorie" || prevSeg === "catalogue") && categoryLabelPending) {
        label = "";
        pending = true;
      } else {
        const decoded = decodeURIComponent(seg).replace(/-/g, " ");
        label = decoded.replace(/qogita\s*/gi, "").trim();
        if (!label) label = prevSeg === "vendeur" ? "Fournisseur" : "–";
        label = label.replace(/^\w/, (c) => c.toUpperCase());
      }
    }

    return { path, label, isLast, pending };
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
          <li key={crumb.path} className="inline-flex items-center gap-1.5 leading-4">
            <ChevronRight size={12} className="text-mk-ter" />
            {crumb.pending ? (
              // Largeur/hauteur fixes alignées sur le line-height du texte
              // (12px font + leading-4 = 16px) pour éviter tout reflow
              // quand le libellé réel (catégorie ou vendeur) prend le relais.
              <span
                aria-label="Chargement"
                aria-busy="true"
                className="inline-block h-4 w-32 rounded-sm bg-muted animate-pulse align-middle"
              />
            ) : crumb.isLast ? (
              <span className="inline-block min-h-4 font-semibold text-mk-navy align-middle">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="inline-block min-h-4 text-mk-sec hover:text-mk-blue transition-colors align-middle"
              >
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
