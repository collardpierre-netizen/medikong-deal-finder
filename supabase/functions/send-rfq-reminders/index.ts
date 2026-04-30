// RFQ Reminders Dispatcher
// - Cron toutes les 30min appelle cette edge function
// - Charge les cibles éligibles via la RPC `rfq_select_reminder_targets`
// - Pour chaque cible : rend le template (variables {{...}}), crée une
//   vendor_notification (qui déclenche l'email via le pipeline existant),
//   et trace dans rfq_reminder_log via `rfq_record_reminder_sent`.
//
// Garde-fous DB-side (déjà appliqués par la RPC) :
//  - RFQ encore actif, deadline non dépassée
//  - vendeur a vu (viewed/pending_review/reminded), pas répondu, pas décliné
//  - délai de la vague atteint (24h pour vague 1, 72h pour vague 2)
//  - pas de doublon (UNIQUE rfq_id+vendor_id+wave_number)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://medikong.pro";

interface Target {
  dispatch_id: string;
  rfq_id: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_email: string | null;
  product_name: string | null;
  quantity: number;
  deadline_in_hours: number;
  responses_deadline: string;
  next_wave: number;
  template_id: string;
  subject_fr: string;
  body_fr: string;
  tracking_token: string;
}

function renderTemplate(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) =>
    String(vars[k] ?? `{{${k}}}`),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Charge les cibles
  const { data: targets, error: selErr } = await supabase.rpc(
    "rfq_select_reminder_targets",
    { _max_per_run: 200 },
  );

  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const list = (targets ?? []) as Target[];
  const summary = { total: list.length, sent: 0, skipped: 0, errors: 0 };

  for (const t of list) {
    const vars = {
      vendor_name: t.vendor_name ?? "Cher partenaire",
      product_name: t.product_name ?? "le produit demandé",
      quantity: t.quantity,
      deadline_in_hours: t.deadline_in_hours,
      respond_url: `${APP_URL}/vendor/rfq/${t.rfq_id}?token=${t.tracking_token}`,
    };

    const subject = renderTemplate(t.subject_fr, vars);
    const body = renderTemplate(t.body_fr, vars);

    // Crée une vendor_notification (le pipeline existant gère l'email)
    const { data: notif, error: notifErr } = await supabase
      .from("vendor_notifications")
      .insert({
        vendor_id: t.vendor_id,
        type: "rfq_reminder",
        title: subject,
        body,
        link_url: vars.respond_url,
        metadata: {
          rfq_id: t.rfq_id,
          dispatch_id: t.dispatch_id,
          wave_number: t.next_wave,
          template_id: t.template_id,
        },
      })
      .select("id")
      .single();

    // Trace dans rfq_reminder_log (idempotent via UNIQUE)
    const { data: logId, error: logErr } = await supabase.rpc(
      "rfq_record_reminder_sent",
      {
        _rfq_id: t.rfq_id,
        _vendor_id: t.vendor_id,
        _wave: t.next_wave,
        _template_id: t.template_id,
        _email_message_id: notif?.id ?? null,
        _error: notifErr?.message ?? null,
      },
    );

    if (logErr || notifErr) {
      summary.errors++;
    } else if (logId) {
      summary.sent++;
    } else {
      // Doublon (déjà loggé) — silencieux
      summary.skipped++;
    }
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
