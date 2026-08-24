// Cron-friendly. Sends reminders for sub_orders paid by invoice :
//   J-N (before due, configurable per vendor)
//   J+M for each M in remind_days_after_due (configurable per vendor)
// Also flips PENDING -> OVERDUE for past-due invoices.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / 86400000);
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-BE", { year: "numeric", month: "long", day: "2-digit" }).format(date);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), {
      status: guard.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }



  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Flip pending -> overdue
    const { data: overdueCount } = await supabase.rpc("mark_overdue_vendor_invoices");

    // 2. Find sub_orders eligible for a reminder
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data: subs, error: subErr } = await supabase
      .from("sub_orders")
      .select(`
        id, order_id, vendor_id, payment_due_date, payment_status,
        invoice_reminder_count, invoice_last_reminder_at, subtotal_incl_vat,
        orders:order_id ( id, order_number, customer_id, customers:customer_id ( id, email, company_name ) ),
        vendors:vendor_id ( id, name, company_name )
      `)
      .eq("payment_method", "invoice")
      .in("payment_status", ["pending", "overdue"]);

    if (subErr) throw subErr;

    // 3. Load vendor settings in batch
    const vendorIds = [...new Set((subs || []).map((s: any) => s.vendor_id))];
    const { data: settings } = vendorIds.length
      ? await supabase
          .from("vendor_invoice_payment_settings")
          .select("vendor_id, auto_remind_enabled, remind_days_before_due, remind_days_after_due")
          .in("vendor_id", vendorIds)
      : { data: [] };
    const settingsMap = new Map((settings || []).map((s: any) => [s.vendor_id, s]));

    let sent = 0;
    let skipped = 0;

    for (const s of subs || []) {
      const cfg: any = settingsMap.get(s.vendor_id);
      if (!cfg || cfg.auto_remind_enabled === false) { skipped++; continue; }
      if (!s.payment_due_date) { skipped++; continue; }

      const due = new Date(s.payment_due_date);
      due.setUTCHours(0, 0, 0, 0);
      const offset = daysBetween(today, due); // <0 before, =0 today, >0 overdue

      const before = Number(cfg.remind_days_before_due ?? 3);
      const after: number[] = Array.isArray(cfg.remind_days_after_due) ? cfg.remind_days_after_due : [1, 7, 14];

      const shouldRemind =
        (offset === -before) ||         // N days before
        (offset === 0) ||                // due today
        (offset > 0 && after.includes(offset));

      if (!shouldRemind) { skipped++; continue; }

      // Idempotency : don't send more than once per day
      if (s.invoice_last_reminder_at) {
        const last = new Date(s.invoice_last_reminder_at);
        if (last.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)) {
          skipped++; continue;
        }
      }

      const customerEmail = (s.orders as any)?.customers?.email;
      if (!customerEmail) { skipped++; continue; }

      const idemKey = `invoice-reminder-${s.id}-${today.toISOString().slice(0, 10)}`;

      try {
        await supabase.functions.invoke("send-app-email", {
          body: {
            templateName: "invoice-payment-reminder",
            recipientEmail: customerEmail,
            idempotencyKey: idemKey,
            templateData: {
              customerName: (s.orders as any)?.customers?.company_name ?? null,
              vendorName: (s.vendors as any)?.company_name || (s.vendors as any)?.name || "votre fournisseur",
              orderNumber: (s.orders as any)?.order_number,
              amountIncVat: fmtMoney(Number(s.subtotal_incl_vat || 0)),
              dueDate: fmtDate(s.payment_due_date),
              daysOffset: offset,
              payUrl: `https://medikong.pro/account/orders/${(s.orders as any)?.order_number ?? ""}`,
            },
          },
        });

        await supabase
          .from("sub_orders")
          .update({
            invoice_reminder_count: (s.invoice_reminder_count ?? 0) + 1,
            invoice_last_reminder_at: new Date().toISOString(),
          })
          .eq("id", s.id);
        sent++;
      } catch (e) {
        console.error("Reminder send failed", s.id, e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, marked_overdue: overdueCount ?? 0, sent, skipped, considered: subs?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("send-invoice-payment-reminders error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
