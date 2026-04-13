import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface StepConfig {
  name: string;
  label: string;
  functionName: string;
  params: Record<string, unknown>;
  required: boolean;
  loopBatch?: boolean;
  batchSize?: number;
}

function getPipelineSteps(country: string, mode: string): StepConfig[] {
  if (mode === "incremental") {
    // Daily incremental: only update offers for products that already have offers
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
        label: "Offres multi-vendeurs (incrémental)",
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
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text, status: res.status };
    }
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return { timeout: true, message: `Function ${functionName} timed out after ${timeoutMs}ms` };
    }
    throw e;
  }
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

    // Helper to update a step
    const updateStep = async (idx: number, status: string, stats?: unknown) => {
      const { data: current } = await supabase
        .from("sync_pipeline_runs")
        .select("steps_status")
        .eq("id", runId)
        .single();
      const steps = (current?.steps_status as any[]) || [];
      steps[idx] = {
        ...steps[idx],
        status,
        ...(status === "running" ? { started_at: new Date().toISOString() } : {}),
        ...(status === "completed" || status === "failed"
          ? { completed_at: new Date().toISOString(), stats }
          : {}),
      };
      await supabase
        .from("sync_pipeline_runs")
        .update({
          steps_status: steps,
          current_step: idx + (status === "completed" ? 1 : 0),
        })
        .eq("id", runId);
    };

    // Run pipeline
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];

      // If stepOnly is specified, skip non-matching steps
      if (stepOnly && step.name !== stepOnly) {
        await updateStep(i, "skipped");
        continue;
      }

      await updateStep(i, "running");

      try {
        if (step.loopBatch) {
          let totalProcessed = 0;
          let iterations = 0;
          const maxIterations = 1000; // safety limit

          while (iterations < maxIterations) {
            const result = (await callEdgeFunction(step.functionName, step.params)) as any;
            const processed = result?.stats?.enriched || result?.stats?.upserted || result?.processed || 0;
            totalProcessed += processed;
            iterations++;

            if (processed === 0 || processed < (step.batchSize || 100)) break;
            await new Promise((r) => setTimeout(r, 500));
          }
          await updateStep(i, "completed", { totalProcessed, iterations });
        } else {
          const result = await callEdgeFunction(step.functionName, step.params);
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

          return new Response(JSON.stringify({ success: false, runId, failedStep: step.name }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Done
    await supabase
      .from("sync_pipeline_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", runId);

    return new Response(JSON.stringify({ success: true, runId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("run-sync-pipeline error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
