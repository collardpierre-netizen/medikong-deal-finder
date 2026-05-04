import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RETRY_TOKEN_PREFIX = "lazy-retry:";
const GLOBAL_RELOAD_COUNTER_KEY = "medikong:reload-count";
const GLOBAL_RELOAD_LAST_AT_KEY = "medikong:reload-last-at";

/** Max automatic reloads per browser session before we stop and show the boundary. */
export const MAX_AUTO_RELOADS_PER_SESSION = 2;
/** Cooldown between two auto reloads (ms). Prevents tight loops on cascading errors. */
const RELOAD_COOLDOWN_MS = 10_000;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

function isChunkLoadError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("dynamically imported module") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("fetch") ||
    message.includes("_result") ||
    message.includes("default") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("module script") ||
    message.includes("network")
  );
}

function readInt(key: string): number {
  try {
    const raw = window.sessionStorage.getItem(key);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function getReloadAttempts(): number {
  if (typeof window === "undefined") return 0;
  return readInt(GLOBAL_RELOAD_COUNTER_KEY);
}

export function canAutoReload(): boolean {
  if (typeof window === "undefined") return false;
  if (getReloadAttempts() >= MAX_AUTO_RELOADS_PER_SESSION) return false;
  const last = readInt(GLOBAL_RELOAD_LAST_AT_KEY);
  if (last && Date.now() - last < RELOAD_COOLDOWN_MS) return false;
  return true;
}

/** Resets the session reload counter (call after the user manually clicks retry). */
export function resetReloadAttempts() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(GLOBAL_RELOAD_COUNTER_KEY);
    window.sessionStorage.removeItem(GLOBAL_RELOAD_LAST_AT_KEY);
  } catch {
    /* ignore */
  }
}

/** Triggers a hard reload, but only if quota allows. Returns true if reload was triggered. */
export function safeAutoReload(): boolean {
  if (typeof window === "undefined") return false;
  if (!canAutoReload()) return false;
  try {
    const next = getReloadAttempts() + 1;
    window.sessionStorage.setItem(GLOBAL_RELOAD_COUNTER_KEY, String(next));
    window.sessionStorage.setItem(GLOBAL_RELOAD_LAST_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
  return true;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await importer();
      // Defensive: a stale CDN / SPA fallback can resolve a chunk request with
      // an HTML page or an empty module. React's lazy would then store
      // `_result = undefined` and crash on `_result.default` with a blank
      // screen. Force a real error so the boundary + retry kick in.
      if (!mod || typeof (mod as { default?: unknown }).default === "undefined") {
        throw new Error(
          `Lazy chunk "${key}" resolved without a default export (stale or invalid chunk)`,
        );
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`${RETRY_TOKEN_PREFIX}${key}`);
      }
      return mod;
    } catch (error) {
      if (typeof window !== "undefined" && isChunkLoadError(error)) {
        const retryKey = `${RETRY_TOKEN_PREFIX}${key}`;
        const alreadyRetried = window.sessionStorage.getItem(retryKey) === "1";

        // Per-chunk guard (1 retry max for THIS chunk) AND global session cap.
        if (!alreadyRetried && canAutoReload()) {
          window.sessionStorage.setItem(retryKey, "1");
          if (safeAutoReload()) {
            return new Promise<never>(() => undefined);
          }
        }
      }

      // Quota exhausted or non-chunk error: let the LazyRouteBoundary catch it.
      throw error;
    }
  });
}

export function installViteChunkReloadGuard() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    safeAutoReload();
  });
}
