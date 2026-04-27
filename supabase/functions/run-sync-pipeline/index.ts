import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  if (mode === "incremental") {
    // Daily incremental: best-price offer recovery + multi-vendor refresh so ALL
    // offers (incl. secondary sellers) keep a synced_at < 24h. Runs 3x/day via cron.
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
        name: "offers_multi_vendor",
        label: "Offres Multi-Vendeurs (incrémental)",
        functionName: "sync-qogita-offers-detail",
        params: { country, multi_vendor: true },
        required: false,
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
    {
      name: "offers_multi_vendor",
      label: "Offres Multi-Vendeurs",
      functionName: "sync-qogita-offers-detail",
      params: { country, multi_vendor: true },
      required: false,
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callEdgeFunction(functionName: string, params: unknown, timeoutMs = 280000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text, status: res.status };
    }

    if (!res.ok) {
      const message = parsed?.error || parsed?.message || `Function ${functionName} failed with status ${res.status}`;
      throw new Error(message);
    }

    return parsed;
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return { timeout: true, message: `Function ${functionName} timed out after ${timeoutMs}ms` };
    }
    throw e;
  }
}

async function markPreviousRunsAsSuperseded(supabase: any, country: string, runId: string) {
  await supabase
    .from("sync_pipeline_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Remplacé par le run ${runId}`,
    })
    .eq("country_code", country)
    .eq("status", "running")
    .neq("id", runId);
}

async function waitForSyncLogCompletion(
  supabase: any,
  logId: string,
  timeoutMs = 25 * 60 * 1000,
  pollMs = 5000,
  stallTimeoutMs = 4 * 60 * 1000, // mark as stuck if no progress for 4 minutes
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
}: {
  supabase: any;
  runId: string;
  steps: StepConfig[];
  stepOnly?: string;
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

    await supabase
      .from("sync_pipeline_runs")
      .update({
        steps_status: stepsStatus,
        current_step: idx + (status === "completed" ? 1 : 0),
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
          const result = (await callEdgeFunction(step.functionName, step.params)) as any;
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

          await sleep(STEP_DELAY_MS);
        }

        if (iterations >= MAX_LOOP_ITERATIONS) {
          throw new Error(`Limite de sécurité atteinte sur ${step.label}`);
        }

        await updateStep(i, "completed", { totalProcessed, iterations });
      } else {
        const result = await callEdgeFunction(step.functionName, step.params);
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

  await supabase
    .from("sync_pipeline_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const country = body.country || "BE";
    const triggeredBy = body.triggeredBy || "manual";
    const mode = body.mode || "incremental"; // "incremental" (default) or "full"
    const stepOnly = body.stepOnly;

    const STEPS = getPipelineSteps(country, mode);

    // Create pipeline run record
    const initialSteps = STEPS.map((s) => ({
      step: s.name,
      label: s.label,
      status: "pending",
    }));

    const { data: run, error: insertErr } = await supabase
      .from("sync_pipeline_runs")
      .insert({
        country_code: country,
        status: "running",
        triggered_by: triggeredBy,
        started_at: new Date().toISOString(),
        total_steps: STEPS.length,
        steps_status: initialSteps,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    const runId = run.id;

    await markPreviousRunsAsSuperseded(supabase, country, runId);

    const backgroundRun = executePipeline({
      supabase,
      runId,
      steps: STEPS,
      stepOnly,
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

    return new Response(JSON.stringify({ success: true, runId, status: "started" }), {
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
