// Tests unitaires pour la cascade MOV de `validateCart`.
// Couvre :
//   1. vendor_buyer_overrides bat tout (vendor × buyer)
//   2. vendor_profile_defaults (profil+pays) bat offers.mov pour vendeur réel
//   3. offers.mov utilisé si pas de défaut vendeur (vendeur réel)
//   4. Plancher DEFAULT_MEDIKONG_MOV (500€) appliqué UNIQUEMENT aux vendeurs non-réels
//   5. Vendeur réel sans aucune règle → pas de plancher 500€

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateCart, DEFAULT_MEDIKONG_MOV } from "./validate-cart.ts";

interface MockData {
  offers: any[];
  vendors: any[];
  vendor_profile_defaults: any[];
  vendor_buyer_overrides: any[];
  admin_settings?: any[];
}

/** Mini-stub `supabase` compatible avec les chaînes utilisées par validateCart. */
function makeStub(data: MockData) {
  const tables: Record<string, any[]> = {
    offers: data.offers,
    vendors: data.vendors,
    vendor_profile_defaults: data.vendor_profile_defaults,
    vendor_buyer_overrides: data.vendor_buyer_overrides,
    admin_settings: data.admin_settings || [],
  };

  function query(table: string) {
    let rows = [...(tables[table] || [])];
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
      // Promise-like resolution (Supabase clients are thenables).
      then: (resolve: any) => resolve({ data: rows, error: null }),
    };
    return builder;
  }


  return {
    from: (table: string) => query(table),
    rpc: async (_fn: string, params: any) => {
      // calculate_offer_price_for_quantity : on renvoie simplement le prix de l'offre.
      const offer = data.offers.find((o) => o.id === params.p_offer_id);
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

const buyerCtx = { customer_type: "pharmacy", country_code: "BE" };
const BUYER_ID = "buyer-1";

Deno.test("MOV cascade — vendor_buyer_overrides bat tout le reste", async () => {
  const stub = makeStub({
    offers: [baseOffer],
    vendors: [{ id: "v-real", type: "real" }],
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 200 },
    ],
    vendor_buyer_overrides: [
      { vendor_id: "v-real", buyer_account_id: BUYER_ID, default_mov: 8, is_active: true },
    ],
  });
  const res = await validateCart(stub, [{ offer_id: "off-1", quantity: 1 }], BUYER_ID, buyerCtx);
  assertEquals(res.vendors.length, 1);
  assertEquals(res.vendors[0].mov_required, 8);
  assertEquals(res.vendors[0].mov_reached, true);
});

Deno.test("MOV cascade — vendor_profile_defaults bat offers.mov pour vendeur réel", async () => {
  const stub = makeStub({
    offers: [baseOffer], // offers.mov = 50
    vendors: [{ id: "v-real", type: "real" }],
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 12 },
    ],
    vendor_buyer_overrides: [],
  });
  const res = await validateCart(stub, [{ offer_id: "off-1", quantity: 1 }], BUYER_ID, buyerCtx);
  // Math.max(profileMov=12, agg.movMax=50) = 50
  assertEquals(res.vendors[0].mov_required, 50);
});

Deno.test("MOV cascade — vendor_profile_defaults s'applique même < offers.mov quand offers.mov=0", async () => {
  const stub = makeStub({
    offers: [{ ...baseOffer, mov: 0 }],
    vendors: [{ id: "v-real", type: "real" }],
    vendor_profile_defaults: [
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "BE", default_mov: 12 },
    ],
    vendor_buyer_overrides: [],
  });
  const res = await validateCart(stub, [{ offer_id: "off-1", quantity: 2 }], BUYER_ID, buyerCtx);
  assertEquals(res.vendors[0].mov_required, 12);
});

Deno.test("MOV cascade — vendeur réel sans règle → offers.mov, PAS de plancher 500€", async () => {
  const stub = makeStub({
    offers: [baseOffer],
    vendors: [{ id: "v-real", type: "real" }],
    vendor_profile_defaults: [],
    vendor_buyer_overrides: [],
  });
  const res = await validateCart(stub, [{ offer_id: "off-1", quantity: 6 }], BUYER_ID, buyerCtx);
  assertEquals(res.vendors[0].mov_required, 50); // offers.mov
});

Deno.test("MOV cascade — vendeur virtuel/qogita → plancher 500€ s'applique", async () => {
  const stub = makeStub({
    offers: [{ ...baseOffer, vendor_id: "v-qogita" }],
    vendors: [{ id: "v-qogita", type: "qogita" }],
    // vendor_profile_defaults présent mais ignoré car vendeur non-réel
    vendor_profile_defaults: [
      { vendor_id: "v-qogita", profile_type: "pharmacy", country_code: "BE", default_mov: 10 },
    ],
    vendor_buyer_overrides: [],
  });
  const res = await validateCart(stub, [{ offer_id: "off-1", quantity: 1 }], BUYER_ID, buyerCtx);
  assertEquals(res.vendors[0].mov_required, DEFAULT_MEDIKONG_MOV);
  assertEquals(res.vendors[0].mov_reached, false);
});

Deno.test("MOV cascade — vendor_buyer_overrides bat même pour vendeur virtuel", async () => {
  const stub = makeStub({
    offers: [{ ...baseOffer, vendor_id: "v-qogita" }],
    vendors: [{ id: "v-qogita", type: "qogita" }],
    vendor_profile_defaults: [],
    vendor_buyer_overrides: [
      { vendor_id: "v-qogita", buyer_account_id: BUYER_ID, default_mov: 25, is_active: true },
    ],
  });
  const res = await validateCart(stub, [{ offer_id: "off-1", quantity: 3 }], BUYER_ID, buyerCtx);
  assertEquals(res.vendors[0].mov_required, 25);
});

Deno.test("MOV cascade — fallback profil (sans country exact)", async () => {
  const stub = makeStub({
    offers: [{ ...baseOffer, mov: 0 }],
    vendors: [{ id: "v-real", type: "real" }],
    vendor_profile_defaults: [
      // Pas de match BE/pharmacy exact, mais profil pharmacy quelque part
      { vendor_id: "v-real", profile_type: "pharmacy", country_code: "FR", default_mov: 30 },
    ],
    vendor_buyer_overrides: [],
  });
  const res = await validateCart(stub, [{ offer_id: "off-1", quantity: 5 }], BUYER_ID, buyerCtx);
  assertEquals(res.vendors[0].mov_required, 30);
});
