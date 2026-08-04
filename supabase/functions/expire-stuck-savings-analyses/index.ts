// Edge function: expire-stuck-savings-analyses
// Watchdog appelé par pg_cron : passe en `failed` (failure_reason = 'timeout')
// toutes les analyses OCR restées en `processing` au-delà de processing_timeout_at,
// puis notifie le pharmacien par email (best-effort, idempotent).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const nowIso = new Date().toISOString();
    const { data: stuck, error: selErr } = await supabase
      .from("savings_simulations")
      .select("id, email, pharmacy_name, created_via")
      .eq("status", "processing")
      .not("processing_timeout_at", "is", null)
      .lt("processing_timeout_at", nowIso)
      .limit(100);
    if (selErr) throw selErr;

    let expired = 0;
    let notified = 0;

    for (const sim of stuck ?? []) {
      const { error: upErr } = await supabase
        .from("savings_simulations")
        .update({
          status: "failed",
          failure_reason: "timeout",
          error_message: "Traitement interrompu (délai dépassé).",
          processing_timeout_at: null,
        })
        .eq("id", sim.id)
        .eq("status", "processing");
      if (upErr) {
        console.error("[expire-savings] update failed", sim.id, upErr);
        continue;
      }
      expired++;

      if (sim.email && sim.created_via !== "admin_manual") {
        try {
          const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "savings-analysis-failed",
              recipientEmail: sim.email,
              idempotencyKey: `savings-failed-${sim.id}`,
              templateData: {
                pharmacyName: sim.pharmacy_name || "votre pharmacie",
                reason: "timeout",
                retryUrl: "https://medikong.pro/economies",
              },
            },
          });
          if (mailErr) console.error("[expire-savings] email failed", sim.id, mailErr);
          else notified++;
        } catch (e) {
          console.error("[expire-savings] email exception", sim.id, e);
        }
      }
    }

    console.log("[expire-savings] done", { expired, notified });
    return Response.json({ expired, notified }, { headers: corsHeaders });
  } catch (err) {
    console.error("[expire-savings] fatal", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders },
    );
  }
});
