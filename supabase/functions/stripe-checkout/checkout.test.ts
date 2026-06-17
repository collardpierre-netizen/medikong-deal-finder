// Tests d'intégration de l'endpoint `stripe-checkout` — action `create-checkout-session`.
//
// Couvre la validation panier appliquée AVANT la création de la session Stripe :
//   - 401 sans Authorization, 403 IDOR (commande d'un autre acheteur)
//   - 404 commande introuvable, 400 sans order_id ou sans lignes
//   - cascade MOV (vendor_buyer_overrides > vendor_profile_defaults > offers.mov)
//   - plancher 500€ uniquement sur vendeurs virtuels (Qogita)
//   - MOQ et stock vérifiés côté serveur
//   - prix Stripe = prix recalculés par validateCart (anti-tampering client)
//   - vendor_breakdown : commission + transfer_amount
//
// Tout est exécuté en mémoire via DI (makeClient + makeStripe).

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";
import { DEFAULT_MEDIKONG_MOV } from "../_shared/validate-cart.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Fixtures {
  users: Record<string, { id: string }>;
  customers: any[];
  orders: any[];
  order_lines: any[];
  offers: any[];
  vendors: any[];
  vendor_profile_defaults: any[];
  vendor_buyer_overrides: any[];
}

const baseOffer = {
  id: "off-1",
  vendor_id: "v-real",
  product_id: "p-1",
  price_excl_vat: 10,
  price_incl_vat: 12.1,
  stock_quantity: 100,
  moq: 1,
  mov: 50,
  is_active: true,
  vat_rate: 21,
  vendors: { display_code: "ABC123" },
};

