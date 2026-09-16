// @ts-nocheck — Deno runtime
// Émet les factures d'une commande payée par virement (au nom et pour le compte
// du fournisseur + commission), pour les encaissements qui ne passent pas par
// Stripe. Deux modes :
//   { order_id: "<uuid>" }  → une commande précise
//   { sweep: true }         → rattrapage des commandes virement payées sans facture
// Auth : service_role ou admin.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { emitOrderInvoices } from "../_shared/order-invoices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SWEEP_LIMIT = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "___");
    if (!isServiceRole) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return json(401, { error: "unauthorized" });
      const { data: userRes } = await supabase.auth.getUser(token);
      const uid = userRes?.user?.id;
      if (!uid) return json(401, { error: "unauthorized" });
      const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!adm) return json(403, { error: "forbidden" });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.order_id === "string" ? body.order_id.trim() : "";
    const sweep = body?.sweep === true;
    if (!orderId && !sweep) return json(400, { error: "order_id_or_sweep_required" });

    const nowIso = new Date().toISOString();

    // ── Mode commande unique
    if (orderId) {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, order_number, payment_method, payment_status, status")
        .eq("id", orderId)
        .maybeSingle();
      if (error) return json(500, { error: "order_fetch_failed", details: error.message });
      if (!order) return json(404, { error: "order_not_found" });
      if (order.payment_status !== "paid") {
        return json(200, { ok: true, skipped: "not_paid", payment_status: order.payment_status });
      }
      if (String(order.status || "").toLowerCase() === "cancelled") {
        return json(200, { ok: true, skipped: "cancelled" });
      }
      const res = await emitOrderInvoices(supabase, order.id, nowIso);
      return json(200, { ok: true, order_id: order.id, ...res });
    }

    // ── Mode rattrapage : virements payés sans facture au nom du fournisseur
    const { data: candidates, error: candErr } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("payment_status", "paid")
      .eq("payment_method", "bank_transfer")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(500);
    if (candErr) return json(500, { error: "candidates_fetch_failed", details: candErr.message });

    const ids = (candidates || []).map((o: any) => o.id);
    if (ids.length === 0) return json(200, { ok: true, processed: 0 });

    const { data: invoiced } = await supabase
      .from("order_invoices")
      .select("order_id")
      .eq("type", "self_billing")
      .in("order_id", ids);
    const alreadyInvoiced = new Set((invoiced || []).map((r: any) => r.order_id));

    const todo = ids.filter((id: string) => !alreadyInvoiced.has(id)).slice(0, SWEEP_LIMIT);
    const processed: Array<Record<string, unknown>> = [];
    for (const id of todo) {
      const res = await emitOrderInvoices(supabase, id, nowIso);
      processed.push({ order_id: id, emitted_vendors: res.emitted_vendors, skipped_no_mandate: res.skipped_no_mandate });
    }

    return json(200, { ok: true, candidates: ids.length, processed: processed.length, details: processed });
  } catch (e) {
    console.error("[emit-order-invoices]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
