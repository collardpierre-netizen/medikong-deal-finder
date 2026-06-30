// Integration test: ensures a paid order with order_lines from multiple
// distinct vendors produces exactly one sub_order per vendor_id when the
// fan-out RPC `fanout_order_to_vendors` runs (the same RPC called by
// stripe-webhook, check-session-status, create-order and notify-vendors-new-order).
//
// Runs against the live project using SERVICE_ROLE. Inserts ephemeral data
// (customer, order, order_lines, vendors) and cleans up at the end.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const opts = { sanitizeOps: false, sanitizeResources: false };

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function suffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

Deno.test(
  "fanout_order_to_vendors crée 1 sub_order distinct par vendor_id",
  opts,
  async () => {
    const sb = admin();
    const tag = suffix();

    // --- 1. Seed 2 vendors --------------------------------------------------
    const vendorPayload = (label: string) => ({
      name: `TEST-FANOUT-${label}-${tag}`,
      company_name: `TEST-FANOUT-${label}-${tag}`,
      slug: `test-fanout-${label}-${tag}`,
      email: `test-fanout-${label}-${tag}@example.invalid`,
      is_active: true,
    });
    const { data: vIns, error: vErr } = await sb
      .from("vendors")
      .insert([vendorPayload("A"), vendorPayload("B")])
      .select("id");
    assertEquals(vErr, null, `vendors insert: ${vErr?.message}`);
    assert(vIns && vIns.length === 2);
    const vendorA = vIns[0].id as string;
    const vendorB = vIns[1].id as string;

    // --- 2. Seed customer ---------------------------------------------------
    const { data: cIns, error: cErr } = await sb
      .from("customers")
      .insert({
        company_name: `TEST-FANOUT-CUST-${tag}`,
        email: `test-fanout-cust-${tag}@example.invalid`,
        address_line1: "Rue test 1",
        postal_code: "1000",
        city: "Bruxelles",
        country_code: "BE",
      })
      .select("id")
      .single();
    assertEquals(cErr, null, `customers insert: ${cErr?.message}`);
    const customerId = cIns!.id as string;

    // --- 3. Seed order ------------------------------------------------------
    const orderNumber = `TEST-FANOUT-${tag}`;
    const { data: oIns, error: oErr } = await sb
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        status: "confirmed",
        payment_status: "paid",
        subtotal_excl_vat: 100,
        vat_amount: 21,
        total_incl_vat: 121,
      })
      .select("id")
      .single();
    assertEquals(oErr, null, `orders insert: ${oErr?.message}`);
    const orderId = oIns!.id as string;

    // --- 4. Seed 3 order_lines : 2 sur vendor A, 1 sur vendor B -------------
    const mkLine = (vendorId: string, qty: number, unit: number) => ({
      order_id: orderId,
      vendor_id: vendorId,
      quantity: qty,
      unit_price_excl_vat: unit,
      unit_price_incl_vat: Math.round(unit * 1.21 * 100) / 100,
      vat_rate: 21,
      line_total_excl_vat: unit * qty,
      line_total_incl_vat: Math.round(unit * qty * 1.21 * 100) / 100,
    });
    const { error: lErr } = await sb.from("order_lines").insert([
      mkLine(vendorA, 2, 10),
      mkLine(vendorA, 1, 25),
      mkLine(vendorB, 3, 5),
    ]);
    assertEquals(lErr, null, `order_lines insert: ${lErr?.message}`);

    try {
      // --- 5. Run fan-out --------------------------------------------------
      const { error: rpcErr } = await sb.rpc("fanout_order_to_vendors", {
        _order_id: orderId,
      });
      assertEquals(rpcErr, null, `RPC: ${rpcErr?.message}`);

      // --- 6. Assert : 1 sub_order par vendor distinct ---------------------
      const { data: subs, error: sErr } = await sb
        .from("sub_orders")
        .select("id, vendor_id")
        .eq("order_id", orderId);
      assertEquals(sErr, null, `sub_orders select: ${sErr?.message}`);
      assert(subs, "sub_orders devrait exister");
      assertEquals(
        subs!.length,
        2,
        `attendu 2 sub_orders (1 par vendor distinct), obtenu ${subs!.length}`,
      );
      const vendorIds = new Set(subs!.map((s) => s.vendor_id));
      assertEquals(vendorIds.size, 2, "vendor_id doit être distinct par sub_order");
      assert(vendorIds.has(vendorA), "sub_order pour vendorA manquant");
      assert(vendorIds.has(vendorB), "sub_order pour vendorB manquant");

      // --- 7. Idempotence : 2e appel ne crée pas de doublon ----------------
      const { error: rpcErr2 } = await sb.rpc("fanout_order_to_vendors", {
        _order_id: orderId,
      });
      assertEquals(rpcErr2, null, `RPC 2e appel: ${rpcErr2?.message}`);
      const { data: subs2 } = await sb
        .from("sub_orders")
        .select("id")
        .eq("order_id", orderId);
      assertEquals(
        subs2!.length,
        2,
        "fan-out doit être idempotent (toujours 2 sub_orders)",
      );
    } finally {
      // --- 8. Cleanup -------------------------------------------------------
      await sb.from("sub_orders").delete().eq("order_id", orderId);
      await sb.from("order_lines").delete().eq("order_id", orderId);
      await sb.from("orders").delete().eq("id", orderId);
      await sb.from("customers").delete().eq("id", customerId);
      await sb.from("vendors").delete().in("id", [vendorA, vendorB]);
    }
  },
);
