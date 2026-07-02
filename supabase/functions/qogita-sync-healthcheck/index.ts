// Public health check for the Qogita sync pipeline.
// Returns the latest run per mode, stuck runs, staleness flags and any error message.
// No auth required — read-only, aggregated status only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Staleness thresholds (hours) per mode — beyond this the run is considered late.
const STALE_HOURS: Record<string, number> = {
  daily_stale_refresh: 6,
  incremental: 12,
  full: 24 * 8,
  mute_detection: 48,
  reconciliation_sweep: 30,
};

// If a run is still `running` after this many minutes we flag it as stuck.
const STUCK_AFTER_MINUTES = 60;

type ResyncLog = {
  id: string;
  mode: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  total_errors: number | null;
  error_message: string | null;
  errors_by_endpoint: Record<string, number> | null;
  offers_processed: number | null;
  offers_updated: number | null;
  offers_created: number | null;
  offers_deactivated: number | null;
  products_processed: number | null;
  products_targeted: number | null;
  country_code: string | null;
  triggered_by: string | null;
};

function hoursSince(ts: string | null): number | null {
  if (!ts) return null;
  return (Date.now() - new Date(ts).getTime()) / 3_600_000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Pull the last 200 runs; enough to derive per-mode last + stuck detection.
    const { data, error } = await supabase
      .from("qogita_resync_logs")
      .select(
        "id, mode, status, started_at, completed_at, duration_ms, total_errors, error_message, errors_by_endpoint, offers_processed, offers_updated, offers_created, offers_deactivated, products_processed, products_targeted, country_code, triggered_by",
      )
      .order("started_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    const logs = (data ?? []) as ResyncLog[];

    // Latest run per mode (any status)
    const latestByMode = new Map<string, ResyncLog>();
    // Latest *successful* run per mode
    const latestSuccessByMode = new Map<string, ResyncLog>();
    for (const l of logs) {
      if (!latestByMode.has(l.mode)) latestByMode.set(l.mode, l);
      if (
        (l.status === "success" || l.status === "completed") &&
        !latestSuccessByMode.has(l.mode)
      ) {
        latestSuccessByMode.set(l.mode, l);
      }
    }

    // Runs still marked `running` for too long → stuck
    const stuck = logs
      .filter((l) => {
        if (l.status !== "running") return false;
        const h = hoursSince(l.started_at);
        return h !== null && h * 60 > STUCK_AFTER_MINUTES;
      })
      .map((l) => ({
        id: l.id,
        mode: l.mode,
        started_at: l.started_at,
        hours_ago: Number((hoursSince(l.started_at) ?? 0).toFixed(2)),
      }));

    // Overall latest run
    const latest = logs[0] ?? null;

    // Per-mode summary with stale flag
    const modes = Array.from(
      new Set([...latestByMode.keys(), ...Object.keys(STALE_HOURS)]),
    ).map((mode) => {
      const last = latestByMode.get(mode) ?? null;
      const lastSuccess = latestSuccessByMode.get(mode) ?? null;
      const threshold = STALE_HOURS[mode] ?? 24;
      const hAgoSuccess = hoursSince(lastSuccess?.started_at ?? null);
      const stale =
        hAgoSuccess === null ? true : hAgoSuccess > threshold;
      return {
        mode,
        stale,
        threshold_hours: threshold,
        last_run: last
          ? {
              id: last.id,
              status: last.status,
              started_at: last.started_at,
              completed_at: last.completed_at,
              duration_ms: last.duration_ms,
              total_errors: last.total_errors ?? 0,
              error_message: last.error_message,
              errors_by_endpoint: last.errors_by_endpoint,
              country_code: last.country_code,
              triggered_by: last.triggered_by,
              hours_ago:
                hoursSince(last.started_at) === null
                  ? null
                  : Number(hoursSince(last.started_at)!.toFixed(2)),
            }
          : null,
        last_success: lastSuccess
          ? {
              id: lastSuccess.id,
              started_at: lastSuccess.started_at,
              hours_ago:
                hAgoSuccess === null ? null : Number(hAgoSuccess.toFixed(2)),
            }
          : null,
      };
    });

    // 24h aggregates
    const cutoff = Date.now() - 24 * 3_600_000;
    const recent = logs.filter(
      (l) => new Date(l.started_at).getTime() >= cutoff,
    );
    const last_24h = {
      runs: recent.length,
      failed: recent.filter(
        (l) => l.status === "failed" || l.status === "needs_review",
      ).length,
      offers_processed: recent.reduce(
        (a, l) => a + (l.offers_processed ?? 0),
        0,
      ),
      offers_created: recent.reduce((a, l) => a + (l.offers_created ?? 0), 0),
      offers_updated: recent.reduce((a, l) => a + (l.offers_updated ?? 0), 0),
      offers_deactivated: recent.reduce(
        (a, l) => a + (l.offers_deactivated ?? 0),
        0,
      ),
      errors: recent.reduce((a, l) => a + (l.total_errors ?? 0), 0),
    };

    // Overall health: OK / degraded / down
    const anyStale = modes.some((m) => m.stale);
    const anyFailedRecent = last_24h.failed > 0;
    const hasStuck = stuck.length > 0;
    let health: "ok" | "degraded" | "down";
    if (anyStale && !recent.length) health = "down";
    else if (anyStale || anyFailedRecent || hasStuck) health = "degraded";
    else health = "ok";

    const body = {
      health,
      checked_at: new Date().toISOString(),
      latest_run: latest
        ? {
            id: latest.id,
            mode: latest.mode,
            status: latest.status,
            started_at: latest.started_at,
            completed_at: latest.completed_at,
            duration_ms: latest.duration_ms,
            total_errors: latest.total_errors ?? 0,
            error_message: latest.error_message,
            errors_by_endpoint: latest.errors_by_endpoint,
            country_code: latest.country_code,
            triggered_by: latest.triggered_by,
            hours_ago:
              hoursSince(latest.started_at) === null
                ? null
                : Number(hoursSince(latest.started_at)!.toFixed(2)),
          }
        : null,
      modes,
      stuck_runs: stuck,
      last_24h,
    };

    // HTTP status: 200 for ok/degraded, 503 when down (useful for uptime probes).
    const status = health === "down" ? 503 : 200;

    return new Response(JSON.stringify(body, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        health: "unknown",
        error: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
