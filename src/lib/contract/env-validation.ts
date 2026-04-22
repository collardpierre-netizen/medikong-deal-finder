/**
 * Validation au démarrage des prérequis nécessaires à la génération et au
 * stockage des PDFs de mandat de facturation.
 *
 * La génération PDF est exécutée 100% côté navigateur (jsPDF) puis le fichier
 * est uploadé dans le bucket privé `seller-contracts` via le SDK Supabase.
 * Les seules variables d'environnement réellement requises côté client sont
 * donc celles du SDK Supabase (URL + clé publishable). Cette validation
 * remonte précocement toute incohérence (variable manquante, URL malformée,
 * clé qui n'a pas le bon format JWT, bucket inaccessible) sans bloquer
 * l'application — l'objectif est d'observer, pas de crasher.
 *
 * Les checks plus profonds (RLS, taille max, MIME type) sont validés
 * uniquement au moment de l'upload réel pour ne pas générer de bruit
 * superflu pour les utilisateurs qui ne signent jamais de contrat.
 */
import { supabase } from "@/integrations/supabase/client";
import { SELLER_CONTRACTS_BUCKET } from "@/lib/contract/contract-storage";

export type EnvCheckSeverity = "info" | "warning" | "error";

export interface EnvCheckResult {
  /** Identifiant stable pour filtrer/tester. */
  key: string;
  /** Libellé court à afficher dans les logs / outils admin. */
  label: string;
  severity: EnvCheckSeverity;
  /** Détail technique (peut être affiché dans la console navigateur). */
  detail: string;
  /** Action recommandée pour résoudre le problème. */
  remediation?: string;
}

/**
 * Vérifie les variables d'environnement injectées par Vite (préfixées `VITE_`).
 * Vite remplace `import.meta.env.VITE_*` au build → si la valeur est manquante
 * en runtime c'est qu'elle l'était au build (mauvais déploiement).
 */
function checkViteEnv(): EnvCheckResult[] {
  const results: EnvCheckResult[] = [];
  const env = import.meta.env;

  const requiredVars: Array<{
    name: keyof ImportMetaEnv | string;
    label: string;
    validate?: (v: string) => string | null;
  }> = [
    {
      name: "VITE_SUPABASE_URL",
      label: "URL du backend Supabase",
      validate: (v) => {
        try {
          const u = new URL(v);
          if (u.protocol !== "https:") return "L'URL doit être en HTTPS.";
          if (!u.hostname.endsWith(".supabase.co")) {
            return "L'URL ne pointe pas vers un projet Supabase officiel.";
          }
          return null;
        } catch {
          return "URL malformée.";
        }
      },
    },
    {
      name: "VITE_SUPABASE_PUBLISHABLE_KEY",
      label: "Clé publishable Supabase (JWT anon)",
      validate: (v) => {
        // Un JWT a 3 segments base64url séparés par des points.
        const parts = v.split(".");
        if (parts.length !== 3) return "Format JWT invalide (3 segments attendus).";
        try {
          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
          );
          if (payload.role !== "anon") {
            return `Rôle JWT inattendu: "${payload.role}". Attendu: "anon".`;
          }
          if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
            return "Le JWT est expiré.";
          }
          return null;
        } catch {
          return "Impossible de décoder le payload JWT.";
        }
      },
    },
    {
      name: "VITE_SUPABASE_PROJECT_ID",
      label: "Identifiant du projet Supabase",
      validate: (v) =>
        /^[a-z0-9]{20,}$/.test(v) ? null : "Format inhabituel (attendu: identifiant alphanumérique).",
    },
  ];

  for (const v of requiredVars) {
    const raw = (env as Record<string, string | undefined>)[v.name as string];
    if (!raw || raw.trim() === "") {
      results.push({
        key: `env.${v.name}.missing`,
        label: v.label,
        severity: "error",
        detail: `Variable d'environnement manquante: ${v.name}`,
        remediation:
          "Reconnectez Lovable Cloud depuis Connectors → Lovable Cloud, puis re-publiez l'app.",
      });
      continue;
    }
    const err = v.validate?.(raw);
    if (err) {
      results.push({
        key: `env.${v.name}.invalid`,
        label: v.label,
        severity: "error",
        detail: `${v.name}: ${err}`,
        remediation:
          "Vérifiez que le projet Supabase associé est actif et que la clé publishable n'a pas été régénérée sans re-publication.",
      });
    }
  }

  return results;
}

