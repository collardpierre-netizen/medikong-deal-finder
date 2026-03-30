import type { FaqItem } from "@/data/entreprise-data";
import { ShoppingCart, Package, UserCircle, Store, ShieldCheck, Lightbulb, Rocket, FileText, ShieldAlert, BookOpen } from "lucide-react";

export interface ProcessStep {
  number: number;
  title: string;
  description: string;
  tags?: string[];
}

export interface ComparisonRow {
  criteria: string;
  medikong: string;
  medikongHighlight?: boolean;
  traditional: string;
}

export interface PricingCardData {
  title: string;
  price: string;
  priceSub: string;
  features: string[];
  cta: { label: string; variant: "navy" | "pink" };
  featured?: boolean;
}

export interface CommissionTierData {
  icon: string;
  name: string;
  rate: string;
  volumeRange: string;
  features: string[];
  highlighted?: boolean;
}

export interface TestimonialData {
  quote: string;
  authorName: string;
  authorRole: string;
  authorInitials: string;
}

export interface HelpCategoryData {
  icon: React.ElementType;
  title: string;
  description: string;
  articleCount: number;
  articles?: { label: string; href: string }[];
}

export const verificationSteps: ProcessStep[] = [
  { number: 1, title: "Vérification d'identité", description: "Chaque fournisseur soumet ses documents officiels : numéro BCE, TVA intracommunautaire, licence de distribution et assurance RC professionnelle.", tags: ["BCE", "TVA", "Licence distribution"] },
  { number: 2, title: "Audit de conformité", description: "Notre équipe vérifie la conformité réglementaire : marquage CE des produits, notification AFMPS, traçabilité des lots et respect des bonnes pratiques de distribution (GDP).", tags: ["Marquage CE", "AFMPS", "GDP"] },
  { number: 3, title: "Évaluation qualité", description: "Nous analysons la qualité de service : délais de livraison, taux de retour, satisfaction client et réactivité du service après-vente.", tags: ["Délais", "SAV", "Satisfaction"] },
  { number: 4, title: "Monitoring continu", description: "Les fournisseurs sont réévalués en continu. Notre algorithme interne analyse les performances et déclenche des alertes en cas de baisse de qualité.", tags: ["Score interne", "Alertes", "Réévaluation"] },
];

export const comparisonRows: ComparisonRow[] = [
  { criteria: "Vérification fournisseurs", medikong: "✓ Audit BCE + TVA + licence", medikongHighlight: true, traditional: "—" },
  { criteria: "Conformité CE / AFMPS", medikong: "✓ Vérifié automatiquement", medikongHighlight: true, traditional: "Manuel, non garanti" },
  { criteria: "Traçabilité des lots", medikong: "✓ Intégrée à la commande", medikongHighlight: true, traditional: "Papier / Excel" },
  { criteria: "Protection acheteur", medikong: "✓ Garantie 14 jours", medikongHighlight: true, traditional: "—" },
  { criteria: "Comparaison des prix", medikong: "✓ Temps réel, multi-fournisseurs", medikongHighlight: true, traditional: "Catalogue par catalogue" },
  { criteria: "Paiement différé", medikong: "✓ 30/60 jours via Mondu", medikongHighlight: true, traditional: "Négociation individuelle" },
];

export const qualityFaqItems: FaqItem[] = [
  { question: "Que se passe-t-il si je reçois un produit non conforme ?", answer: "Contactez notre support dans les 14 jours suivant la réception. Nous organisons le retour et le remboursement intégral." },
  { question: "Comment vérifiez-vous le marquage CE ?", answer: "Chaque produit référencé est vérifié via les bases de données EUDAMED et les certificats fournis par les fabricants." },
  { question: "Les produits sont-ils assurés pendant le transport ?", answer: "Oui, tous les envois sont couverts par une assurance transport incluse dans les frais de livraison." },
  { question: "Comment retourner un produit ?", answer: "Connectez-vous à votre espace client et rendez-vous dans \"Mes commandes\". Un bon de retour prépayé vous sera envoyé par email. Le remboursement est effectué dès réception du produit retourné." },
];

