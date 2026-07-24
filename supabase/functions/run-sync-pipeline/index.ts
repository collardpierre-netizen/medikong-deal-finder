import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STEP_DELAY_MS = 500;
const MAX_LOOP_ITERATIONS = 1000;

interface StepConfig {
  name: string;
  label: string;
  functionName: string;
  params: Record<string, unknown>;
  required: boolean;
  loopBatch?: boolean;
  batchSize?: number;
  waitsForSyncLog?: boolean;
}

function getPipelineSteps(country: string, mode: string): StepConfig[] {
  if (mode === "fast_tier_refresh") {
    return [
      {
        name: "offers_fast_refresh",
        label: "Refresh rapide offres (prix/stock/paliers)",
        functionName: "sync-qogita-offers-detail",
        params: { country, mode: "fast" },
        required: true,
        loopBatch: true,
        batchSize: 100,
      },
    ];
  }

  if (mode === "daily_stale_refresh") {
    return [
      {
        name: "offers_detail",
        label: "Mise à jour offres stale",
        functionName: "sync-qogita-offers-detail",
        params: { country },
        required: true,
        loopBatch: true,
        batchSize: 100,
      },
    ];
  }

  if (mode === "incremental") {
    // Daily incremental: best-price offer recovery + multi-vendor refresh so ALL
    // offers (incl. secondary sellers) keep a synced_at < 24h. Runs 3x/day via cron.
    //
    // NOTE 2026-07-24 — Étape doublon `offers_multi_vendor` retirée.
    // `sync-qogita-offers-detail` a `fetchMultiVendor = true` hardcodé, donc
    // `offers_detail` fait déjà tout le travail multi-vendeur. Passer `multi_vendor: true`
    // au 2ᵉ appel ne change rien côté fonction (paramètre ignoré) et double
    // simplement le coût + risque de 429. Le code de l'étape reste disponible via
    // la même fonction — retrait purement pipeline, réversible en ré-ajoutant
    // l'entrée si un jour on dissocie best-price et multi-vendor.
    return [
      {
        name: "offers_detail",
        label: "Mise à jour offres (incrémental)",
        functionName: "sync-qogita-offers-detail",
        params: { country },
        required: true,
        loopBatch: true,
        batchSize: 100,
      },
      {
        name: "recalculate_prices",
        label: "Recalculer Prix (marge)",
        functionName: "recalculate-all-prices",
        params: {},
        required: true,
      },
      {
        name: "meilisearch_sync",
        label: "Sync Meilisearch",
        functionName: "sync-meilisearch",
        params: { action: "full-sync" },
        required: false,
      },
    ];
  }

  // Full pipeline: CSV import + everything
  return [
    {
      name: "csv_import",
      label: "Import CSV Produits",
      functionName: "sync-qogita-products",
      params: { country },
      required: true,
      waitsForSyncLog: true,
    },
    {
      name: "brands_categories",
      label: "Sync Marques & Catégories",
      functionName: "sync-qogita-brands",
      params: { country },
      required: false,
    },
    {
      name: "offers_detail",
      label: "Enrichissement Détails",
      functionName: "sync-qogita-offers-detail",
      params: { country },
      required: false,
      loopBatch: true,
      batchSize: 100,
    },
    // NOTE 2026-07-24 — Étape doublon `offers_multi_vendor` retirée du full aussi
    // (fetchMultiVendor hardcodé true dans sync-qogita-offers-detail). Réversible :
    // ré-ajouter l'entrée { name: "offers_multi_vendor", … multi_vendor: true } ici.
    {
      name: "recalculate_prices",
      label: "Recalculer Prix (marge)",
      functionName: "recalculate-all-prices",
      params: {},
      required: true,
    },
    {
      name: "meilisearch_sync",
      label: "Sync Meilisearch",
      functionName: "sync-meilisearch",
      params: { action: "full-sync" },
      required: false,
    },
    {
      // Sweep A — reconciliation by sync_run_id (full runs only).
      // Deactivates Qogita entities not touched by this run (with anti-wipe guardrails).
      name: "reconcile_sweep_a",
      label: "Réconciliation Qogita (sweep A)",
      functionName: "qogita-reconcile",
      params: { sweep: "run_id", country },
      required: false,
    },
  ];
}


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PROJECT_URL_RE = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/;

