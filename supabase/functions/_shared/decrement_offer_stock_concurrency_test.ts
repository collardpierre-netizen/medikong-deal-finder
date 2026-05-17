// Test de concurrence pour public.decrement_offer_stock
//
// Objectif : garantir qu'en cas d'appels simultanés (race condition),
// le stock d'une offre ne devient JAMAIS négatif et que la somme des
// décréments réussis ne dépasse jamais le stock initial.
//
// Stratégie :
//  1. Choisir une offre existante, snapshot du stock + statut.
//  2. Forcer le stock à une valeur connue (INITIAL_STOCK = 100).
//  3. Lancer N appels RPC en parallèle (Promise.all) dont la somme
//     demandée dépasse largement le stock (ex. 10 × 30 = 300 demandés).
//  4. Vérifier :
//       - somme des `decremented` sur les succès ≤ INITIAL_STOCK
//       - stock final = INITIAL_STOCK - somme décrémentée
//       - stock final ≥ 0
//       - chaque réponse en échec porte error = "insufficient_stock"
//  5. Restaurer le stock et le statut d'origine.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const INITIAL_STOCK = 100;
const CONCURRENT_CALLS = 10;
const QTY_PER_CALL = 30; // total demandé = 300, soit 3× le stock

const opts = { sanitizeOps: false, sanitizeResources: false };

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.test(
  "decrement_offer_stock — concurrence : pas de stock négatif",
  opts,
  async () => {
    const db = admin();

    // 1. Choisir une offre cible (la première active avec stock > 0).
    const { data: offer, error: pickErr } = await db
      .from("offers")
      .select("id, stock_quantity, stock_status")
      .gt("stock_quantity", 0)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    assertEquals(pickErr, null, `pick offer: ${pickErr?.message}`);
    assert(offer, "Aucune offre active avec stock > 0 trouvée");

    const originalStock = offer.stock_quantity as number;
    const originalStatus = offer.stock_status as string;
    const offerId = offer.id as string;

    try {
      // 2. Forcer le stock à INITIAL_STOCK.
      const { error: setErr } = await db
        .from("offers")
        .update({ stock_quantity: INITIAL_STOCK, stock_status: "in_stock" })
        .eq("id", offerId);
      assertEquals(setErr, null, `reset stock: ${setErr?.message}`);

      // 3. Lancer N appels concurrents.
      const calls = Array.from({ length: CONCURRENT_CALLS }, () =>
        db.rpc("decrement_offer_stock", {
          p_offer_id: offerId,
          p_quantity: QTY_PER_CALL,
        }),
      );
      const results = await Promise.all(calls);

      // 4. Analyse des réponses.
      let successCount = 0;
      let failureCount = 0;
      let totalDecremented = 0;

      for (const { data, error } of results) {
        assertEquals(error, null, `rpc error: ${error?.message}`);
        const payload = data as {
          success: boolean;
          error?: string;
          decremented?: number;
          current_stock?: number;
          new_stock?: number;
        };
        if (payload.success) {
          successCount++;
          totalDecremented += payload.decremented ?? 0;
          assertEquals(
            payload.decremented,
            QTY_PER_CALL,
            "decremented doit être égal à la quantité demandée",
          );
        } else {
          failureCount++;
          assertEquals(
            payload.error,
            "insufficient_stock",
            "échec doit être insufficient_stock",
          );
          assert(
            (payload.current_stock ?? -1) >= 0,
            `current_stock doit être ≥ 0, reçu ${payload.current_stock}`,
          );
        }
      }

      // 5. Lire le stock final et valider l'invariant.
      const { data: finalRow, error: finalErr } = await db
        .from("offers")
        .select("stock_quantity")
        .eq("id", offerId)
        .single();
      assertEquals(finalErr, null, `read final stock: ${finalErr?.message}`);
      const finalStock = finalRow!.stock_quantity as number;

      console.log({
        offerId,
        INITIAL_STOCK,
        CONCURRENT_CALLS,
        QTY_PER_CALL,
        successCount,
        failureCount,
        totalDecremented,
        finalStock,
      });

      // Invariants critiques.
      assert(finalStock >= 0, `Stock final négatif : ${finalStock}`);
      assert(
        totalDecremented <= INITIAL_STOCK,
        `Σ décréments (${totalDecremented}) > stock initial (${INITIAL_STOCK})`,
      );
      assertEquals(
        finalStock,
        INITIAL_STOCK - totalDecremented,
        "stock final doit = stock initial - Σ décréments",
      );
      assertEquals(
        successCount + failureCount,
        CONCURRENT_CALLS,
        "tous les appels doivent répondre",
      );
      // Avec 10×30 demandés sur 100 dispo, au moins un succès et un échec.
      assert(successCount >= 1, "au moins un succès attendu");
      assert(failureCount >= 1, "au moins un échec attendu (overdraw)");
    } finally {
      // Restauration du stock + statut d'origine.
      await db
        .from("offers")
        .update({
          stock_quantity: originalStock,
          stock_status: originalStatus,
        })
        .eq("id", offerId);
    }
  },
);