export const orderSteps = [
  { number: 1, title: "Créez votre compte", description: "Inscription gratuite en 2 minutes. Renseignez votre numéro BCE et TVA pour accéder aux prix professionnels." },
  { number: 2, title: "Recherchez & comparez", description: "Parcourez plus de 12 500 références. Comparez les prix entre fournisseurs directs et offres externes en un coup d'œil." },
  { number: 3, title: "Ajoutez au panier", description: "Sélectionnez vos produits, ajustez les quantités. Le MOV est affiché pour chaque fournisseur." },
  { number: 4, title: "Validez & payez", description: "Choisissez votre mode de paiement : carte bancaire, virement SEPA ou paiement différé 30/60 jours via Mondu." },
];

export const pricingCards: PricingCardData[] = [
  {
    title: "Gratuit",
    price: "0 €",
    priceSub: "pour toujours",
    features: ["Accès au catalogue complet", "Comparaison des prix", "Commandes illimitées", "Support par email"],
    cta: { label: "Créer un compte →", variant: "navy" },
  },
  {
    title: "Pro",
    price: "49 €",
    priceSub: "/ mois HT",
    features: ["Tout du plan Gratuit", "Alertes prix en temps réel", "Accès prioritaire aux promotions", "Account manager dédié", "API catalogue"],
    cta: { label: "Essai gratuit 30j →", variant: "pink" },
    featured: true,
  },
  {
    title: "Enterprise",
    price: "Sur mesure",
    priceSub: "contactez-nous",
    features: ["Tout du plan Pro", "Intégration ERP/PIM", "Tarifs négociés par volume", "SLA garanti", "Formation sur site"],
    cta: { label: "Contactez-nous →", variant: "navy" },
  },
];

export const logisticsFaqItems: FaqItem[] = [
  { question: "Quels sont les délais de livraison ?", answer: "La plupart des commandes sont expédiées sous 24-48h. La livraison standard prend 2-5 jours ouvrables en Belgique." },
  { question: "Livrez-vous à l'international ?", answer: "Oui, nous livrons dans toute l'Union Européenne. Les frais et délais varient selon la destination." },
  { question: "Comment suivre ma commande ?", answer: "Un numéro de suivi vous est envoyé par email dès l'expédition. Vous pouvez aussi suivre votre commande depuis votre espace client." },
  { question: "Que faire en cas de colis endommagé ?", answer: "Refusez le colis et contactez notre support immédiatement. Nous organisons un renvoi sous 24h." },
];

export const commissionTiers: CommissionTierData[] = [
  { icon: "🥉", name: "Starter", rate: "20%", volumeRange: "0 – 10 000 €/mois", features: ["Référencement standard", "Accès marketplace", "Dashboard vendeur", "Support par email", "Paiement J+30"], highlighted: false },
  { icon: "🥈", name: "Pro", rate: "15%", volumeRange: "10 000 – 50 000 €/mois", features: ["Boost référencement (+15%)", "Priorité Buy Box", "Badge \"Vendeur vérifié\"", "Account manager dédié", "Support prioritaire", "Paiement J+20"], highlighted: true },
  { icon: "🥇", name: "Expert", rate: "10%", volumeRange: "50 000 €+/mois", features: ["Référencement premium (top positions)", "Badge \"Top Vendeur\"", "Promotions sponsorisées incluses", "API dédiée", "Support VIP", "Paiement J+15"], highlighted: false },
];

export const testimonials: TestimonialData[] = [
  { quote: "MediKong nous a permis de centraliser nos achats de consommables avec une transparence totale sur les prix. Un vrai gain de temps au quotidien.", authorName: "Dr. Sophie Claessens", authorRole: "Directrice médicale — Clinique Saint-Luc, Bruxelles", authorInitials: "SC" },
  { quote: "En tant que pharmacien indépendant, je n'avais pas accès aux mêmes prix que les grandes chaînes. MediKong a changé la donne.", authorName: "Philippe Lemaire", authorRole: "Pharmacien titulaire — Pharmacie du Parc, Liège", authorInitials: "PL" },
  { quote: "La plateforme est intuitive et le support réactif. Nous avons réduit nos coûts d'approvisionnement de 18% en 6 mois.", authorName: "Marie Vandenberghe", authorRole: "Responsable achats — CHU de Gand", authorInitials: "MV" },
  { quote: "Le paiement différé via Mondu nous permet de gérer notre trésorerie sereinement. C'est un vrai plus pour une jeune structure.", authorName: "Thomas Dubois", authorRole: "CEO — MedSupply Belgium", authorInitials: "TD" },
  { quote: "Nous avons multiplié notre chiffre d'affaires par 3 depuis notre inscription comme vendeur sur MediKong.", authorName: "Isabelle Peeters", authorRole: "Directrice commerciale — Pharma Distri NV", authorInitials: "IP" },
  { quote: "La vérification des fournisseurs nous rassure. Nous savons que chaque produit commandé est conforme et traçable.", authorName: "Marc Janssen", authorRole: "Kinésithérapeute — Cabinet indépendant, Namur", authorInitials: "MJ" },
];

