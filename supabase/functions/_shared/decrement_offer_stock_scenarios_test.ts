// Tests scénarios pour public.decrement_offer_stock
//
// Couvre 3 cas clés sur une offre éphémère :
//   1. overdraw       — p_quantity > stock  → success=false, stock inchangé
//   2. exact          — p_quantity = stock  → success=true,  stock=0, status=out_of_stock
//   3. sous-solde     — p_quantity < stock  → success=true,  stock=initial - qty
//
// Invariant global : le stock ne devient JAMAIS négatif.
//
// Pour chaque cas on snapshot + force le stock à une valeur connue, on appelle
// le RPC, on vérifie le payload + le stock en base, puis on restaure l'offre.

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

async function pickOffer(db: ReturnType<typeof admin>) {
  const { data, error } = await db
    .from("offers")
    .select("id, stock_quantity, stock_status")
    .gt("stock_quantity", 0)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  assertEquals(error, null, `pick offer: ${error?.message}`);
  assert(data, "Aucune offre active avec stock > 0 trouvée");
  return data as { id: string; stock_quantity: number; stock_status: string };
}

async function setStock(
  db: ReturnType<typeof admin>,
  offerId: string,
  qty: number,
  status: string,
) {
  const { error } = await db
    .from("offers")
    .update({ stock_quantity: qty, stock_status: status })
    .eq("id", offerId);
  assertEquals(error, null, `setStock: ${error?.message}`);
}

async function readStock(db: ReturnType<typeof admin>, offerId: string) {
  const { data, error } = await db
    .from("offers")
    .select("stock_quantity, stock_status")
    .eq("id", offerId)
    .single();
  assertEquals(error, null, `readStock: ${error?.message}`);
  return data as { stock_quantity: number; stock_status: string };
}

async function runScenario(
  initialStock: number,
  initialStatus: string,
  quantity: number,
  expect: {
    success: boolean;
    finalStock: number;
    finalStatus?: string;
    error?: string;
  },
) {
  const db = admin();
  const offer = await pickOffer(db);
  const orig = { qty: offer.stock_quantity, status: offer.stock_status };

  try {
    await setStock(db, offer.id, initialStock, initialStatus);

    const { data, error } = await db.rpc("decrement_offer_stock", {
      p_offer_id: offer.id,
      p_quantity: quantity,
    });
    assertEquals(error, null, `rpc: ${error?.message}`);

    const payload = data as {
      success: boolean;
      error?: string;
      new_stock?: number;
      decremented?: number;
      current_stock?: number;
      requested?: number;
    };
    assertEquals(payload.success, expect.success, "success mismatch");

    if (expect.success) {
      assertEquals(payload.new_stock, expect.finalStock, "new_stock mismatch");
      assertEquals(payload.decremented, quantity, "decremented mismatch");
    } else {
      assertEquals(payload.error, expect.error, "error code mismatch");
      assertEquals(payload.current_stock, initialStock, "current_stock mismatch");
      assertEquals(payload.requested, quantity, "requested mismatch");
    }

    const after = await readStock(db, offer.id);
    assert(after.stock_quantity >= 0, `stock négatif détecté: ${after.stock_quantity}`);
    assertEquals(after.stock_quantity, expect.finalStock, "stock en base mismatch");
    if (expect.finalStatus) {
      assertEquals(after.stock_status, expect.finalStatus, "stock_status mismatch");
    }
  } finally {
    await setStock(db, offer.id, orig.qty, orig.status);
  }
}

Deno.test(
  "decrement_offer_stock — overdraw (qty > stock) : refus + stock inchangé",
  opts,
  async () => {
    await runScenario(200, "in_stock", 250, {
      success: false,
      error: "insufficient_stock",
      finalStock: 200,
      finalStatus: "in_stock",
    });
  },
);

Deno.test(
  "decrement_offer_stock — exact (qty = stock) : succès + out_of_stock",
  opts,
  async () => {
    await runScenario(100, "in_stock", 100, {
      success: true,
      finalStock: 0,
      finalStatus: "out_of_stock",
    });
  },
);

Deno.test(
  "decrement_offer_stock — sous-solde (qty < stock) : succès + reste positif",
  opts,
  async () => {
    await runScenario(100, "in_stock", 40, {
      success: true,
      finalStock: 60,
      finalStatus: "in_stock",
    });
  },
);
