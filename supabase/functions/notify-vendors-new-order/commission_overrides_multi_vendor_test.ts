// Integration test: ensures that when an admin creates a multi-vendor manual
// order, each resulting sub_order receives the correct commission override
// for its own vendor_id (rate vs amount, distinct per vendor, no cross-talk).
//
// Exercises `admin_create_manual_order` (which builds the sub_orders with
// `commission_rate_override` / `commission_amount_override` per vendor).
// Uses an ephemeral admin auth user so the RPC's is_admin() check passes.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;

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
  "admin_create_manual_order propage commission_rate/amount_override par vendor_id",
  opts,
  async () => {
    const sb = admin();
    const tag = suffix();

    // --- 1. Seed 2 vendors ----------------------------------------------------
    const vendorPayload = (label: string) => ({
      name: `TEST-COMOV-${label}-${tag}`,
      company_name: `TEST-COMOV-${label}-${tag}`,
      slug: `test-comov-${label}-${tag}`,
      email: `test-comov-${label}-${tag}@example.invalid`,
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

    // --- 2. Seed customer -----------------------------------------------------
    const { data: cIns, error: cErr } = await sb
      .from("customers")
      .insert({
        company_name: `TEST-COMOV-CUST-${tag}`,
        email: `test-comov-cust-${tag}@example.invalid`,
        address_line1: "Rue test 1",
        postal_code: "1000",
        city: "Bruxelles",
        country_code: "BE",
      })
      .select("id")
      .single();
    assertEquals(cErr, null, `customers insert: ${cErr?.message}`);
    const customerId = cIns!.id as string;

    // --- 3. Seed ephemeral admin auth user -----------------------------------
    const adminEmail = `test-comov-admin-${tag}@example.invalid`;
    const adminPassword = `Pw!${tag}-${Math.random().toString(36).slice(2, 10)}`;
    const { data: uIns, error: uErr } = await sb.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    assertEquals(uErr, null, `auth createUser: ${uErr?.message}`);
    const adminUserId = uIns.user!.id;

    const { error: auErr } = await sb
      .from("admin_users")
      .insert({ user_id: adminUserId, is_active: true, role: "admin" });
    assertEquals(auErr, null, `admin_users insert: ${auErr?.message}`);

    // Sign in to get a JWT and run the RPC as admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sIn, error: sInErr } = await userClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    assertEquals(sInErr, null, `signIn: ${sInErr?.message}`);
    assert(sIn.session, "session attendue");

    let orderId: string | null = null;

    try {
      // --- 4. Call admin_create_manual_order with multi-vendor lines + overrides
      // Vendor A → rate 15% ; Vendor B → amount 42 € (exclusif rate)
      const payload = {
        customer_id: customerId,
        status: "confirmed",
        payment_method: "invoice",
        payment_status: "paid",
        fulfillment_mode: "pickup",
        lines: [
          { vendor_id: vendorA, quantity: 2, unit_price_excl_vat: 10, vat_rate: 21, manual_label: "A-1" },
          { vendor_id: vendorA, quantity: 1, unit_price_excl_vat: 25, vat_rate: 21, manual_label: "A-2" },
          { vendor_id: vendorB, quantity: 3, unit_price_excl_vat: 5,  vat_rate: 21, manual_label: "B-1" },
        ],
        commissions: {
          [vendorA]: { rate: 15 },
          [vendorB]: { amount: 42 },
        },
      };

      const { data: rpcData, error: rpcErr } = await userClient.rpc(
        "admin_create_manual_order",
        { _payload: payload },
      );
      assertEquals(rpcErr, null, `RPC: ${rpcErr?.message}`);
      assert(rpcData, "RPC must return data");
      orderId = (rpcData as { id: string }).id;

      // --- 5. Assert per-vendor overrides on sub_orders ----------------------
      const { data: subs, error: sErr } = await sb
        .from("sub_orders")
        .select("vendor_id, commission_rate_override, commission_amount_override")
        .eq("order_id", orderId);
      assertEquals(sErr, null, `sub_orders select: ${sErr?.message}`);
      assertEquals(subs!.length, 2, `attendu 2 sub_orders, obtenu ${subs!.length}`);

      const byVendor = new Map(subs!.map((s) => [s.vendor_id, s]));

      const subA = byVendor.get(vendorA);
      assert(subA, "sub_order vendor A manquant");
      assertEquals(
        Number(subA!.commission_rate_override),
        15,
        `vendor A commission_rate_override attendu=15, obtenu=${subA!.commission_rate_override}`,
      );
      assertEquals(
        subA!.commission_amount_override,
        null,
        `vendor A commission_amount_override doit être NULL (rate uniquement), obtenu=${subA!.commission_amount_override}`,
      );

      const subB = byVendor.get(vendorB);
      assert(subB, "sub_order vendor B manquant");
      assertEquals(
        Number(subB!.commission_amount_override),
        42,
        `vendor B commission_amount_override attendu=42, obtenu=${subB!.commission_amount_override}`,
      );
      assertEquals(
        subB!.commission_rate_override,
        null,
        `vendor B commission_rate_override doit être NULL (amount uniquement), obtenu=${subB!.commission_rate_override}`,
      );

      // --- 6. Aucun cross-talk : override A ≠ override B ---------------------
      assert(
        Number(subA!.commission_rate_override) !== Number(subB!.commission_rate_override) ||
          subA!.commission_rate_override === null ||
          subB!.commission_rate_override === null,
        "les overrides A et B ne doivent pas être identiques",
      );
    } finally {
      // --- 7. Cleanup ---------------------------------------------------------
      if (orderId) {
        await sb.from("sub_orders").delete().eq("order_id", orderId);
        await sb.from("order_items").delete().eq("order_id", orderId);
        await sb.from("order_lines").delete().eq("order_id", orderId);
        await sb.from("orders").delete().eq("id", orderId);
      }
      await sb.from("customers").delete().eq("id", customerId);
      await sb.from("vendors").delete().in("id", [vendorA, vendorB]);
      await sb.from("admin_users").delete().eq("user_id", adminUserId);
      await sb.auth.admin.deleteUser(adminUserId);
    }
  },
);
