// Test automatisé du toggle « INFORMATIONS DE PAIEMENT »
// Couvre les deux cas (affiché / masqué) pour :
//   - le PDF de commande (generate-order-pdf) — gating via RPC order_should_show_payment_info
//   - la page publique (public_get_order_by_token) — gating via le même RPC
//
// Implémentation : appelle l'RPC SQL `admin_test_show_payment_info_toggle()` qui
// crée une commande synthétique, bascule le toggle, vérifie la cohérence des deux
// surfaces et nettoie après lui.
//
// Pré-requis pour l'exécution :
//   - SUPABASE_URL              (ou VITE_SUPABASE_URL)
//   - SUPABASE_SERVICE_ROLE_KEY (clé service_role — la fonction est admin-only)
// Si la clé service_role n'est pas disponible, le test est SKIP avec un message clair.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function callSelfTest(): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_test_show_payment_info_toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: "{}",
  });
  const body = await res.json();
  assertEquals(res.status, 200, `RPC failed: ${JSON.stringify(body)}`);
  return body;
}

Deno.test({
  name: "show_payment_info toggle — cohérence PDF + page publique (les deux états)",
  ignore: !SUPABASE_URL || !SERVICE_ROLE_KEY,
  async fn() {
    const result = await callSelfTest();

    assert(result.pass === true, `Self-test failed: ${JSON.stringify(result, null, 2)}`);
    assertEquals(Array.isArray(result.scenarios), true);
    assertEquals(result.scenarios.length, 2);

    const byScenario = Object.fromEntries(
      result.scenarios.map((s: any) => [s.scenario, s]),
    );

    // Cas 1 : toggle activé → bloc affiché côté PDF + public
    assert(byScenario.toggle_true, "Missing scenario toggle_true");
    assertEquals(byScenario.toggle_true.pass, true, byScenario.toggle_true.detail);

    // Cas 2 : toggle désactivé → bloc masqué côté PDF + public, vendor_bank null
    assert(byScenario.toggle_false, "Missing scenario toggle_false");
    assertEquals(byScenario.toggle_false.pass, true, byScenario.toggle_false.detail);
  },
});

Deno.test({
  name: "admin_test_show_payment_info_toggle — refus anon",
  ignore: !SUPABASE_URL,
  async fn() {
    const anon =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
      "";
    if (!anon) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_test_show_payment_info_toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: "{}",
    });
    const body = await res.text();
    assert(
      res.status === 401 || res.status === 403 || res.status === 404 || /permission denied|forbidden/i.test(body),
      `Expected denial for anon, got ${res.status}: ${body}`,
    );
  },
});
