// Validation E2E : vérifie que notify-order-shipped refuse (422) une commande
// dont le customer n'a pas d'email.
//
// Pré-requis dans .env (racine du projet) :
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (pour seed/cleanup + signer un admin de test)
//   TEST_ADMIN_EMAIL            (compte admin existant utilisé pour l'auth)
//   TEST_ADMIN_PASSWORD
//
// Lancer via l'outil test_edge_functions (functions: ["notify-order-shipped"]).

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("TEST_ADMIN_EMAIL");
const ADMIN_PASSWORD = Deno.env.get("TEST_ADMIN_PASSWORD");
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;

const FN_URL = `${SUPABASE_URL}/functions/v1/notify-order-shipped`;

async function invoke(token: string, body: unknown) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, body: parsed ?? text };
}

Deno.test("notify-order-shipped refuse un customer sans email (422)", async () => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn("SKIP: TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD manquants dans .env");
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Sign-in admin (client anonyme, mot de passe)
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInErr } = await authClient.auth
    .signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (signInErr || !signIn.session) {
    throw new Error(`Sign-in admin failed: ${signInErr?.message}`);
  }
  const adminToken = signIn.session.access_token;

  // 1) Fixture : customer SANS email
  const { data: customer, error: custErr } = await admin
    .from("customers")
    .insert({
      email: null,
      company_name: "TEST FIXTURE no-email",
    })
    .select("id")
    .single();
  if (custErr || !customer) throw new Error(`seed customer failed: ${custErr?.message}`);

  // 2) Fixture : commande rattachée à ce customer
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_id: customer.id,
      order_number: `TEST-NOEMAIL-${Date.now()}`,
      total_amount: 0,
      status: "shipped",
    })
    .select("id")
    .single();

  try {
    if (orderErr || !order) throw new Error(`seed order failed: ${orderErr?.message}`);

    // 3) Appel edge fn — doit renvoyer 422 "Customer email missing"
    const res = await invoke(adminToken, { orderId: order.id, dryRun: true });
    assertEquals(res.status, 422, `expected 422, got ${res.status} — body=${JSON.stringify(res.body)}`);
    assertEquals(res.body?.error, "Customer email missing");

    // 4) Contrôle négatif : orderId inexistant → 404
    const res404 = await invoke(adminToken, {
      orderId: "00000000-0000-0000-0000-000000000000",
      dryRun: true,
    });
    assertEquals(res404.status, 404);
  } finally {
    // Cleanup best-effort
    if (order?.id) await admin.from("orders").delete().eq("id", order.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});

Deno.test("notify-order-shipped refuse un appel non authentifié (401)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ orderId: "x" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});
