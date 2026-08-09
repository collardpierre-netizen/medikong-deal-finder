/**
 * Cache-busting & récupération après incident.
 *
 * Objectif : après un incident réseau/backend (backend en pause, coupure DNS,
 * blocage CORS, 5xx en série), le navigateur peut garder en mémoire des
 * données React Query en erreur ou partielles, et en cache HTTP des images
 * ayant répondu par une erreur. Ce module :
 *
 *  1. détecte un incident à partir du flux d'événements réseau
 *     (`network-diagnostics`) : N échecs réseau/CORS/5xx rapprochés ;
 *  2. détecte la reprise (1er appel backend réussi après l'incident) ;
 *  3. à la reprise : invalide les queries React Query (au minimum celles en
 *     erreur ou vides) et incrémente une version d'assets qui casse le cache
 *     HTTP des images (`?v=<version>`).
 *
 * La version d'assets est persistée en `localStorage` pour survivre à un
 * rechargement, et remise à la valeur du build à chaque déploiement.
 */

import { queryClient } from "@/lib/query-client";
import {
  subscribeNetworkEvents,
  getBackendOrigin,
  type NetworkEvent,
} from "@/lib/network-diagnostics";

declare const __BUILD_ID__: string;

const CURRENT_BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

const ASSET_VERSION_KEY = "medikong:asset-cache-version";
const ASSET_BUILD_KEY = "medikong:asset-cache-build";

/** Seuil d'échecs rapprochés qui caractérise un incident. */
const FAILURE_THRESHOLD = 3;
/** Fenêtre glissante (ms) dans laquelle compter les échecs. */
const FAILURE_WINDOW_MS = 30_000;

let assetVersion = "0";
let assetVersionLoaded = false;
const assetListeners = new Set<(version: string) => void>();

function loadAssetVersion(): string {
  if (assetVersionLoaded) return assetVersion;
  assetVersionLoaded = true;
  if (typeof window === "undefined") return assetVersion;
  try {
    const storedBuild = window.localStorage.getItem(ASSET_BUILD_KEY);
    if (storedBuild !== CURRENT_BUILD_ID) {
      // Nouveau déploiement : on repart d'une version propre.
      assetVersion = "0";
      window.localStorage.setItem(ASSET_BUILD_KEY, CURRENT_BUILD_ID);
      window.localStorage.setItem(ASSET_VERSION_KEY, assetVersion);
    } else {
      assetVersion = window.localStorage.getItem(ASSET_VERSION_KEY) ?? "0";
    }
  } catch {
    /* stockage indisponible (navigation privée) : version en mémoire */
  }
  return assetVersion;
}

/**
 * Version courante à injecter dans les URLs d'assets.
 * Combine le buildId (invalidation à chaque déploiement) et un compteur
 * incrémenté à chaque reprise après incident.
 */
export function getAssetCacheVersion(): string {
  return `${CURRENT_BUILD_ID}-${loadAssetVersion()}`;
}

/** Incrémente la version d'assets : les prochaines URLs cassent le cache HTTP. */
export function bumpAssetCacheVersion(): string {
  loadAssetVersion();
  const next = String((Number(assetVersion) || 0) + 1);
  assetVersion = next;
  try {
    window.localStorage.setItem(ASSET_VERSION_KEY, next);
    window.localStorage.setItem(ASSET_BUILD_KEY, CURRENT_BUILD_ID);
  } catch {
    /* best-effort */
  }
  const version = getAssetCacheVersion();
  assetListeners.forEach((l) => l(version));
  return version;
}

/** S'abonne aux changements de version d'assets (re-render des images). */
export function subscribeAssetCacheVersion(
  listener: (version: string) => void,
): () => void {
  assetListeners.add(listener);
  return () => assetListeners.delete(listener);
}

/**
 * Ajoute `?v=<version>` (ou `&v=`) à une URL d'asset interne.
 * Les URLs externes ou déjà versionnées sont renvoyées inchangées afin de ne
 * pas casser des signatures d'URL ou déclencher des misses inutiles.
 */