function makeFixtures(overrides: Partial<Fixtures> = {}): Fixtures {
  return {
    users: { "tok-buyer": { id: "auth-1" }, "tok-other": { id: "auth-other" } },
    customers: [
      { id: "buyer-1", auth_user_id: "auth-1", customer_type: "pharmacy", country_code: "BE" },
      { id: "buyer-2", auth_user_id: "auth-other", customer_type: "pharmacy", country_code: "BE" },
    ],
    orders: [{
      id: "ord-1",
      order_number: "MK-0001",
      total_incl_vat: 60.5,
      customer_id: "buyer-1",
      stripe_session_id: null,
      stripe_payment_intent_id: null,
    }],
    order_lines: [{
      order_id: "ord-1",
      offer_id: "off-1",
      vendor_id: "v-real",
      product_id: "p-1",
      quantity: 5,
      unit_price_incl_vat: 12.1,
      line_total_incl_vat: 60.5,
      product: { name: "Doliprane 500" },
    }],
    offers: [baseOffer],
    vendors: [{
      id: "v-real", type: "real",
      stripe_account_id: "acct_test", commission_rate: 20, stripe_charges_enabled: true,
    }],
    vendor_profile_defaults: [],
    vendor_buyer_overrides: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeStubClient(fx: Fixtures) {
  function query(table: string) {
    let rows = [...((fx as any)[table] || [])];
    const builder: any = {
      select: (_cols: string) => builder,
      eq: (col: string, val: any) => {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      in: (col: string, vals: any[]) => {
        rows = rows.filter((r) => vals.includes(r[col]));
        return builder;
      },
      single: async () => ({
        data: rows[0] ?? null,
        error: rows[0] ? null : { message: "not found" },
      }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      update: (_patch: any) => ({
        eq: (_col: string, _val: any) => Promise.resolve({ data: null, error: null }),
      }),
      then: (resolve: any) => resolve({ data: rows, error: null }),
    };
    return builder;
  }

  return {
    auth: {
      getUser: async (token: string) => ({ data: { user: fx.users[token] ?? null }, error: null }),
    },
    from: (table: string) => query(table),
    rpc: async (_fn: string, params: any) => {
      const offer = fx.offers.find((o) => o.id === params.p_offer_id);
      if (!offer) return { data: null, error: null };
      return {
        data: [{
          tier_index: 0, mov_threshold: 0,
          price_excl_vat: offer.price_excl_vat,
          price_incl_vat: offer.price_incl_vat,
        }],
        error: null,
      };
    },
  };
}

interface SessionSpy { lastCreate?: any }

function makeStubStripe(spy: SessionSpy) {
  return {
    checkout: {
      sessions: {
        create: async (params: any) => {
          spy.lastCreate = params;
          return {
            id: "cs_test_123",
            url: "https://checkout.stripe.test/cs_test_123",
            payment_intent: "pi_test_123",
            livemode: false,
          };
        },
        retrieve: async (_id: string) => ({ id: _id, url: "x", status: "open" }),
      },
    },
    paymentIntents: {
      retrieve: async (_id: string) => ({ client_secret: "cs_secret" }),
      create: async (_p: any) => ({ id: "pi_x", client_secret: "cs_x" }),
    },
  };
}

function makeRequest(body: unknown, opts: { auth?: string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== null) headers["Authorization"] = `Bearer ${opts.auth ?? "tok-buyer"}`;
  return new Request("http://localhost/stripe-checkout", {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

const run = (fx: Fixtures, body: unknown, opts?: { auth?: string | null }) => {
  const spy: SessionSpy = {};
  return {
    spy,
    res: handler(makeRequest(body, opts ?? {}), {
      makeClient: () => makeStubClient(fx),
      makeStripe: () => makeStubStripe(spy),
      defaultCommission: 0.20,
    }),
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("[checkout] 401 sans Authorization", async () => {
  const { res } = run(makeFixtures(), { action: "create-checkout-session", order_id: "ord-1" }, { auth: null });
  const r = await res;
  assertEquals(r.status, 401);
  await r.json();
});

Deno.test("[checkout] 400 sans order_id", async () => {
  const { res } = run(makeFixtures(), { action: "create-checkout-session" });
  const r = await res;
  assertEquals(r.status, 400);
  const b = await r.json();
  assertEquals(b.error, "order_id requis");
});

Deno.test("[checkout] 404 commande introuvable", async () => {
  const { res } = run(makeFixtures(), { action: "create-checkout-session", order_id: "ord-unknown" });
  const r = await res;
  assertEquals(r.status, 404);
  await r.json();
});

Deno.test("[checkout] 403 IDOR — commande d'un autre acheteur", async () => {
  const fx = makeFixtures();
  fx.orders[0].customer_id = "buyer-2";
  const { res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 403);
  await r.json();
});

Deno.test("[checkout] succès — cascade vendor_buyer_overrides + line_items aux prix recalculés", async () => {
  const fx = makeFixtures({
    vendor_buyer_overrides: [
      { vendor_id: "v-real", buyer_account_id: "buyer-1", default_mov: 8, is_active: true },
    ],
  });
  const { spy, res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 200);
  const body = await r.json();
  assertEquals(body.session_id, "cs_test_123");
  assertEquals(body.url, "https://checkout.stripe.test/cs_test_123");

  // line_items utilisent les prix recalculés (12.1 € TTC × 5)
  assertEquals(spy.lastCreate.line_items.length, 1);
  assertEquals(spy.lastCreate.line_items[0].price_data.unit_amount, 1210);
  assertEquals(spy.lastCreate.line_items[0].quantity, 5);
  assertEquals(spy.lastCreate.line_items[0].price_data.product_data.name, "Doliprane 500");

  // vendor_breakdown : 6050 cents, commission 20% = 1210, transfer = 4840
  const breakdown = JSON.parse(spy.lastCreate.metadata.vendor_breakdown);
  assertEquals(breakdown.length, 1);
  assertEquals(breakdown[0].vendor_id, "v-real");
  assertEquals(breakdown[0].subtotal, 6050);
  assertEquals(breakdown[0].commission_amount, 1210);
  assertEquals(breakdown[0].transfer_amount, 4840);
});

Deno.test("[checkout] cascade vendor_profile_defaults — MOV=Math.max(12,50)=50 atteint à 5×10€", async () => {
  const fx = makeFixtures({
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 12 },
    ],
  });
  const { res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 200);
  await r.json();
});

Deno.test("[checkout] cart_validation_failed — MOV vendor_profile_defaults non atteint", async () => {
  const fx = makeFixtures({
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 200 },
    ],
  });
  // 5×10€ = 50€ < 200€ requis
  const { res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 400);
  const b = await r.json();
  assertEquals(b.error, "cart_validation_failed");
  assertEquals(b.validation.vendors[0].mov_required, 200);
  assertEquals(b.validation.vendors[0].amount_missing, 150);
});

Deno.test("[checkout] vendeur réel sans règle — PAS de plancher 500€, offers.mov=50 suffit", async () => {
  const fx = makeFixtures();
  const { res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 200);
  await r.json();
});

Deno.test("[checkout] vendeur virtuel (Qogita) — plancher 500€ bloque le checkout", async () => {
  const fx = makeFixtures({
    offers: [{ ...baseOffer, vendor_id: "v-qogita" }],
    vendors: [{
      id: "v-qogita", type: "qogita",
      stripe_account_id: null, commission_rate: 20, stripe_charges_enabled: false,
    }],
    order_lines: [{
      order_id: "ord-1", offer_id: "off-1", vendor_id: "v-qogita", product_id: "p-1",
      quantity: 5, unit_price_incl_vat: 12.1, line_total_incl_vat: 60.5,
      product: { name: "Doliprane 500" },
    }],
  });
  const { res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 400);
  const b = await r.json();
  assertEquals(b.error, "cart_validation_failed");
  assertEquals(b.validation.vendors[0].mov_required, DEFAULT_MEDIKONG_MOV);
});

Deno.test("[checkout] MOQ non respecté → cart_validation_failed", async () => {
  const fx = makeFixtures({
    offers: [{ ...baseOffer, moq: 10 }],
  });
  // order_line quantity=5 < moq=10
  const { res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 400);
  const b = await r.json();
  assertEquals(b.error, "cart_validation_failed");
  assert(b.validation.errors.some((e: any) => e.type === "below_moq"));
});

Deno.test("[checkout] stock insuffisant → cart_validation_failed", async () => {
  const fx = makeFixtures({
    offers: [{ ...baseOffer, stock_quantity: 2 }],
  });
  const { res } = run(fx, { action: "create-checkout-session", order_id: "ord-1" });
  const r = await res;
  assertEquals(r.status, 400);
  const b = await r.json();
  assertEquals(b.error, "cart_validation_failed");
  assert(b.validation.errors.some((e: any) => e.type === "exceeds_stock"));
});

Deno.test("[checkout] action inconnue → 400", async () => {
  const { res } = run(makeFixtures(), { action: "nope" });
  const r = await res;
  assertEquals(r.status, 400);
  const b = await r.json();
  assertEquals(b.error, "Action inconnue");
});
