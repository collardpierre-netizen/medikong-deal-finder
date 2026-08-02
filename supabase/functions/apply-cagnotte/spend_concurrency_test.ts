// Test de concurrence — mouvement 'spend' de la cagnotte MediKong
//
// Objectif : garantir qu'un double-clic / double webhook / deux appels
// simultanés sur la même commande ne peuvent JAMAIS créer deux lignes
// 'spend' dans public.cagnotte_ledger.
//
// Le garde-fou testé est l'index UNIQUE partiel :
//   idx_cagnotte_spend_unique_order
//     ON public.cagnotte_ledger (order_id)
//     WHERE movement_type = 'spend' AND order_id IS NOT NULL
//
// Stratégie :
//  1. Prendre une commande existante SANS mouvement 'spend'.
//  2. Lancer N inserts 'spend' en parallèle (Promise.all) sur cette commande.
//  3. Vérifier : exactement 1 succès, N-1 échecs en 23505 (unique violation),
//     et exactement 1 ligne 'spend' en base pour cette commande.
//  4. Nettoyer la ligne créée par le test.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CONCURRENT_CALLS = 5;
const AMOUNT_EUR = 1.23;

const opts = { sanitizeOps: false, sanitizeResources: false };

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.test(
  "cagnotte 'spend' — deux appels simultanés ne créent qu'un seul mouvement",
  opts,
  async () => {
    const db = admin();

    // 1. Trouver une commande dont le client a un compte utilisateur,
    //    et qui n'a pas encore de mouvement 'spend'.
    const { data: spentRows, error: spentErr } = await db
      .from("cagnotte_ledger")
      .select("order_id")
      .eq("movement_type", "spend")
      .not("order_id", "is", null);
    assertEquals(spentErr, null, `read ledger: ${spentErr?.message}`);
    const alreadySpent = new Set((spentRows ?? []).map((r) => r.order_id as string));

    const { data: orders, error: ordersErr } = await db
      .from("orders")
      .select("id, customer_id")
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    assertEquals(ordersErr, null, `read orders: ${ordersErr?.message}`);

    let orderId: string | null = null;
    let userId: string | null = null;

    for (const o of orders ?? []) {
      if (alreadySpent.has(o.id as string)) continue;
      const { data: customer } = await db
        .from("customers")
        .select("auth_user_id")
        .eq("id", o.customer_id as string)
        .maybeSingle();
      if (customer?.auth_user_id) {
        orderId = o.id as string;
        userId = customer.auth_user_id as string;
        break;
      }
    }

    assert(orderId && userId, "Aucune commande éligible (client avec compte, sans 'spend') trouvée");

    try {
      // 2. N inserts 'spend' concurrents sur la même commande.
      const results = await Promise.all(
        Array.from({ length: CONCURRENT_CALLS }, (_, i) =>
          db.from("cagnotte_ledger").insert({
            user_id: userId,
            order_id: orderId,
            movement_type: "spend",
            amount_eur: -AMOUNT_EUR,
            balance_after: 0,
            description: `[TEST concurrence] spend #${i + 1}`,
          }).select("id").maybeSingle()
        ),
      );

      const successes = results.filter((r) => !r.error);
      const failures = results.filter((r) => r.error);

      // 3. Exactement un gagnant, tous les autres rejetés par l'index unique.
      assertEquals(
        successes.length,
        1,
        `Attendu 1 insert réussi, obtenu ${successes.length}`,
      );
      assertEquals(failures.length, CONCURRENT_CALLS - 1);
      for (const f of failures) {
        assertEquals(
          // deno-lint-ignore no-explicit-any
          (f.error as any)?.code,
          "23505",
          `Échec attendu en unique violation (23505), obtenu ${f.error?.code}: ${f.error?.message}`,
        );
      }

      // Vérification côté base : une seule ligne 'spend' pour cette commande.
      const { count, error: countErr } = await db
        .from("cagnotte_ledger")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .eq("movement_type", "spend");
      assertEquals(countErr, null, `count spend: ${countErr?.message}`);
      assertEquals(count, 1, `Attendu 1 ligne 'spend' en base, obtenu ${count}`);
    } finally {
      // 4. Nettoyage : supprimer les lignes créées par le test.
      await db
        .from("cagnotte_ledger")
        .delete()
        .eq("order_id", orderId!)
        .eq("movement_type", "spend")
        .like("description", "[TEST concurrence]%");
    }
  },
);
