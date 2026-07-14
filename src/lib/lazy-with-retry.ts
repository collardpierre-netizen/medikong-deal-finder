import {
  createElement,
  forwardRef,
  lazy,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

const RETRY_TOKEN_PREFIX = "lazy-retry:";
const CACHE_BUST_TOKEN_PREFIX = "lazy-cache-bust:";
const GLOBAL_RELOAD_COUNTER_KEY = "medikong:reload-count";
const GLOBAL_RELOAD_LAST_AT_KEY = "medikong:reload-last-at";
const CACHE_BUST_RELOAD_COUNTER_KEY = "medikong:chunk-cache-bust-count";

/** Max automatic reloads per browser session before we stop and show the boundary. */
export const MAX_AUTO_RELOADS_PER_SESSION = 2;
/** Cooldown between two auto reloads (ms). Prevents tight loops on cascading errors. */
const RELOAD_COOLDOWN_MS = 10_000;
const MAX_CACHE_BUST_RELOADS_PER_SESSION = 2;
const TRANSIENT_CHUNK_RELOAD_COUNTER_KEY = "medikong:transient-chunk-reload-count";
const MAX_TRANSIENT_CHUNK_RELOADS_PER_SESSION = 5;
const TRANSIENT_CHUNK_POLL_DELAY_MS = 2_500;
const TRANSIENT_CHUNK_MAX_WAIT_MS = 10_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractChunkUrl(message: string): string | null {
  const urlMatch = message.match(/https?:\/\/[^\s'")]+\.[a-z]+(?:\?[^\s'")]*)?/i);
  return urlMatch?.[0] ?? null;
}

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

function isTransientChunkProbe(probe: ChunkProbeResult | null): boolean {
  if (!probe) return false;
  if (probe.fetchError) return true;
  if (probe.status == null) return false;
  return probe.status === 408 || probe.status === 429 || probe.status >= 500;
}

function isStaleHtmlFallbackProbe(probe: ChunkProbeResult | null): boolean {
  if (!probe?.looksLikeHtml) return false;
  return !isTransientChunkProbe(probe);
}

function isHealthyJavaScriptProbe(probe: ChunkProbeResult | null): boolean {
  if (!probe) return false;
  if (probe.fetchError || probe.looksLikeHtml) return false;
  if (probe.status == null || probe.status < 200 || probe.status >= 400) return false;
  const contentType = (probe.contentType ?? "").toLowerCase();
  return (
    contentType.includes("javascript") ||
    contentType.includes("ecmascript") ||
    contentType.includes("module") ||
    contentType === ""
  );
}

async function waitForChunkServerRecovery(url: string): Promise<boolean> {
  const startedAt = Date.now();
  while (typeof window !== "undefined" && Date.now() - startedAt < TRANSIENT_CHUNK_MAX_WAIT_MS) {
    const probe = await probeChunkUrl(url);
    if (isHealthyJavaScriptProbe(probe) || isStaleHtmlFallbackProbe(probe)) return true;
    await delay(TRANSIENT_CHUNK_POLL_DELAY_MS);
  }
  return false;
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
    window.sessionStorage.removeItem(CACHE_BUST_RELOAD_COUNTER_KEY);
    window.sessionStorage.removeItem(TRANSIENT_CHUNK_RELOAD_COUNTER_KEY);
    window.sessionStorage.removeItem("medikong:transient-chunk-url");
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(CACHE_BUST_TOKEN_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Progressive backoff before a hard reload: 800ms, 2s, 4s, capped at 6s.
 * Purpose: give the current UI a beat before it "jumps" to a new page,
 * and space out consecutive reload attempts across the session.
 */
const RELOAD_BACKOFF_STEPS_MS = [800, 2_000, 4_000, 6_000] as const;

function reloadBackoffMs(attemptsAlreadyDone: number): number {
  const idx = Math.max(0, Math.min(attemptsAlreadyDone, RELOAD_BACKOFF_STEPS_MS.length - 1));
  return RELOAD_BACKOFF_STEPS_MS[idx];
}

/** Testing hook so unit tests don't have to wait real timers. */
export const __reloadTiming = {
  /** Override the timer used before a reload actually fires. */
  scheduler: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
};

function scheduleReload(fn: () => void, ms: number) {
  __reloadTiming.scheduler(fn, ms);
}

/** Triggers a hard reload, but only if quota allows. Returns true if reload was scheduled. */
export function safeAutoReload(): boolean {
  if (typeof window === "undefined") return false;
  if (!canAutoReload()) return false;
  const attemptsAlreadyDone = getReloadAttempts();
  try {
    window.sessionStorage.setItem(GLOBAL_RELOAD_COUNTER_KEY, String(attemptsAlreadyDone + 1));
    window.sessionStorage.setItem(GLOBAL_RELOAD_LAST_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  scheduleReload(() => {
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  }, reloadBackoffMs(attemptsAlreadyDone));
  return true;
}

export function safeCacheBustReload(): boolean {
  if (typeof window === "undefined") return false;
  const attempts = readInt(CACHE_BUST_RELOAD_COUNTER_KEY);
  if (attempts >= MAX_CACHE_BUST_RELOADS_PER_SESSION) return false;

  // Cooldown between successive cache-bust reloads: prevents the
  // `vite:preloadError` guard from firing back-to-back and making the
  // page flicker/jump.
  const last = readInt(GLOBAL_RELOAD_LAST_AT_KEY);
  if (last && Date.now() - last < RELOAD_COOLDOWN_MS) return false;

  try {
    window.sessionStorage.setItem(CACHE_BUST_RELOAD_COUNTER_KEY, String(attempts + 1));
    window.sessionStorage.setItem(GLOBAL_RELOAD_LAST_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }

  scheduleReload(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_v", Date.now().toString());
      window.location.replace(url.toString());
    } catch {
      try {
        window.location.reload();
      } catch {
        /* ignore */
      }
    }
  }, reloadBackoffMs(attempts));
  return true;
}

export function safeTransientChunkReload(url?: string | null): boolean {
  if (typeof window === "undefined") return false;
  const attempts = readInt(TRANSIENT_CHUNK_RELOAD_COUNTER_KEY);
  if (attempts >= MAX_TRANSIENT_CHUNK_RELOADS_PER_SESSION) return false;

  try {
    window.sessionStorage.setItem(TRANSIENT_CHUNK_RELOAD_COUNTER_KEY, String(attempts + 1));
    window.sessionStorage.setItem(GLOBAL_RELOAD_LAST_AT_KEY, String(Date.now()));
    if (url) window.sessionStorage.setItem("medikong:transient-chunk-url", url);
  } catch {
    /* ignore */
  }

  scheduleReload(() => {
    try {
      const current = new URL(window.location.href);
      current.searchParams.set("_chunkRetry", String(attempts + 1));
      current.searchParams.set("_t", Date.now().toString());
      window.location.replace(current.toString());
    } catch {
      try {
        window.location.reload();
      } catch {
        /* ignore */
      }
    }
  }, reloadBackoffMs(attempts));
  return true;
}

/**
 * Number of in-place import retries (with exponential backoff) attempted
 * BEFORE we escalate to a full page reload. Handles transient network blips,
 * cold CDN edges, and flaky mobile connections without disturbing the user.
 */
const IN_PLACE_RETRY_ATTEMPTS = 3;
const IN_PLACE_RETRY_BASE_DELAY_MS = 250;
const IN_PLACE_RETRY_MAX_DELAY_MS = 1500;

function backoffDelay(attempt: number) {
  const exp = IN_PLACE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * IN_PLACE_RETRY_BASE_DELAY_MS;
  return Math.min(IN_PLACE_RETRY_MAX_DELAY_MS, exp + jitter);
}

function isLikelyTransient(error: unknown, probe: ChunkProbeResult | null) {
  if (isStaleHtmlFallbackProbe(probe)) return false;
  if (isTransientChunkProbe(probe)) return true;
  const msg = getErrorMessage(error).toLowerCase();
  if (!msg) return true;
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("load failed") ||
    msg.includes("dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("chunkloaderror") ||
    msg.includes("module script")
  );
}

async function attemptImport<T>(
  importer: () => Promise<{ default: T }>,
): Promise<{ mod: { default: T } | null; error: unknown }> {
  try {
    const mod = await importer();
    return { mod, error: null };
  } catch (err) {
    return { mod: null, error: err };
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string,
): LazyExoticComponent<T> {
  // React.lazy caches the promise permanently — including a rejected one.
  // We wrap it in a component that recreates the underlying lazy on failure,
  // so a subsequent navigation to the same route retries the import instead of
  // re-throwing the cached rejection (which would force the user to click twice).
  let cachedLazy: LazyExoticComponent<T> | null = null;
  let cachedImportPromise: Promise<{ default: T }> | null = null;
  let bustToken = 0;

  const buildImport = async (): Promise<{ default: T }> => {
    // ---- Phase 1: in-place retries with exponential backoff ------------
    let importError: unknown = null;
    let mod: { default: T } | null = null;

    for (let attempt = 0; attempt < IN_PLACE_RETRY_ATTEMPTS; attempt++) {
      const res = await attemptImport(importer);
      mod = res.mod;
      importError = res.error;

      const resolvedOk =
        importError == null &&
        mod != null &&
        typeof (mod as { default?: unknown }).default !== "undefined";
      if (resolvedOk) break;

      // Only backoff+retry when it looks transient AND we have attempts left.
      // Skip the sniff on the last iteration so we exit immediately to Phase 2.
      if (attempt < IN_PLACE_RETRY_ATTEMPTS - 1) {
        if (importError == null) break;
        // Cheap probe first (only if we have a URL to probe) so we don't
        // waste retries on a stale deploy.
        const url = extractChunkUrl(getErrorMessage(importError));
        let probe: ChunkProbeResult | null = null;
        if (url) probe = await probeChunkUrl(url);
        if (isStaleHtmlFallbackProbe(probe)) break; // deploy stale → escalate now
        if (!isLikelyTransient(importError, probe)) break;
        await delay(backoffDelay(attempt));
      }
    }

    const looksInvalid =
      importError != null ||
      !mod ||
      typeof (mod as { default?: unknown }).default === "undefined";

    if (looksInvalid) {
      // ---- Phase 2: diagnose + escalate to reload or throw -------------
      const msg = getErrorMessage(importError);
      const url = extractChunkUrl(msg);
      let probe: ChunkProbeResult | null = null;
      if (url) probe = await probeChunkUrl(url);

      if (isStaleHtmlFallbackProbe(probe)) {
        importError = new Error(
          `Lazy chunk "${key}" was served as text/html instead of JavaScript (stale deploy or SPA fallback): ${probe.url}`,
        );
      } else if (isTransientChunkProbe(probe)) {
        importError = new Error(
          `Lazy chunk "${key}" is temporarily unavailable (${probe.status ?? probe.fetchError ?? "network"}): ${probe.url}`,
        );
      } else if (!importError) {
        importError = new Error(
          `Lazy chunk "${key}" resolved without a default export (stale or invalid chunk)`,
        );
      }

      // Attach diagnostic context so the boundary/reporter can persist it.
      try {
        (importError as Error & { chunkKey?: string; probe?: ChunkProbeResult | null }).chunkKey = key;
        (importError as Error & { chunkKey?: string; probe?: ChunkProbeResult | null }).probe = probe;
      } catch {
        /* ignore */
      }

      if (typeof window !== "undefined" && isChunkLoadError(importError)) {
        const retryKey = `${RETRY_TOKEN_PREFIX}${key}`;
        const alreadyRetried = window.sessionStorage.getItem(retryKey) === "1";
        if (isTransientChunkProbe(probe) && url) {
          await waitForChunkServerRecovery(url);
          if (safeTransientChunkReload(url)) {
            return new Promise<never>(() => undefined);
          }
        }
        if (isStaleHtmlFallbackProbe(probe)) {
          window.sessionStorage.setItem(`${CACHE_BUST_TOKEN_PREFIX}${key}`, "1");
          if (safeCacheBustReload()) {
            return new Promise<never>(() => undefined);
          }
        }
        if (!alreadyRetried && canAutoReload()) {
          window.sessionStorage.setItem(retryKey, "1");
          if (safeAutoReload()) {
            return new Promise<never>(() => undefined);
          }
        }
      }
      // Invalidate the module-scoped lazy cache so the NEXT navigation to
      // this route recreates a fresh `lazy(...)` and retries the import,
      // instead of re-throwing React's cached rejected promise (which is
      // what forces users to click the menu 2× to see the page).
      cachedLazy = null;
      cachedImportPromise = null;
      throw importError;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`${RETRY_TOKEN_PREFIX}${key}`);
      // A lazy chunk resolved successfully → the app is healthy again.
      // Reset the session reload counters so a future unrelated chunk
      // failure isn't immediately gated by past reloads accumulated
      // across navigation. Without this, hitting the auto-reload cap
      // once per session permanently pins the boundary on any later
      // transient error.
      try {
        window.sessionStorage.removeItem(GLOBAL_RELOAD_COUNTER_KEY);
        window.sessionStorage.removeItem(GLOBAL_RELOAD_LAST_AT_KEY);
        // NB: on NE réinitialise PAS CACHE_BUST_RELOAD_COUNTER_KEY ici.
        // Ce compteur borne la garde `vite:preloadError` qui recharge
        // avec `?_v=…` sur chunk stale ; le remettre à zéro sur chaque
        // succès permet à la garde de reboucler indéfiniment (page qui
        // « saute ») quand un chunk pre-bundlé Vite alterne succès/échec.
      } catch {
        /* ignore */
      }
    }
    return mod!;
  };

  const getLazy = (): LazyExoticComponent<T> => {
    if (!cachedLazy) {
      // Capture the same promise instance across renders while it's pending,
      // so React's Suspense sees a consistent thenable per mount cycle.
      const token = ++bustToken;
      cachedImportPromise = buildImport().catch((e) => {
        // Ensure any concurrent readers also see the invalidation.
        if (bustToken === token) {
          cachedLazy = null;
          cachedImportPromise = null;
        }
        throw e;
      });
      const promise = cachedImportPromise;
      cachedLazy = lazy(() => promise);
    }
    return cachedLazy;
  };

  // A forwardRef wrapper so downstream refs still work; the wrapper reads
  // the (possibly recreated) inner lazy on each render.
  const Wrapped = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    // useState forces a re-render if the module-level cache was invalidated
    // between mount and this render (no-op otherwise). Kept lightweight.
    useState(0);
    const Inner = getLazy() as unknown as ComponentType<any>;
    return createElement(Inner, { ...props, ref });
  });
  Wrapped.displayName = `LazyWithRetry(${key})`;
  return Wrapped as unknown as LazyExoticComponent<T>;
}

export function installViteChunkReloadGuard() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", async (event) => {
    event.preventDefault();
    const url = extractChunkUrl(getErrorMessage((event as Event & { payload?: unknown }).payload));
    if (url) {
      const probe = await probeChunkUrl(url);
      if (isTransientChunkProbe(probe)) {
        await waitForChunkServerRecovery(url);
        if (safeTransientChunkReload(url)) return;
      }
      if (isStaleHtmlFallbackProbe(probe) && safeCacheBustReload()) return;
    }
    if (!safeCacheBustReload()) safeAutoReload();
  });
}
