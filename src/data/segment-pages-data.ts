import pharmacieHero from "@/assets/segment-pharmacie-hero.jpg";
import ehpadHero from "@/assets/segment-ehpad-hero.jpg";
import grossisteHero from "@/assets/segment-grossiste-hero.jpg";
import hopitalHero from "@/assets/segment-hopital-hero.jpg";
import cabinetHero from "@/assets/segment-cabinet-hero.jpg";
import dentisteHero from "@/assets/segment-dentiste-hero.jpg";
import veterinaireHero from "@/assets/segment-veterinaire-hero.jpg";

export interface SegmentStat {
  value: string;
  label: string;
  icon?: string;
}

export interface SegmentFeature {
  title: string;
  description: string;
}

export interface SegmentStep {
  title: string;
  description: string;
}

export interface SegmentFaq {
  question: string;
  answer: string;
}

export interface SegmentCategory {
  title: string;
  description: string;
}

export interface SegmentComparison {
  title: string;
  description: string;
  quote: string;
}

export interface SegmentPageData {
  slug: string;
  badge: string;
  badgeEmoji: string;
  title: string;
  titleHighlight: string;
  subtitle: string;
  heroImage: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  trustLine: string;
  stats: SegmentStat[];
  painTitle: string;
  painSubtitle: string;
  painPoints: { emoji: string; text: string }[];
  featuresTitle: string;
  features: SegmentFeature[];
  processTitle: string;
  processSubtitle: string;
  steps: SegmentStep[];
  comparisons?: SegmentComparison[];
  categoriesTitle: string;
  categories: SegmentCategory[];
  faq: SegmentFaq[];
  contactTitle: string;
  contactSubtitle: string;
  contactCta: string;
  seoTitle: string;
  seoDescription: string;
}

