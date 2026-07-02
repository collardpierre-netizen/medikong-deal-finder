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

  const canReloadNow =
    !autoRefreshDisabled &&
    atRisk &&
    !busy &&
    document.visibilityState === "visible" &&
    canAutoReload();

  if (canReloadNow) {
    if (!safeCacheBustReload()) safeAutoReload();
    return;
  }

  // Reload différé :
  //  - Sur page à risque (admin) : toast + retry auto dans 60 s dès que
  //    l'utilisateur n'est plus en train d'interagir.
  //  - Ailleurs : toast uniquement, aucun rechargement automatique
  //    (l'utilisateur recharge quand il veut via le CTA du toast).
  showNewVersionToast();
  if (atRisk && !autoRefreshDisabled) {
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
    // on n'insiste pas : rechargement seulement là où c'est nécessaire.
    if (!isAtRiskPath()) return;
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

  // Ne préflighte de rechargement que sur les pages à risque (admin).
  // Ailleurs on laisse le boot se poursuivre : le watcher affichera un toast
  // et l'utilisateur rechargera à sa convenance.
  if (!isAtRiskPath()) return true;

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
    if (isUserBusy()) return;
    if (isBuildStale() && canAutoReload()) {
      if (!safeCacheBustReload()) safeAutoReload();
    }
  });
}

export const __TEST__ = { CURRENT_BUILD_ID, VERSION_URL };