export const contactSubjects = [
  "Question sur une commande",
  "Problème de livraison",
  "Retour / Remboursement",
  "Devenir vendeur",
  "Partenariat / Presse",
  "Investissement",
  "Question technique",
  "Autre",
];

export function getHelpCategories(t: (key: string) => string): HelpCategoryData[] {
  return [
    { icon: Rocket, title: t("helpCenter.categories.gettingStarted.title"), description: t("helpCenter.categories.gettingStarted.description"), articleCount: 5, articles: [
      { label: t("helpCenter.categories.gettingStarted.a1"), href: "/centre-aide/creer-compte-professionnel" },
      { label: t("helpCenter.categories.gettingStarted.a2"), href: "/centre-aide/premiere-commande" },
      { label: t("helpCenter.categories.gettingStarted.a3"), href: "/centre-aide/naviguer-catalogue" },
    ]},
    { icon: ShoppingCart, title: t("helpCenter.categories.orders.title"), description: t("helpCenter.categories.orders.description"), articleCount: 12, articles: [
      { label: t("helpCenter.categories.orders.a1"), href: "/centre-aide/passer-commande" },
      { label: t("helpCenter.categories.orders.a2"), href: "/centre-aide/moyens-paiement" },
      { label: t("helpCenter.categories.orders.a3"), href: "/paiement-differe" },
    ]},
    { icon: Package, title: t("helpCenter.categories.delivery.title"), description: t("helpCenter.categories.delivery.description"), articleCount: 8, articles: [
      { label: t("helpCenter.categories.delivery.a1"), href: "/centre-aide/suivre-colis" },
      { label: t("helpCenter.categories.delivery.a2"), href: "/logistique" },
      { label: t("helpCenter.categories.delivery.a3"), href: "/centre-aide/retourner-produit" },
    ]},
    { icon: FileText, title: t("helpCenter.categories.vat.title"), description: t("helpCenter.categories.vat.description"), articleCount: 4, articles: [
      { label: t("helpCenter.categories.vat.a1"), href: "/centre-aide/tva-medikong" },
      { label: t("helpCenter.categories.vat.a2"), href: "/centre-aide/telecharger-factures" },
      { label: t("helpCenter.categories.vat.a3"), href: "/centre-aide/modifier-facturation" },
    ]},
    { icon: ShieldAlert, title: t("helpCenter.categories.claims.title"), description: t("helpCenter.categories.claims.description"), articleCount: 6, articles: [
      { label: t("helpCenter.categories.claims.a1"), href: "/centre-aide/signaler-probleme" },
      { label: t("helpCenter.categories.claims.a2"), href: "/centre-aide/delai-remboursement" },
      { label: t("helpCenter.categories.claims.a3"), href: "/centre-aide/suivre-reclamation" },
    ]},
    { icon: UserCircle, title: t("helpCenter.categories.account.title"), description: t("helpCenter.categories.account.description"), articleCount: 6, articles: [
      { label: t("helpCenter.categories.account.a1"), href: "/centre-aide/ajouter-utilisateur" },
      { label: t("helpCenter.categories.account.a2"), href: "/centre-aide/securiser-compte" },
      { label: t("helpCenter.categories.account.a3"), href: "/mot-de-passe-oublie" },
    ]},
    { icon: Store, title: t("helpCenter.categories.sellers.title"), description: t("helpCenter.categories.sellers.description"), articleCount: 10, articles: [
      { label: t("helpCenter.categories.sellers.a1"), href: "/devenir-vendeur" },
      { label: t("helpCenter.categories.sellers.a2"), href: "/centre-aide/gerer-catalogue" },
      { label: t("helpCenter.categories.sellers.a3"), href: "/entreprise/comment-ca-marche" },
    ]},
    { icon: ShieldCheck, title: t("helpCenter.categories.quality.title"), description: t("helpCenter.categories.quality.description"), articleCount: 5, articles: [
      { label: t("helpCenter.categories.quality.a1"), href: "/centre-aide/marquage-ce" },
      { label: t("helpCenter.categories.quality.a2"), href: "/verification-fournisseurs" },
      { label: t("helpCenter.categories.quality.a3"), href: "/qualite-garantie" },
    ]},
    { icon: Lightbulb, title: t("helpCenter.categories.features.title"), description: t("helpCenter.categories.features.description"), articleCount: 7, articles: [
      { label: t("helpCenter.categories.features.a1"), href: "/centre-aide/comparaison-prix" },
      { label: t("helpCenter.categories.features.a2"), href: "/centre-aide/configurer-alertes" },
      { label: t("helpCenter.categories.features.a3"), href: "/centre-aide/acceder-api" },
    ]},
    { icon: BookOpen, title: t("helpCenter.categories.resources.title"), description: t("helpCenter.categories.resources.description"), articleCount: 4, articles: [
      { label: t("helpCenter.categories.resources.a1"), href: "/centre-aide/guide-achat-pharmacies" },
      { label: t("helpCenter.categories.resources.a2"), href: "/centre-aide/bonnes-pratiques-b2b" },
    ]},
  ];
}

