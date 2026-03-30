export interface HelpArticle {
  slug: string;
  categoryKey: string;
  titleKey: string;
  sections: { headingKey: string; bodyKey: string }[];
}

// All articles with i18n keys — content lives in locale JSON files
export const helpArticles: HelpArticle[] = [
  // Premiers pas
  { slug: "creer-compte-professionnel", categoryKey: "gettingStarted", titleKey: "helpArticles.creerCompte.title", sections: [
    { headingKey: "helpArticles.creerCompte.s1h", bodyKey: "helpArticles.creerCompte.s1" },
    { headingKey: "helpArticles.creerCompte.s2h", bodyKey: "helpArticles.creerCompte.s2" },
    { headingKey: "helpArticles.creerCompte.s3h", bodyKey: "helpArticles.creerCompte.s3" },
  ]},
  { slug: "premiere-commande", categoryKey: "gettingStarted", titleKey: "helpArticles.premiereCommande.title", sections: [
    { headingKey: "helpArticles.premiereCommande.s1h", bodyKey: "helpArticles.premiereCommande.s1" },
    { headingKey: "helpArticles.premiereCommande.s2h", bodyKey: "helpArticles.premiereCommande.s2" },
    { headingKey: "helpArticles.premiereCommande.s3h", bodyKey: "helpArticles.premiereCommande.s3" },
  ]},
  { slug: "naviguer-catalogue", categoryKey: "gettingStarted", titleKey: "helpArticles.naviguerCatalogue.title", sections: [
    { headingKey: "helpArticles.naviguerCatalogue.s1h", bodyKey: "helpArticles.naviguerCatalogue.s1" },
    { headingKey: "helpArticles.naviguerCatalogue.s2h", bodyKey: "helpArticles.naviguerCatalogue.s2" },
  ]},
  // Commandes & Paiements
  { slug: "passer-commande", categoryKey: "orders", titleKey: "helpArticles.passerCommande.title", sections: [
    { headingKey: "helpArticles.passerCommande.s1h", bodyKey: "helpArticles.passerCommande.s1" },
    { headingKey: "helpArticles.passerCommande.s2h", bodyKey: "helpArticles.passerCommande.s2" },
    { headingKey: "helpArticles.passerCommande.s3h", bodyKey: "helpArticles.passerCommande.s3" },
  ]},
  { slug: "moyens-paiement", categoryKey: "orders", titleKey: "helpArticles.moyensPaiement.title", sections: [
    { headingKey: "helpArticles.moyensPaiement.s1h", bodyKey: "helpArticles.moyensPaiement.s1" },
    { headingKey: "helpArticles.moyensPaiement.s2h", bodyKey: "helpArticles.moyensPaiement.s2" },
  ]},
  // Livraison & Suivi
  { slug: "suivre-colis", categoryKey: "delivery", titleKey: "helpArticles.suivreColis.title", sections: [
    { headingKey: "helpArticles.suivreColis.s1h", bodyKey: "helpArticles.suivreColis.s1" },
    { headingKey: "helpArticles.suivreColis.s2h", bodyKey: "helpArticles.suivreColis.s2" },
  ]},
  { slug: "retourner-produit", categoryKey: "delivery", titleKey: "helpArticles.retournerProduit.title", sections: [
    { headingKey: "helpArticles.retournerProduit.s1h", bodyKey: "helpArticles.retournerProduit.s1" },
    { headingKey: "helpArticles.retournerProduit.s2h", bodyKey: "helpArticles.retournerProduit.s2" },
    { headingKey: "helpArticles.retournerProduit.s3h", bodyKey: "helpArticles.retournerProduit.s3" },
  ]},
  // TVA & Facturation
  { slug: "tva-medikong", categoryKey: "vat", titleKey: "helpArticles.tvaMedikong.title", sections: [
    { headingKey: "helpArticles.tvaMedikong.s1h", bodyKey: "helpArticles.tvaMedikong.s1" },
    { headingKey: "helpArticles.tvaMedikong.s2h", bodyKey: "helpArticles.tvaMedikong.s2" },
  ]},
  { slug: "telecharger-factures", categoryKey: "vat", titleKey: "helpArticles.telechargerFactures.title", sections: [
    { headingKey: "helpArticles.telechargerFactures.s1h", bodyKey: "helpArticles.telechargerFactures.s1" },
    { headingKey: "helpArticles.telechargerFactures.s2h", bodyKey: "helpArticles.telechargerFactures.s2" },
  ]},
  { slug: "modifier-facturation", categoryKey: "vat", titleKey: "helpArticles.modifierFacturation.title", sections: [
    { headingKey: "helpArticles.modifierFacturation.s1h", bodyKey: "helpArticles.modifierFacturation.s1" },
  ]},
  // Réclamations
  { slug: "signaler-probleme", categoryKey: "claims", titleKey: "helpArticles.signalerProbleme.title", sections: [
    { headingKey: "helpArticles.signalerProbleme.s1h", bodyKey: "helpArticles.signalerProbleme.s1" },
    { headingKey: "helpArticles.signalerProbleme.s2h", bodyKey: "helpArticles.signalerProbleme.s2" },
  ]},
  { slug: "delai-remboursement", categoryKey: "claims", titleKey: "helpArticles.delaiRemboursement.title", sections: [
    { headingKey: "helpArticles.delaiRemboursement.s1h", bodyKey: "helpArticles.delaiRemboursement.s1" },
  ]},
  { slug: "suivre-reclamation", categoryKey: "claims", titleKey: "helpArticles.suivreReclamation.title", sections: [
    { headingKey: "helpArticles.suivreReclamation.s1h", bodyKey: "helpArticles.suivreReclamation.s1" },
  ]},
  // Mon compte
  { slug: "ajouter-utilisateur", categoryKey: "account", titleKey: "helpArticles.ajouterUtilisateur.title", sections: [
    { headingKey: "helpArticles.ajouterUtilisateur.s1h", bodyKey: "helpArticles.ajouterUtilisateur.s1" },
  ]},
  { slug: "securiser-compte", categoryKey: "account", titleKey: "helpArticles.securiserCompte.title", sections: [
    { headingKey: "helpArticles.securiserCompte.s1h", bodyKey: "helpArticles.securiserCompte.s1" },
    { headingKey: "helpArticles.securiserCompte.s2h", bodyKey: "helpArticles.securiserCompte.s2" },
  ]},
  // Vendeurs
  { slug: "gerer-catalogue", categoryKey: "sellers", titleKey: "helpArticles.gererCatalogue.title", sections: [
    { headingKey: "helpArticles.gererCatalogue.s1h", bodyKey: "helpArticles.gererCatalogue.s1" },
    { headingKey: "helpArticles.gererCatalogue.s2h", bodyKey: "helpArticles.gererCatalogue.s2" },
  ]},
  // Qualité
  { slug: "marquage-ce", categoryKey: "quality", titleKey: "helpArticles.marquageCe.title", sections: [
    { headingKey: "helpArticles.marquageCe.s1h", bodyKey: "helpArticles.marquageCe.s1" },
    { headingKey: "helpArticles.marquageCe.s2h", bodyKey: "helpArticles.marquageCe.s2" },
  ]},
  // Fonctionnalités
  { slug: "comparaison-prix", categoryKey: "features", titleKey: "helpArticles.comparaisonPrix.title", sections: [
    { headingKey: "helpArticles.comparaisonPrix.s1h", bodyKey: "helpArticles.comparaisonPrix.s1" },
    { headingKey: "helpArticles.comparaisonPrix.s2h", bodyKey: "helpArticles.comparaisonPrix.s2" },
  ]},
  { slug: "configurer-alertes", categoryKey: "features", titleKey: "helpArticles.configurerAlertes.title", sections: [
    { headingKey: "helpArticles.configurerAlertes.s1h", bodyKey: "helpArticles.configurerAlertes.s1" },
  ]},
  { slug: "acceder-api", categoryKey: "features", titleKey: "helpArticles.accederApi.title", sections: [
    { headingKey: "helpArticles.accederApi.s1h", bodyKey: "helpArticles.accederApi.s1" },
    { headingKey: "helpArticles.accederApi.s2h", bodyKey: "helpArticles.accederApi.s2" },
  ]},
  // Ressources
  { slug: "guide-achat-pharmacies", categoryKey: "resources", titleKey: "helpArticles.guideAchat.title", sections: [
    { headingKey: "helpArticles.guideAchat.s1h", bodyKey: "helpArticles.guideAchat.s1" },
    { headingKey: "helpArticles.guideAchat.s2h", bodyKey: "helpArticles.guideAchat.s2" },
  ]},
  { slug: "bonnes-pratiques-b2b", categoryKey: "resources", titleKey: "helpArticles.bonnesPratiques.title", sections: [
    { headingKey: "helpArticles.bonnesPratiques.s1h", bodyKey: "helpArticles.bonnesPratiques.s1" },
    { headingKey: "helpArticles.bonnesPratiques.s2h", bodyKey: "helpArticles.bonnesPratiques.s2" },
  ]},
];

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return helpArticles.find((a) => a.slug === slug);
}

export function getArticlesByCategory(categoryKey: string): HelpArticle[] {
  return helpArticles.filter((a) => a.categoryKey === categoryKey);
}
