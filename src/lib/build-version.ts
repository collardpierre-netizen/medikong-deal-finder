/**
 * Build version watcher
 * --------------------------------------------------------------
 * À chaque build Vite émet un `/version.json` contenant `buildId`.
 * Au runtime on poll ce fichier et, si l'ID change vs celui figé
 * dans le bundle au moment du build, on sait qu'un redéploiement
 * est intervenu : les chunks lazy chargés ensuite seraient stale.
 *
 * Stratégie :
 *  - Compare buildId courant vs buildId distant (no-store, ignore CDN cache)
 *  - Si différent ET aucune navigation en cours : `location.reload()`
 *  - Sinon : on pose un flag sessionStorage et on rechargera au prochain
 *    chunk-load error (déjà géré par lazy-with-retry).
 *
 * Combiné avec :
 *  - Hash dans les filenames (vite.config.ts)
 *  - LazyRouteBoundary qui propose un retry visuel
 *  - lazy-with-retry qui auto-reload sur chunk error
 */

declare const __BUILD_ID__: string;
import { toast } from "sonner";
import {
  safeAutoReload,
  safeCacheBustReload,
  canAutoReload,
  resetReloadAttempts,
} from "@/lib/lazy-with-retry";
import { bustAdminQueryCache } from "@/lib/admin-cache-bust";
import { isAutoRefreshDisabled } from "@/lib/auto-refresh-preference";

const CURRENT_BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const VERSION_URL = "/version.json";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const STALE_FLAG_KEY = "medikong:build-stale";
const RELOAD_COUNTER_BUILD_KEY = "medikong:reload-counter-build-id";
const TOAST_ID = "medikong-new-version";
const DEFERRED_AUTO_RELOAD_MS = 60_000; // laisse 60 s pour finir une saisie

/**
 * Pages "à risque" pour lesquelles on force le rechargement automatique
 * quand une nouvelle version est détectée. Sur les autres routes on ne
 * recharge JAMAIS automatiquement : le toast reste visible et l'utilisateur
 * recharge quand il le souhaite (le rechargement finira par avoir lieu au
 * prochain chunk-load error via lazy-with-retry, ou à la prochaine navigation).
 *
 * Rationale : les écrans admin manipulent des chiffres/KPIs calculés côté
 * backend et exposent des actions destructives ; il est plus grave d'y
 * afficher un bundle stale que d'y perdre un focus.
 */
const AT_RISK_PATH_PREFIXES = ["/admin"];

/**
 * Routes "sensibles" où l'utilisateur remplit un formulaire long ou un
 * brouillon (checkout, onboarding vendeur, ReStock publier, RFQ, édition
 * admin, paramètres compte, …). Même sur une page à risque, ces routes
 * sont exclues de l'auto-reload : on ne veut pas faire perdre la saisie.
 *
 * Les patterns supportent :
 *  - préfixes littéraux (`/panier`)
 *  - segments d'action fréquents (`/nouveau`, `/edit`, `/publier`) qui
 *    apparaissent souvent en fin ou milieu de path.
 */
const SENSITIVE_PATH_PREFIXES = [
  // Encodage / édition de commandes manuelles : saisie longue, jamais de reload auto
  "/admin/commandes",
  "/panier",
  "/checkout",
  "/onboarding",
  "/compte",
  "/vendor",
  "/restock/publier",
  "/restock/nouveau",
  "/demander-un-prix",
  "/mes-rfq/nouveau",
];
const SENSITIVE_PATH_SEGMENTS = [
  "/nouveau",
  "/new",
  "/edit",
  "/editer",
  "/publier",
  "/creer",
  "/create",
  "/import",
];

function isAtRiskPath(): boolean {
  try {
    const path = window.location?.pathname ?? "";
    return AT_RISK_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  } catch {
    return false;
  }
}

function isSensitivePath(): boolean {
  try {
    const path = window.location?.pathname ?? "";
    if (SENSITIVE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return true;
    }
    // Segments comme `/edit`, `/nouveau`, `/publier` apparaissant n'importe
    // où dans le chemin (ex. `/admin/marques/:slug/edit`).
    return SENSITIVE_PATH_SEGMENTS.some(
      (seg) => path.endsWith(seg) || path.includes(`${seg}/`),
    );
  } catch {
    return false;
  }
}

