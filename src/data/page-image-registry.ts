/** Registry of all CMS-manageable page images */
export const PAGE_IMAGE_REGISTRY: { pageKey: string; sectionKey: string; label: string }[] = [
  // Entreprise
  { pageKey: "about", sectionKey: "split-mission", label: "À propos — Notre mission" },
  { pageKey: "how-it-works", sectionKey: "hero-photo", label: "Comment ça marche — Photo hero" },
  { pageKey: "why-medikong", sectionKey: "split-comparateur", label: "Pourquoi MediKong — Comparateur" },
  { pageKey: "why-medikong", sectionKey: "split-analytics", label: "Pourquoi MediKong — Analytics" },
  { pageKey: "why-medikong", sectionKey: "split-security", label: "Pourquoi MediKong — Sécurité" },
  // Trust
  { pageKey: "become-seller", sectionKey: "split-dashboard", label: "Devenir vendeur — Dashboard" },
  { pageKey: "supplier-verification", sectionKey: "split-partners", label: "Vérification fournisseurs — Partenaires" },
  { pageKey: "quality-guarantee", sectionKey: "split-traceability", label: "Qualité garantie — Traçabilité" },
  { pageKey: "logistics", sectionKey: "split-tracking", label: "Logistique — Suivi livraison" },
  { pageKey: "buy-now-pay-later", sectionKey: "split-mondu", label: "Paiement différé — Mondu" },
];
