// Integration test: re-runs `fanout_order_to_vendors` across successive order
// state transitions (pending → confirmed/pending → confirmed/paid → re-paid)
// for the same multi-vendor order, and verifies the fan-out remains strictly
// idempotent: same number of sub_orders, same sub_order IDs (no recreation,
// no orphans, no duplicates), and the same vendor distribution.
//
// Mirrors fanout_multi_vendor_test.ts structure (live project + SERVICE_ROLE,
// ephemeral seed + cleanup in finally).
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
  "fanout_order_to_vendors reste idempotent à travers les transitions d'état successives",
  opts,
  async () => {
    const sb = admin();
    const tag = suffix();

    // --- 1. Seed 2 vendors --------------------------------------------------
    const vendorPayload = (label: string) => ({
      name: `TEST-FANOUT-IDEMP-${label}-${tag}`,
      company_name: `TEST-FANOUT-IDEMP-${label}-${tag}`,
      slug: `test-fanout-idemp-${label}-${tag}`,
      email: `test-fanout-idemp-${label}-${tag}@example.invalid`,
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
        company_name: `TEST-FANOUT-IDEMP-CUST-${tag}`,
        email: `test-fanout-idemp-cust-${tag}@example.invalid`,
        address_line1: "Rue test 1",
        postal_code: "1000",
        city: "Bruxelles",
        country_code: "BE",
      })
      .select("id")
      .single();
    assertEquals(cErr, null, `customers insert: ${cErr?.message}`);
    const customerId = cIns!.id as string;

    // --- 3. Seed order (start state: pending/pending) -----------------------
    const orderNumber = `TEST-FANOUT-IDEMP-${tag}`;
    const { data: oIns, error: oErr } = await sb
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        status: "pending",
        payment_status: "pending",
        subtotal_excl_vat: 100,
        vat_amount: 21,
        total_incl_vat: 121,
      })
      .select("id")
      .single();
    assertEquals(oErr, null, `orders insert: ${oErr?.message}`);
    const orderId = oIns!.id as string;

    // --- 4. Seed order_lines : 2 sur vendor A, 1 sur vendor B ---------------
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
      type SubSnap = { id: string; vendor_id: string };
      const snapshot = async (label: string): Promise<SubSnap[]> => {
        const { data, error } = await sb
          .from("sub_orders")
          .select("id, vendor_id")
          .eq("order_id", orderId)
          .order("vendor_id", { ascending: true });
        assertEquals(error, null, `sub_orders select (${label}): ${error?.message}`);
        return (data ?? []) as SubSnap[];
      };

      // --- 5. Phase 1 : fan-out en état initial (pending/pending) ----------
      const { error: rpc1 } = await sb.rpc("fanout_order_to_vendors", {
        _order_id: orderId,
      });
      assertEquals(rpc1, null, `RPC phase 1: ${rpc1?.message}`);
      const snap1 = await snapshot("phase 1");
      assertEquals(snap1.length, 2, "phase 1: attendu 2 sub_orders");
      const baselineIds = snap1.map((s) => s.id).sort();
      const baselineVendors = new Set(snap1.map((s) => s.vendor_id));
      assert(baselineVendors.has(vendorA) && baselineVendors.has(vendorB));

      // --- 6. Phase 2 : transition → confirmed/pending + re-fanout ---------
      {
        const { error } = await sb
          .from("orders")
          .update({ status: "confirmed", payment_status: "pending" })
          .eq("id", orderId);
        assertEquals(error, null, `update phase 2: ${error?.message}`);
      }
      const { error: rpc2 } = await sb.rpc("fanout_order_to_vendors", {
        _order_id: orderId,
      });
      assertEquals(rpc2, null, `RPC phase 2: ${rpc2?.message}`);
      const snap2 = await snapshot("phase 2");
      assertEquals(snap2.length, 2, "phase 2: pas de doublon");
      assertEquals(
        snap2.map((s) => s.id).sort(),
        baselineIds,
        "phase 2: les sub_order.id doivent être identiques (aucune recréation)",
      );

      // --- 7. Phase 3 : transition → confirmed/paid + re-fanout ------------
      {
        const { error } = await sb
          .from("orders")
          .update({ status: "confirmed", payment_status: "paid" })
          .eq("id", orderId);
        assertEquals(error, null, `update phase 3: ${error?.message}`);
      }
      const { error: rpc3 } = await sb.rpc("fanout_order_to_vendors", {
        _order_id: orderId,
      });
      assertEquals(rpc3, null, `RPC phase 3: ${rpc3?.message}`);
      const snap3 = await snapshot("phase 3");
      assertEquals(snap3.length, 2, "phase 3: pas de doublon");
      assertEquals(
        snap3.map((s) => s.id).sort(),
        baselineIds,
        "phase 3: les sub_order.id doivent être identiques",
      );

      // --- 8. Phase 4 : webhook ré-émis (même état confirmed/paid) ---------
      // Simule un retry Stripe / 2e appel notify-vendors-new-order.
      const { error: rpc4 } = await sb.rpc("fanout_order_to_vendors", {
        _order_id: orderId,
      });
      assertEquals(rpc4, null, `RPC phase 4: ${rpc4?.message}`);
      const snap4 = await snapshot("phase 4");
      assertEquals(snap4.length, 2, "phase 4: pas de doublon sur retry");
      assertEquals(
        snap4.map((s) => s.id).sort(),
        baselineIds,
        "phase 4: aucune recréation sur retry idempotent",
      );

      // --- 9. Vérif finale : 1 sub_order distinct par vendor ---------------
      const vendorIds = new Set(snap4.map((s) => s.vendor_id));
      assertEquals(vendorIds.size, 2, "vendor_id distinct par sub_order");
      assert(vendorIds.has(vendorA) && vendorIds.has(vendorB));
    } finally {
      // --- 10. Cleanup -----------------------------------------------------
      await sb.from("sub_orders").delete().eq("order_id", orderId);
      await sb.from("order_lines").delete().eq("order_id", orderId);
      await sb.from("orders").delete().eq("id", orderId);
      await sb.from("customers").delete().eq("id", customerId);
      await sb.from("vendors").delete().in("id", [vendorA, vendorB]);
    }
  },
);
