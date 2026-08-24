// Integration test: paiement Stripe simulé (checkout.session.completed) vs appel
// direct du RPC `fanout_order_to_vendors` doivent produire des sub_orders
// strictement équivalents (mêmes vendor_id, mêmes totaux par vendeur).
//
// On exécute le handler `handleCheckoutSessionCompleted` du webhook avec :
//   - un stub Stripe (paymentIntents.retrieve renvoie une charge factice)
//   - le client Supabase service-role réel, enveloppé pour intercepter
//     `functions.invoke("notify-vendors-new-order")` et exécuter le RPC en
//     direct (test hermétique : pas d'email envoyé, pas d'invocation HTTP).
//
// Deux jeux de données identiques sont créés : l'un passe par le webhook,
// l'autre par le RPC. Les sub_orders sont ensuite comparés vendor par vendeur.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { __setTestDeps, handleCheckoutSessionCompleted } from "../stripe-webhook/index.ts";

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

/**
 * Wrap le client supabase pour rerouter `functions.invoke("notify-vendors-new-order")`
 * vers un appel RPC direct (évite d'appeler la vraie edge function qui enverrait
 * des emails). Toutes les autres méthodes passent à travers tel quel.
 */
function wrapSupabaseForWebhookTest(real: ReturnType<typeof admin>) {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === "functions") {
        return {
          invoke: async (name: string, init?: { body?: any }) => {
            if (name === "notify-vendors-new-order") {
              const orderId = init?.body?.orderId ?? init?.body?.order_id;
              const { error } = await target.rpc("fanout_order_to_vendors", {
                _order_id: orderId,
              });
              if (error) return { data: null, error };
              return { data: { ok: true, viaTestProxy: true }, error: null };
            }
            // Toutes les autres edge functions (generate-vendor-invoices,
            // send-app-email, decrement_offer_stock rpc, etc.)
            // → no-op silencieux pour garder le test hermétique.
            return { data: { skipped: true }, error: null };
          },
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function makeStripeStub() {
  return {
    paymentIntents: {
      retrieve: async (_id: string) => ({
        id: _id,
        latest_charge: `ch_test_${suffix()}`,
      }),
    },
    transfers: {
      create: async () => {
        throw new Error("transfers.create should not be called when vendor_breakdown is empty");
      },
    },
    webhooks: {
      constructEventAsync: async () => {
        throw new Error("not used in this test");
      },
    },
  };
}

async function seedFixture(sb: ReturnType<typeof admin>, tag: string) {
  // 2 vendors
  const vendorPayload = (label: string) => ({
    name: `TEST-PARITY-${label}-${tag}`,
    company_name: `TEST-PARITY-${label}-${tag}`,
    slug: `test-parity-${label}-${tag}`,
    email: `test-parity-${label}-${tag}@example.invalid`,
    is_active: true,
  });
  const { data: vIns, error: vErr } = await sb
    .from("vendors")
    .insert([vendorPayload("A"), vendorPayload("B")])
    .select("id");
  assertEquals(vErr, null, `vendors insert: ${vErr?.message}`);
  const vendorA = vIns![0].id as string;
  const vendorB = vIns![1].id as string;

  const { data: cIns, error: cErr } = await sb
    .from("customers")
    .insert({
      company_name: `TEST-PARITY-CUST-${tag}`,
      email: `test-parity-cust-${tag}@example.invalid`,
      address_line1: "Rue test 1",
      postal_code: "1000",
      city: "Bruxelles",
      country_code: "BE",
    })
    .select("id")
    .single();
  assertEquals(cErr, null, `customers insert: ${cErr?.message}`);
  const customerId = cIns!.id as string;

  const { data: oIns, error: oErr } = await sb
    .from("orders")
    .insert({
      order_number: `TEST-PARITY-${tag}`,
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

  return { vendorA, vendorB, customerId, orderId };
}

async function cleanup(
  sb: ReturnType<typeof admin>,
  ids: { orderId: string; customerId: string; vendorA: string; vendorB: string },
) {
  await sb.from("sub_order_generation_logs").delete().eq("order_id", ids.orderId);
  await sb.from("sub_orders").delete().eq("order_id", ids.orderId);
  await sb.from("order_lines").delete().eq("order_id", ids.orderId);
  await sb.from("orders").delete().eq("id", ids.orderId);
  await sb.from("customers").delete().eq("id", ids.customerId);
  await sb.from("vendors").delete().in("id", [ids.vendorA, ids.vendorB]);
}

type SubOrderRow = {
  vendor_id: string;
  subtotal_excl_vat: number | null;
  subtotal_incl_vat: number | null;
  vat_amount: number | null;
};

function normalize(rows: SubOrderRow[]) {
  return rows
    .map((r) => ({
      vendor_id: r.vendor_id,
      subtotal_excl_vat: Number(r.subtotal_excl_vat ?? 0),
      subtotal_incl_vat: Number(r.subtotal_incl_vat ?? 0),
      vat_amount: Number(r.vat_amount ?? 0),
    }))
    .sort((a, b) => a.vendor_id.localeCompare(b.vendor_id));
}

Deno.test(
  "stripe-webhook (checkout.session.completed) produit les mêmes sub_orders que le RPC fanout direct",
  opts,
  async () => {
    const sb = admin();

    // --- A) Fixture passée via le webhook simulé --------------------------
    const fixtureWebhook = await seedFixture(sb, `wh-${suffix()}`);
    // --- B) Fixture témoin passée via RPC direct --------------------------
    const fixtureDirect = await seedFixture(sb, `direct-${suffix()}`);

    try {
      // ----- B) Référence : RPC direct ------------------------------------
      const { error: rpcErr } = await sb.rpc("fanout_order_to_vendors", {
        _order_id: fixtureDirect.orderId,
      });
      assertEquals(rpcErr, null, `RPC direct: ${rpcErr?.message}`);

      // ----- A) Webhook simulé --------------------------------------------
      const wrapped = wrapSupabaseForWebhookTest(sb);
      const stripeStub = makeStripeStub();
      __setTestDeps({ supabase: wrapped, stripe: stripeStub });

      const fakeSession = {
        id: `cs_test_${suffix()}`,
        livemode: false,
        payment_intent: `pi_test_${suffix()}`,
        metadata: {
          order_id: fixtureWebhook.orderId,
          order_number: `TEST-PARITY-WH-${suffix()}`,
          // vendor_breakdown vide → pas de transfers Stripe Connect tentés
          vendor_breakdown: "[]",
        },
      } as any;

      await handleCheckoutSessionCompleted(fakeSession);

      // ----- Vérif 1 : statut order mis à jour -----------------------------
      const { data: orderRow } = await sb
        .from("orders")
        .select("status, payment_status, stripe_session_id")
        .eq("id", fixtureWebhook.orderId)
        .single();
      assertEquals(orderRow?.status, "confirmed");
      assertEquals(orderRow?.payment_status, "paid");
      assertEquals(orderRow?.stripe_session_id, fakeSession.id);

      // ----- Vérif 2 : sub_orders identiques entre webhook et RPC direct --
      const cols = "vendor_id, subtotal_excl_vat, subtotal_incl_vat, vat_amount";
      const [{ data: subsWh }, { data: subsDirect }] = await Promise.all([
        sb.from("sub_orders").select(cols).eq("order_id", fixtureWebhook.orderId),
        sb.from("sub_orders").select(cols).eq("order_id", fixtureDirect.orderId),
      ]);
      assert(subsWh && subsDirect, "sub_orders devraient exister dans les 2 cas");
      assertEquals(subsWh!.length, 2, "webhook : 2 sub_orders attendus");
      assertEquals(subsDirect!.length, 2, "direct : 2 sub_orders attendus");

      // Remap vendor_id sur celui du jeu "direct" pour comparer les montants
      // (les vendor_id diffèrent entre les 2 fixtures, mais l'ordre A/B est
      // conservé : on compare position par position après tri par totaux).
      const sortByTotal = (rows: SubOrderRow[]) =>
        normalize(rows).sort(
          (a, b) => a.subtotal_excl_vat - b.subtotal_excl_vat,
        );
      const nWh = sortByTotal(subsWh as SubOrderRow[]);
      const nDirect = sortByTotal(subsDirect as SubOrderRow[]);

      for (let i = 0; i < nWh.length; i++) {
        assertEquals(
          nWh[i].subtotal_excl_vat,
          nDirect[i].subtotal_excl_vat,
          `sub_order #${i} subtotal_excl_vat diverge (webhook vs RPC direct)`,
        );
        assertEquals(
          nWh[i].subtotal_incl_vat,
          nDirect[i].subtotal_incl_vat,
          `sub_order #${i} subtotal_incl_vat diverge (webhook vs RPC direct)`,
        );
        assertEquals(
          nWh[i].vat_amount,
          nDirect[i].vat_amount,
          `sub_order #${i} vat_amount diverge (webhook vs RPC direct)`,
        );
      }

      // ----- Vérif 3 : idempotence du webhook -----------------------------
      await handleCheckoutSessionCompleted(fakeSession);
      const { data: subsWh2 } = await sb
        .from("sub_orders")
        .select("id")
        .eq("order_id", fixtureWebhook.orderId);
      assertEquals(
        subsWh2!.length,
        2,
        "webhook rejoué : doit rester idempotent (toujours 2 sub_orders)",
      );
    } finally {
      // Reset des stubs pour ne pas polluer d'autres tests
      __setTestDeps({ supabase: null, stripe: null });
      await cleanup(sb, fixtureWebhook);
      await cleanup(sb, fixtureDirect);
    }
  },
);
