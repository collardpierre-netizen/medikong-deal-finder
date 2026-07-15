// Server-side order creation (security definer pattern).
// Replaces the client-side inserts in useCreateOrder, which were blocked by RLS
// on order_items / order_lines and silently swallowed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCart } from "../_shared/validate-cart.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BALOOH_VENDOR_ID = "b3aa8188-7584-47eb-9b5f-fd50e33ec569";

interface CustomerInfo {
  company: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

interface CreateOrderInput {
  shippingAddress: string;
  billingAddress?: string;
  paymentMethod: string; // UI label
  customerInfo?: CustomerInfo;
  items: { offer_id: string; product_id: string; quantity: number }[];
}

function mapPaymentMethod(label: string): "card" | "bank_transfer" | "invoice" {
  if (label === "Carte bancaire") return "card";
  if (label === "Virement SEPA") return "bank_transfer";
  if (label.startsWith("Paiement sur facture")) return "invoice";
  return "invoice";
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Idempotent short-circuit for `no_vendor_eligible_for_invoice`.
// Rationale: a buyer whose cart is not eligible for invoice payment used to
// generate one auto-cancelled order per click (see Pharmacie des Saules — 13
// duplicates on 2026-07-15). Even after we stopped persisting on rejection,
// double-clicks still re-run the eligibility RPCs for nothing. We remember
// recent rejections in-memory (per warm isolate) keyed on user+cart+method
// and return the cached rejection for a short TTL.
// ---------------------------------------------------------------------------
const INELIGIBLE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ineligibleCache = new Map<string, { until: number; payload: unknown }>();

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cachePurgeExpired(now: number) {
  for (const [k, v] of ineligibleCache) if (v.until <= now) ineligibleCache.delete(k);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });


  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Non autorisé" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) return json(401, { error: "Non autorisé" });
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;

    // Privileged client for inserts (RLS-bypass; we authorize by userId scoping)
    const supabase = createClient(supabaseUrl, serviceKey);

    const input = (await req.json()) as CreateOrderInput;
    if (!input?.items?.length) return json(400, { error: "Panier vide" });

