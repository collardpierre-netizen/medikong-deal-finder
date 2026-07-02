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

const CURRENT_BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const VERSION_URL = "/version.json";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const STALE_FLAG_KEY = "medikong:build-stale";
const RELOAD_COUNTER_BUILD_KEY = "medikong:reload-counter-build-id";
const TOAST_ID = "medikong-new-version";
const DEFERRED_AUTO_RELOAD_MS = 60_000; // laisse 60 s pour finir une saisie

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

  // If the user is mid-typing in a form, don't yank the page from under them.
  const active = document.activeElement;
  const isEditing =
    active instanceof HTMLElement &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.isContentEditable);

  const canReloadNow =
    !isEditing && document.visibilityState === "visible" && canAutoReload();

  if (canReloadNow) {
    if (!safeCacheBustReload()) safeAutoReload();
    return;
  }

  // Reload différé : on prévient l'utilisateur avec un toast persistant
  // + CTA « Recharger maintenant », et on planifie un nouveau tentative
  // automatique dans 60 s (au cas où il quitterait le champ entre temps).
  showNewVersionToast();
  scheduleDeferredReload();
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
    const active = document.activeElement;
    const stillEditing =
      active instanceof HTMLElement &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    if (
      !stillEditing &&
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
  // If we already flagged stale and the user comes back, reload.
  window.addEventListener("focus", () => {
    if (isBuildStale() && canAutoReload()) {
      if (!safeCacheBustReload()) safeAutoReload();
    }
  });
}

export const __TEST__ = { CURRENT_BUILD_ID, VERSION_URL };