export const segmentPages: Record<string, SegmentPageData> = {
  pharmacies: {
    slug: "pharmacies",
    badge: "Pour les pharmacies d'officine",
    badgeEmoji: "💊",
    title: "Vous économisez en moyenne",
    titleHighlight: "23%",
    subtitle: "sur vos achats de matériel médical. Sans changer vos habitudes de commande. Nos pharmaciens partenaires économisent en moyenne 2 760€ par an.",
    heroImage: pharmacieHero,
    ctaPrimary: { label: "Créer mon compte gratuit", href: "/onboarding" },
    ctaSecondary: { label: "Calculer mes économies", href: "/contact" },
    trustLine: "100% gratuit · Pas d'engagement · Accès immédiat au catalogue",
    stats: [
      { value: "2.760€", label: "Économie moyenne / an" },
      { value: "48-72h", label: "Livraison en Belgique" },
      { value: "0€", label: "Coût de la plateforme" },
      { value: "500+", label: "Pharmacies partenaires" },
    ],
    painTitle: "Combien vous coûte de ne pas comparer ?",
    painSubtitle: "Sur un panier annuel moyen de 12 000€ de matériel médical, nutrition et incontinence, la différence est concrète.",
    painPoints: [
      { emoji: "💰", text: "Les mêmes références ont des écarts de prix significatifs selon le fournisseur." },
      { emoji: "⏰", text: "Vous perdez du temps à contacter chaque labo séparément pour comparer." },
      { emoji: "📦", text: "Votre grossiste n'est pas toujours le moins cher sur le matériel médical." },
    ],
    featuresTitle: "Ça ne remplace pas votre grossiste. Ça vient en complément.",
    features: [
      { title: "Une seule interface", description: "Comparez les prix de plusieurs fournisseurs en un coup d'œil." },
      { title: "Commandez en quelques clics", description: "Aussi simple que sur Amazon — sans la complexité." },
      { title: "Livré en 48-72h", description: "Facture claire directement dans votre compte." },
      { title: "Prix transparents", description: "Vous voyez les prix de plusieurs fournisseurs côte à côte." },
      { title: "Pas de commission cachée", description: "Pas d'abonnement, pas de frais mensuels. Le prix affiché est le prix que vous payez." },
      { title: "Fournisseurs vérifiés", description: "Tous nos vendeurs sont des professionnels agréés. Traçabilité complète." },
    ],
    processTitle: "Comment ça marche ?",
    processSubtitle: "3 étapes simples",
    steps: [
      { title: "Créez votre compte", description: "Inscription gratuite en 2 minutes. Aucun engagement." },
      { title: "Comparez les prix", description: "Parcourez le catalogue et comparez les offres de plusieurs fournisseurs." },
      { title: "Commandez et recevez", description: "Passez commande en quelques clics. Livraison sous 48-72h." },
    ],
    comparisons: [
      { title: "vs Grossistes traditionnels", description: "Votre grossiste est imbattable sur les médicaments. Mais sur le matériel médical, son offre est souvent limitée et chère.", quote: "On ne touche pas à vos médicaments. On vous fait gagner de l'argent là où votre grossiste vous en fait perdre." },
      { title: "vs Groupements (Santalis…)", description: "Les groupements négocient des conditions d'achat — mais vous perdez votre liberté de choix.", quote: "Avec MediKong, pas d'engagement, pas d'adhésion, pas de cotisation." },
      { title: "vs Labos en direct", description: "Vous avez vos contacts directs ? MediKong vous donne le pouvoir de vérifier si c'est le meilleur deal.", quote: "Utilisez MediKong pour vérifier les prix et découvrir des alternatives." },
    ],
    categoriesTitle: "Les catégories où les économies sont visibles",
    categories: [
      { title: "Nutrition clinique", description: "Fresubin, Delical, Nutricia" },
      { title: "Laits bébé", description: "Formules infantiles" },
      { title: "Incontinence", description: "Protection & hygiène" },
      { title: "Pansements", description: "Post-op & soins" },
    ],
    faq: [
      { question: "Est-ce que MediKong remplace mon grossiste ?", answer: "Non. MediKong est complémentaire. Vous gardez vos circuits habituels pour les médicaments. MediKong couvre le matériel médical, la nutrition et l'incontinence." },
      { question: "Y a-t-il des frais cachés ou un abonnement ?", answer: "Non. L'inscription et l'utilisation sont gratuites. Le prix affiché est le prix que vous payez, HTVA." },
      { question: "Quels sont les délais de livraison ?", answer: "48 à 72h en Belgique. Les délais varient selon le fournisseur et sont clairement indiqués sur chaque offre." },
      { question: "Y a-t-il un minimum de commande ?", answer: "Les MOQ sont bas et adaptés aux officines. Chaque offre indique clairement son minimum." },
      { question: "Comment fonctionne la facturation ?", answer: "Vous recevez une facture unique et claire pour chaque commande, disponible dans votre espace." },
      { question: "Les fournisseurs sont-ils fiables ?", answer: "Tous nos fournisseurs sont des professionnels agréés avec traçabilité complète et conformité garantie." },
    ],
    contactTitle: "Créer mon compte pharmacie",
    contactSubtitle: "Accès immédiat au catalogue et aux prix — gratuit, sans engagement",
    contactCta: "Créer mon compte gratuit",
    seoTitle: "MediKong pour pharmacies | Économisez 23% sur vos achats",
    seoDescription: "Comparez les prix de matériel médical pour votre pharmacie. Économisez en moyenne 2 760€ par an. Gratuit, sans engagement.",
  },

  ehpad: {
    slug: "ehpad",
    badge: "Pour les EHPAD & Maisons de repos",
    badgeEmoji: "🏥",
    title: "Simplifiez vos achats de soins,",
    titleHighlight: "réduisez vos coûts.",
    subtitle: "MediKong Care centralise l'approvisionnement de votre établissement : nutrition, incontinence, pansements. Prix négociés, commande soignant en 2 clics, livraison directe.",
    heroImage: ehpadHero,
    ctaPrimary: { label: "Demander une démo", href: "/contact" },
    ctaSecondary: { label: "Créer mon compte EHPAD", href: "/onboarding" },
    trustLine: "Gratuit · Sans engagement · Réponse sous 24h",
    stats: [
      { value: "80.000+", label: "Références médicales" },
      { value: "8+", label: "Fournisseurs vérifiés" },
      { value: "−30%", label: "Économie moyenne" },
      { value: "24-48h", label: "Livraison express" },
    ],
    painTitle: "Vos défis d'approvisionnement au quotidien",
    painSubtitle: "Ruptures, prix qui augmentent, commandes complexes, factures difficiles à ventiler… MediKong Care résout ces problèmes.",
    painPoints: [
      { emoji: "💰", text: "Économie moyenne de 15% sur les achats de consommables." },
      { emoji: "⏰", text: "48h de délai de livraison standard." },
      { emoji: "📱", text: "2 minutes pour passer une commande de réassort." },
    ],
    featuresTitle: "Tout ce qu'il faut pour votre établissement",
    features: [
      { title: "Catalogue dédié EHPAD", description: "Nutrition (Fresubin, Delical), incontinence (Tena, iD), pansements, soins d'hygiène." },
      { title: "Prix négociés volumes", description: "Tarifs groupés par établissement ou par groupe. Plus vous commandez, moins vous payez." },
      { title: "Commande simplifiée", description: "Interface soignant avec scan code-barres, listes pré-remplies, réassort en 2 clics." },
      { title: "Gestion multi-résidents", description: "Affectez les produits par résident pour un suivi précis des consommations." },
      { title: "Dashboard groupe", description: "Pilotez les achats de tous vos établissements depuis un seul tableau de bord." },
      { title: "Conformité & traçabilité", description: "Produits certifiés CE, fiches techniques disponibles, historique complet pour les audits." },
    ],
    processTitle: "Comment ça marche ?",
    processSubtitle: "Opérationnel en moins d'une semaine",
    steps: [
      { title: "Créez votre compte établissement", description: "Inscription gratuite en 2 minutes. Ajoutez votre numéro INAMI/FINESS." },
      { title: "Configurez vos listes de produits", description: "Importez vos listes habituelles ou parcourez notre catalogue dédié EHPAD." },
      { title: "Commandez et recevez", description: "Passez commande en quelques clics. Livraison directe sous 48-72h." },
    ],
    categoriesTitle: "Nos catégories phares pour les EHPAD",
    categories: [
      { title: "Nutrition clinique", description: "Fresubin, Delical, Nutricia, Resource" },
      { title: "Incontinence", description: "Tena, iD Expert, Abena, Hartmann" },
      { title: "Pansements & soins", description: "Post-op, escarres, plaies chroniques" },
      { title: "Hygiène & entretien", description: "Gants, désinfectants, produits corporels" },
    ],
    faq: [
      { question: "MediKong est-il adapté aux petits EHPAD ?", answer: "Oui. Pas de volume minimum requis. Nos MOQ sont adaptés à tous les établissements." },
      { question: "Peut-on gérer plusieurs établissements ?", answer: "Oui. Le dashboard groupe permet de piloter les achats de tous vos établissements." },
      { question: "Comment fonctionne la facturation ?", answer: "Facture unique par commande, ventilable par résident ou par service." },
      { question: "Les soignants peuvent-ils commander ?", answer: "Oui. Interface simplifiée avec accès par code PIN et validation par le responsable." },
      { question: "Quels sont les délais de livraison ?", answer: "48-72h en Belgique. Livraison directe dans votre établissement." },
      { question: "MediKong remplace-t-il notre pharmacie ?", answer: "Non. MediKong est complémentaire pour le matériel médical et les consommables." },
    ],
    contactTitle: "Demandez une présentation personnalisée",
    contactSubtitle: "Un expert MediKong Care vous contacte sous 24h pour adapter la solution à votre établissement.",
    contactCta: "Demander ma présentation",
    seoTitle: "MediKong Care pour EHPAD | Simplifiez vos achats de soins",
    seoDescription: "Plateforme d'approvisionnement dédiée aux maisons de repos. Nutrition, incontinence, pansements. Économisez 30% en moyenne.",
  },

  grossistes: {
    slug: "grossistes",
    badge: "Pour les grossistes & services achats",
    badgeEmoji: "🎯",
    title: "Baissez vos coûts sur les volumes,",
    titleHighlight: "sécurisez vos stocks.",
    subtitle: "MediKong benchmark vos prix actuels et source les meilleures opportunités (EU) sur les catégories qui tournent : nutrition, laits bébé, incontinence, pansements post-op.",
    heroImage: grossisteHero,
    ctaPrimary: { label: "Demander un benchmark 72h", href: "/contact" },
    ctaSecondary: { label: "Planifier un appel", href: "/contact" },
    trustLine: "Analyse gratuite · Sans engagement · Résultats en 72h",
    stats: [
      { value: "−8 à −15%", label: "Économie vs prix actuels" },
      { value: "72h", label: "Benchmark livré" },
      { value: "100+", label: "SKU analysés gratuitement" },
      { value: "EU", label: "Réseau fournisseurs" },
    ],
    painTitle: "Le vrai problème ? Ce n'est pas que le prix.",
    painSubtitle: "Les grossistes ne perdent pas de marge uniquement sur le prix. Ils la perdent sur le temps et les ruptures.",
    painPoints: [
      { emoji: "💰", text: "Les mêmes références ont des écarts de prix significatifs selon le canal et la période." },
      { emoji: "⏰", text: "Les équipes achats passent trop de temps en allers-retours fournisseurs." },
      { emoji: "📦", text: "Les ruptures coûtent cher : substitutions, retards, service client dégradé." },
    ],
    featuresTitle: "MediKong = Procurement-as-a-Service",
    features: [
      { title: "Benchmark prix en 72h", description: "Transmettez votre panier achat → nous livrons une analyse claire avec quick wins identifiés." },
      { title: "Sourcing + exécution", description: "On active notre réseau de fournisseurs EU et on exécute pour vous avec propositions net-net." },
      { title: "Reporting complet", description: "Suivez vos économies et votre taux de service en temps réel : OTIF, lead time, opportunités réassort." },
      { title: "Réseau EU activé", description: "Accès à des fournisseurs vérifiés dans toute l'Europe pour diversifier vos sources." },
    ],
    processTitle: "5 étapes. Zéro blabla.",
    processSubtitle: "Simple, concret, pilotable.",
    steps: [
      { title: "Envoyez votre panier", description: "Excel ou export de votre ERP." },
      { title: "On benchmark", description: "Analyse et propositions en 72h." },
      { title: "Vous validez", description: "Vous choisissez les lignes à activer." },
      { title: "On exécute", description: "Commande + livraison coordonnées." },
      { title: "Reporting ROI", description: "Suivi économies + plan de réassort." },
    ],
    categoriesTitle: "Les catégories où les économies sont visibles",
    categories: [
      { title: "Nutrition", description: "Fresubin, Delical, Nutricia" },
      { title: "Laits bébé", description: "Formules infantiles" },
      { title: "Incontinence", description: "Protection & soins" },
      { title: "Pansements", description: "Post-op & soins" },
    ],
    faq: [
      { question: "Traçabilité, lots, conformité ?", answer: "Tous nos fournisseurs sont agréés. Traçabilité complète par lot, conformité CE et documentation disponible." },
      { question: "Travaillez-vous uniquement en Belgique ?", answer: "Non. Notre réseau couvre toute l'Union Européenne pour maximiser les opportunités." },
      { question: "Et si vous ne battez pas nos prix ?", answer: "Aucun engagement. Si notre benchmark ne révèle pas d'opportunité, vous ne payez rien." },
    ],
    contactTitle: "Recevoir mon benchmark 72h",
    contactSubtitle: "Analyse gratuite sur 100 références",
    contactCta: "Demander mon benchmark",
    seoTitle: "MediKong pour grossistes | Procurement-as-a-Service",
    seoDescription: "Benchmark prix en 72h, sourcing EU, reporting ROI. Réduisez vos coûts de 8 à 15% sur vos achats de matériel médical.",
  },

  hopitaux: {
    slug: "hopitaux",
    badge: "Pour les hôpitaux & cliniques",
    badgeEmoji: "🏨",
    title: "Centralisez vos achats,",
    titleHighlight: "maîtrisez vos budgets.",
    subtitle: "MediKong simplifie l'approvisionnement hospitalier : comparez les offres de plusieurs fournisseurs, passez commande en quelques clics, suivez vos dépenses en temps réel.",
    heroImage: hopitalHero,
    ctaPrimary: { label: "Demander une démo", href: "/contact" },
    ctaSecondary: { label: "Créer mon compte hôpital", href: "/onboarding" },
    trustLine: "Gratuit · Sans engagement · Conformité CE garantie",
    stats: [
      { value: "80.000+", label: "Références médicales" },
      { value: "−20%", label: "Économie moyenne" },
      { value: "48h", label: "Livraison standard" },
      { value: "Multi-sites", label: "Gestion centralisée" },
    ],
    painTitle: "L'approvisionnement hospitalier est complexe.",
    painSubtitle: "Multiplicité de fournisseurs, appels d'offres lourds, budgets serrés — MediKong apporte de la clarté.",
    painPoints: [
      { emoji: "📋", text: "Les processus d'achat hospitaliers sont longs et fragmentés entre services." },
      { emoji: "💰", text: "Les budgets sont sous pression constante, chaque économie compte." },
      { emoji: "📦", text: "Les ruptures de stock impactent directement la qualité des soins." },
    ],
    featuresTitle: "Une plateforme conçue pour l'hôpital",
    features: [
      { title: "Comparateur multi-fournisseurs", description: "Visualisez les offres de tous les fournisseurs sur une seule interface." },
      { title: "Gestion multi-services", description: "Chaque service commande indépendamment, le service achats valide et consolide." },
      { title: "Conformité & traçabilité", description: "Produits certifiés CE, numéros de lot, fiches techniques accessibles en un clic." },
      { title: "Reporting budgétaire", description: "Tableaux de bord en temps réel par service, par catégorie, par période." },
      { title: "Volumes négociés", description: "Plus vous commandez, plus vos prix baissent grâce aux paliers de volumes." },
      { title: "Intégration ERP", description: "Export des commandes et factures compatible avec vos systèmes existants." },
    ],
    processTitle: "Comment ça marche ?",
    processSubtitle: "Déployé en moins de 2 semaines",
    steps: [
      { title: "Audit de vos besoins", description: "On analyse vos catégories d'achats prioritaires." },
      { title: "Configuration par service", description: "On paramètre les accès et les catalogues par service." },
      { title: "Formation des équipes", description: "Prise en main rapide — interface intuitive." },
      { title: "Go live & suivi", description: "Vous commandez, on mesure les économies." },
    ],
    categoriesTitle: "Catégories prioritaires pour l'hôpital",
    categories: [
      { title: "Dispositifs médicaux", description: "Consommables, instruments, diagnostic" },
      { title: "Pansements & soins", description: "Post-op, escarres, plaies complexes" },
      { title: "Nutrition clinique", description: "Alimentation entérale et compléments" },
      { title: "Hygiène & protection", description: "Gants, masques, désinfectants" },
    ],
    faq: [
      { question: "MediKong est-il compatible avec les marchés publics ?", answer: "MediKong est un outil de comparaison et de sourcing complémentaire, utilisable hors marchés publics pour les achats en dessous des seuils." },
      { question: "Peut-on gérer plusieurs sites ?", answer: "Oui. Le dashboard groupe centralise les données de tous vos sites hospitaliers." },
      { question: "Les fournisseurs sont-ils agréés ?", answer: "Tous nos fournisseurs sont des professionnels agréés avec conformité CE et traçabilité complète." },
      { question: "Comment sont gérées les factures ?", answer: "Factures électroniques structurées, exportables vers votre ERP/système comptable." },
    ],
    contactTitle: "Demandez une démonstration",
    contactSubtitle: "Un expert MediKong vous présente la solution adaptée à votre établissement.",
    contactCta: "Planifier ma démo",
    seoTitle: "MediKong pour hôpitaux | Approvisionnement médical centralisé",
    seoDescription: "Centralisez les achats hospitaliers, comparez les fournisseurs, économisez 20% en moyenne sur le matériel médical.",
  },

  "cabinets-medicaux": {
    slug: "cabinets-medicaux",
    badge: "Pour les cabinets médicaux",
    badgeEmoji: "🩺",
    title: "Vos fournitures médicales au",
    titleHighlight: "meilleur prix.",
    subtitle: "Consommables, instruments et matériel de diagnostic — comparez les offres et commandez en quelques clics. MOQ bas adaptés aux praticiens indépendants.",
    heroImage: cabinetHero,
    ctaPrimary: { label: "Créer mon compte gratuit", href: "/onboarding" },
    ctaSecondary: { label: "Voir le catalogue", href: "/catalogue" },
    trustLine: "100% gratuit · Pas d'engagement · Livraison sous 48-72h",
    stats: [
      { value: "−25%", label: "Économie moyenne" },
      { value: "48-72h", label: "Livraison" },
      { value: "0€", label: "Coût plateforme" },
      { value: "MOQ bas", label: "Adapté aux cabinets" },
    ],
    painTitle: "Vous méritez de meilleurs prix.",
    painSubtitle: "En tant que praticien indépendant, vous n'avez pas le pouvoir de négociation d'un hôpital. MediKong change la donne.",
    painPoints: [
      { emoji: "💰", text: "Les prix de votre fournisseur habituel ne sont pas toujours les meilleurs." },
      { emoji: "⏰", text: "Vous n'avez pas le temps de comparer les offres entre fournisseurs." },
      { emoji: "📦", text: "Les MOQ élevés ne sont pas adaptés à votre consommation." },
    ],
    featuresTitle: "Conçu pour les praticiens indépendants",
    features: [
      { title: "MOQ adaptés", description: "Minimum de commande bas, pensé pour les cabinets avec une consommation modérée." },
      { title: "Comparateur de prix", description: "Voyez les offres de tous les fournisseurs sur une seule page." },
      { title: "Commande rapide", description: "Interface simple — trouvez, comparez, commandez en 2 minutes." },
      { title: "Livraison au cabinet", description: "Livraison directe à votre adresse sous 48-72h." },
      { title: "Facture claire", description: "Une facture unique par commande, HTVA, téléchargeable à tout moment." },
      { title: "Réapprovisionnement facile", description: "Recommandez vos produits habituels en un clic depuis votre historique." },
    ],
    processTitle: "Comment ça marche ?",
    processSubtitle: "Simple comme 1-2-3",
    steps: [
      { title: "Inscrivez-vous", description: "Gratuit, en 2 minutes. Aucun engagement." },
      { title: "Comparez et commandez", description: "Trouvez le meilleur prix parmi nos fournisseurs vérifiés." },
      { title: "Recevez au cabinet", description: "Livraison sous 48-72h. Facture claire." },
    ],
    categoriesTitle: "Les essentiels pour votre cabinet",
    categories: [
      { title: "Consommables", description: "Gants, compresses, aiguilles, seringues" },
      { title: "Instruments", description: "Petite instrumentation, otoscopes, tensiomètres" },
      { title: "Diagnostic", description: "Tests rapides, bandelettes, thermomètres" },
      { title: "Hygiène", description: "Désinfectants, produits de surface, EPI" },
    ],
    faq: [
      { question: "Est-ce adapté à un petit cabinet ?", answer: "Oui. Les MOQ sont bas et adaptés aux volumes d'un praticien indépendant." },
      { question: "Quels sont les délais de livraison ?", answer: "48-72h en Belgique, livraison directe à votre cabinet." },
      { question: "Y a-t-il un abonnement ?", answer: "Non. MediKong est 100% gratuit, sans frais cachés." },
      { question: "Les produits sont-ils conformes ?", answer: "Tous nos fournisseurs sont agréés. Produits certifiés CE avec traçabilité complète." },
    ],
    contactTitle: "Créer mon compte cabinet médical",
    contactSubtitle: "Accès immédiat au catalogue et aux prix pro — gratuit, sans engagement.",
    contactCta: "Créer mon compte gratuit",
    seoTitle: "MediKong pour cabinets médicaux | Fournitures au meilleur prix",
    seoDescription: "Comparez les prix de fournitures médicales pour votre cabinet. MOQ bas, livraison 48-72h. Gratuit, sans engagement.",
  },

  dentistes: {
    slug: "dentistes",
    badge: "Pour les cabinets dentaires",
    badgeEmoji: "🦷",
    title: "Matériel dentaire au",
    titleHighlight: "prix professionnel.",
    subtitle: "Consommables dentaires, instruments et produits d'hygiène spécialisés — comparez les fournisseurs et économisez sur vos achats récurrents.",
    heroImage: dentisteHero,
    ctaPrimary: { label: "Créer mon compte gratuit", href: "/onboarding" },
    ctaSecondary: { label: "Voir le catalogue", href: "/catalogue" },
    trustLine: "100% gratuit · Pas d'engagement · Livraison sous 48-72h",
    stats: [
      { value: "−20%", label: "Économie moyenne" },
      { value: "48-72h", label: "Livraison" },
      { value: "0€", label: "Coût plateforme" },
      { value: "CE", label: "Produits certifiés" },
    ],
    painTitle: "Vos consommables dentaires coûtent trop cher.",
    painSubtitle: "Les cabinets dentaires dépensent en moyenne 15 000€/an en consommables. Il est temps de comparer.",
    painPoints: [
      { emoji: "💰", text: "Les prix varient fortement d'un fournisseur à l'autre pour les mêmes produits." },
      { emoji: "🔒", text: "Vous êtes souvent captif d'un seul fournisseur sans alternative visible." },
      { emoji: "📦", text: "Les ruptures de stock perturbent votre planning de soins." },
    ],
    featuresTitle: "MediKong pour les dentistes",
    features: [
      { title: "Catalogue dentaire", description: "Composites, empreintes, anesthésiques, instruments rotatifs, produits d'hygiène." },
      { title: "Comparateur de prix", description: "Voyez les offres côte à côte et choisissez le meilleur rapport qualité-prix." },
      { title: "MOQ adaptés", description: "Quantités minimales pensées pour un cabinet dentaire individuel." },
      { title: "Réapprovisionnement rapide", description: "Recommandez vos consommables habituels en un clic." },
      { title: "Traçabilité complète", description: "Numéros de lot, dates de péremption, certificats CE disponibles." },
      { title: "Livraison au cabinet", description: "Directement à votre adresse, sous 48-72h." },
    ],
    processTitle: "Comment ça marche ?",
    processSubtitle: "Aussi simple que de commander en ligne",
    steps: [
      { title: "Créez votre compte", description: "Inscription gratuite en 2 minutes." },
      { title: "Comparez les prix", description: "Trouvez les meilleures offres pour vos consommables." },
      { title: "Commandez et recevez", description: "Livraison au cabinet sous 48-72h." },
    ],
    categoriesTitle: "Les essentiels pour votre cabinet dentaire",
    categories: [
      { title: "Composites & ciments", description: "Restauration, scellement, collage" },
      { title: "Anesthésie & aiguilles", description: "Carpules, aiguilles dentaires" },
      { title: "Hygiène & stérilisation", description: "Désinfection, sachets, indicateurs" },
      { title: "Instruments rotatifs", description: "Fraises, polissoirs, disques" },
    ],
    faq: [
      { question: "Trouvez-vous les grandes marques dentaires ?", answer: "Oui. Nous référençons les marques leaders du secteur dentaire." },
      { question: "Quels sont les délais de livraison ?", answer: "48-72h en Belgique, livraison directe au cabinet." },
      { question: "Y a-t-il un minimum de commande ?", answer: "Les MOQ sont bas et adaptés aux cabinets dentaires individuels." },
      { question: "Les produits sont-ils certifiés ?", answer: "Tous les produits sont certifiés CE avec traçabilité complète par lot." },
    ],
    contactTitle: "Créer mon compte cabinet dentaire",
    contactSubtitle: "Accédez au catalogue et aux prix pro — gratuit, sans engagement.",
    contactCta: "Créer mon compte gratuit",
    seoTitle: "MediKong pour dentistes | Matériel dentaire au meilleur prix",
    seoDescription: "Comparez les prix de consommables et matériel dentaire. Économisez 20% en moyenne. Gratuit, sans engagement.",
  },

  veterinaires: {
    slug: "veterinaires",
    badge: "Pour les vétérinaires",
    badgeEmoji: "🐾",
    title: "Fournitures vétérinaires au",
    titleHighlight: "juste prix.",
    subtitle: "Consommables, instruments et matériel de diagnostic pour cliniques et cabinets vétérinaires. Comparez les offres et réduisez vos coûts.",
    heroImage: veterinaireHero,
    ctaPrimary: { label: "Créer mon compte gratuit", href: "/onboarding" },
    ctaSecondary: { label: "Voir le catalogue", href: "/catalogue" },
    trustLine: "100% gratuit · Pas d'engagement · Livraison sous 48-72h",
    stats: [
      { value: "−20%", label: "Économie moyenne" },
      { value: "48-72h", label: "Livraison" },
      { value: "0€", label: "Coût plateforme" },
      { value: "CE", label: "Produits certifiés" },
    ],
    painTitle: "Vos fournitures vétérinaires méritent mieux.",
    painSubtitle: "Les cliniques vétérinaires font face aux mêmes défis que les cabinets médicaux : prix élevés, peu de transparence, fournisseurs limités.",
    painPoints: [
      { emoji: "💰", text: "Les prix des consommables vétérinaires varient fortement entre fournisseurs." },
      { emoji: "🔍", text: "Il est difficile de comparer les offres sans y consacrer beaucoup de temps." },
      { emoji: "📦", text: "Les MOQ élevés ne sont pas adaptés aux cliniques indépendantes." },
    ],
    featuresTitle: "MediKong pour les vétérinaires",
    features: [
      { title: "Catalogue adapté", description: "Consommables, sutures, diagnostic rapide, produits d'hygiène adaptés aux cliniques." },
      { title: "Comparateur multi-fournisseurs", description: "Voyez toutes les offres sur une seule page et choisissez le meilleur prix." },
      { title: "MOQ adaptés", description: "Quantités minimales pensées pour les cliniques vétérinaires indépendantes." },
      { title: "Commande rapide", description: "Recommandez vos produits habituels en un clic depuis votre historique." },
      { title: "Traçabilité complète", description: "Numéros de lot, conformité, fiches techniques disponibles." },
      { title: "Livraison à la clinique", description: "Livraison directe sous 48-72h en Belgique." },
    ],
    processTitle: "Comment ça marche ?",
    processSubtitle: "Simple et rapide",
    steps: [
      { title: "Inscrivez-vous", description: "Gratuit, en 2 minutes. Aucun engagement." },
      { title: "Comparez et commandez", description: "Trouvez le meilleur prix parmi nos fournisseurs." },
      { title: "Recevez à la clinique", description: "Livraison sous 48-72h. Facture claire." },
    ],
    categoriesTitle: "Les essentiels pour votre clinique vétérinaire",
    categories: [
      { title: "Consommables", description: "Compresses, gants, seringues, aiguilles" },
      { title: "Chirurgie & sutures", description: "Fils, instruments, draps opératoires" },
      { title: "Diagnostic", description: "Tests rapides, bandelettes, thermomètres" },
      { title: "Hygiène & protection", description: "Désinfectants, EPI, produits de surface" },
    ],
    faq: [
      { question: "Les produits sont-ils adaptés au vétérinaire ?", answer: "Oui. Notre catalogue inclut les consommables médicaux utilisables en clinique vétérinaire." },
      { question: "Quels sont les délais ?", answer: "48-72h en Belgique, livraison directe à votre clinique." },
      { question: "Y a-t-il un abonnement ?", answer: "Non. MediKong est 100% gratuit pour les professionnels." },
      { question: "Comment fonctionne la facturation ?", answer: "Facture unique par commande, HTVA, téléchargeable dans votre espace." },
    ],
    contactTitle: "Créer mon compte vétérinaire",
    contactSubtitle: "Accès immédiat au catalogue — gratuit, sans engagement.",
    contactCta: "Créer mon compte gratuit",
    seoTitle: "MediKong pour vétérinaires | Fournitures au meilleur prix",
    seoDescription: "Comparez les prix de fournitures vétérinaires. Consommables, instruments, diagnostic. Gratuit, sans engagement.",
  },
};
