/**
 * Retry global avec backoff exponentiel pour les appels réseau backend
 * (auth + données + storage + edge functions).
 *
 * Installe un wrapper autour de `window.fetch` qui ne cible QUE les appels
 * vers le backend Supabase (URL `VITE_SUPABASE_URL`). Les erreurs
 * temporaires (NetworkError, 429, 5xx) sont réessayées avec un délai
 * exponentiel + jitter. Les erreurs métier (4xx hors 429) ne sont jamais
 * réessayées, et les mutations non idempotentes non plus.
 */

const MAX_ATTEMPTS = 4; // 1 essai + 3 retries
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8000;

/** Délai exponentiel avec jitter (±25%). */
export function computeBackoffDelay(
  attempt: number,
  baseDelayMs = BASE_DELAY_MS,
  maxDelayMs = MAX_DELAY_MS,
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exp + jitter));
}

/** Un statut HTTP mérite-t-il un retry ? */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Une requête est rejouable si elle est idempotente (GET/HEAD/OPTIONS)
 * ou s'il s'agit d'un POST connu comme sûr à rejouer :
 * - auth token (login / refresh) : rejouer n'a pas d'effet de bord
 * - RPC de lecture PostgREST (`/rest/v1/rpc/...`)
 * - listing storage (`/storage/v1/object/list/...`)
 */
export function isReplayableRequest(method: string, url: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return true;
  if (m !== "POST") return false;
  return (
    url.includes("/auth/v1/token") ||
    url.includes("/rest/v1/rpc/") ||
    url.includes("/storage/v1/object/list/")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function installBackendRetry() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl || typeof window === "undefined" || !window.fetch) return;

  const w = window as unknown as { __medikongRetryInstalled?: boolean };
  if (w.__medikongRetryInstalled) return;
  w.__medikongRetryInstalled = true;

  const origin = (() => {
    try {
      return new URL(supabaseUrl).origin;
    } catch {
      return supabaseUrl;
    }
  })();

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");

    // Hors backend, ou requête non rejouable : comportement natif inchangé.
    // Un objet Request avec body ne peut pas être rejoué (stream consommé).
    const isRequestWithBody = input instanceof Request && method.toUpperCase() !== "GET";
    if (!url.startsWith(origin) || isRequestWithBody || !isReplayableRequest(method, url)) {
      return originalFetch(input as RequestInfo, init);
    }

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const attemptInit: RequestInit | undefined =
        attempt === 1
          ? init
          : {
              ...init,
              headers: (() => {
                const h = new Headers(
                  init?.headers ?? (input instanceof Request ? input.headers : undefined),
                );
                h.set("x-retry-count", String(attempt - 1));
                return h;
              })(),
            };

      try {
        const response = await originalFetch(input as RequestInfo, attemptInit);
        if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status)) {
          await sleep(computeBackoffDelay(attempt));
          continue;
        }
        return response;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(computeBackoffDelay(attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error("Backend request failed");
  };
}
