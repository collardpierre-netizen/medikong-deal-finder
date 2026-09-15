/**
 * Surface detection — routage deux-hôtes MediKong.
 *
 * Deux surfaces distinctes, servies par la même application :
 * - `care`   : care.medikong.pro (PWA établissements de soins, back-offices Groupe/Résidence)
 * - `market` : medikong.pro, www.medikong.pro, dev.medikong.pro, previews (marketplace + admin)
 *
 * Le stockage navigateur (localStorage, IndexedDB, service worker, souscriptions push)
 * est scopé à l'origine : Care doit vivre sur son propre hôte, d'où cette séparation.
 *
 * La surface est calculée une seule fois au chargement. Aucun composant ne doit
 * relire `window.location.hostname` : importer `APP_SURFACE` / `IS_CARE` / `IS_MARKET`.
 */

export type AppSurface = "market" | "care";

const CARE_SURFACE_STORAGE_KEY = "mk_surface_override";

function detectSurface(): AppSurface {
  // 1. Override explicite au build (CI / preview dédiée)
  const explicit = (import.meta.env.VITE_SURFACE as string | undefined)?.toLowerCase();
  if (explicit === "care") return "care";
  if (explicit === "market") return "market";

  if (typeof window === "undefined") return "market";

  const host = window.location.hostname.toLowerCase();

  // 2. Hôtes Care réels
  if (host === "care.medikong.pro" || host === "care.dev.medikong.pro") return "care";
  if (host.startsWith("care.")) return "care";

  // 3. Local / preview : ?surface=care mémorisé pour la session d'onglet
  try {
    const param = new URLSearchParams(window.location.search).get("surface")?.toLowerCase();
    if (param === "care" || param === "market") {
      window.sessionStorage.setItem(CARE_SURFACE_STORAGE_KEY, param);
      return param as AppSurface;
    }
    const stored = window.sessionStorage.getItem(CARE_SURFACE_STORAGE_KEY)?.toLowerCase();
    if (stored === "care" || stored === "market") return stored as AppSurface;
  } catch {
    // sessionStorage indisponible (mode privé strict) → surface par défaut
  }

  return "market";
}

export const APP_SURFACE: AppSurface = detectSurface();
export const IS_CARE = APP_SURFACE === "care";
export const IS_MARKET = APP_SURFACE === "market";

/** Origine canonique de la surface Care (production). */
export const CARE_ORIGIN = "https://care.medikong.pro";

/**
 * Construit l'URL Care équivalente à un chemin `/care/...` de la marketplace.
 * `/care/groups/abc?x=1` → `https://care.medikong.pro/groups/abc?x=1`
 */
export function careUrlFromLegacyPath(pathname: string, search = ""): string {
  const stripped = pathname.replace(/^\/care(?=\/|$)/, "") || "/";
  const base =
    typeof window !== "undefined" && window.location.hostname.toLowerCase().startsWith("dev.")
      ? "https://care.dev.medikong.pro"
      : CARE_ORIGIN;
  return `${base}${stripped.startsWith("/") ? stripped : `/${stripped}`}${search}`;
}
