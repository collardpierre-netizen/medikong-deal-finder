export interface TimelineNode {
  year: string;
  title: string;
  desc: string;
  status: "past" | "active" | "future";
}

export interface VTimelineNode {
  year: string;
  title: string;
  desc: string;
  status: "past" | "current" | "future";
}

export interface TeamMember {
  initials: string;
  name: string;
  role: string;
  bio: string;
  linkedinUrl: string;
  avatarGradient: string;
}

export interface Testimonial {
  stars: number;
  text: string;
  authorName: string;
  authorRole: string;
  avatarInitials: string;
  avatarGradient: string;
}

export interface Job {
  title: string;
  department: "Tech" | "Sales" | "Design" | "Analytics";
  location: string;
  contract: string;
}

export interface PressArticle {
  source: string;
  title: string;
  excerpt: string;
  date: string;
  thumbnailGradient: string;
  articleUrl: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Tier {
  name: string;
  rate: string;
  range: string;
  highlighted?: boolean;
}

export const aboutTimeline: TimelineNode[] = [
  { year: "2020", title: "Création de Balooh SRL", desc: "Fondation de la holding mère à Ath, Belgique.", status: "past" },
  { year: "2022", title: "Lancement beta", desc: "50 fournisseurs, tests de marché en Belgique.", status: "past" },
  { year: "2023", title: "500 produits en ligne", desc: "Première levée de fonds seed de 1M€.", status: "past" },
  { year: "2024", title: "40 000+ références", desc: "Expansion Pays-Bas, API ERP, croissance 10x.", status: "past" },
  { year: "2025", title: "Expansion Benelux", desc: "Luxembourg et Wallonie, 500+ acheteurs actifs.", status: "active" },
  { year: "2026", title: "Phase 2 levée de fonds", desc: "Tax Shelter 45%, objectif 5M€, valorisation 160M€.", status: "future" },
];

export const teamMembers: TeamMember[] = [
  {
    initials: "PC",
    name: "Pierre Collard",
    role: "Co-fondateur · Sales & Growth",
    bio: "Ancien directeur commercial chez un distributeur médical, Pierre a 15 ans d'expérience dans la distribution de fournitures médicales en Belgique et aux Pays-Bas. Il pilote la stratégie commerciale et les partenariats fournisseurs.",
    linkedinUrl: "#",
    avatarGradient: "from-[#E70866] to-[#F472B6]",
  },
  {
    initials: "OA",
    name: "Olivier-Hicham Allard",
    role: "Co-fondateur · Strategy & Finance",
    bio: "Ingénieur puis MBA HEC, Olivier a lancé 3 entreprises dans le digital santé. Il supervise la stratégie financière, les levées de fonds Tax Shelter et la roadmap produit de MediKong.",
    linkedinUrl: "#",
    avatarGradient: "from-[#1B5BDA] to-[#60A5FA]",
  },
];

export const testimonials: Testimonial[] = [
  {
    stars: 5,
    text: "MediKong nous a permis de réduire nos coûts d'approvisionnement de 23% en 6 mois. La transparence des prix est un vrai game changer.",
    authorName: "Marie Dubois",
    authorRole: "Pharmacie Centrale, Bruxelles",
    avatarInitials: "MD",
    avatarGradient: "from-[#E70866] to-[#DB2777]",
  },
  {
    stars: 5,
    text: "Enfin une plateforme qui comprend les besoins du secteur médical. La vérification des fournisseurs nous donne une confiance totale.",
    authorName: "Dr. Jean Lambert",
    authorRole: "Clinique Saint-Joseph, Liège",
    avatarInitials: "JL",
    avatarGradient: "from-[#1B5BDA] to-[#60A5FA]",
  },
  {
    stars: 4,
    text: "L'intégration avec notre ERP a été fluide. On commande directement depuis notre système et MediKong gère le reste.",
    authorName: "Sophie Martin",
    authorRole: "Laboratoire BioMed, Anvers",
    avatarInitials: "SM",
    avatarGradient: "from-[#7C3AED] to-[#A78BFA]",
  },
];

export const jobListings: Job[] = [
  { title: "Full-Stack Developer (Python/React)", department: "Tech", location: "Paris, France · Remote", contract: "CDI" },
  { title: "Key Account Manager Santé", department: "Sales", location: "Belgique · Remote", contract: "CDI" },
  { title: "Product Designer", department: "Design", location: "Europe · Remote", contract: "CDI" },
  { title: "Data Analyst", department: "Analytics", location: "Anywhere · Remote", contract: "Stage 6 mois" },
];

export const pressArticles: PressArticle[] = [
  {
    source: "VentureBeat",
    title: "MediKong lève 5M€ pour accélérer sa croissance en Benelux",
    excerpt: "La marketplace B2B de fournitures médicales annonce sa Series A pour étendre sa couverture géographique et renforcer ses outils d'intelligence tarifaire.",
    date: "28 mars 2026",
    thumbnailGradient: "from-blue-400 to-indigo-500",
    articleUrl: "#",
  },
  {
    source: "Les Échos Santé",
    title: "Comment MediKong transforme les achats médicaux en Europe",
    excerpt: "Avec 40 000 références et 500 professionnels actifs, la plateforme belge s'impose comme un acteur incontournable du B2B médical.",
    date: "15 mars 2026",
    thumbnailGradient: "from-pink-400 to-rose-500",
    articleUrl: "#",
  },
  {
    source: "Actualités Pharmaceutiques",
    title: "Pharmacies françaises : pourquoi MediKong vous intéresse",
    excerpt: "La marketplace propose désormais un comparateur de prix en temps réel et des conditions de paiement différé adaptées aux officines.",
    date: "1 mars 2026",
    thumbnailGradient: "from-emerald-400 to-teal-500",
    articleUrl: "#",
  },
  {
    source: "TechCrunch Europe",
    title: "MediKong x Skyscanner : quand les marketplaces se rencontrent",
    excerpt: "Analyse du modèle de comparaison de prix appliqué au secteur médical B2B, inspiré des best practices du travel tech.",
    date: "10 février 2026",
    thumbnailGradient: "from-purple-400 to-violet-500",
    articleUrl: "#",
  },
];

export const faqItems: FaqItem[] = [
  { question: "Quels types d'entreprises peuvent vendre sur MediKong ?", answer: "Tout distributeur, fabricant ou grossiste de fournitures médicales disposant d'un numéro AFMPS/FAGG valide et enregistré au Benelux peut rejoindre notre plateforme après vérification." },
  { question: "Comment sont vérifiés les fournisseurs ?", answer: "Chaque fournisseur passe par un processus de vérification en 5 étapes : validation du numéro BCE/TVA, vérification AFMPS, contrôle des licences de distribution, audit qualité et entretien commercial." },
  { question: "Quelles sont les conditions de paiement ?", answer: "Nous proposons le paiement immédiat (Visa, Mastercard, Bancontact), le virement SEPA, et le paiement différé à 30/60/90 jours via notre partenaire Mondu, sous réserve d'éligibilité." },
  { question: "Puis-je intégrer MediKong à mon ERP ?", answer: "Oui, notre API REST et nos connecteurs pré-configurés sont compatibles avec les principaux ERP du secteur (SAP, Sage, WinPharma, Officina). L'intégration prend généralement 2-3 jours." },
  { question: "Y a-t-il une limite de volume d'achat ?", answer: "Non. MediKong est conçu pour les achats de toutes tailles, du réapprovisionnement quotidien aux appels d'offres hospitaliers de plusieurs centaines de milliers d'euros." },
  { question: "Que se passe-t-il en cas de litige ?", answer: "Notre équipe support intervient sous 24h. Un processus de médiation structuré protège acheteurs et vendeurs, avec remboursement garanti si le vendeur est en tort." },
];

export const commissionTiers: Tier[] = [
  { name: "Bronze", rate: "14%", range: "0 - 10k€/mois" },
  { name: "Silver", rate: "13%", range: "10k - 50k€/mois" },
  { name: "Gold", rate: "12%", range: "50k - 200k€/mois", highlighted: true },
  { name: "Platinum", rate: "10%", range: "200k+€/mois" },
];

export const investTimeline: VTimelineNode[] = [
  { year: "2023", title: "Phase 1 — Seed", desc: "1M€ levés auprès d'investisseurs belges. Développement plateforme et premiers 50 fournisseurs.", status: "past" },
  { year: "2026", title: "Phase 2 — Series A", desc: "Objectif 5M€ via Tax Shelter 45%. Expansion Benelux, recrutement, marketing.", status: "current" },
  { year: "2027", title: "Phase 3 — Series B", desc: "15M€ pour l'expansion européenne. France, Allemagne, Suisse.", status: "future" },
  { year: "2028-2030", title: "Exit", desc: "IPO ou acquisition stratégique. Valorisation cible 500M€+.", status: "future" },
];

export const companyInfo = {
  name: "Balooh SRL",
  tva: "BE 1005.771.323",
  address: "23 rue de la Procession, B-7822 Ath, Belgique",
  email: "contact@medikong.pro",
  phone: "+32 2 XXX XX XX",
};