/**
 * Vérifie que le bucket `seller-contracts` est accessible depuis le navigateur
 * (sans nécessiter une session authentifiée). On utilise `list` avec une limite
 * de 1 dans un dossier sentinelle inexistant : un succès (liste vide) confirme
 * que le bucket existe et que les RLS répondent. Une erreur "Bucket not found"
 * indique une mauvaise configuration. Une erreur RLS est *attendue* pour un
 * utilisateur non authentifié et n'est pas remontée comme erreur.
 */
async function checkContractsBucket(): Promise<EnvCheckResult[]> {
  try {
    const { error } = await supabase.storage
      .from(SELLER_CONTRACTS_BUCKET)
      .list("__healthcheck__", { limit: 1 });

    if (!error) return [];

    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("not found") || msg.includes("bucket")) {
      return [
        {
          key: "storage.bucket.missing",
          label: "Bucket de stockage des contrats",
          severity: "error",
          detail: `Le bucket "${SELLER_CONTRACTS_BUCKET}" est inaccessible: ${error.message}`,
          remediation:
            "Vérifiez que le bucket existe et que ses policies RLS sont actives dans Lovable Cloud.",
        },
      ];
    }

    // Erreur RLS → attendu pour un utilisateur non authentifié, on log en info.
    return [
      {
        key: "storage.bucket.rls",
        label: "Bucket de stockage des contrats",
        severity: "info",
        detail: `Bucket joignable, accès restreint par RLS (réponse: ${error.message}).`,
      },
    ];
  } catch (err) {
    return [
      {
        key: "storage.bucket.network",
        label: "Bucket de stockage des contrats",
        severity: "warning",
        detail: `Impossible de joindre le storage Supabase: ${
          err instanceof Error ? err.message : String(err)
        }`,
        remediation:
          "Vérifiez la connectivité réseau et que VITE_SUPABASE_URL pointe vers un projet en ligne.",
      },
    ];
  }
}

/** Résultat agrégé de la validation. */
export interface ContractEnvHealth {
  ok: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  results: EnvCheckResult[];
  checkedAt: string;
}

/**
 * Lance toutes les validations en parallèle et retourne un rapport agrégé.
 * Idempotent — peut être ré-appelé depuis une page admin pour diagnostic.
 */
export async function validateContractEnv(): Promise<ContractEnvHealth> {
  const envResults = checkViteEnv();
  // On évite l'appel réseau si les variables Supabase sont déjà invalides :
  // le SDK lèverait de toute façon une erreur peu informative.
  const blockingEnvError = envResults.some((r) => r.severity === "error");
  const storageResults = blockingEnvError ? [] : await checkContractsBucket();

  const results = [...envResults, ...storageResults];
  const hasErrors = results.some((r) => r.severity === "error");
  const hasWarnings = results.some((r) => r.severity === "warning");
  return {
    ok: !hasErrors && !hasWarnings,
    hasErrors,
    hasWarnings,
    results,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Variante "fire-and-forget" pour `main.tsx` : exécute la validation puis
 * écrit un rapport groupé dans la console et expose le résultat sur
 * `window.__medikongContractEnv` pour un diagnostic rapide depuis la console
 * navigateur en production. Ne lève jamais d'erreur (best-effort).
 */
export function runContractEnvValidationOnBoot(): void {
  // Délai léger pour ne pas bloquer le premier rendu.
  setTimeout(() => {
    validateContractEnv()
      .then((health) => {
        const w = window as unknown as {
          __medikongContractEnv?: ContractEnvHealth;
        };
        w.__medikongContractEnv = health;

        if (health.ok) {
          console.info(
            "[medikong] ✓ Configuration PDF/contrats validée",
            { checkedAt: health.checkedAt }
          );
          return;
        }

        const groupLabel = health.hasErrors
          ? "[medikong] ✗ Configuration PDF/contrats — erreurs détectées"
          : "[medikong] ⚠ Configuration PDF/contrats — avertissements";
        console.groupCollapsed(groupLabel);
        for (const r of health.results) {
          const log =
            r.severity === "error"
              ? console.error
              : r.severity === "warning"
                ? console.warn
                : console.info;
          log.call(
            console,
            `[${r.severity.toUpperCase()}] ${r.label} (${r.key})`,
            { detail: r.detail, remediation: r.remediation }
          );
        }
        console.info(
          "Inspectez window.__medikongContractEnv pour le rapport complet."
        );
        console.groupEnd();
      })
      .catch((err) => {
        // Ne jamais propager — la validation est purement diagnostique.
        console.warn("[medikong] Validation env contrats interrompue:", err);
      });
  }, 0);
}
