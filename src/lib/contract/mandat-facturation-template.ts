/**
 * Source unique du contenu de la convention de mandat de facturation.
 * Versionné pour assurer la traçabilité légale (audit, contrôle TVA).
 */

export const CONTRACT_VERSION = "v1.0";
export const CONTRACT_TYPE = "mandat_facturation";

export interface ContractVendorData {
  company_name: string;
  legal_form?: string | null;
  address?: string | null;
  bce?: string | null;
  vat?: string | null;
  representative_name: string;
  representative_role?: string | null;
  signature_location?: string | null;
}

export interface ContractMediKongData {
  legal_form: string;
  address: string;
  bce: string;
  vat: string;
  representative_name: string;
  representative_role: string;
  jurisdiction_city: string;
}

export const MEDIKONG_DEFAULTS: ContractMediKongData = {
  legal_form: "SRL",
  address: "MediKong SRL — Adresse du siège social",
  bce: "BE0XXX.XXX.XXX",
  vat: "BE0XXX.XXX.XXX",
  representative_name: "Représentant légal MediKong",
  representative_role: "Administrateur",
  jurisdiction_city: "Bruxelles",
};

export interface ContractArticle {
  id: string;
  number: string;
  title: string;
  paragraphs: Array<string | { type: "list"; items: string[] } | { type: "subarticle"; number: string; text: string }>;
}

