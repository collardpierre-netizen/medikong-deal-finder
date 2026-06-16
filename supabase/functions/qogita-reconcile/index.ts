// Qogita reconciliation sweeps (A: by sync_run_id, B: by staleness).
// Called by the daily cron and by run-sync-pipeline at the end of full runs.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const sweep: "run_id" | "staleness" = body.sweep ?? "staleness";
    const sync_run_id: string | null = body.sync_run_id ?? null;
    const threshold_days: number = Number(body.threshold_days ?? 7);
    const country: string | null = body.country ?? null;
    const dry_run: boolean = !!body.dry_run;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let result;
    if (sweep === "run_id") {
      if (!sync_run_id) {
        return new Response(JSON.stringify({ error: "sync_run_id required for sweep=run_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await sb.rpc("qogita_sweep_run_id", {
        _sync_run_id: sync_run_id, _country: country, _dry_run: dry_run,
      });
      if (error) throw error;
      result = data;
    } else if (sweep === "staleness") {
      const { data, error } = await sb.rpc("qogita_sweep_staleness", {
        _threshold_days: threshold_days, _country: country, _dry_run: dry_run,
      });
      if (error) throw error;
      result = data;
    } else {
      return new Response(JSON.stringify({ error: `unknown sweep: ${sweep}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, sweep, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("qogita-reconcile error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