/**
 * Détection "utilisateur en train de saisir / interagir" plus fiable que le
 * simple `activeElement instanceof HTMLInputElement`. Couvre :
 *  - Élément actif input/textarea/select/contenteditable (y compris à
 *    travers les shadow roots ouverts, ex. composants Radix).
 *  - Ancêtre `contenteditable` (ex. TipTap : l'élément focus peut être
 *    un `<span>` interne).
 *  - Dialogs / drawers / popovers ouverts (Radix pose `data-state="open"`
 *    sur `[role="dialog"]` / `[role="alertdialog"]`).
 *  - Zone marquée `aria-busy="true"` (upload / save en cours).
 *  - Sélection de texte non vide (l'utilisateur est en train de copier).
 *  - Média en cours de lecture non muet.
 */
function getDeepActiveElement(): Element | null {
  try {
    let el: Element | null = document.activeElement;
    while (el && (el as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot?.activeElement) {
      el = (el as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot.activeElement;
    }
    return el;
  } catch {
    return null;
  }
}

function isUserBusy(): boolean {
  try {
    const active = getDeepActiveElement();
    if (active instanceof HTMLElement) {
      const tag = active.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (active.isContentEditable) return true;
      if (active.closest("[contenteditable=\"true\"], [contenteditable=\"\"]")) return true;
    }

    // Modals / drawers / popovers ouverts.
    if (
      document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      )
    ) {
      return true;
    }

    // Zone marquée occupée (upload / save en cours).
    if (document.querySelector('[aria-busy="true"]')) return true;

    // Sélection de texte active (copie en cours).
    const sel = window.getSelection?.();
    if (sel && !sel.isCollapsed && (sel.toString()?.length ?? 0) > 0) return true;

    // Média audio/vidéo en cours de lecture non muet.
    const media = Array.from(
      document.querySelectorAll<HTMLMediaElement>("video, audio"),
    );
    if (media.some((m) => !m.paused && !m.ended && !m.muted && m.currentTime > 0)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Détection "formulaire / brouillon en cours" indépendante du focus.
 *
 * Contrairement à `isUserBusy()` qui exige que l'élément soit *actif*,
 * cette fonction inspecte le DOM à froid pour repérer un brouillon non
 * sauvegardé qui serait perdu par un reload — même si l'utilisateur a
 * momentanément cliqué ailleurs (onglet, notification, etc.).
 *
 * Signaux détectés :
 *  - `<form data-dirty="true">` ou `[data-dirty="true"]` posé par le code
 *    applicatif (react-hook-form + useEffect, TipTap onUpdate, etc.).
 *  - `<input>` / `<textarea>` avec une valeur non vide qui diverge de
 *    l'attribut par défaut (l'utilisateur a tapé quelque chose).
 *  - `<select>` dont la valeur diverge de l'option `defaultSelected`.
 *  - Éléments `contenteditable` non vides (éditeurs riches type TipTap).
 *  - Attribut sentinelle `[data-lov-draft]` posé explicitement par une
 *    page pour indiquer un brouillon en cours.
 *
 * On IGNORE volontairement les champs de recherche/nav (`type="search"`,
 * `role="searchbox"`, `[data-search-input]`) pour ne pas bloquer un reload
 * sur une simple recherche header.
 */
function isSearchLikeInput(el: Element): boolean {
  if (el instanceof HTMLInputElement && el.type === "search") return true;
  const role = el.getAttribute("role");
  if (role === "searchbox" || role === "search") return true;
  if (el.hasAttribute("data-search-input")) return true;
  // Ancêtre marqué comme zone de recherche/navigation.
  if (el.closest('[role="search"], [data-search-input], nav')) return true;
  return false;
}

function inputHasUserValue(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  const value = el.value ?? "";
  if (!value.trim()) return false;
  // Ignore les champs pré-remplis inchangés (defaultValue reflète la valeur
  // initiale rendue par React ou l'attribut `value` du HTML).
  if (el.defaultValue != null && el.defaultValue === value) return false;
  return true;
}

function hasUnsavedDraft(): boolean {
  try {
    // Sentinelles explicites.
    if (document.querySelector('[data-dirty="true"], [data-lov-draft]')) {
      return true;
    }

    // Inputs / textareas avec valeur utilisateur.
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea",
    );
    for (const el of Array.from(inputs)) {
      if (isSearchLikeInput(el)) continue;
      if (el instanceof HTMLInputElement) {
        // Ignore les types non textuels sans intérêt (button, submit, hidden…).
        const t = el.type;
        if (
          t === "button" ||
          t === "submit" ||
          t === "reset" ||
          t === "hidden" ||
          t === "image"
        ) {
          continue;
        }
        // Cases à cocher / radios : dirty si l'état diverge du défaut.
        if (t === "checkbox" || t === "radio") {
          if (el.checked !== el.defaultChecked) return true;
          continue;
        }
      }
      if (inputHasUserValue(el)) return true;
    }

    // Selects dont la sélection diverge du défaut.
    const selects = document.querySelectorAll<HTMLSelectElement>("select");
    for (const sel of Array.from(selects)) {
      if (isSearchLikeInput(sel)) continue;
      const options = Array.from(sel.options);
      const defaultOpt = options.find((o) => o.defaultSelected);
      const currentValue = sel.value;
      if (defaultOpt && defaultOpt.value !== currentValue) return true;
      if (!defaultOpt && currentValue && options[0]?.value !== currentValue) return true;
    }

    // Contenteditable non vide (éditeurs riches).
    const editables = document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"], [contenteditable=""]',
    );
    for (const ed of Array.from(editables)) {
      if (isSearchLikeInput(ed)) continue;
      const text = (ed.textContent ?? "").trim();
      if (text.length > 0) return true;
    }

    return false;
  } catch {
    return false;
  }
}



let deferredReloadTimer: number | null = null;
let toastShown = false;
let started = false;

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return typeof data.buildId === "string" ? data.buildId : null;
  } catch {
    return null;
  }
}