export function getHelpFaqItems(t: (key: string) => string): FaqItem[] {
  return [
    { question: t("helpCenter.faq.q1"), answer: t("helpCenter.faq.a1") },
    { question: t("helpCenter.faq.q2"), answer: t("helpCenter.faq.a2") },
    { question: t("helpCenter.faq.q3"), answer: t("helpCenter.faq.a3") },
    { question: t("helpCenter.faq.q4"), answer: t("helpCenter.faq.a4") },
    { question: t("helpCenter.faq.q5"), answer: t("helpCenter.faq.a5") },
    { question: t("helpCenter.faq.q6"), answer: t("helpCenter.faq.a6") },
    { question: t("helpCenter.faq.q7"), answer: t("helpCenter.faq.a7") },
    { question: t("helpCenter.faq.q8"), answer: t("helpCenter.faq.a8") },
  ];
}

// Keep backward-compatible static exports for non-i18n usage
export const helpCategories: HelpCategoryData[] = [
  { icon: Rocket, title: "Premiers pas", description: "Créer votre compte, passer votre première commande et naviguer le catalogue.", articleCount: 5, articles: [
    { label: "Comment créer un compte professionnel ?", href: "/centre-aide/creer-compte-professionnel" },
    { label: "Comment passer ma première commande ?", href: "/centre-aide/premiere-commande" },
    { label: "Comment naviguer le catalogue ?", href: "/centre-aide/naviguer-catalogue" },
  ]},
  { icon: ShoppingCart, title: "Commandes & Paiements", description: "Passer commande, moyens de paiement, factures et paiement différé.", articleCount: 12, articles: [
    { label: "Comment passer une commande ?", href: "/centre-aide/passer-commande" },
    { label: "Quels sont les moyens de paiement acceptés ?", href: "/centre-aide/moyens-paiement" },
    { label: "Comment utiliser le paiement différé ?", href: "/paiement-differe" },
  ]},
  { icon: Package, title: "Livraison & Suivi", description: "Délais, suivi de colis, retours et remboursements.", articleCount: 8, articles: [
    { label: "Comment suivre mon colis ?", href: "/centre-aide/suivre-colis" },
    { label: "Quels sont les délais de livraison ?", href: "/logistique" },
    { label: "Comment retourner un produit ?", href: "/centre-aide/retourner-produit" },
  ]},
  { icon: FileText, title: "TVA & Facturation", description: "Comprendre la TVA, télécharger vos factures et gérer vos données fiscales.", articleCount: 4, articles: [
    { label: "Comment fonctionne la TVA sur MediKong ?", href: "/centre-aide/tva-medikong" },
    { label: "Où télécharger mes factures ?", href: "/centre-aide/telecharger-factures" },
    { label: "Comment modifier mes données de facturation ?", href: "/centre-aide/modifier-facturation" },
  ]},
  { icon: ShieldAlert, title: "Réclamations & Remboursements", description: "Signaler un problème, suivre une réclamation et obtenir un remboursement.", articleCount: 6, articles: [
    { label: "Comment signaler un problème avec ma commande ?", href: "/centre-aide/signaler-probleme" },
    { label: "Quel est le délai de remboursement ?", href: "/centre-aide/delai-remboursement" },
    { label: "Comment suivre ma réclamation ?", href: "/centre-aide/suivre-reclamation" },
  ]},
  { icon: UserCircle, title: "Mon compte", description: "Inscription, paramètres, gestion des utilisateurs et sécurité.", articleCount: 6, articles: [
    { label: "Comment ajouter un utilisateur ?", href: "/centre-aide/ajouter-utilisateur" },
    { label: "Comment sécuriser mon compte ?", href: "/centre-aide/securiser-compte" },
    { label: "J'ai oublié mon mot de passe", href: "/mot-de-passe-oublie" },
  ]},
  { icon: Store, title: "Vendeurs", description: "Devenir vendeur, catalogue, commissions et paiements.", articleCount: 10, articles: [
    { label: "Comment devenir vendeur sur MediKong ?", href: "/devenir-vendeur" },
    { label: "Comment gérer mon catalogue ?", href: "/centre-aide/gerer-catalogue" },
    { label: "Quelles sont les commissions ?", href: "/entreprise/comment-ca-marche" },
  ]},
  { icon: ShieldCheck, title: "Qualité & Conformité", description: "Marquage CE, AFMPS, garantie et traçabilité.", articleCount: 5, articles: [
    { label: "Qu'est-ce que le marquage CE ?", href: "/centre-aide/marquage-ce" },
    { label: "Comment vérifier la conformité AFMPS ?", href: "/verification-fournisseurs" },
    { label: "Quelle est notre politique de garantie ?", href: "/qualite-garantie" },
  ]},
  { icon: Lightbulb, title: "Fonctionnalités", description: "Recherche, comparaison des prix, alertes et API.", articleCount: 7, articles: [
    { label: "Comment utiliser la comparaison de prix ?", href: "/centre-aide/comparaison-prix" },
    { label: "Comment configurer des alertes ?", href: "/centre-aide/configurer-alertes" },
    { label: "Comment accéder à l'API ?", href: "/centre-aide/acceder-api" },
  ]},
  { icon: BookOpen, title: "Ressources & Guides", description: "Tutoriels, guides d'achat et bonnes pratiques pour les professionnels de santé.", articleCount: 4, articles: [
    { label: "Guide d'achat pour les pharmacies", href: "/centre-aide/guide-achat-pharmacies" },
    { label: "Bonnes pratiques de commande B2B", href: "/centre-aide/bonnes-pratiques-b2b" },
  ]},
];

