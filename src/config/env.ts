/**
 * Environment detection — Lovable.
 * Lovable ne permet pas d'éditer .env, on détecte donc via hostname avec fallback VITE_APP_ENV.
 *
 * Mapping :
 * - medikong.pro / www.medikong.pro                  → prod
 * - dev.medikong.pro / staging.medikong.pro          → staging
 * - *.lovable.app / localhost / autres               → dev
 */

export type AppEnv = "dev" | "staging" | "prod";

function detectEnv(): AppEnv {
  // 1. Override explicite via env var (CI / build)
  const explicit = (import.meta.env.VITE_APP_ENV as string | undefined)?.toLowerCase();
  if (explicit === "prod" || explicit === "production") return "prod";
  if (explicit === "staging") return "staging";
  if (explicit === "dev" || explicit === "development") return "dev";

  // 2. Détection hostname (browser only)
  if (typeof window === "undefined") return "dev";
  const host = window.location.hostname.toLowerCase();

  if (host === "medikong.pro" || host === "www.medikong.pro") return "prod";
  if (host === "dev.medikong.pro") return "staging"; // dev sous-domaine = pré-prod
  if (host.startsWith("staging.")) return "staging";
  return "dev";
}

export const APP_ENV: AppEnv = detectEnv();
export const IS_PROD = APP_ENV === "prod";
export const IS_STAGING = APP_ENV === "staging";
export const IS_DEV = APP_ENV === "dev";
export const IS_NON_PROD = !IS_PROD;

export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "https://medikong.pro");
