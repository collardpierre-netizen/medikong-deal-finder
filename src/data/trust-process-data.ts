import type { FaqItem } from "@/data/entreprise-data";
import { ShoppingCart, Package, UserCircle, Store, ShieldCheck, Lightbulb } from "lucide-react";

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

export const helpCategories: HelpCategoryData[] = [
  { icon: ShoppingCart, title: "Commandes & Paiements", description: "Passer commande, moyens de paiement, factures et paiement différé.", articleCount: 12 },
  { icon: Package, title: "Livraison & Retours", description: "Délais, suivi de colis, retours et remboursements.", articleCount: 8 },
  { icon: UserCircle, title: "Mon compte", description: "Inscription, paramètres, gestion des utilisateurs et sécurité.", articleCount: 6 },
  { icon: Store, title: "Vendeurs", description: "Devenir vendeur, catalogue, commissions et paiements.", articleCount: 10 },
  { icon: ShieldCheck, title: "Qualité & Conformité", description: "Marquage CE, AFMPS, garantie et traçabilité.", articleCount: 5 },
  { icon: Lightbulb, title: "Fonctionnalités", description: "Recherche, comparaison des prix, alertes et API.", articleCount: 7 },
];

export const helpFaqItems: FaqItem[] = [
  { question: "Comment créer un compte professionnel ?", answer: "Rendez-vous sur la page d'inscription et choisissez 'Je souhaite acheter'. Renseignez votre numéro BCE et TVA. Votre compte sera validé sous 24h." },
  { question: "Comment modifier ou annuler une commande ?", answer: "Vous pouvez modifier ou annuler une commande tant qu'elle n'a pas été expédiée. Rendez-vous dans 'Mes commandes' de votre espace client." },
  { question: "Quels sont les moyens de paiement acceptés ?", answer: "Nous acceptons Visa, Mastercard, Bancontact, virement SEPA et le paiement différé 30/60 jours via Mondu (sous conditions)." },
  { question: "Comment contacter le support ?", answer: "Envoyez un email à support@medikong.pro (réponse sous 24h) ou via le formulaire de contact. Le chat en ligne sera bientôt disponible." },
];
