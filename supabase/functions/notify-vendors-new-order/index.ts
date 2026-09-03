// Notifie les vendeurs concernés par une commande qui vient d'être payée :
// - crée 1 sub_order par vendeur (idempotent)
// - insère 1 vendor_notifications "Nouvelle commande" (cloche, idempotent)
// - envoie l'email transactionnel "vendor-new-order"
//
// Appelé par stripe-webhook (checkout.session.completed) et check-session-status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_URL = "https://medikong.pro/vendor/commandes";
const MAGIC_LINK_BASE = "https://medikong.pro/vendor/orders";

const fmtEur = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!isFinite(v)) return "0,00 EUR";
  return new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " EUR";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role only: this endpoint is called internally by stripe-webhook and
  // check-session-status. Reject any external caller.
  const SERVICE_KEY_ENV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!SERVICE_KEY_ENV || token !== SERVICE_KEY_ENV) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body?.orderId ?? body?.order_id;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Charge SLA settings (pour rappel délais dans l'email)
    const { data: settings } = await supabase
      .from("vendor_sla_settings")
      .select("hours_to_confirm, hours_to_ship")
      .eq("id", 1)
      .maybeSingle();
    const hoursToConfirm = settings?.hours_to_confirm ?? 12;
    const hoursToShip = settings?.hours_to_ship ?? 24;

    // 2) Fan-out: crée sub_orders + notifs cloche, retourne la liste des vendeurs
    const { data: vendors, error: fanErr } = await supabase
      .rpc("fanout_order_to_vendors", { _order_id: orderId });

    if (fanErr) {
      console.error("[notify-vendors-new-order] fanout error", fanErr);
      return new Response(JSON.stringify({ error: fanErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailsSent = 0;
    let emailsSkipped = 0;
    const errors: string[] = [];

    for (const v of vendors ?? []) {
      if (!v.vendor_email) {
        emailsSkipped++;
        continue;
      }
      // CTA magic-link : /vendor/orders/<order_number>?token=<magic_token>
      // Fallback sur PORTAL_URL si pas de token (sécurité).
      const ctaUrl = v.magic_token && v.order_number
        ? `${MAGIC_LINK_BASE}/${encodeURIComponent(v.order_number)}?token=${encodeURIComponent(v.magic_token)}`
        : PORTAL_URL;

      try {
        const res = await supabase.functions.invoke("send-app-email", {
          body: {
            templateName: "vendor-new-order",
            recipientEmail: v.vendor_email,
            idempotencyKey: `vendor-new-order-${v.sub_order_id}`,
            templateData: {
              vendorName: v.vendor_name,
              orderNumber: v.order_number,
              lineCount: v.line_count,
              vendorTotalIncVat: fmtEur(v.vendor_subtotal_incl_vat),
              hoursToConfirm,
              hoursToShip,
              ctaUrl,
            },
          },
        });
        if (res.error) throw res.error;
        emailsSent++;
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        console.error("[notify-vendors-new-order] email failed", v.vendor_id, msg);
        errors.push(`${v.vendor_id}:${msg}`);
      }
    }

    // 4) Notification interne (équipe MediKong) — 1 email par commande, idempotent
    let adminEmailSent = false;
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number, total_incl_vat, total_excl_vat, payment_method, customer_id, customers(company_name, email)")
        .eq("id", orderId)
        .maybeSingle();
      const { count: lineCount } = await supabase
        .from("order_lines")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId);
      const cust: any = (order as any)?.customers ?? null;
      const res = await supabase.functions.invoke("send-app-email", {
        body: {
          templateName: "admin-new-order",
          idempotencyKey: `admin-new-order-${orderId}`,
          templateData: {
            orderNumber: order?.order_number ?? orderId,
            customerName: cust?.company_name ?? "—",
            customerEmail: cust?.email ?? "",
            totalIncVat: fmtEur(order?.total_incl_vat),
            totalExclVat: fmtEur(order?.total_excl_vat),
            lineCount: lineCount ?? 0,
            vendorCount: vendors?.length ?? 0,
            paymentMethod: order?.payment_method ?? "—",
            ctaUrl: `https://medikong.pro/admin/commandes/${orderId}`,
          },
        },
      });
      if (res.error) throw res.error;
      adminEmailSent = true;
    } catch (e) {
      console.error("[notify-vendors-new-order] admin email failed", (e as Error)?.message ?? e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        order_id: orderId,
        admin_email_sent: adminEmailSent,
        vendors: vendors?.length ?? 0,
        emails_sent: emailsSent,
        emails_skipped: emailsSkipped,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
