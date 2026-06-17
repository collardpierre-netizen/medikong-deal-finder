// Tests d'intégration de l'endpoint `validate-cart`.
// On exerce `handler(req, { makeClient })` de bout en bout :
//   - parsing Authorization + getUser
//   - lookup customers (profil + pays)
//   - exécution complète de validateCart (offres + tiers + cascade MOV)
//   - assertions sur le shape de la réponse JSON, les totaux et le MOV final
//
// Les fixtures DB sont définies in-memory et exposées via un stub Supabase
// compatible avec les chaînes `.from().select().eq()/.in()/.maybeSingle()`
// et `.rpc(...)` utilisées par le code de production.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "./index.ts";
import { DEFAULT_MEDIKONG_MOV } from "../_shared/validate-cart.ts";

// ---------------------------------------------------------------------------
// Fixtures DB
// ---------------------------------------------------------------------------

interface Fixtures {
  users: Record<string, { id: string }>;
  customers: any[];
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
    users: { "tok-buyer": { id: "auth-1" } },
    customers: [
      { id: "buyer-1", auth_user_id: "auth-1", customer_type: "pharmacy", country_code: "BE" },
    ],
    offers: [baseOffer],
    vendors: [{ id: "v-real", type: "real" }],
    vendor_profile_defaults: [],
    vendor_buyer_overrides: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stub Supabase
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
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: any) => resolve({ data: rows, error: null }),
    };
    return builder;
  }

  return {
    auth: {
      getUser: async (token: string) => {
        const u = fx.users[token];
        return { data: { user: u ?? null }, error: null };
      },
    },
    from: (table: string) => query(table),
    rpc: async (_fn: string, params: any) => {
      const offer = fx.offers.find((o) => o.id === params.p_offer_id);
      if (!offer) return { data: null, error: null };
      return {
        data: [{
          tier_index: 0,
          mov_threshold: 0,
          price_excl_vat: offer.price_excl_vat,
          price_incl_vat: offer.price_incl_vat,
        }],
        error: null,
      };
    },
  };
}

function makeRequest(body: unknown, opts: { auth?: string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== null) {
    headers["Authorization"] = `Bearer ${opts.auth ?? "tok-buyer"}`;
  }
  return new Request("http://localhost/validate-cart", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("[integration] 401 sans Authorization", async () => {
  const fx = makeFixtures();
  const res = await handler(makeRequest({ items: [] }, { auth: null }), {
    makeClient: () => makeStubClient(fx),
  });
  assertEquals(res.status, 401);
  await res.json();
});

Deno.test("[integration] 401 si token inconnu", async () => {
  const fx = makeFixtures();
  const res = await handler(makeRequest({ items: [{ offer_id: "off-1", quantity: 1 }] }, { auth: "bad-token" }), {
    makeClient: () => makeStubClient(fx),
  });
  assertEquals(res.status, 401);
  await res.json();
});

Deno.test("[integration] cascade vendor_buyer_overrides — MOV=8€, atteint, total HTVA=10€", async () => {
  const fx = makeFixtures({
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 200 },
    ],
    vendor_buyer_overrides: [
      { vendor_id: "v-real", buyer_account_id: "buyer-1", default_mov: 8, is_active: true },
    ],
  });
  const res = await handler(makeRequest({ items: [{ offer_id: "off-1", quantity: 1 }] }), {
    makeClient: () => makeStubClient(fx),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.valid, true);
  assertEquals(body.vendors.length, 1);
  assertEquals(body.vendors[0].mov_required, 8);
  assertEquals(body.vendors[0].mov_reached, true);
  assertEquals(body.vendors[0].subtotal_excl_vat, 10);
  assertEquals(body.totals.subtotal_excl_vat, 10);
  assertEquals(body.totals.total_incl_vat, 12.1);
  assertEquals(body.totals.n_items, 1);
  assertEquals(body.totals.n_vendors, 1);
});

Deno.test("[integration] cascade vendor_profile_defaults — MOV=Math.max(12,50)=50€, non atteint à 1×10€", async () => {
  const fx = makeFixtures({
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 12 },
    ],
  });
  const res = await handler(makeRequest({ items: [{ offer_id: "off-1", quantity: 1 }] }), {
    makeClient: () => makeStubClient(fx),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.valid, false);
  assertEquals(body.vendors[0].mov_required, 50);
  assertEquals(body.vendors[0].mov_reached, false);
  assertEquals(body.vendors[0].amount_missing, 40);
  // une seule erreur MOV non atteint
  assertEquals(body.errors.length, 1);
  assertEquals(body.errors[0].type, "vendor_mov_not_reached");
  assertEquals(body.errors[0].details.required, 50);
  assertEquals(body.errors[0].details.missing, 40);
});

