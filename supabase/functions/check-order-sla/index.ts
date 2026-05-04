// Cron-driven SLA scanner for vendor sub-orders.
// Detects overdue actions and writes to order_vendor_sla_alerts.
// Sends vendor in-app notification, optional admin email, optional Slack webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AlertType = "not_viewed" | "not_confirmed" | "not_shipped" | "critical_escalation";

interface Settings {
  enabled: boolean;
  hours_to_view: number;
  hours_to_confirm: number;
  hours_to_ship: number;
  hours_critical_escalation: number;
  notify_admin_email: string | null;
  slack_webhook_url: string | null;
  send_vendor_reminder: boolean;
}

const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1) Load settings
  const { data: settingsRow } = await supabase
    .from("vendor_sla_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const settings: Settings = {
    enabled: settingsRow?.enabled ?? true,
    hours_to_view: settingsRow?.hours_to_view ?? 1,
    hours_to_confirm: settingsRow?.hours_to_confirm ?? 12,
    hours_to_ship: settingsRow?.hours_to_ship ?? 24,
    hours_critical_escalation: settingsRow?.hours_critical_escalation ?? 48,
    notify_admin_email: settingsRow?.notify_admin_email ?? null,
    slack_webhook_url: settingsRow?.slack_webhook_url ?? null,
    send_vendor_reminder: settingsRow?.send_vendor_reminder ?? true,
  };

  if (!settings.enabled) return j({ ok: true, skipped: "disabled" });

  // 2) Fetch open sub_orders (not shipped/delivered/cancelled) with parent paid order
  const { data: subOrders, error } = await supabase
    .from("sub_orders")
    .select(`
      id, vendor_id, status, created_at,
      vendor_first_viewed_at, vendor_confirmed_at, shipped_at,
      orders!inner ( id, order_number, payment_status, status, total_incl_vat, hidden_from_list )
    `)
    .in("status", ["pending", "processing", "forwarded"])
    .limit(1000);

  if (error) return j({ ok: false, error: error.message }, 500);

  const now = Date.now();
  const created: Array<{ alert_type: AlertType; sub_order_id: string }> = [];
  const skipped: string[] = [];

  for (const so of subOrders ?? []) {
    const order = (so as any).orders;
    if (!order || order.hidden_from_list) continue;
    if (order.payment_status !== "paid") continue; // SLA only counts after payment

    const ageHours = (now - new Date(so.created_at).getTime()) / 36e5;

    // Determine the most relevant overdue alert
    const candidates: Array<{ type: AlertType; threshold: number; cond: boolean }> = [
      {
        type: "critical_escalation",
        threshold: settings.hours_critical_escalation,
        cond: !so.shipped_at && ageHours >= settings.hours_critical_escalation,
      },
      {
        type: "not_shipped",
        threshold: settings.hours_to_ship,
        cond: !so.shipped_at && ageHours >= settings.hours_to_ship,
      },
      {
        type: "not_confirmed",
        threshold: settings.hours_to_confirm,
        cond: !so.vendor_confirmed_at && ageHours >= settings.hours_to_confirm,
      },
      {
        type: "not_viewed",
        threshold: settings.hours_to_view,
        cond: !so.vendor_first_viewed_at && ageHours >= settings.hours_to_view,
      },
    ];

    const triggered = candidates.find((c) => c.cond);
    if (!triggered) {
      skipped.push(so.id);
      continue;
    }

    const severity =
      triggered.type === "critical_escalation" || triggered.type === "not_shipped"
        ? "critical"
        : "warning";

    const { data: ins, error: insErr } = await supabase
      .from("order_vendor_sla_alerts")
      .upsert(
        {
          order_id: order.id,
          sub_order_id: so.id,
          vendor_id: so.vendor_id,
          alert_type: triggered.type,
          severity,
          hours_overdue: Number((ageHours - triggered.threshold).toFixed(2)),
          threshold_hours: triggered.threshold,
          payload: {
            order_number: order.order_number,
            order_total_incl_vat: order.total_incl_vat,
            sub_order_status: so.status,
            age_hours: Number(ageHours.toFixed(2)),
          },
        },
        { onConflict: "sub_order_id,alert_type", ignoreDuplicates: false },
      )
      .select("id, notified_vendor_at, notified_admin_at, notified_slack_at")
      .maybeSingle();

    if (insErr || !ins) continue;
    created.push({ alert_type: triggered.type, sub_order_id: so.id });

    // 3a) Vendor in-app notification (once per alert)
    if (settings.send_vendor_reminder && so.vendor_id && !ins.notified_vendor_at) {
      await supabase.from("vendor_notifications").insert({
        vendor_id: so.vendor_id,
        type: "order_sla_overdue",
        title:
          triggered.type === "not_viewed"
            ? `Commande ${order.order_number} en attente de prise en charge`
            : triggered.type === "not_confirmed"
              ? `Commande ${order.order_number} à confirmer`
              : triggered.type === "not_shipped"
                ? `Commande ${order.order_number} à expédier`
                : `Commande ${order.order_number} : escalade critique`,
        body: `Action requise : ${triggered.type}. Délai dépassé de ${Math.round(ageHours - triggered.threshold)}h (seuil ${triggered.threshold}h).`,
        cta_url: `/vendor/commandes`,
        payload: { sub_order_id: so.id, order_id: order.id, alert_type: triggered.type, severity },
      });
      await supabase
        .from("order_vendor_sla_alerts")
        .update({ notified_vendor_at: new Date().toISOString() })
        .eq("id", ins.id);
    }

    // 3b) Admin email (only critical)
    if (severity === "critical" && settings.notify_admin_email && !ins.notified_admin_at) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "order-sla-critical-admin",
            recipientEmail: settings.notify_admin_email,
            idempotencyKey: `sla-admin-${ins.id}`,
            templateData: {
              orderNumber: order.order_number,
              alertType: triggered.type,
              hoursOverdue: Math.round(ageHours - triggered.threshold),
              vendorId: so.vendor_id,
              adminUrl: `https://dev.medikong.pro/admin/commandes`,
            },
          },
        });
        await supabase
          .from("order_vendor_sla_alerts")
          .update({ notified_admin_at: new Date().toISOString() })
          .eq("id", ins.id);
      } catch (_) { /* best-effort */ }
    }

    // 3c) Slack webhook (warning + critical)
    if (settings.slack_webhook_url && !ins.notified_slack_at) {
      try {
        const emoji = severity === "critical" ? ":rotating_light:" : ":hourglass_flowing_sand:";
        await fetch(settings.slack_webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${emoji} *SLA ${severity.toUpperCase()}* — Commande \`${order.order_number}\`\n• Vendeur: ${so.vendor_id}\n• Type: ${triggered.type}\n• Retard: +${Math.round(ageHours - triggered.threshold)}h (seuil ${triggered.threshold}h)\n• <https://dev.medikong.pro/admin/commandes|Voir>`,
          }),
        });
        await supabase
          .from("order_vendor_sla_alerts")
          .update({ notified_slack_at: new Date().toISOString() })
          .eq("id", ins.id);
      } catch (_) { /* best-effort */ }
    }

    await supabase
      .from("sub_orders")
      .update({ last_sla_check_at: new Date().toISOString() })
      .eq("id", so.id);
  }

  // 4) Auto-resolve alerts whose underlying issue is fixed
  const { data: openAlerts } = await supabase
    .from("order_vendor_sla_alerts")
    .select("id, alert_type, sub_orders:sub_order_id(status, vendor_first_viewed_at, vendor_confirmed_at, shipped_at)")
    .is("resolved_at", null);

  for (const a of (openAlerts ?? []) as any[]) {
    const so = a.sub_orders;
    if (!so) continue;
    let resolved = false;
    if (a.alert_type === "not_viewed" && so.vendor_first_viewed_at) resolved = true;
    if (a.alert_type === "not_confirmed" && so.vendor_confirmed_at) resolved = true;
    if (a.alert_type === "not_shipped" && (so.shipped_at || ["shipped","delivered"].includes(so.status))) resolved = true;
    if (a.alert_type === "critical_escalation" && (so.shipped_at || ["shipped","delivered","cancelled"].includes(so.status))) resolved = true;
    if (so.status === "cancelled") resolved = true;
    if (resolved) {
      await supabase
        .from("order_vendor_sla_alerts")
        .update({ resolved_at: new Date().toISOString(), resolved_reason: "auto: action completed" })
        .eq("id", a.id);
    }
  }

  return j({ ok: true, scanned: subOrders?.length ?? 0, created: created.length, skipped: skipped.length });
});