export const helpFaqItems: FaqItem[] = [
  { question: "Comment créer un compte professionnel ?", answer: "Rendez-vous sur la page d'inscription et choisissez 'Je souhaite acheter'. Renseignez votre numéro BCE et TVA. Votre compte sera validé sous 24h." },
  { question: "Comment modifier ou annuler une commande ?", answer: "Vous pouvez modifier ou annuler une commande tant qu'elle n'a pas été expédiée. Rendez-vous dans 'Mes commandes' de votre espace client." },
  { question: "Quels sont les moyens de paiement acceptés ?", answer: "Nous acceptons Visa, Mastercard, Bancontact, virement SEPA et le paiement différé 30/60 jours via Mondu (sous conditions)." },
  { question: "Comment contacter le support ?", answer: "Envoyez un email à support@medikong.pro (réponse sous 24h) ou via le formulaire de contact. Le chat en ligne sera bientôt disponible." },
  { question: "Comment suivre ma commande ?", answer: "Un numéro de suivi vous est envoyé par email dès l'expédition. Vous pouvez aussi suivre votre commande en temps réel depuis votre espace client dans 'Mes commandes'." },
  { question: "Quels sont les délais de livraison ?", answer: "La plupart des commandes sont expédiées sous 24-48h. La livraison standard prend 2-5 jours ouvrables en Belgique, et 3-7 jours dans le reste de l'UE." },
  { question: "Comment devenir vendeur sur MediKong ?", answer: "Rendez-vous sur la page 'Devenir vendeur' et remplissez le formulaire d'inscription. Notre équipe vérifiera vos documents sous 48h." },
  { question: "Comment fonctionne la TVA sur MediKong ?", answer: "Les prix affichés sont HT. La TVA applicable est calculée automatiquement selon le pays de livraison et le type de produit (taux standard ou réduit)." },
];
