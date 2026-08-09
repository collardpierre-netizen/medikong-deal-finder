/**
 * Diagnostic réseau — observateur global des appels `fetch`.
 *
 * Enregistre dans un ring-buffer en mémoire (jamais persisté) chaque appel
 * réseau sortant : endpoint, méthode, statut, durée, et classification de
 * l'erreur (réseau/DNS, CORS probable, HTTP). Aucun header personnalisé n'est
 * ajouté : la requête d'origine est transmise telle quelle pour ne jamais
 * déclencher de preflight CORS supplémentaire.
 */

export type NetworkEventKind =
  | "ok"
  | "http_error"
  | "network"
  | "cors"
  | "aborted";

export interface NetworkEvent {
  id: number;
  startedAt: number;
  durationMs: number;
  method: string;
  url: string;
  origin: string;
  path: string;
  scope: "backend" | "external" | "same-origin";
  status: number | null;
  ok: boolean;
  kind: NetworkEventKind;
  errorMessage: string | null;
}

const MAX_EVENTS = 300;

const events: NetworkEvent[] = [];
const listeners = new Set<(events: NetworkEvent[]) => void>();
let seq = 0;

export function getNetworkEvents(): NetworkEvent[] {
  return events;
}

export function clearNetworkEvents() {
  events.length = 0;
  emit();
}

export function subscribeNetworkEvents(
  listener: (events: NetworkEvent[]) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  const snapshot = [...events];
  listeners.forEach((l) => l(snapshot));
}

function push(event: NetworkEvent) {
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  emit();
}

function backendOrigin(): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

/** Classe une erreur `fetch` : DNS/réseau, CORS probable, ou abandon. */
export function classifyFetchError(
  err: unknown,
): { kind: NetworkEventKind; message: string } {
  const message =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("abort")) return { kind: "aborted", message };
  if (
    lower.includes("cors") ||
    lower.includes("access-control") ||
    lower.includes("preflight") ||
    lower.includes("cross-origin")
  ) {
    return { kind: "cors", message };
  }
  return { kind: "network", message };
}

export function installNetworkDiagnostics() {
  if (typeof window === "undefined" || !window.fetch) return;
  const w = window as unknown as { __medikongNetDiagInstalled?: boolean };
  if (w.__medikongNetDiagInstalled) return;
  w.__medikongNetDiagInstalled = true;

  const backend = backendOrigin();
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    let parsedOrigin = "";
    let parsedPath = url;
    try {
      const u = new URL(url, window.location.origin);
      parsedOrigin = u.origin;
      parsedPath = u.pathname + (u.search ? u.search : "");
    } catch {
      /* URL non parsable : on garde la valeur brute */
    }

    const scope: NetworkEvent["scope"] =
      backend && parsedOrigin === backend
        ? "backend"
        : parsedOrigin === window.location.origin
          ? "same-origin"
          : "external";

    const startedAt = Date.now();
    const t0 = performance.now();

    try {
      const response = await originalFetch(input as RequestInfo, init);
      push({
        id: ++seq,
        startedAt,
        durationMs: Math.round(performance.now() - t0),
        method,
        url,
        origin: parsedOrigin,
        path: parsedPath,
        scope,
        status: response.status,
        ok: response.ok,
        kind: response.ok ? "ok" : "http_error",
        errorMessage: null,
      });
      return response;
    } catch (err) {
      const { kind, message } = classifyFetchError(err);
      push({
        id: ++seq,
        startedAt,
        durationMs: Math.round(performance.now() - t0),
        method,
        url,
        origin: parsedOrigin,
        path: parsedPath,
        scope,
        status: null,
        ok: false,
        kind,
        errorMessage: message,
      });
      throw err;
    }
  };
}

export interface ProbeResult {
  label: string;
  url: string;
  status: number | null;
  durationMs: number;
  outcome: "ok" | "http_error" | "network" | "cors" | "aborted";
  detail: string;
}

/** Sonde un endpoint et renvoie un verdict lisible (DNS / CORS / HTTP). */
export async function probeEndpoint(
  label: string,
  url: string,
  init?: RequestInit,
): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    return {
      label,
      url,
      status: res.status,
      durationMs: Math.round(performance.now() - t0),
      outcome: res.ok ? "ok" : "http_error",
      detail: res.ok
        ? `HTTP ${res.status} — réponse lisible (CORS OK, DNS OK)`
        : `HTTP ${res.status} ${res.statusText || ""} — le serveur répond mais refuse la requête`,
    };
  } catch (err) {
    const { kind, message } = classifyFetchError(err);
    return {
      label,
      url,
      status: null,
      durationMs: Math.round(performance.now() - t0),
      outcome: kind,
      detail:
        kind === "cors"
          ? `CORS bloqué : ${message}`
          : kind === "aborted"
            ? `Requête interrompue : ${message}`
            : `Échec réseau/DNS (hôte injoignable ou résolution impossible) : ${message}`,
    };
  }
}

export function getBackendOrigin(): string | null {
  return backendOrigin();
}
