// Source unique de vérité pour les libellés des modes d'onboarding vendeur.
// Utilisé partout dans l'interface admin (fiche vendeur, dialog création,
// historique des emails) pour garantir la cohérence FR / NL / EN.

export type VendorOnboardingMode = "create" | "attach" | "self_register";

export type VendorOnboardingLocale = "fr" | "nl" | "en";

export interface VendorOnboardingModeMeta {
  /** Libellé court (utilisé dans badges + selects). */
  label: Record<VendorOnboardingLocale, string>;
  /** Phrase descriptive (encart explicatif). */
  description: Record<VendorOnboardingLocale, string>;
  /** Couleurs du badge (cohérentes partout). */
  badge: { bg: string; text: string; border: string };
}

export const VENDOR_ONBOARDING_MODE_META: Record<VendorOnboardingMode, VendorOnboardingModeMeta> = {
  create: {
    label: {
      fr: "Création admin",
      nl: "Admin-aanmaak",
      en: "Admin create",
    },
    description: {
      fr: "Un vendeur est créé dans MediKong et un compte utilisateur est généré en même temps. L'accès reste inactif jusqu'à ce que le destinataire clique le lien de vérification envoyé par email (valide 24 h).",
      nl: "Een verkoper wordt in MediKong aangemaakt samen met een gebruikersaccount. De toegang blijft inactief tot de ontvanger op de verificatielink in de e-mail klikt (geldig 24 u).",
      en: "A vendor is created in MediKong together with a user account. Access stays inactive until the recipient clicks the verification link sent by email (valid 24 h).",
    },
    badge: { bg: "#EFF6FF", text: "#1B5BDA", border: "#DBEAFE" },
  },
  attach: {
    label: {
      fr: "Rattachement",
      nl: "Koppeling",
      en: "Attach",
    },
    description: {
      fr: "Un vendeur existe déjà dans la base MediKong mais n'a pas encore de compte d'accès. Un utilisateur (existant ou nouveau) lui est rattaché après vérification de son email.",
      nl: "Een verkoper bestaat al in MediKong maar heeft nog geen toegangsaccount. Een gebruiker (bestaand of nieuw) wordt eraan gekoppeld na verificatie van het e-mailadres.",
      en: "A vendor already exists in MediKong but has no access account yet. A user (existing or new) is attached after email verification.",
    },
    badge: { bg: "#F0FDF4", text: "#059669", border: "#BBF7D0" },
  },
  self_register: {
    label: {
      fr: "Auto-inscription",
      nl: "Zelfregistratie",
      en: "Self-registration",
    },
    description: {
      fr: "Le vendeur s'inscrit lui-même via le formulaire public. Son compte est créé en mode shadow ; un admin doit valider son profil pour activer l'accès complet au portail.",
      nl: "De verkoper registreert zichzelf via het publieke formulier. Het account wordt in shadow-modus aangemaakt; een admin moet het profiel valideren om volledige toegang tot het portaal te activeren.",
      en: "The vendor signs up via the public form. The account is created in shadow mode; an admin must validate the profile to grant full portal access.",
    },
    badge: { bg: "#F5F3FF", text: "#7C3AED", border: "#E9D5FF" },
  },
};

/** Libellé court d'un mode (par défaut FR pour l'interface admin). */
export function getVendorOnboardingModeLabel(
  mode: VendorOnboardingMode | string | null | undefined,
  locale: VendorOnboardingLocale = "fr",
): string {
  if (!mode) return "—";
  const meta = VENDOR_ONBOARDING_MODE_META[mode as VendorOnboardingMode];
  return meta?.label[locale] ?? String(mode);
}

/** Couleurs du badge d'un mode (fallback gris neutre). */
export function getVendorOnboardingModeBadgeColors(
  mode: VendorOnboardingMode | string | null | undefined,
): { bg: string; text: string; border: string } {
  const meta = mode ? VENDOR_ONBOARDING_MODE_META[mode as VendorOnboardingMode] : undefined;
  return meta?.badge ?? { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" };
}