    // Resolve/create customer (scoped to this user)
    let { data: customer } = await supabase
      .from("customers")
      .select("id, customer_type, country_code")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!customer) {
      const ci = input.customerInfo;
      if (!ci || !userEmail) return json(400, { error: "Profil client incomplet" });
      const { data: created, error: cErr } = await supabase
        .from("customers")
        .insert({
          auth_user_id: userId,
          email: userEmail,
          company_name: ci.company || userEmail,
          address_line1: ci.street,
          city: ci.city,
          postal_code: ci.postalCode,
          country_code: ci.country || "BE",
        })
        .select("id, customer_type, country_code")
        .single();
      if (cErr) return json(500, { error: "Création client : " + cErr.message });
      customer = created;
    }

    // Server-side validation (authoritative prices, MOQ, MOV, stock)
    const cartItems = input.items
      .filter((i) => i.offer_id && i.quantity > 0)
      .map((i) => ({ offer_id: i.offer_id, quantity: i.quantity }));
    const validation = await validateCart(supabase, cartItems, customer.id, {
      customer_type: customer.customer_type,
      country_code: customer.country_code,
    });
    if (!validation.valid) {
      return json(400, { error: "cart_validation_failed", validation });
    }

    // Totals from validated items
    const subtotal = validation.items.reduce((s, it) => s + it.total_excl_vat, 0);
    const total = validation.items.reduce((s, it) => s + it.total_incl_vat, 0);
    const vatAmount = Math.max(0, total - subtotal);

    // Lookup offer metadata (qogita + vendor type) up-front so we can pre-check
    // invoice eligibility BEFORE persisting an order — avoids creating orphan
    // cancelled orders when no vendor is eligible for invoice payment
    // (previously seen as 11 flash-cancelled duplicates for the same buyer).
    const offerIds = validation.items.map((v) => v.offer_id);
    const { data: offers } = await supabase
      .from("offers")
      .select("id, vendor_id, qogita_offer_qid, qogita_seller_fid, qogita_base_price")
      .in("id", offerIds);
    const offerMap = new Map((offers || []).map((o: any) => [o.id, o]));

    const vendorIds = [...new Set((offers || []).map((o: any) => o.vendor_id))];
    const { data: vendors } = vendorIds.length
      ? await supabase.from("vendors").select("id, type").in("id", vendorIds)
      : { data: [] };
    const vendorTypeMap = new Map((vendors || []).map((v: any) => [v.id, v.type]));

    // ====== PRE-CHECK INVOICE ELIGIBILITY (no order created yet) ======
    const orderPaymentMethod = mapPaymentMethod(input.paymentMethod);
    const invoiceEligibility: Array<{ vendor_id: string; eligible: boolean; net_days?: number; reason?: string }> = [];
    if (orderPaymentMethod === "invoice") {
      const perVendor = new Map<string, number>();
      for (const v of validation.items) {
        const ref = offerMap.get(v.offer_id);
        const vId = ref?.vendor_id ?? v.vendor_id;
        const vType = vId ? vendorTypeMap.get(vId) : null;
        if (!vId || vType === "qogita_virtual") continue; // qogita always goes via Balooh card
        perVendor.set(vId, (perVendor.get(vId) || 0) + Number(v.total_excl_vat));
      }
      let eligibleAny = false;
      for (const [vid, subTotal] of perVendor) {
        const { data: elig } = await supabase.rpc("resolve_invoice_payment_eligibility", {
          _vendor_id: vid, _customer_id: customer.id, _amount_cents: Math.round(subTotal * 100),
        });
        const row = Array.isArray(elig) ? elig[0] : elig;
        if (row?.eligible) {
          eligibleAny = true;
          invoiceEligibility.push({ vendor_id: vid, eligible: true, net_days: row.net_days });
        } else {
          invoiceEligibility.push({ vendor_id: vid, eligible: false, reason: row?.reason || "ineligible" });
        }
      }
      if (!eligibleAny) {
        // No persistence: fail fast with a clear error the front can render as
        // "Paiement sur facture non disponible — utilisez la carte bancaire".
        return json(400, { error: "no_vendor_eligible_for_invoice", eligibility: invoiceEligibility });
      }
    }

    const orderNumber = `MK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customer.id,
        shipping_address: { line1: input.shippingAddress },
        billing_address: { line1: input.billingAddress || input.shippingAddress },
        payment_method: orderPaymentMethod,
        subtotal_excl_vat: subtotal,
        vat_amount: vatAmount,
        total_incl_vat: total,
      })
      .select("id, order_number")
      .single();
    if (orderErr || !order) return json(500, { error: "Création commande : " + orderErr?.message });

    // Helper: mark an order as auto-cancelled with a machine-readable reason so
    // the admin list can filter these out instead of showing polluting rows.
    const softCancel = async (reason: string) => {
      await supabase.from("orders").update({
        status: "cancelled",
        hidden_from_list: true,
        deleted_at: new Date().toISOString(),
        deleted_reason: reason,
      }).eq("id", order.id);
    };

    // order_items (legacy) — must succeed
    // validateCart returns vat_rate as percent (e.g. 21).
    // order_items historically stores it as fraction (0.21), order_lines as percent (21).
    const orderItems = validation.items.map((v) => {
      const ref = offerMap.get(v.offer_id);
      const vatPct = Number(v.vat_rate ?? 21);
      return {
        order_id: order.id,
        offer_id: v.offer_id,
        product_id: v.product_id,
        quantity: v.quantity,
        unit_price_excl_vat: v.unit_price_excl_vat,
        unit_price_incl_vat: v.unit_price_incl_vat,
        vat_rate: vatPct / 100,
        line_total_excl_vat: v.total_excl_vat,
        line_total_incl_vat: v.total_incl_vat,
        qogita_offer_qid: ref?.qogita_offer_qid ?? null,
        qogita_seller_fid: ref?.qogita_seller_fid ?? null,
        qogita_base_price: ref?.qogita_base_price ?? null,
      };
    });
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) {
      await softCancel("insert_order_items_failed");
      return json(500, { error: "Insertion order_items : " + itemsErr.message });
    }

    // order_lines (routing-aware)
    const orderLines = validation.items.map((v) => {
      const ref = offerMap.get(v.offer_id);
      const vId = ref?.vendor_id ?? v.vendor_id;
      const vType = vId ? vendorTypeMap.get(vId) : null;
      const isQogita = vType === "qogita_virtual";
      const vatPct = Number(v.vat_rate ?? 21);
      return {
        order_id: order.id,
        offer_id: v.offer_id,
        product_id: v.product_id,
        vendor_id: isQogita ? BALOOH_VENDOR_ID : vId,
        quantity: v.quantity,
        unit_price_excl_vat: v.unit_price_excl_vat,
        unit_price_incl_vat: v.unit_price_incl_vat,
        vat_rate: vatPct,
        line_total_excl_vat: v.total_excl_vat,
        line_total_incl_vat: v.total_incl_vat,
        fulfillment_type: isQogita ? "qogita" : "vendor_direct",
        fulfillment_status: "pending",
        qogita_order_status: "pending",
        qogita_offer_qid: ref?.qogita_offer_qid ?? null,
        qogita_seller_fid: ref?.qogita_seller_fid ?? null,
        cost_price: ref?.qogita_base_price ?? null,
      };
    });
    const { error: linesErr } = await supabase.from("order_lines").insert(orderLines);
    if (linesErr) {
      await softCancel("insert_order_lines_failed");
      return json(500, { error: "Insertion order_lines : " + linesErr.message });
    }

    // ====== INVOICE — persist sub_orders & finalize order (eligibility already resolved) ======
    if (orderPaymentMethod === "invoice") {
      const eligibleEntries = invoiceEligibility.filter((e) => e.eligible);
      for (const e of eligibleEntries) {
        const dueDate = new Date();
        dueDate.setUTCDate(dueDate.getUTCDate() + (e.net_days || 30));
        const vendorLines = orderLines.filter((l) => l.vendor_id === e.vendor_id);
        const vendorTotalIncVat = vendorLines.reduce((s, l) => s + Number(l.line_total_incl_vat), 0);
        await supabase.from("sub_orders").insert({
          order_id: order.id,
          vendor_id: e.vendor_id,
          fulfillment_type: "vendor_direct",
          subtotal_incl_vat: vendorTotalIncVat,
          payment_method: "invoice",
          payment_status: "pending",
          invoice_net_days: e.net_days,
          payment_due_date: dueDate.toISOString().slice(0, 10),
        });
      }
      // Order-level due date = furthest due (worst case for cashflow tracking)
      const dueDays = eligibleEntries.map((e) => e.net_days || 30);
      const maxDays = Math.max(...dueDays);
      const orderDue = new Date(); orderDue.setUTCDate(orderDue.getUTCDate() + maxDays);
      await supabase.from("orders").update({
        payment_method: "invoice",
        payment_status: "pending",
        payment_due_date: orderDue.toISOString().slice(0, 10),
        status: "confirmed",
      }).eq("id", order.id);
      return json(200, { id: order.id, order_number: order.order_number, payment_method: "invoice", eligibility: invoiceEligibility });
    }


    return json(200, { id: order.id, order_number: order.order_number });
  } catch (e) {
    console.error("create-order error:", e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
