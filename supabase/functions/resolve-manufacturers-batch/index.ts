// Admin-only batch runner for public.resolve_product_manufacturers().
// Loops with _limit=BATCH_SIZE until the RPC returns 0 resolved on all 3 branches,
// or MAX_ITERATIONS is reached. Logs progress to sync_logs (sync_type='manual').
//
// Why an edge function: a single global UPDATE on ~400k products exceeds the
// PostgREST statement_timeout. By batching server-side, we stay well under
// the timeout per RPC call (≈ 5-10s for 2000 rows) and cap total work per run.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BATCH_SIZE = 2000;
const MAX_ITERATIONS = 50;

interface BranchTotals {
  via_brand_manufacturer: number;
  via_supplier_name: number;
  via_brand_dictionary: number;
  resolved_total: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Verify caller is admin (verify_jwt = true → user JWT is forwarded)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin", {
    _user_id: userData.user.id,
  });
  if (adminErr || isAdmin !== true) {
    return json({ error: "Admin only" }, 403);
  }

  // 2. Use service role for the actual work + log writes
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 3. Open a sync_logs entry so the UI can poll progress
  const { data: logRow, error: logErr } = await admin
    .from("sync_logs")
    .insert({
      sync_type: "manual",
      status: "running",
      progress_message: "resolve-manufacturers-batch: starting",
      stats: { job: "resolve_product_manufacturers", batch_size: BATCH_SIZE, max_iterations: MAX_ITERATIONS },
    })
    .select("id")
    .single();

  if (logErr || !logRow) {
    return json({ error: `Cannot open sync log: ${logErr?.message}` }, 500);
  }
  const logId = logRow.id;

  const totals: BranchTotals = {
    via_brand_manufacturer: 0,
    via_supplier_name: 0,
    via_brand_dictionary: 0,
    resolved_total: 0,
  };
  let iterations = 0;
  let lastNullBefore: number | null = null;
  let stoppedReason = "max_iterations";

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations++;
      const { data, error } = await admin.rpc("resolve_product_manufacturers", {
        _dry_run: false,
        _limit: BATCH_SIZE,
      });
      if (error) throw error;

      const r = (data ?? {}) as Partial<BranchTotals> & { null_before?: number };
      totals.via_brand_manufacturer += r.via_brand_manufacturer ?? 0;
      totals.via_supplier_name += r.via_supplier_name ?? 0;
      totals.via_brand_dictionary += r.via_brand_dictionary ?? 0;
      totals.resolved_total += r.resolved_total ?? 0;
      if (typeof r.null_before === "number") lastNullBefore = r.null_before;

      // Update progress (best effort)
      await admin
        .from("sync_logs")
        .update({
          progress_current: totals.resolved_total,
          progress_total: (lastNullBefore ?? 0) + totals.resolved_total,
          progress_message: `iter ${iterations}/${MAX_ITERATIONS} · résolus cumul ${totals.resolved_total}`,
          stats: { ...totals, iterations, last_null_before: lastNullBefore, batch_size: BATCH_SIZE },
        })
        .eq("id", logId);

      // Stop early if this batch produced nothing on all 3 branches
      if ((r.resolved_total ?? 0) === 0) {
        stoppedReason = "no_more_to_resolve";
        break;
      }
    }

    await admin
      .from("sync_logs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        progress_message: `Terminé (${stoppedReason}) — ${totals.resolved_total} produits résolus en ${iterations} itération(s)`,
        stats: { ...totals, iterations, stopped_reason: stoppedReason, batch_size: BATCH_SIZE },
      })
      .eq("id", logId);

    return json({
      ok: true,
      sync_log_id: logId,
      iterations,
      stopped_reason: stoppedReason,
      ...totals,
    });
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    await admin
      .from("sync_logs")
      .update({
        status: "error",
        completed_at: new Date().toISOString(),
        error_message: message,
        stats: { ...totals, iterations, stopped_reason: "error", batch_size: BATCH_SIZE },
      })
      .eq("id", logId);
    return json({ error: message, sync_log_id: logId, ...totals, iterations }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