async function callEdgeFunction(functionName: string, params: unknown, timeoutMs = 280000): Promise<unknown> {
  const supabaseUrl = (SUPABASE_URL ?? "").trim();
  if (!PROJECT_URL_RE.test(supabaseUrl)) {
    const msg = `internal_invoke_failed: ${functionName} — INVALID_PROJECT_URL (got="${supabaseUrl}")`;
    console.error(msg);
    throw new Error(msg);
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const msg = `internal_invoke_failed: ${functionName} — MISSING_SERVICE_ROLE_KEY`;
    console.error(msg);
    throw new Error(msg);
  }

  // Routage interne Edge Runtime — plus de fetch() vers l'URL publique du
  // projet (échouait avec "TypeError: error sending request from 10.32.x.x
  // for https://<ref>.supabase.co/...").
  const internalClient = createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY);

  const invokePromise = internalClient.functions
    .invoke(functionName, { body: params })
    .then(({ data, error }) => {
      if (error) {
        const details = (error as any)?.context?.text
          ? `${error.message}: ${(error as any).context.text}`
          : (error.message ?? String(error));
        console.error(`internal_invoke_failed: ${functionName} — ${details}`);
        throw new Error(details);
      }
      return data;
    });

  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ __timeout: true }), timeoutMs),
  );

  const result: any = await Promise.race([invokePromise, timeoutPromise]);
  if (result && result.__timeout) {
    return { timeout: true, message: `Function ${functionName} timed out after ${timeoutMs}ms` };
  }
  return result;
}


// Heartbeat staleness threshold: time since last progress bump (NOT total run duration).
// 10 min : plus agressif qu'avant (15 min), pour libérer plus tôt les runs orphelins
// (edge function tuée par WORKER_LIMIT sans mise à jour du heartbeat).
const PIPELINE_HEARTBEAT_STALE_MINUTES = 10;

async function markPreviousRunsAsSuperseded(supabase: any, country: string, runId: string) {
  // Exclude the current run id explicitly to avoid auto-superseding ourselves.
  await supabase
    .from("sync_pipeline_runs")
    .update({
      status: "superseded",
      completed_at: new Date().toISOString(),
      error_message: `Remplacé par le run ${runId}`,
    })
    .eq("country_code", country)
    .eq("status", "running")
    .neq("id", runId);
}

async function bumpHeartbeat(supabase: any, runId: string) {
  try {
    await supabase
      .from("sync_pipeline_runs")
      .update({ last_progress_at: new Date().toISOString() })
      .eq("id", runId);
  } catch (e) {
    console.warn("bumpHeartbeat failed:", (e as any)?.message);
  }
}

