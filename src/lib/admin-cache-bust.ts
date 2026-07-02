/**
 * Invalidation des caches React Query admin à chaque déploiement.
 *
 * Chaque hook admin utilise une queryKey préfixée par `"admin"` (ex.
 * `["admin-orders-paginated", ...]`, `["admin-vendors"]`, …). Après un
 * redéploiement, si l'onglet reste ouvert et que le watcher de version
 * (`build-version.ts`) diffère le reload (ex. utilisateur en train de
 * taper), ces caches peuvent contenir des KPIs / totaux calculés par
 * l'ancien backend. On force donc l'invalidation dès que le `buildId`
 * courant diffère de celui vu au dernier passage.
 *
 * - `bustAdminQueryCache()` : supprime + invalide toutes les queries
 *   dont la 1re clé commence par `"admin"`. Appelable à tout moment.
 * - `checkAdminBuildIdOnBoot()` : compare `__BUILD_ID__` avec l'ID
 *   stocké en `localStorage`. Si différent → bust + persistance.
 *   À appeler au boot (idempotent).
 */

import { queryClient } from "@/lib/query-client";

declare const __BUILD_ID__: string;

const CURRENT_BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const STORAGE_KEY = "medikong:admin-build-id";

function isAdminKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    typeof key[0] === "string" &&
    (key[0] as string).startsWith("admin")
  );
}

export function bustAdminQueryCache(): number {
  let count = 0;
  try {
    const predicate = (q: { queryKey: unknown }) => {
      if (!isAdminKey(q.queryKey)) return false;
      count += 1;
      return true;
    };
    queryClient.removeQueries({ predicate });
    queryClient.invalidateQueries({
      predicate: (q) => isAdminKey(q.queryKey),
    });
  } catch {
    /* best-effort */
  }
  return count;
}

export function checkAdminBuildIdOnBoot(): void {
  if (typeof window === "undefined") return;
  if (CURRENT_BUILD_ID === "dev") return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === CURRENT_BUILD_ID) return;
    // Build a changé (ou premier passage) → on invalide les caches admin
    // en mémoire et on mémorise le nouveau buildId.
    bustAdminQueryCache();
    window.localStorage.setItem(STORAGE_KEY, CURRENT_BUILD_ID);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

export const __TEST__ = { CURRENT_BUILD_ID, STORAGE_KEY, isAdminKey };
