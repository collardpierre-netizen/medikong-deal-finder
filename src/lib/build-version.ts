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
import { safeAutoReload, canAutoReload } from "@/lib/lazy-with-retry";

const CURRENT_BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const VERSION_URL = "/version.json";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const STALE_FLAG_KEY = "medikong:build-stale";

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

  markStale();

  // If the user is mid-typing in a form, don't yank the page from under them.
  const active = document.activeElement;
  const isEditing =
    active instanceof HTMLElement &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.isContentEditable);

  if (!isEditing && document.visibilityState === "visible" && canAutoReload()) {
    safeAutoReload();
  }
  // Otherwise: the next chunk error or visibility change will trigger reload.
}

export function installBuildVersionWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Don't bother in dev.
  if (CURRENT_BUILD_ID === "dev" || import.meta.env.DEV) return;

  // Initial check shortly after boot
  window.setTimeout(() => void checkVersion(), 30_000);
  // Periodic check
  window.setInterval(() => void checkVersion(), POLL_INTERVAL_MS);
  // Re-check when tab regains focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkVersion();
  });
  // If we already flagged stale and the user comes back, reload.
  window.addEventListener("focus", () => {
    if (isBuildStale() && canAutoReload()) safeAutoReload();
  });
}

export const __TEST__ = { CURRENT_BUILD_ID, VERSION_URL };
