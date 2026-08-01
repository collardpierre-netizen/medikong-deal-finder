// calculate_commission — commission fournisseur MediKong.
// CRITIQUE : calculée sur le MONTANT PLEIN HT de chaque ligne, au taux gelé
// à la commande, INDÉPENDAMMENT de la cagnotte utilisée par le pharmacien.
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

    // Gèle les taux manquants puis totalise sur le montant plein des lignes.
    const { data: snapshot, error } = await admin.rpc("snapshot_order_commission", {
      p_order_id: orderId,
    });
    if (error) return json({ success: false, error: error.message }, 500);

    const { data: order } = await admin
      .from("orders")
      .select("id, order_number, subtotal_excl_vat, cagnotte_used, commission_total_ht, cagnotte_eligible_ht")
      .eq("id", orderId)
      .maybeSingle();

    const { data: lines } = await admin
      .from("order_items")
      .select("id, line_total_excl_vat, commission_rate_snapshot, commission_ht, cagnotte_eligible_snapshot")
      .eq("order_id", orderId);

    return json({
      success: true,
      order: order ?? null,
      // Montant reversé au fournisseur = montant plein − commission (jamais impacté par la cagnotte)
      supplier_payout_ht:
        order
          ? Math.round(
              (Number(order.subtotal_excl_vat || 0) - Number(order.commission_total_ht || 0)) * 100,
            ) / 100
          : null,
      buyer_due_ht: order
        ? Math.round(
            (Number(order.subtotal_excl_vat || 0) - Number(order.cagnotte_used || 0)) * 100,
          ) / 100
        : null,
      lines: lines ?? [],
      snapshot,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
