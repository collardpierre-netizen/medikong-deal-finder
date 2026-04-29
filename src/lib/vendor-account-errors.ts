/**
 * Mapping centralisé des codes d'erreur renvoyés par l'edge function `create-vendor-account`.
 * Fournit titre + message + actions actionnables pour l'UI admin.
 */

export type VendorAccountErrorCode =
  | "vendor_email_already_exists"
  | "vendor_already_has_access"
  | "auth_email_already_exists"
  | "auth_create_failed"
  | "vendor_insert_failed"
  | "vendor_not_found"
  | "missing_fields"
  | "unauthorized"
  | "forbidden"
  | "attach_failed"
  | "internal_error"
  | string;

export type VendorAccountErrorPayload = {
  ok?: false;
  error?: string;
  code?: VendorAccountErrorCode;
  existing_vendor?: {
    id: string;
    name?: string;
    company_name?: string;
    email?: string;
    auth_user_id?: string | null;
  };
  existing_user_id?: string;
  suggested_action?: "attach_to_existing" | "open_existing" | null;
  race_detected?: boolean;
};

export type VendorAccountErrorAction = {
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  /** Navigation cible (route interne) */
  href?: string;
  /** Identifiant logique pour brancher un handler personnalisé (attach, edit_email, retry…) */
  intent?: "attach" | "open_vendor" | "edit_email" | "retry" | "contact_support" | "open_user";
};

export type VendorAccountErrorPresentation = {
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  hint?: string;
  primaryAction?: VendorAccountErrorAction;
  secondaryAction?: VendorAccountErrorAction;
  /** Action complémentaire optionnelle (ex: ouvrir la fiche existante en parallèle d'un rattachement) */
  tertiaryAction?: VendorAccountErrorAction;
  /** Code original conservé pour analytics */
  code: VendorAccountErrorCode;
};

/**
 * Détecte si un payload edge correspond à une erreur applicative normalisée.
 */
export function isVendorAccountError(
  data: any,
): data is VendorAccountErrorPayload {
  return !!data && (data.ok === false || typeof data.error === "string");
}

