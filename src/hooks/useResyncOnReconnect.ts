import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Ré-invalide les queries fournies lorsque :
 * - la connexion réseau revient (`online`)
 * - l'onglet redevient visible (`visibilitychange` → visible)
 * - la fenêtre reprend le focus (`focus`)
 *
 * Objectif : garantir que les badges/montants restent exacts même si un
 * évènement Realtime a été manqué pendant une coupure réseau ou une mise
 * en veille de l'onglet.
 */
export function useResyncOnReconnect(keys: QueryKey[], enabled: boolean = true) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const serialized = keys.map((k) => JSON.stringify(k));

    const invalidateAll = () => {
      for (const key of keys) {
        qc.invalidateQueries({ queryKey: key });
      }
    };

    const onOnline = () => invalidateAll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") invalidateAll();
    };
    const onFocus = () => invalidateAll();

    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // On dépend d'une version sérialisée pour éviter de ré-abonner à chaque render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, enabled, keys.length, ...(keys.map((k) => JSON.stringify(k)))]);
}
