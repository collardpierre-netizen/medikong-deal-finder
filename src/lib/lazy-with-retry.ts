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
    message.includes("network") ||
    // HTML-instead-of-JS responses (SPA fallback / 404 page returned with text/html)
    message.includes("text/html") ||
    message.includes("mime type") ||
    message.includes("expected a javascript") ||
    message.includes("html-document") ||
    message.includes("not a valid javascript")
  );
}

export interface ChunkProbeResult {
  url: string;
  status: number | null;
  statusText: string | null;
  contentType: string | null;
  contentLength: string | null;
  bodySnippet: string | null;
  looksLikeHtml: boolean;
  fetchError?: string;
}

/**
 * Probes a URL and returns diagnostics (status, content-type, body snippet).
 * Used to identify why a dynamic import failed: missing chunk, SPA fallback,
 * CDN error page, etc.
 */
export async function probeChunkUrl(url: string): Promise<ChunkProbeResult> {
  const result: ChunkProbeResult = {
    url,
    status: null,
    statusText: null,
    contentType: null,
    contentLength: null,
    bodySnippet: null,
    looksLikeHtml: false,
  };
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    result.status = res.status;
    result.statusText = res.statusText || null;
    const ct = (res.headers.get("content-type") || "").toLowerCase() || null;
    result.contentType = ct;
    result.contentLength = res.headers.get("content-length");
    try {
      const body = await res.text();
      result.bodySnippet = body.slice(0, 512);
      const head = body.slice(0, 64).trim().toLowerCase();
      const ctHtml = !!ct && ct.includes("text/html");
      const ctJs =
        !!ct && (ct.includes("javascript") || ct.includes("ecmascript") || ct.includes("module"));
      result.looksLikeHtml =
        ctHtml ||
        (!ctJs &&
          (head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<"))) ||
        !res.ok;
    } catch {
      result.looksLikeHtml = !res.ok;
    }
  } catch (e) {
    result.fetchError = getErrorMessage(e);
  }
  return result;
}

async function isHtmlResponse(url: string): Promise<boolean> {
  const probe = await probeChunkUrl(url);
  return probe.looksLikeHtml;
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
    let importError: unknown = null;
    let mod: { default: T } | null = null;
    try {
      mod = await importer();
    } catch (err) {
      importError = err;
    }

    // Detect HTML-instead-of-JS: either the import threw, or it resolved
    // without a default export (some bundlers swallow the MIME error).
    const looksInvalid =
      importError != null ||
      !mod ||
      typeof (mod as { default?: unknown }).default === "undefined";

    if (looksInvalid) {
      // Try to extract a URL from the original error to probe its content-type.
      const msg = getErrorMessage(importError);
      const urlMatch = msg.match(/https?:\/\/[^\s'")]+\.[a-z]+(?:\?[^\s'")]*)?/i);
      if (urlMatch && (await isHtmlResponse(urlMatch[0]))) {
        importError = new Error(
          `Lazy chunk "${key}" was served as text/html instead of JavaScript (stale deploy or SPA fallback): ${urlMatch[0]}`,
        );
      } else if (!importError) {
        importError = new Error(
          `Lazy chunk "${key}" resolved without a default export (stale or invalid chunk)`,
        );
      }

      if (typeof window !== "undefined" && isChunkLoadError(importError)) {
        const retryKey = `${RETRY_TOKEN_PREFIX}${key}`;
        const alreadyRetried = window.sessionStorage.getItem(retryKey) === "1";
        if (!alreadyRetried && canAutoReload()) {
          window.sessionStorage.setItem(retryKey, "1");
          if (safeAutoReload()) {
            return new Promise<never>(() => undefined);
          }
        }
      }
      throw importError;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`${RETRY_TOKEN_PREFIX}${key}`);
    }
    return mod!;
  });
}

export function installViteChunkReloadGuard() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    safeAutoReload();
  });
}