async function waitForSyncLogCompletion(
  supabase: any,
  logId: string,
  timeoutMs = 25 * 60 * 1000,
  pollMs = 5000,
  stallTimeoutMs = 10 * 60 * 1000, // mark as stuck if no progress for 10 minutes (CSV 115MB / 366k lignes peut bootstrap lentement)
) {
  const deadline = Date.now() + timeoutMs;
  let lastProgress = -1;
  let lastProgressAt = Date.now();

  while (Date.now() < deadline) {
    const { data: log, error } = await supabase
      .from("sync_logs")
      .select("id, status, error_message, progress_current, progress_total, progress_message, stats, started_at")
      .eq("id", logId)
      .single();

    if (error) throw error;
    if (!log) throw new Error(`Log ${logId} introuvable`);

    if (log.status === "completed") return log;

    if (log.status === "error") {
      throw new Error(log.error_message || `Échec du log ${logId}`);
    }

    // Detect stalled background runs (edge function killed, log left "running")
    const cur = Number(log.progress_current || 0);
    if (cur !== lastProgress) {
      lastProgress = cur;
      lastProgressAt = Date.now();
    } else if (Date.now() - lastProgressAt > stallTimeoutMs) {
      const elapsed = Math.round((Date.now() - lastProgressAt) / 1000);
      console.log(
        `[watchdog] sync_log ${logId} progress=${log.progress_current}/${log.progress_total} elapsed=${elapsed}s, ` +
        `bail-out en cours si pas de progression dans les prochaines secondes`,
      );
      // Mark log as failed and give up — background worker is dead
      await supabase
        .from("sync_logs")
        .update({
          status: "error",
          completed_at: new Date().toISOString(),
          error_message: `Aucune progression depuis ${Math.round(stallTimeoutMs / 60000)} min — worker arrière-plan probablement tué`,
        })
        .eq("id", logId);
      throw new Error(`Sync log ${logId} bloqué (aucune progression pendant ${Math.round(stallTimeoutMs / 60000)} min)`);
    }

    await sleep(pollMs);
  }

  throw new Error(`Timeout en attente de fin pour le log ${logId}`);
}

