// credit_cagnotte — crédite la cagnotte MediKong d'une commande payée.
// Règles : 2% du HT des lignes ÉLIGIBLES (commission produit >= 12%),
// expiration au 31 décembre de l'année civile suivante, idempotent par commande.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  if (!guard.ok) return json({ success: false, error: guard.error }, guard.status);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body.order_id;
    if (!orderId) return json({ success: false, error: "order_id required" }, 400);

    // 1. Idempotence
    const { data: existing } = await admin
      .from("cagnotte_ledger")
      .select("id, amount_eur")
      .eq("order_id", orderId)
      .eq("movement_type", "earn")
      .maybeSingle();
    if (existing) {
      return json({ success: true, skipped: "already_credited", ledger_id: existing.id, cagnotte_earned: existing.amount_eur });
    }

    // 2. Commande + acheteur
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, order_number, customer_id, payment_status, status, cagnotte_earned")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) return json({ success: false, error: "order_not_found" }, 404);

    if (order.payment_status !== "paid") {
      return json({ success: false, error: "order_not_paid", payment_status: order.payment_status }, 409);
    }

    const { data: customer } = await admin
      .from("customers")
      .select("id, auth_user_id")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (!customer?.auth_user_id) {
      return json({ success: false, error: "customer_without_auth_user" }, 409);
    }

    // 3. Geler taux/éligibilité + recalculer la commission fournisseur (montant plein)
    const { data: snapshot, error: snapErr } = await admin.rpc("snapshot_order_commission", {
      p_order_id: orderId,
    });
    if (snapErr) return json({ success: false, error: snapErr.message }, 500);

    // 4. HT éligible = uniquement les lignes cagnotte_eligible_snapshot = true
    const { data: eligibleLines } = await admin
      .from("order_items")
      .select("line_total_excl_vat")
      .eq("order_id", orderId)
      .eq("cagnotte_eligible_snapshot", true);

    const eligibleHt = Math.round(
      (eligibleLines ?? []).reduce((s, l) => s + Number(l.line_total_excl_vat || 0), 0) * 100,
    ) / 100;

    // 5. Taux depuis settings
    const { data: setting } = await admin
      .from("settings")
      .select("value")
      .eq("key", "cagnotte_rate")
      .maybeSingle();
    const rate = Number(setting?.value ?? 0.02);

    const earned = Math.round(eligibleHt * rate * 100) / 100;
    if (earned < 0.01) {
      return json({
        success: true,
        skipped: "nothing_eligible",
        cagnotte_eligible_ht: eligibleHt,
        commission_total_ht: (snapshot as any)?.commission_total_ht ?? null,
      });
    }

    // 6. Expiration : 31 décembre de N+1
    const expiresOn = `${new Date().getUTCFullYear() + 1}-12-31`;

    const { data: ledgerId, error: ledgerErr } = await admin.rpc("insert_ledger_entry", {
      p_user_id: customer.auth_user_id,
      p_movement_type: "earn",
      p_amount_eur: earned,
      p_description: `Gain sur commande ${order.order_number} (${eligibleHt.toFixed(2)} € HT éligible)`,
      p_order_id: orderId,
      p_expires_on: expiresOn,
    });
    if (ledgerErr) return json({ success: false, error: ledgerErr.message }, 500);

    // 7. Trace sur la commande
    await admin
      .from("orders")
      .update({ cagnotte_eligible_ht: eligibleHt, cagnotte_earned: earned })
      .eq("id", orderId);

    // 8. Email "cagnotte gagnée" — idempotent via orders.email_cagnotte_earned_sent_at
    try {
      const { data: orderMail } = await admin
        .from("orders")
        .select("id, order_number, subtotal_excl_vat, email_cagnotte_earned_sent_at")
        .eq("id", orderId)
        .maybeSingle();

      if (orderMail && !orderMail.email_cagnotte_earned_sent_at) {
        const { data: cust } = await admin
          .from("customers")
          .select("email, contact_name, company_name")
          .eq("id", order.customer_id)
          .maybeSingle();

        const { data: bal } = await admin
          .from("cagnotte_balance")
          .select("current_balance, next_expiry_date")
          .eq("user_id", customer.auth_user_id)
          .maybeSingle();

        if (cust?.email) {
          const expiryDate = bal?.next_expiry_date ?? expiresOn;
          const expiresLabel = new Date(expiryDate).toLocaleDateString("fr-BE", {
            day: "numeric", month: "long", year: "numeric",
          });
          const firstName = String(cust.contact_name || cust.company_name || "").split(" ")[0] || null;

          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "cagnotte-earned",
              recipientEmail: cust.email,
              idempotencyKey: `cagnotte-earned-${orderId}`,
              templateData: {
                pharmacien_prenom: firstName,
                order_number: orderMail.order_number,
                order_ht: Number(orderMail.subtotal_excl_vat ?? 0),
                eligible_ht: eligibleHt,
                cagnotte_earned: earned,
                cagnotte_balance_total: Number(bal?.current_balance ?? earned),
                expires_on: expiresLabel,
                cta_url: `${Deno.env.get("APP_URL") ?? "https://www.medikong.pro"}/compte`,
              },
            },
          });

          await admin
            .from("orders")
            .update({ email_cagnotte_earned_sent_at: new Date().toISOString() })
            .eq("id", orderId)
            .is("email_cagnotte_earned_sent_at", null);
        }
      }
    } catch (mailErr) {
      console.error("cagnotte-earned email error:", mailErr);
    }

    return json({
      success: true,
      ledger_id: ledgerId,
      user_id: customer.auth_user_id,
      cagnotte_eligible_ht: eligibleHt,
      cagnotte_earned: earned,
      expires_on: expiresOn,
      commission_total_ht: (snapshot as any)?.commission_total_ht ?? null,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