function markStale() {
  try {
    window.sessionStorage.setItem(STALE_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isBuildStale(): boolean {
  try {
    return window.sessionStorage.getItem(STALE_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

async function checkVersion() {
  const remote = await fetchRemoteBuildId();
  if (!remote || remote === CURRENT_BUILD_ID) return;

  resetReloadCountersForRemoteBuild(remote);
  markStale();

  // Nouveau déploiement détecté : purge immédiatement les caches admin
  // en mémoire (chiffres/KPIs) pour ne jamais servir des valeurs calculées
  // par l'ancien backend, même si le reload est différé ci-dessous.
  bustAdminQueryCache();

  const autoRefreshDisabled = isAutoRefreshDisabled();
  const atRisk = isAtRiskPath();
  const busy = isUserBusy();
  // Exclusion supplémentaire : route sensible (formulaires longs,
  // checkout, onboarding, édition admin…) OU brouillon non sauvegardé
  // détecté dans le DOM. Dans ces cas on ne recharge JAMAIS
  // automatiquement, même si la page est "à risque".
  const sensitive = isSensitivePath() || hasUnsavedDraft();

  const canReloadNow =
    !autoRefreshDisabled &&
    atRisk &&
    !sensitive &&
    !busy &&
    document.visibilityState === "visible" &&
    canAutoReload();

  if (canReloadNow) {
    if (!safeCacheBustReload()) safeAutoReload();
    return;
  }

  // Reload différé :
  //  - Sur page à risque (admin) non sensible : toast + retry auto dans 60 s
  //    dès que l'utilisateur n'est plus en train d'interagir ni de saisir.
  //  - Ailleurs / route sensible / brouillon détecté : toast uniquement.
  showNewVersionToast();
  if (atRisk && !sensitive && !autoRefreshDisabled) {
    scheduleDeferredReload();
  }
}

function resetReloadCountersForRemoteBuild(remoteBuildId: string) {
  try {
    const previous = window.sessionStorage.getItem(RELOAD_COUNTER_BUILD_KEY);
    if (previous === remoteBuildId) return;
    resetReloadAttempts();
    window.sessionStorage.setItem(RELOAD_COUNTER_BUILD_KEY, remoteBuildId);
  } catch {
    /* ignore */
  }
}

function showNewVersionToast() {
  if (toastShown) return;
  toastShown = true;
  try {
    toast("Nouvelle version disponible", {
      id: TOAST_ID,
      description:
        "Une mise à jour du site est prête. Rechargez pour l'appliquer.",
      duration: Infinity,
      action: {
        label: "Recharger",
        onClick: () => {
          try {
            window.location.reload();
          } catch {
            /* ignore */
          }
        },
      },
    });
  } catch {
    /* toast non disponible → on retombera sur l'auto-reload programmé */
  }
}

function scheduleDeferredReload() {
  if (deferredReloadTimer != null) return;
  deferredReloadTimer = window.setTimeout(() => {
    deferredReloadTimer = null;
    if (isAutoRefreshDisabled()) return;
    // Si l'utilisateur a navigué hors d'une page à risque entre-temps,
    // ou qu'il a ouvert un formulaire / démarré un brouillon, on n'insiste
    // pas : rechargement seulement là où c'est nécessaire et sûr.
    if (!isAtRiskPath()) return;
    if (isSensitivePath() || hasUnsavedDraft()) return;
    if (
      !isUserBusy() &&
      document.visibilityState === "visible" &&
      canAutoReload()
    ) {
      if (!safeCacheBustReload()) safeAutoReload();
    } else {
      // Toujours pas safe → on retente plus tard.
      scheduleDeferredReload();
    }
  }, DEFERRED_AUTO_RELOAD_MS);
}

export async function preflightBuildVersionBeforeRender(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (CURRENT_BUILD_ID === "dev" || import.meta.env.DEV) return true;

  const remote = await fetchRemoteBuildId();
  if (!remote || remote === CURRENT_BUILD_ID) return true;

  resetReloadCountersForRemoteBuild(remote);
  markStale();
  bustAdminQueryCache();

  // Préférence utilisateur : ne pas recharger automatiquement.
  // Le watcher affichera un toast pour un rechargement manuel.
  if (isAutoRefreshDisabled()) return true;

  // Ne préflighte de rechargement que sur les pages à risque (admin) qui
  // ne sont ni une route sensible (checkout, onboarding, édition…) ni en
  // train d'afficher un brouillon utilisateur. Ailleurs on laisse le boot
  // se poursuivre : le watcher affichera un toast et l'utilisateur
  // rechargera à sa convenance.
  if (!isAtRiskPath()) return true;
  if (isSensitivePath() || hasUnsavedDraft()) return true;

  if (safeCacheBustReload() || safeAutoReload()) return false;
  return true;
}

export function installBuildVersionWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Don't bother in dev.
  if (CURRENT_BUILD_ID === "dev" || import.meta.env.DEV) return;

  // Immediate check at boot to catch tabs left open during a redeploy,
  // puis re-check à +30 s pour rattraper un déploiement juste après le boot.
  void checkVersion();
  window.setTimeout(() => void checkVersion(), 30_000);
  // Periodic check
  window.setInterval(() => void checkVersion(), POLL_INTERVAL_MS);
  // Re-check when tab regains focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkVersion();
  });
  // If we already flagged stale and the user comes back, reload — mais
  // uniquement sur une page à risque et si l'utilisateur n'est pas en train
  // de saisir/interagir.
  window.addEventListener("focus", () => {
    if (isAutoRefreshDisabled()) return;
    if (!isAtRiskPath()) return;
    if (isSensitivePath() || hasUnsavedDraft()) return;
    if (isUserBusy()) return;
    if (isBuildStale() && canAutoReload()) {
      if (!safeCacheBustReload()) safeAutoReload();
    }
  });
}

export const __TEST__ = { CURRENT_BUILD_ID, VERSION_URL };
