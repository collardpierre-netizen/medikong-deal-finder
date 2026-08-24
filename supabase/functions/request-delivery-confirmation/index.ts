// Envoie l'email "Confirmez la réception de votre commande" au client.
// Appelé automatiquement par le trigger DB quand orders.status passe à 'delivered',
// et invocable manuellement en admin (dryRun supporté).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth : soit cron/trigger via x-cron-secret, soit admin connecté via Bearer JWT.
  const cronSecret = Deno.env.get("CRON_SHARED_SECRET") ?? "";
  const providedCron = req.headers.get("x-cron-secret") ?? "";
  const isCronCall = !!cronSecret && providedCron === cronSecret;

  const admin = createClient(supabaseUrl, serviceKey);

  if (!isCronCall) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!bearer) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(bearer);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: claims.claims.sub as string });
    if (isAdmin !== true) return json({ error: "Forbidden" }, 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* trigger peut envoyer JSON minimal */ }
  const orderId = String(body?.orderId ?? "");
  if (!orderId) return json({ error: "orderId required" }, 400);
  const dryRun = body?.dryRun === true;

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, order_number, customer_id, status, delivery_confirmation_completed_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) return json({ error: "Order not found" }, 404);
  if (order.status !== "delivered") {
    return json({ error: "order_not_delivered", status: order.status }, 422);
  }
  if (order.delivery_confirmation_completed_at) {
    return json({ skipped: true, reason: "already_confirmed_by_buyer" }, 200);
  }

  const { data: customer } = await admin
    .from("customers")
    .select("email, company_name")
    .eq("id", order.customer_id)
    .maybeSingle();
  const recipientEmail = customer?.email;
  if (!recipientEmail) return json({ error: "Customer email missing" }, 422);

  // Génère (ou régénère) le magic-link token via RPC SECURITY DEFINER.
  const { data: rawToken, error: tokErr } = await admin.rpc("create_buyer_delivery_token", { _order_id: order.id });
  if (tokErr || !rawToken) return json({ error: "token_generation_failed", detail: tokErr?.message }, 500);

  const appOrigin = String(body?.appOrigin || "https://medikong.pro").replace(/\/+$/, "");
  const confirmUrl = `${appOrigin}/commande/confirmer/${encodeURIComponent(String(rawToken))}`;

  const { data: lines } = await admin
    .from("order_lines")
    .select("id, quantity, line_total_incl_vat, products:product_id(name)")
    .eq("order_id", order.id);
  const lineCount = (lines ?? []).length;

  const templateData = {
    orderNumber: order.order_number,
    customerName: customer?.company_name || undefined,
    confirmUrl,
    lineCount,
  };

  const idempotencyKey = `order-delivery-confirmation-${order.id}`;

  if (dryRun) {
    return json({
      dryRun: true,
      idempotencyKey,
      recipient: recipientEmail,
      templateName: "order-delivery-confirmation",
      templateData,
      confirmUrl,
    });
  }

  const { data: sendData, error: sendErr } = await admin.functions.invoke("send-app-email", {
    body: {
      templateName: "order-delivery-confirmation",
      recipientEmail,
      idempotencyKey,
      templateData,
    },
  });
  if (sendErr) return json({ error: "email_invoke_failed", detail: sendErr?.message }, 502);

  return json({ success: true, queued: true, recipient: recipientEmail, idempotencyKey, sendData });
});
