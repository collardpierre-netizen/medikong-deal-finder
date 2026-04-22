/**
 * Configuration verrouillée pour la génération + le stockage des PDFs de
 * contrats vendeurs (mandats de facturation).
 *
 * Objectif : aucune variable d'environnement ne doit être configurée
 * manuellement en production. Tout est :
 *  - soit fourni automatiquement par Lovable Cloud (SUPABASE_URL,
 *    SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY),
 *  - soit codé en dur ici (bucket, TTL, content-type, headers CORS) pour
 *    éviter toute dérive entre environnements.
 *
 * `loadContractEnv()` valide STRICTEMENT les secrets au démarrage de la
 * requête et lève une erreur explicite si quelque chose manque/est invalide
 * — l'edge function répondra alors `500 { error: "env_misconfigured" }`
 * avec le détail dans les logs structurés (pas exposé au client).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes verrouillées (NE JAMAIS surcharger via env vars)
// ─────────────────────────────────────────────────────────────────────────────

/** Bucket privé qui stocke les PDFs signés. RLS gérée par migration. */
export const SELLER_CONTRACTS_BUCKET = "seller-contracts";

/** Durée de vie des liens signés renvoyés au client (5 min, rotation forcée). */
export const SIGNED_URL_TTL_SECONDS = 5 * 60;

/** MIME type imposé pour tout objet stocké dans le bucket des contrats. */
export const CONTRACT_PDF_CONTENT_TYPE = "application/pdf";

/** Taille max raisonnable pour un PDF de contrat (10 MB) — protection abus. */
export const CONTRACT_PDF_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Headers CORS verrouillés pour toutes les réponses (succès et erreurs).
 * Inclut les headers `x-supabase-client-*` envoyés par le SDK JS récent.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation des variables d'environnement Supabase (auto-injectées)
// ─────────────────────────────────────────────────────────────────────────────

export interface ContractEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
}

class ContractEnvError extends Error {
  constructor(
    message: string,
    public readonly missing: string[],
    public readonly invalid: string[],
  ) {
    super(message);
    this.name = "ContractEnvError";
  }
}

function validateUrl(value: string | undefined, name: string, errors: string[]): void {
  if (!value) return;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") {
      errors.push(`${name}: doit être en HTTPS (reçu ${u.protocol})`);
    }
    if (!u.hostname.endsWith(".supabase.co")) {
      errors.push(`${name}: hostname inattendu (${u.hostname})`);
    }
  } catch {
    errors.push(`${name}: URL malformée`);
  }
}

function validateJwt(
  value: string | undefined,
  name: string,
  expectedRole: "anon" | "service_role",
  errors: string[],
): void {
  if (!value) return;

  // Nouveau format Supabase (2025+) : `sb_publishable_...` / `sb_secret_...`.
  // Ce ne sont pas des JWT — on valide juste le préfixe et la longueur min.
  if (value.startsWith("sb_publishable_") || value.startsWith("sb_secret_")) {
    const expectedPrefix = expectedRole === "anon" ? "sb_publishable_" : "sb_secret_";
    if (!value.startsWith(expectedPrefix)) {
      errors.push(
        `${name}: préfixe Supabase inattendu (attendu "${expectedPrefix}*")`,
      );
    }
    if (value.length < 30) {
      errors.push(`${name}: clé Supabase trop courte`);
    }
    return;
  }

  // Ancien format : JWT signé avec `role` dans le payload.
  const parts = value.split(".");
  if (parts.length !== 3) {
    errors.push(`${name}: format JWT invalide (attendu 3 segments, reçu ${parts.length})`);
    return;
  }
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { role?: string; exp?: number };
    if (payload.role !== expectedRole) {
      errors.push(`${name}: rôle JWT inattendu "${payload.role}" (attendu "${expectedRole}")`);
    }
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      errors.push(`${name}: JWT expiré`);
    }
  } catch {
    errors.push(`${name}: payload JWT non décodable`);
  }
}

/**
 * Charge et valide les secrets Supabase nécessaires à la fonction.
 * Lève `ContractEnvError` si une variable est manquante ou invalide —
 * l'appelant convertit ça en réponse 500 propre.
 */
export function loadContractEnv(): ContractEnv {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!anonKey) missing.push("SUPABASE_ANON_KEY");

  const invalid: string[] = [];
  validateUrl(supabaseUrl, "SUPABASE_URL", invalid);
  validateJwt(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY", "service_role", invalid);
  validateJwt(anonKey, "SUPABASE_ANON_KEY", "anon", invalid);

  if (missing.length > 0 || invalid.length > 0) {
    throw new ContractEnvError(
      "Configuration des secrets Supabase invalide pour generate-contract-pdf",
      missing,
      invalid,
    );
  }

  return {
    supabaseUrl: supabaseUrl!,
    serviceRoleKey: serviceRoleKey!,
    anonKey: anonKey!,
  };
}

export { ContractEnvError };
