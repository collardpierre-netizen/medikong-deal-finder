import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Health-check backend : interroge l'edge function publique `health-check`
 * (base de données + service d'authentification) et expose un état simple
 * consommé par le bandeau applicatif.
 *
 * - Sondage périodique léger (60 s en régime normal, 15 s en cas de panne)
 * - Re-sonde immédiatement au retour de connectivité / focus onglet
 * - Aucune donnée métier, aucun header custom (pas de preflight superflu)
 */

export type HealthStatus = "up" | "degraded" | "down" | "unknown";

export interface HealthCheckDetail {
  status: HealthStatus;
  latency_ms: number;
  error: string | null;
}

export interface BackendHealth {
  status: HealthStatus;
  database: HealthCheckDetail | null;
  auth: HealthCheckDetail | null;
  checkedAt: string | null;
  /** true quand la requête de health-check elle-même n'a pas abouti (réseau/DNS/CORS) */
  unreachable: boolean;
  loading: boolean;
}

const HEALTHY_INTERVAL_MS = 60_000;
const UNHEALTHY_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 8_000;

function healthUrl(): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/functions/v1/health-check`;
}

export function useBackendHealth(): BackendHealth & { refresh: () => void } {
  const [state, setState] = useState<BackendHealth>({
    status: "unknown",
    database: null,
    auth: null,
    checkedAt: null,
    unreachable: false,
    loading: true,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const probe = useCallback(async () => {
    const url = healthUrl();
    if (!url) {
      setState((s) => ({ ...s, loading: false }));
      return "unknown" as HealthStatus;
    }

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
      });
      const body = (await res.json()) as {
        status?: HealthStatus;
        checks?: { database?: HealthCheckDetail; auth?: HealthCheckDetail };
        checked_at?: string;
      };
      const status = body.status ?? (res.ok ? "up" : "down");
      if (mounted.current) {
        setState({
          status,
          database: body.checks?.database ?? null,
          auth: body.checks?.auth ?? null,
          checkedAt: body.checked_at ?? new Date().toISOString(),
          unreachable: false,
          loading: false,
        });
      }
      return status;
    } catch {
      if (mounted.current) {
        setState({
          status: "down",
          database: null,
          auth: null,
          checkedAt: new Date().toISOString(),
          unreachable: true,
          loading: false,
        });
      }
      return "down" as HealthStatus;
    } finally {
      clearTimeout(abortTimer);
    }
  }, []);

  const schedule = useCallback(
    (status: HealthStatus) => {
      if (timer.current) clearTimeout(timer.current);
      const delay =
        status === "up" ? HEALTHY_INTERVAL_MS : UNHEALTHY_INTERVAL_MS;
      timer.current = setTimeout(() => {
        void probe().then(schedule);
      }, delay);
    },
    [probe],
  );

  const refresh = useCallback(() => {
    void probe().then(schedule);
  }, [probe, schedule]);

  useEffect(() => {
    mounted.current = true;
    void probe().then(schedule);

    const onOnline = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [probe, refresh, schedule]);

  return { ...state, refresh };
}
