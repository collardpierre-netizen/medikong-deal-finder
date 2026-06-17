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
  return "invoice";
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json(401, { error: "Non autorisé" });
    const userId = claims.claims.sub as string;
    const userEmail = (claims.claims.email as string | undefined) ?? null;

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

    const orderNumber = `MK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customer.id,
        shipping_address: { line1: input.shippingAddress },
        billing_address: { line1: input.billingAddress || input.shippingAddress },
        payment_method: mapPaymentMethod(input.paymentMethod),
        subtotal_excl_vat: subtotal,
        vat_amount: vatAmount,
        total_incl_vat: total,
      })
      .select("id, order_number")
      .single();
    if (orderErr || !order) return json(500, { error: "Création commande : " + orderErr?.message });

    // Lookup offer metadata (qogita + vendor type) to route lines
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

    // order_items (legacy) — must succeed
    const orderItems = validation.items.map((v) => {
      const ref = offerMap.get(v.offer_id);
      return {
        order_id: order.id,
        offer_id: v.offer_id,
        product_id: v.product_id,
        quantity: v.quantity,
        unit_price_excl_vat: v.unit_price_excl_vat,
        unit_price_incl_vat: v.unit_price_incl_vat,
        vat_rate: v.vat_rate ?? 0.21,
        line_total_excl_vat: v.total_excl_vat,
        line_total_incl_vat: v.total_incl_vat,
        qogita_offer_qid: ref?.qogita_offer_qid ?? null,
        qogita_seller_fid: ref?.qogita_seller_fid ?? null,
        qogita_base_price: ref?.qogita_base_price ?? null,
      };
    });
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return json(500, { error: "Insertion order_items : " + itemsErr.message });
    }

    // order_lines (routing-aware)
    const orderLines = validation.items.map((v) => {
      const ref = offerMap.get(v.offer_id);
      const vId = ref?.vendor_id ?? v.vendor_id;
      const vType = vId ? vendorTypeMap.get(vId) : null;
      const isQogita = vType === "qogita_virtual";
      return {
        order_id: order.id,
        offer_id: v.offer_id,
        product_id: v.product_id,
        vendor_id: isQogita ? BALOOH_VENDOR_ID : vId,
        quantity: v.quantity,
        unit_price_excl_vat: v.unit_price_excl_vat,
        unit_price_incl_vat: v.unit_price_incl_vat,
        vat_rate: (v.vat_rate ?? 0.21) * (v.vat_rate && v.vat_rate < 1 ? 100 : 1), // store as percent
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
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return json(500, { error: "Insertion order_lines : " + linesErr.message });
    }

    return json(200, { id: order.id, order_number: order.order_number });
  } catch (e) {
    console.error("create-order error:", e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
