// Cron job : rejoue notify-vendors-new-order pour les commandes payées
// qui n'ont aucun sub_order (webhook Stripe manqué ou fan-out échoué).
// Scanne les 7 derniers jours ; idempotent côté fanout_order_to_vendors + email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const results: Array<{ order_id: string; order_number: string; ok: boolean; error?: string }> = [];

  try {
    // Commandes payées des 7 derniers jours sans aucun sub_order
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, order_number, created_at")
      .eq("payment_status", "paid")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;

    for (const o of orders ?? []) {
      const { count } = await supabase
        .from("sub_orders")
        .select("id", { count: "exact", head: true })
        .eq("order_id", o.id);
      if ((count ?? 0) > 0) continue;

      try {
        const res = await supabase.functions.invoke("notify-vendors-new-order", {
          body: { orderId: o.id },
        });
        if (res.error) throw res.error;
        results.push({ order_id: o.id, order_number: o.order_number, ok: true });
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        console.error("[retry-vendor-fanout] failed", o.id, msg);
        results.push({ order_id: o.id, order_number: o.order_number, ok: false, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, scanned: orders?.length ?? 0, replayed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, results }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