export function presentVendorAccountError(
  payload: VendorAccountErrorPayload,
): VendorAccountErrorPresentation {
  const code = payload.code ?? "internal_error";
  const ev = payload.existing_vendor;
  const evName = ev?.company_name || ev?.name || "ce vendeur";

  switch (code) {
    case "vendor_email_already_exists": {
      const hasAccess = !!ev?.auth_user_id;
      const raced = payload.race_detected;
      const openVendorAction: VendorAccountErrorAction | undefined = ev?.id
        ? { label: "Ouvrir la fiche vendeur existant", intent: "open_vendor", href: `/admin/vendeurs/${ev.id}`, variant: "outline" }
        : undefined;
      return {
        severity: "warning",
        code,
        title: raced
          ? "Conflit détecté : un autre admin vient de créer ce vendeur"
          : "Vendeur déjà existant",
        description: hasAccess
          ? `Un vendeur avec cet email existe déjà : « ${evName} » et possède déjà un accès au portail.`
          : `Un vendeur avec cet email existe déjà : « ${evName} ». Vous pouvez lui rattacher un accès portail au lieu de créer un doublon.`,
        hint: hasAccess
          ? "Ouvrez sa fiche pour réinitialiser son mot de passe ou modifier ses infos."
          : "Le rattachement réutilise le compte existant ; aucun doublon n'est créé.",
        primaryAction: hasAccess
          ? openVendorAction
          : { label: "Rattacher au vendeur existant", intent: "attach" },
        secondaryAction: { label: "Modifier l'email", intent: "edit_email", variant: "outline" },
        // Si pas d'accès, on offre quand même un raccourci direct vers la fiche en action tertiaire
        tertiaryAction: hasAccess ? undefined : openVendorAction,
      };
    }

    case "vendor_already_has_access":
      return {
        severity: "warning",
        code,
        title: "Accès portail déjà configuré",
        description: `« ${evName} » a déjà un compte d'accès au portail vendeur.`,
        hint: "Pour réinitialiser le mot de passe, utilisez l'action « Renvoyer l'invitation » sur la fiche vendeur.",
        primaryAction: ev?.id
          ? { label: "Ouvrir la fiche vendeur", intent: "open_vendor", href: `/admin/vendeurs/${ev.id}` }
          : undefined,
        secondaryAction: { label: "Fermer", intent: "edit_email", variant: "outline" },
      };

    case "auth_email_already_exists":
      return {
        severity: "warning",
        code,
        title: "Compte utilisateur déjà existant",
        description:
          "Un compte utilisateur existe déjà avec cet email mais n'est rattaché à aucun vendeur.",
        hint: payload.existing_user_id
          ? `ID utilisateur : ${payload.existing_user_id}. Saisissez à nouveau cet email pour le rattacher au nouveau vendeur, ou utilisez un autre email.`
          : "Saisissez à nouveau cet email pour le rattacher au nouveau vendeur, ou utilisez un autre email.",
        primaryAction: payload.existing_user_id
          ? { label: "Voir le compte", intent: "open_user", href: `/admin/utilisateurs?user_id=${payload.existing_user_id}` }
          : undefined,
        secondaryAction: { label: "Modifier l'email", intent: "edit_email", variant: "outline" },
      };

    case "auth_create_failed":
      return {
        severity: "error",
        code,
        title: "Création du compte d'accès impossible",
        description:
          payload.error ?? "Le compte d'authentification n'a pas pu être créé.",
        hint:
          "Vérifiez que l'email est valide et qu'il n'est pas déjà utilisé. Si le problème persiste, contactez l'équipe technique.",
        primaryAction: { label: "Réessayer", intent: "retry" },
        secondaryAction: { label: "Modifier l'email", intent: "edit_email", variant: "outline" },
      };

    case "vendor_insert_failed":
      return {
        severity: "error",
        code,
        title: "Enregistrement du vendeur impossible",
        description:
          payload.error ?? "Une erreur est survenue lors de l'enregistrement en base.",
        hint: "Le compte d'accès créé a été annulé. Vous pouvez réessayer en toute sécurité.",
        primaryAction: { label: "Réessayer", intent: "retry" },
      };

    case "vendor_not_found":
      return {
        severity: "error",
        code,
        title: "Vendeur introuvable",
        description: "Le vendeur ciblé pour le rattachement n'existe plus ou a été supprimé.",
        primaryAction: { label: "Recharger la liste", intent: "retry" },
      };

    case "attach_failed":
      return {
        severity: "error",
        code,
        title: "Rattachement impossible",
        description: payload.error ?? "Le rattachement de l'accès au vendeur a échoué.",
        hint: "Le compte d'accès créé a été annulé. Vous pouvez réessayer.",
        primaryAction: { label: "Réessayer", intent: "retry" },
      };

    case "missing_fields":
      return {
        severity: "warning",
        code,
        title: "Champs manquants",
        description: "Le nom de l'entreprise et l'email sont requis.",
      };

    case "unauthorized":
      return {
        severity: "error",
        code,
        title: "Session expirée",
        description: "Vous devez vous reconnecter pour effectuer cette action.",
        primaryAction: { label: "Se reconnecter", intent: "retry", href: "/admin/login" },
      };

    case "forbidden":
      return {
        severity: "error",
        code,
        title: "Action non autorisée",
        description: "Votre rôle ne permet pas de créer un vendeur.",
        hint: "Contactez un super-admin si vous pensez que c'est une erreur.",
      };

    case "internal_error":
    default:
      return {
        severity: "error",
        code,
        title: "Erreur inattendue",
        description: payload.error ?? "Une erreur technique est survenue.",
        hint: "Si le problème persiste, contactez l'équipe technique.",
        primaryAction: { label: "Réessayer", intent: "retry" },
      };
  }
}