export function withAssetCacheVersion(url: string): string {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (/[?&]v=/.test(url)) return url;
  const version = getAssetCacheVersion();
  if (version.endsWith("-0")) return url; // aucun incident : URL native
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

/** Invalide toutes les queries React Query (données potentiellement périmées). */
export function bustAllQueryCache(): number {
  const count = queryClient.getQueryCache().getAll().length;
  try {
    queryClient.invalidateQueries();
  } catch {
    /* best-effort */
  }
  return count;
}

/**
 * Invalide uniquement les queries à risque après un incident : celles en
 * erreur, et celles restées sans données. Les données déjà chargées avec
 * succès sont conservées puis rafraîchies au prochain accès.
 */
export function bustStaleQueryCache(): number {
  let count = 0;
  try {
    const predicate = (q: {
      state: { status: string; data: unknown };
    }): boolean => {
      const risky = q.state.status === "error" || q.state.data === undefined;
      if (risky) count += 1;
      return risky;
    };
    queryClient.removeQueries({ predicate: predicate as never });
    queryClient.invalidateQueries({
      predicate: (q) =>
        q.state.status === "error" || q.state.data === undefined,
    });
  } catch {
    /* best-effort */
  }
  return count;
}

export interface IncidentRecoveryState {
  incidentActive: boolean;
  lastIncidentAt: number | null;
  lastRecoveryAt: number | null;
  recoveries: number;
}

const state: IncidentRecoveryState = {
  incidentActive: false,
  lastIncidentAt: null,
  lastRecoveryAt: null,
  recoveries: 0,
};

export function getIncidentRecoveryState(): IncidentRecoveryState {
  return { ...state };
}

function isFailure(event: NetworkEvent): boolean {
  if (event.kind === "network" || event.kind === "cors") return true;
  return event.kind === "http_error" && (event.status ?? 0) >= 500;
}

/** Reprise : purge les données à risque + casse le cache des images. */
export function recoverFromIncident(): void {
  state.incidentActive = false;
  state.lastRecoveryAt = Date.now();
  state.recoveries += 1;
  bustStaleQueryCache();
  bumpAssetCacheVersion();
}

/**
 * Installe la détection d'incident + la récupération automatique.
 * Idempotent, à appeler une fois au boot.
 */
export function installIncidentCacheRecovery(): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as { __medikongIncidentRecovery?: boolean };
  if (w.__medikongIncidentRecovery) return () => {};
  w.__medikongIncidentRecovery = true;

  const backend = getBackendOrigin();
  let failures: number[] = [];
  let lastSeenId = 0;

  const unsubscribe = subscribeNetworkEvents((events) => {
    // Les événements arrivent en tête de liste (plus récent en premier).
    const fresh = events.filter((e) => e.id > lastSeenId).reverse();
    if (fresh.length === 0) return;
    lastSeenId = Math.max(lastSeenId, ...fresh.map((e) => e.id));

    for (const event of fresh) {
      if (backend && event.origin && event.origin !== backend) continue;
      const now = event.startedAt;
      if (isFailure(event)) {
        failures = failures.filter((t) => now - t < FAILURE_WINDOW_MS);
        failures.push(now);
        if (!state.incidentActive && failures.length >= FAILURE_THRESHOLD) {
          state.incidentActive = true;
          state.lastIncidentAt = now;
        }
      } else if (event.kind === "ok") {
        failures = [];
        if (state.incidentActive) recoverFromIncident();
      }
    }
  });

  // Retour de connectivité navigateur : on considère aussi l'incident terminé.
  const onOnline = () => {
    if (state.incidentActive) recoverFromIncident();
    else bustStaleQueryCache();
  };
  window.addEventListener("online", onOnline);

  // Retour d'onglet après un incident : rafraîchit ce qui a échoué.
  const onVisible = () => {
    if (document.visibilityState === "visible" && state.incidentActive) {
      bustStaleQueryCache();
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    unsubscribe();
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    w.__medikongIncidentRecovery = false;
  };
}

export const __TEST__ = {
  FAILURE_THRESHOLD,
  FAILURE_WINDOW_MS,
  isFailure,
  state,
};
