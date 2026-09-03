// Messagerie de commande : l'admin écrit au client (ou le client répond),
// le message est historisé dans order_messages et notifié par email.
import { createClient } from "npm:@supabase/supabase-js@2";
import { AUDIT_NOTIFICATION_EMAIL } from "../_shared/audit-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://medikong.pro";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_KEY;

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return json({ error: "Unauthorized" }, 401);

  try {
    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(bearer);
    const userId = claims?.claims?.sub as string | undefined;
    if (claimsErr || !userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body?.orderId ?? body?.order_id;
    const message: string = String(body?.message ?? "").trim();
    if (!orderId) return json({ error: "orderId required" }, 400);
    if (!message) return json({ error: "message required" }, 400);
    if (message.length > 5000) return json({ error: "message too long" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_id, customers(company_name, email, auth_user_id)")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) return json({ error: "order_not_found" }, 404);

    const customer = (order as any).customers as
      | { company_name: string | null; email: string | null; auth_user_id: string | null }
      | null;

    // Résolution du rôle de l'auteur
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = !!adminRow?.is_active && ["super_admin", "admin", "moderateur", "support"].includes(adminRow.role);
    const isCustomer = !!customer?.auth_user_id && customer.auth_user_id === userId;
    if (!isAdmin && !isCustomer) return json({ error: "Forbidden" }, 403);

    const senderRole = isAdmin ? "admin" : "customer";
    let senderName = isAdmin ? "Équipe MediKong" : (customer?.company_name ?? "Client");
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.full_name) senderName = profile.full_name;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("order_messages")
      .insert({
        order_id: orderId,
        sender_role: senderRole,
        sender_user_id: userId,
        sender_name: senderName,
        body: message,
        ...(isAdmin ? { read_by_admin_at: new Date().toISOString() } : { read_by_customer_at: new Date().toISOString() }),
      })
      .select("id, created_at")
      .single();
    if (insertErr || !inserted) return json({ error: insertErr?.message ?? "insert_failed" }, 500);

    // Notification email (best-effort)
    let emailSent = false;
    try {
      if (isAdmin) {
        if (customer?.email) {
          const res = await supabase.functions.invoke("send-app-email", {
            body: {
              templateName: "order-message-customer",
              recipientEmail: customer.email,
              idempotencyKey: `order-message-${inserted.id}`,
              templateData: {
                orderNumber: (order as any).order_number,
                senderName,
                message,
                ctaUrl: `${SITE_URL}/commande/${orderId}`,
              },
            },
          });
          emailSent = !res.error;
        }
      } else {
        const res = await supabase.functions.invoke("send-app-email", {
          body: {
            templateName: "order-message-admin",
            recipientEmail: AUDIT_NOTIFICATION_EMAIL,
            idempotencyKey: `order-message-${inserted.id}`,
            templateData: {
              orderNumber: (order as any).order_number,
              customerName: customer?.company_name ?? "Client",
              customerEmail: customer?.email ?? "",
              message,
              ctaUrl: `${SITE_URL}/admin/commandes/${orderId}`,
            },
          },
        });
        emailSent = !res.error;
      }
    } catch (e) {
      console.error("[send-order-message] email failed", (e as Error)?.message ?? e);
    }

    return json({ ok: true, message_id: inserted.id, email_sent: emailSent });
  } catch (e) {
    console.error("[send-order-message]", (e as Error)?.message ?? e);
    return json({ error: "internal_error" }, 500);
  }
});