async function executePipeline({
  supabase,
  runId,
  steps,
  stepOnly,
  sharedParams,
}: {
  supabase: any;
  runId: string;
  steps: StepConfig[];
  stepOnly?: string;
  sharedParams?: Record<string, unknown>;
}) {
  const updateStep = async (idx: number, status: string, stats?: unknown) => {
    const { data: current } = await supabase
      .from("sync_pipeline_runs")
      .select("steps_status")
      .eq("id", runId)
      .single();

    const stepsStatus = (current?.steps_status as any[]) || [];
    stepsStatus[idx] = {
      ...stepsStatus[idx],
      status,
      ...(status === "running" ? { started_at: new Date().toISOString() } : {}),
      ...(status === "completed" || status === "failed"
        ? { completed_at: new Date().toISOString(), stats }
        : {}),
    };

    // Every step transition bumps the heartbeat — this is what keeps a long-running
    // Full sync out of the "stale" bucket without needing to raise the timeout.
    await supabase
      .from("sync_pipeline_runs")
      .update({
        steps_status: stepsStatus,
        current_step: idx + (status === "completed" ? 1 : 0),
        last_progress_at: new Date().toISOString(),
      })
      .eq("id", runId);
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (stepOnly && step.name !== stepOnly) {
      await updateStep(i, "skipped");
      continue;
    }

    await updateStep(i, "running");

    try {
      if (step.loopBatch) {
        let totalProcessed = 0;
        let iterations = 0;

        while (iterations < MAX_LOOP_ITERATIONS) {
          const result = (await callEdgeFunction(step.functionName, {
            ...step.params,
            ...(sharedParams ?? {}),
          })) as any;
          if (result?.timeout) {
            throw new Error(result.message || `Timeout sur ${step.label}`);
          }

          const processed = Number(
            result?.products_enriched ??
            result?.stats?.products_enriched ??
            result?.stats?.enriched ??
            result?.stats?.upserted ??
            result?.processed ??
            0,
          );
          const remaining = typeof result?.remaining === "number" ? result.remaining : -1;

          totalProcessed += processed;
          iterations++;

          if (result?.status === "error") {
            throw new Error(result?.message || `Échec de l'étape ${step.label}`);
          }

          if (remaining <= 0 || result?.status === "completed") {
            break;
          }

          if (processed === 0 && remaining > 0) {
            throw new Error(`Aucune progression détectée sur ${step.label} alors qu'il reste ${remaining} éléments.`);
          }

          // Bump heartbeat between long batches so a slow Full sync isn't flagged stale.
          await bumpHeartbeat(supabase, runId);

          await sleep(STEP_DELAY_MS);
        }

        if (iterations >= MAX_LOOP_ITERATIONS) {
          throw new Error(`Limite de sécurité atteinte sur ${step.label}`);
        }

        await updateStep(i, "completed", { totalProcessed, iterations });
      } else {
        const result = await callEdgeFunction(step.functionName, {
          ...step.params,
          ...(sharedParams ?? {}),
        });
        if (step.waitsForSyncLog && (result as any)?.sync_log_id) {
          await waitForSyncLogCompletion(supabase, (result as any).sync_log_id);
        }
        await updateStep(i, "completed", result);
      }
    } catch (error: any) {
      await updateStep(i, "failed", { error: error.message });

      if (step.required) {
        await supabase
          .from("sync_pipeline_runs")
          .update({
            status: "failed",
            error_message: `Échec étape ${i + 1}: ${step.label} — ${error.message}`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
        return;
      }
    }
  }

  // Finalize: if any non-required step failed, mark the whole run as completed_with_errors
  // so the UI shows a neutral orange badge — never green, never red.
  const { data: finalSteps } = await supabase
    .from("sync_pipeline_runs")
    .select("steps_status")
    .eq("id", runId)
    .single();
  const hasFailedStep = ((finalSteps?.steps_status as any[]) || []).some(
    (s: any) => s?.status === "failed",
  );
  await supabase
    .from("sync_pipeline_runs")
    .update({
      status: hasFailedStep ? "completed_with_errors" : "completed",
      completed_at: new Date().toISOString(),
      last_progress_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), {
      status: guard.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);



  try {
    const body = await req.json().catch(() => ({}));
    const country = body.country || "BE";
    const triggeredBy = body.triggeredBy || "manual";
    const mode = body.mode || "incremental"; // "incremental" (default), "full" or "daily_stale_refresh"
    const stepOnly = body.stepOnly;
    const batchSize = Math.min(Math.max(Number(body.batchSize ?? 500), 1), 1000);
    let resyncLogId: string | null = null;

    const STEPS = getPipelineSteps(country, mode);

    if (mode === "daily_stale_refresh") {
      const { data: enqueueResult, error: enqueueError } = await supabase.rpc("enqueue_qogita_resync_batch", {
        _batch_size: batchSize,
        _mode: "daily_stale_refresh",
      });
      if (enqueueError) throw enqueueError;

      const queued = enqueueResult as any;
      if (queued?.rate_limited || Number(queued?.enqueued ?? 0) <= 0 || !queued?.log_id) {
        return new Response(JSON.stringify({
          success: true,
          runId: null,
          status: queued?.rate_limited ? "rate_limited" : "nothing_to_sync",
          enqueue: queued,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      resyncLogId = String(queued.log_id);
      for (const step of STEPS) {
        if (step.functionName === "sync-qogita-offers-detail") {
          step.params = {
            ...step.params,
            product_ids: Array.isArray(queued.product_ids) ? queued.product_ids : [],
          };
        }
      }
    }

    if (mode === "fast_tier_refresh") {
      const tier = String(body.tier ?? "A").toUpperCase();
      if (!["A", "B", "C"].includes(tier)) {
        return new Response(JSON.stringify({ error: `invalid tier: ${tier}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const maxAgeHours = Math.min(Math.max(Number(body.maxAgeHours ?? 2), 1), 24 * 30);
      const { data: enqueueResult, error: enqueueError } = await supabase.rpc(
        "enqueue_qogita_fast_refresh_batch",
        { _tier: tier, _batch_size: batchSize, _max_age_hours: maxAgeHours },
      );
      if (enqueueError) throw enqueueError;

      const queued = enqueueResult as any;
      if (queued?.rate_limited || Number(queued?.enqueued ?? 0) <= 0 || !queued?.log_id) {
        return new Response(JSON.stringify({
          success: true, runId: null,
          status: queued?.rate_limited ? "rate_limited" : "nothing_to_sync",
          tier, enqueue: queued,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }

      resyncLogId = String(queued.log_id);
      for (const step of STEPS) {
        if (step.functionName === "sync-qogita-offers-detail") {
          step.params = {
            ...step.params,
            product_ids: Array.isArray(queued.product_ids) ? queued.product_ids : [],
          };
        }
      }
    }

    // Generate sync_run_id for full runs — stamped on every Qogita upsert
    // so sweep A can identify entities not touched by this run.
    const syncRunId: string | null = mode === "full" ? crypto.randomUUID() : null;
    if (syncRunId) {
      for (const s of STEPS) {
        if (s.name === "reconcile_sweep_a") {
          s.params = { ...s.params, sweep: "run_id", sync_run_id: syncRunId };
        } else if (
          s.functionName === "sync-qogita-products" ||
          s.functionName === "sync-qogita-offers-detail" ||
          s.functionName === "sync-qogita-brands"
        ) {
          s.params = { ...s.params, sync_run_id: syncRunId };
        }
      }
    }

    // Concurrency lock: at most one 'running' pipeline per country.
    // 1) Pre-check: if an active run exists AND it's still fresh (heartbeat < 15 min),
    //    skip silently — no new row inserted, no rouge dans l'historique.
    // 2) Otherwise, stale it (not failed) so the new run can proceed.
    // 3) DB partial unique index catches races via 23505.
    const { data: activeRuns } = await supabase
      .from("sync_pipeline_runs")
      .select("id, started_at, last_progress_at")
      .eq("country_code", country)
      .eq("status", "running");

    const active = (activeRuns ?? [])[0];
    if (active) {
      const hb = active.last_progress_at
        ? new Date(active.last_progress_at as any).getTime()
        : new Date(active.started_at as any).getTime();
      const minutesSinceProgress = (Date.now() - hb) / 60000;
      if (minutesSinceProgress < PIPELINE_HEARTBEAT_STALE_MINUTES) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "already_running",
            active_run_id: active.id,
            minutes_since_progress: Number(minutesSinceProgress.toFixed(2)),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      // Stale — mark as such (never failed) so the unique index frees up
      await supabase
        .from("sync_pipeline_runs")
        .update({
          status: "stale",
          completed_at: new Date().toISOString(),
          error_message: `Aucune progression depuis ${Math.round(minutesSinceProgress)} min — run considéré comme interrompu`,
        })
        .eq("id", active.id);
    }

    // Create pipeline run record
    const initialSteps = STEPS.map((s) => ({
      step: s.name,
      label: s.label,
      status: "pending",
    }));

    const nowIso = new Date().toISOString();
    const { data: run, error: insertErr } = await supabase
      .from("sync_pipeline_runs")
      .insert({
        country_code: country,
        status: "running",
        triggered_by: triggeredBy,
        started_at: nowIso,
        last_progress_at: nowIso,
        total_steps: STEPS.length,
        steps_status: initialSteps,
      })
      .select()
      .single();

    if (insertErr) {
      // 23505 = unique_violation on sync_pipeline_runs_one_running_per_country
      if ((insertErr as any)?.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "race" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      throw insertErr;
    }
    const runId = run.id;

    // Belt-and-braces: mark any other stray 'running' rows for this country as superseded
    // (never failed). Excludes runId to avoid auto-supersede.
    await markPreviousRunsAsSuperseded(supabase, country, runId);

    const backgroundRun = executePipeline({
      supabase,
      runId,
      steps: STEPS,
      stepOnly,
      sharedParams: resyncLogId ? { resync_log_id: resyncLogId } : undefined,
    }).catch(async (error: any) => {

      console.error("run-sync-pipeline background error:", error);
      await supabase
        .from("sync_pipeline_runs")
        .update({
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    });

    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(backgroundRun);
    } else {
      await backgroundRun;
    }

    return new Response(JSON.stringify({ success: true, runId, resyncLogId, status: "started" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 202,
    });
  } catch (error: any) {
    console.error("run-sync-pipeline error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
