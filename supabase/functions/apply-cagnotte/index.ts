// apply_cagnotte — applique la cagnotte MediKong sur une commande (mouvement 'spend').
// Appelée UNIQUEMENT à la validation finale de la commande (pas au mouvement du slider).
// Idempotente : un second appel sur la même commande échoue proprement.
// N'écrit JAMAIS commission_total_ht : la commission fournisseur reste calculée
// par snapshot_order_commission sur le montant HT plein.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ success: false, error: "Authentification requise" }, 401);

    let callerId: string | null = null;
    let isService = token === SERVICE_KEY;
    if (!isService) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ success: false, error: "Session invalide" }, 401);
      callerId = u.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body.order_id;
    const amountToUse = Math.round(Number(body.amount_to_use ?? 0) * 100) / 100;
    if (!orderId) return json({ success: false, error: "order_id requis" }, 400);

    // 1. Commande
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, order_number, customer_id, status, payment_status, cagnotte_used")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError || !order) return json({ success: false, error: "Commande introuvable" }, 404);

    if (order.payment_status === "paid" || !["draft", "pending", "confirmed"].includes(String(order.status))) {
      return json({
        success: false,
        error: `Commande dans un état non modifiable (${order.status}/${order.payment_status})`,
      }, 409);
    }

    // 2. Titulaire de la cagnotte = auth_user_id du client de la commande
    const { data: customer } = await admin
      .from("customers")
      .select("id, auth_user_id")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (!customer?.auth_user_id) {
      return json({ success: false, error: "Client sans compte utilisateur" }, 409);
    }

    if (!isService && callerId !== customer.auth_user_id) {
      const { data: adminRow } = await admin
        .from("admin_users")
        .select("id")
        .eq("user_id", callerId)
        .eq("is_active", true)
        .maybeSingle();
      if (!adminRow) return json({ success: false, error: "Accès refusé" }, 403);
    }

    // 3. Sous-total HT de la commande
    const { data: items } = await admin
      .from("order_items")
      .select("line_total_excl_vat")
      .eq("order_id", orderId);
    const subtotalHt = Math.round(
      (items ?? []).reduce((s, i) => s + Number(i.line_total_excl_vat || 0), 0) * 100,
    ) / 100;

    // 4. Paramètres
    const { data: settingsRows } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["cagnotte_min_spend", "cagnotte_max_spend_pct"]);
    const settings: Record<string, any> = {};
    for (const r of settingsRows ?? []) settings[r.key] = r.value;
    const minSpend = Number(settings.cagnotte_min_spend ?? 0.5);
    const maxPct = Number(settings.cagnotte_max_spend_pct ?? 0.3);

    // 5. Solde (NULL = 0 pour un nouveau pharmacien)
    const { data: balance } = await admin
      .from("cagnotte_balance")
      .select("current_balance")
      .eq("user_id", customer.auth_user_id)
      .maybeSingle();
    const currentBalance = Number(balance?.current_balance ?? 0);

    // 6. Validations dans cet ordre exact
    if (amountToUse < minSpend) {
      return json({ success: false, error: `Minimum ${minSpend.toFixed(2)} € requis`, balance_after: currentBalance }, 400);
    }
    const maxFromOrder = Math.floor(subtotalHt * maxPct * 100) / 100;
    if (amountToUse > maxFromOrder) {
      return json({
        success: false,
        error: `Maximum ${maxFromOrder.toFixed(2)} € (${Math.round(maxPct * 100)} % du sous-total HT)`,
        balance_after: currentBalance,
      }, 400);
    }
    if (amountToUse > currentBalance) {
      return json({
        success: false,
        error: `Solde insuffisant (${currentBalance.toFixed(2)} € disponibles)`,
        balance_after: currentBalance,
      }, 400);
    }

    // 7. Idempotence — pré-check applicatif (chemin rapide)
    const { data: existing } = await admin
      .from("cagnotte_ledger")
      .select("id")
      .eq("order_id", orderId)
      .eq("movement_type", "spend")
      .maybeSingle();
    if (existing) {
      return json({
        success: false,
        error: "Cagnotte déjà appliquée sur cette commande",
        balance_after: currentBalance,
        already_applied: true,
      }, 409);
    }

    // 8. Mouvement 'spend' (montant négatif)
    // L'unicité réelle est garantie en base par l'index partiel
    // idx_cagnotte_spend_unique_order (order_id) WHERE movement_type='spend'.
    // En cas de double appel concurrent (double webhook, double clic), le second
    // insert échoue avec 23505 → on répond 409 already_applied sans rien écrire.
    const { error: ledgerError } = await admin.rpc("insert_ledger_entry", {
      p_user_id: customer.auth_user_id,
      p_movement_type: "spend",
      p_amount_eur: -amountToUse,
      p_description: `Utilisation sur commande ${order.order_number}`,
      p_order_id: orderId,
    });
    if (ledgerError) {
      const code = (ledgerError as { code?: string }).code;
      const msg = ledgerError.message ?? "";
      const isDuplicate = code === "23505" || /idx_cagnotte_spend_unique_order|duplicate key/i.test(msg);
      if (isDuplicate) {
        return json({
          success: false,
          error: "Cagnotte déjà appliquée sur cette commande",
          balance_after: currentBalance,
          already_applied: true,
        }, 409);
      }
      return json({ success: false, error: msg || "Erreur lors de l'écriture du mouvement" }, 500);
    }


    // 9. Trace sur la commande — SEUL cagnotte_used change.
    // La commission fournisseur reste calculée sur le sous-total HT plein.
    await admin.from("orders").update({ cagnotte_used: amountToUse }).eq("id", orderId);

    const balanceAfter = Math.round((currentBalance - amountToUse) * 100) / 100;
    return json({
      success: true,
      balance_after: balanceAfter,
      cagnotte_used: amountToUse,
      subtotal_ht: subtotalHt,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
