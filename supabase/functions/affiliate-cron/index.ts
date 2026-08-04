// Cycle de vie des commissions apporteurs.
// action = "validate"        -> pending dont validate_after < now() => validated (cron quotidien)
// action = "monthly_payout"  -> factures self-billing mensuelles (cron mensuel, idempotent)
// action = "replay_order"    -> recalcul/rattrapage d'une commande payée (order_id)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) return json({ ok: false, error: guard.error }, guard.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "validate");

  try {
    if (action === "validate") {
      const { data, error } = await admin.rpc("affiliate_validate_due_commissions");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, validated: data });
    }

    if (action === "monthly_payout") {
      const { data, error } = await admin.rpc("affiliate_generate_monthly_payouts", {
        _period_start: body?.period_start ?? null,
        _period_end: body?.period_end ?? null,
      });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, result: data });
    }

    if (action === "replay_order") {
      const orderId = String(body?.order_id ?? "");
      if (!orderId) return json({ ok: false, error: "order_id requis" }, 400);
      const { data, error } = await admin.rpc("affiliate_process_order_commission", { _order_id: orderId });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, result: data });
    }

    return json({ ok: false, error: "action inconnue" }, 400);
  } catch (e) {
    console.error("affiliate-cron error", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