Deno.test("[integration] cascade vendor_profile_defaults atteint — 5×10€=50€ ≥ MOV 50€", async () => {
  const fx = makeFixtures({
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 12 },
    ],
  });
  const res = await handler(makeRequest({ items: [{ offer_id: "off-1", quantity: 5 }] }), {
    makeClient: () => makeStubClient(fx),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.valid, true);
  assertEquals(body.vendors[0].mov_required, 50);
  assertEquals(body.vendors[0].subtotal_excl_vat, 50);
  assertEquals(body.totals.total_incl_vat, 60.5);
});

Deno.test("[integration] vendeur réel sans règle — fallback offers.mov, PAS de plancher 500€", async () => {
  const fx = makeFixtures(); // pas de defaults, pas d'override
  const res = await handler(makeRequest({ items: [{ offer_id: "off-1", quantity: 6 }] }), {
    makeClient: () => makeStubClient(fx),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.vendors[0].mov_required, 50); // offers.mov, pas 500
  assertEquals(body.vendors[0].subtotal_excl_vat, 60);
  assertEquals(body.valid, true);
});

Deno.test("[integration] vendeur virtuel (Qogita) — plancher 500€ s'applique", async () => {
  const fx = makeFixtures({
    offers: [{ ...baseOffer, vendor_id: "v-qogita" }],
    vendors: [{ id: "v-qogita", type: "qogita" }],
    vendor_profile_defaults: [
      // ignoré car vendeur non-réel
      { vendor_id: "v-qogita", profile_type: "pharmacy", country_code: "BE", default_mov: 10 },
    ],
  });
  const res = await handler(makeRequest({ items: [{ offer_id: "off-1", quantity: 1 }] }), {
    makeClient: () => makeStubClient(fx),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.vendors[0].mov_required, DEFAULT_MEDIKONG_MOV);
  assertEquals(body.vendors[0].mov_reached, false);
  assertEquals(body.vendors[0].amount_missing, DEFAULT_MEDIKONG_MOV - 10);
  assertEquals(body.valid, false);
});

Deno.test("[integration] vendor_buyer_overrides bat le plancher 500€ pour vendeur virtuel", async () => {
  const fx = makeFixtures({
    offers: [{ ...baseOffer, vendor_id: "v-qogita" }],
    vendors: [{ id: "v-qogita", type: "qogita" }],
    vendor_buyer_overrides: [
      { vendor_id: "v-qogita", buyer_account_id: "buyer-1", default_mov: 25, is_active: true },
    ],
  });
  const res = await handler(makeRequest({ items: [{ offer_id: "off-1", quantity: 3 }] }), {
    makeClient: () => makeStubClient(fx),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.vendors[0].mov_required, 25);
  assertEquals(body.vendors[0].subtotal_excl_vat, 30);
  assertEquals(body.valid, true);
});

Deno.test("[integration] panier vide → 400-shape applicatif (valid=false, errors=invalid_quantity)", async () => {
  const fx = makeFixtures();
  const res = await handler(makeRequest({ items: [] }), {
    makeClient: () => makeStubClient(fx),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.valid, false);
  assertEquals(body.errors[0].type, "invalid_quantity");
  assertEquals(body.errors[0].details.reason, "empty_cart");
});

Deno.test("[integration] items pas un tableau → 400", async () => {
  const fx = makeFixtures();
  const res = await handler(makeRequest({ items: "nope" as any }), {
    makeClient: () => makeStubClient(fx),
  });
  assertEquals(res.status, 400);
  await res.json();
});