export const CONTRACT_ARTICLES: ContractArticle[] = [
  {
    id: "art-1",
    number: "1",
    title: "Objet de la convention",
    paragraphs: [
      "Le Vendeur donne mandat exprès à MediKong d'émettre, en son nom et pour son compte, les factures relatives aux ventes de biens qu'il réalise auprès des clients finaux via la plateforme medikong.pro.",
      "Cette convention est conclue conformément à l'article 53 §2 alinéa 2 du Code de la TVA belge, qui autorise l'émission de factures par un tiers au nom et pour le compte de l'assujetti.",
    ],
  },
  {
    id: "art-2",
    number: "2",
    title: "Périmètre du mandat",
    paragraphs: [
      "Le mandat couvre l'ensemble des opérations de vente de biens et services effectuées par le Vendeur via la plateforme MediKong à destination de clients professionnels (B2B) ou, le cas échéant, de clients particuliers (B2C), sur le territoire belge et européen.",
      "Sont exclues du périmètre du présent mandat les ventes réalisées par le Vendeur en dehors de la plateforme MediKong, pour lesquelles le Vendeur conserve l'entière responsabilité d'émission de ses propres factures.",
    ],
  },
  {
    id: "art-3",
    number: "3",
    title: "Mentions obligatoires des factures",
    paragraphs: [
      "Les factures émises par MediKong au nom du Vendeur comporteront l'ensemble des mentions obligatoires prévues par l'article 5 de l'arrêté royal n°1 du 29 décembre 1992, notamment :",
      {
        type: "list",
        items: [
          "Date d'émission et numéro séquentiel unique",
          "Nom, adresse et numéro de TVA du Vendeur (mandant)",
          "Nom, adresse et numéro de TVA du client final",
          "Description détaillée des biens ou services",
          "Prix unitaire HTVA et montant total HTVA",
          "Taux et montant de TVA applicable",
          "Mention obligatoire « Autofacturation » (ou « Facture émise par le preneur ») conformément à l'article 5 §1, 9°ter AR n°1",
        ],
      },
    ],
  },
  {
    id: "art-4",
    number: "4",
    title: "Procédure d'acceptation des factures",
    paragraphs: [
      "Conformément aux exigences légales, chaque facture émise par MediKong au nom du Vendeur est soumise à une procédure d'acceptation.",
      { type: "subarticle", number: "4.1", text: "Notification — Le Vendeur reçoit copie de chaque facture émise dans un délai maximal de 24 heures suivant son émission, via le réseau Peppol (format EN 16931 / Peppol BIS 3.0) si le Vendeur dispose d'un point d'accès Peppol ; à défaut, par email avec PDF lisible et fichier XML structuré ; et l'espace vendeur MediKong pour consultation et téléchargement permanents." },
      { type: "subarticle", number: "4.2", text: "Délai de contestation — Le Vendeur dispose d'un délai de 5 jours ouvrables à compter de la notification pour contester tout ou partie du contenu de la facture. La contestation doit être motivée et adressée par écrit à vendor-support@medikong.pro." },
      { type: "subarticle", number: "4.3", text: "Acceptation tacite — À défaut de contestation dans le délai prévu au point 4.2, la facture est réputée acceptée par le Vendeur." },
      { type: "subarticle", number: "4.4", text: "Rectification — En cas de contestation fondée, MediKong émettra dans les plus brefs délais une note de crédit annulant la facture contestée, suivie d'une nouvelle facture rectifiée." },
    ],
  },
  {
    id: "art-5",
    number: "5",
    title: "Obligations du Vendeur (Mandant)",
    paragraphs: [
      "Nonobstant l'émission matérielle des factures par MediKong, le Vendeur demeure entièrement responsable de ses obligations fiscales et déclaratives, notamment :",
      {
        type: "list",
        items: [
          "Déclaration et paiement de la TVA collectée sur les ventes, auprès du SPF Finances, dans ses déclarations périodiques de TVA",
          "Inscription des factures émises en son nom dans son facturier de sortie",
          "Conservation des factures et documents comptables connexes pendant la durée légale (10 ans)",
          "Fourniture à MediKong de données exactes et à jour concernant son entreprise, sa situation TVA, et son catalogue produits",
          "Communication à son office de contrôle TVA de l'identité de MediKong comme mandataire émetteur de factures, conformément à la circulaire AGFisc N° 53/2013",
        ],
      },
      "Le Vendeur s'engage à NE PAS émettre lui-même de facture pour les ventes couvertes par le présent mandat, afin d'éviter toute double facturation susceptible de constituer une irrégularité fiscale.",
    ],
  },
  {
    id: "art-6",
    number: "6",
    title: "Obligations de MediKong (Mandataire)",
    paragraphs: [
      "MediKong s'engage à :",
      {
        type: "list",
        items: [
          "Émettre les factures dans le respect strict des mentions obligatoires légales et des données transmises par le Vendeur",
          "Respecter les taux de TVA applicables aux opérations du Vendeur",
          "Transmettre sans délai au Vendeur copie de chaque facture émise en son nom",
          "Conserver les factures émises et les justificatifs de transmission pendant la durée légale",
          "Mettre à disposition du Vendeur un espace vendeur permettant la consultation, l'export et le téléchargement de l'ensemble des factures émises en son nom",
        ],
      },
      "MediKong ne se substitue en aucun cas au Vendeur dans ses obligations fiscales ; MediKong agit exclusivement comme mandataire technique d'émission de factures.",
    ],
  },
  {
    id: "art-7",
    number: "7",
    title: "Rémunération de MediKong",
    paragraphs: [
      "Les services de plateforme fournis par MediKong (hébergement du catalogue, acquisition client, traitement des paiements, émission des factures, support) sont rémunérés par une commission de 20% HTVA sur le montant HTVA de chaque vente conclue via la plateforme.",
      "Cette commission fait l'objet d'une facturation séparée émise par MediKong au Vendeur, distincte des factures de vente émises au nom du Vendeur. Elle est compensée directement sur le reversement au Vendeur du produit des ventes.",
    ],
  },
  {
    id: "art-8",
    number: "8",
    title: "Numérotation et archivage",
    paragraphs: [
      "Les factures émises par MediKong au nom du Vendeur suivent une séquence chronologique et numérique propre à MediKong, incluant un identifiant unique du Vendeur permettant la traçabilité.",
      "MediKong conserve l'original électronique de chaque facture. Le Vendeur reçoit un double à valeur probante équivalente, qu'il doit intégrer dans sa propre comptabilité.",
    ],
  },
  {
    id: "art-9",
    number: "9",
    title: "Durée, entrée en vigueur et résiliation",
    paragraphs: [
      { type: "subarticle", number: "9.1", text: "La présente convention entre en vigueur à la date de signature électronique par les deux parties et couvre l'ensemble des opérations postérieures à cette date." },
      { type: "subarticle", number: "9.2", text: "Elle est conclue pour une durée indéterminée." },
      { type: "subarticle", number: "9.3", text: "Chacune des parties peut y mettre fin à tout moment moyennant un préavis écrit de 30 jours calendrier, adressé à l'autre partie par email ou courrier recommandé. Pour le Vendeur : adresse email enregistrée dans son espace vendeur. Pour MediKong : admin@medikong.pro." },
      { type: "subarticle", number: "9.4", text: "La résiliation ne remet pas en cause la validité des factures émises antérieurement dans le cadre du mandat." },
    ],
  },
  {
    id: "art-10",
    number: "10",
    title: "Modification de la convention",
    paragraphs: [
      "Toute modification de la présente convention devra faire l'objet d'un avenant écrit signé par les deux parties. MediKong se réserve la possibilité de proposer une nouvelle version de la convention en cas d'évolution législative ou opérationnelle ; le Vendeur en sera notifié 30 jours avant son entrée en vigueur et pourra résilier la présente convention s'il refuse les nouvelles clauses.",
    ],
  },
  {
    id: "art-11",
    number: "11",
    title: "Droit applicable et juridiction compétente",
    paragraphs: [
      "La présente convention est soumise au droit belge. Tout litige relatif à son interprétation ou à son exécution sera soumis à la compétence exclusive des tribunaux de l'arrondissement du siège social de MediKong, après tentative préalable de résolution amiable.",
    ],
  },
  {
    id: "art-12",
    number: "12",
    title: "Protection des données",
    paragraphs: [
      "Les parties s'engagent à respecter le Règlement Général sur la Protection des Données (RGPD – règlement UE 2016/679) dans le traitement des données personnelles échangées dans le cadre de la présente convention. La politique de confidentialité de MediKong, disponible sur medikong.pro, précise les modalités de traitement.",
    ],
  },
];

/**
 * Champs critiques requis pour pouvoir signer.
 * Si l'un est manquant, le vendeur doit d'abord compléter son profil.
 */
export const REQUIRED_VENDOR_FIELDS: Array<{
  key: keyof ContractVendorData;
  label: string;
}> = [
  { key: "company_name", label: "Raison sociale" },
  { key: "bce", label: "Numéro d'entreprise (BCE)" },
  { key: "vat", label: "Numéro de TVA" },
  { key: "address", label: "Siège social" },
  { key: "representative_name", label: "Nom du représentant légal" },
];

export function getMissingVendorFields(data: ContractVendorData): string[] {
  return REQUIRED_VENDOR_FIELDS.filter((f) => {
    const v = data[f.key];
    return !v || (typeof v === "string" && v.trim().length === 0);
  }).map((f) => f.label);
}
