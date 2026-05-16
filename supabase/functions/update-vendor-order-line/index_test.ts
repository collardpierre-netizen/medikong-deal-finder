// Tests automatisés pour update-vendor-order-line.
// Couvre :
//  - validation du token (manquant, invalide, expiré uniquement via expires_at)
//  - règle "used_at IS NOT NULL" ne doit PAS bloquer (pas de 410)
//  - mise à jour de order_lines.fulfillment_status + sub_orders.status/timestamps
//  - FSM (transitions invalides → 400) et tracking requis sur "ship"
//
// Stratégie :
//  - tests statiques de source (logique d'expiration, références colonnes)
//  - tests live HTTP contre la fonction déployée (validation, 410, FSM)
//  - tests DB + HTTP avec fixtures éphémères (happy path confirm/ship + sub_orders)
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;

const FN_URL = `${SUPABASE_URL}/functions/v1/update-vendor-order-line`;
const opts = { sanitizeOps: false, sanitizeResources: false };

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function call(body: unknown, method = "POST") {
  const res = await fetch(FN_URL, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* non JSON */ }
  return { status: res.status, body: parsed, raw: text };
}

// ---------- 1. Tests statiques de source ----------

Deno.test("source: expiration ne dépend QUE de expires_at, jamais de used_at", opts, async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  // Le bloc qui retourne 410 doit tester expires_at, pas used_at.
  const m = src.match(/return\s+json\(\s*410[\s\S]{0,200}/);
  assert(m, "Un retour 410 doit exister pour token_expired");
  assert(
    /expires_at/.test(m![0].slice(-200)) ||
      /expires_at[\s\S]{0,200}json\(\s*410/.test(src),
    "Le 410 doit être déclenché par expires_at",
  );

  // Aucun `if (... used_at ...)` ne doit déclencher un 410.
  // On scanne les blocs `if (...) { ... json(410 ... }` et on interdit `used_at` dedans.
  const ifBlocks = src.match(/if\s*\([^)]*\)\s*\{[^}]*json\(\s*410[^}]*\}/g) ?? [];
  for (const b of ifBlocks) {
    assert(!/used_at/.test(b), `410 ne doit pas dépendre de used_at:\n${b}`);
  }
  // Forme alternative sans accolades : `if (cond) return json(410, ...);`
  const inlineIfs = src.match(/if\s*\([^)]*\)\s*return\s+json\(\s*410[^;]*;/g) ?? [];
  for (const b of inlineIfs) {
    assert(!/used_at/.test(b), `410 ne doit pas dépendre de used_at:\n${b}`);
  }
});

Deno.test("source: pas de référence à vendor_order_tokens.id", opts, async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const accesses = src.match(/from\(["']vendor_order_tokens["']\)[\s\S]*?;/g) ?? [];
  assert(accesses.length > 0, "Au moins un accès à vendor_order_tokens attendu");
  for (const block of accesses) {
    assert(!/\.eq\(\s*["']id["']/.test(block), `interdit .eq("id"...) : ${block}`);
  }
});

Deno.test("source: sub_orders patché avec status + updated_at + timestamps conditionnels", opts, async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(/from\(["']sub_orders["']\)[\s\S]*\.update\(/.test(src), "UPDATE sub_orders requis");
  assert(/vendor_confirmed_at/.test(src), "vendor_confirmed_at doit être géré");
  assert(/shipped_at/.test(src), "shipped_at doit être géré");
  assert(/updated_at/.test(src), "updated_at doit être patché");
});

// ---------- 2. Tests live HTTP — validation & 410 ----------

Deno.test("HTTP: params manquants → 400 missing_params", opts, async () => {
  const r = await call({});
  assertEquals(r.status, 400);
  assertEquals(r.body?.error, "missing_params");
});

Deno.test("HTTP: action invalide → 400 invalid_action", opts, async () => {
  const r = await call({ token: "x", line_id: "y", action: "explode" });
  assertEquals(r.status, 400);
  assertEquals(r.body?.error, "invalid_action");
});

Deno.test("HTTP: ship sans tracking → 400 tracking_number_required", opts, async () => {
  const r = await call({ token: "x", line_id: "y", action: "ship" });
  assertEquals(r.status, 400);
  assertEquals(r.body?.error, "tracking_number_required");
});

Deno.test("HTTP: token inconnu → 401 invalid_token", opts, async () => {
  const r = await call({
    token: "0".repeat(64),
    line_id: "00000000-0000-0000-0000-000000000000",
    action: "confirm",
  });
  assertEquals(r.status, 401);
  assertEquals(r.body?.error, "invalid_token");
});

// ---------- 3. 410 UNIQUEMENT sur expires_at (used_at peut être posé) ----------

Deno.test(
  "HTTP: token expiré (expires_at passé) → 410, MÊME si used_at est null",
  opts,
  async () => {
    const sb = admin();
    // On a besoin d'un order_id + vendor_id existants pour respecter les FKs éventuelles.
    const { data: vendor } = await sb.from("vendors").select("id").limit(1).maybeSingle();
    const { data: order } = await sb.from("orders").select("id").limit(1).maybeSingle();
    if (!vendor?.id || !order?.id) {
      console.warn("Skip: pas de vendor/order seed disponible");
      return;
    }
    const token = `test-expired-${crypto.randomUUID()}`;
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const ins = await sb.from("vendor_order_tokens").insert({
      token,
      order_id: order.id,
      vendor_id: vendor.id,
      expires_at: past,
      used_at: null,
    }).select("token").maybeSingle();
    if (ins.error) {
      console.warn(`Skip insert token expiré: ${ins.error.message}`);
      return;
    }
    try {
      const r = await call({
        token,
        line_id: "00000000-0000-0000-0000-000000000000",
        action: "confirm",
      });
      assertEquals(r.status, 410);
      assertEquals(r.body?.error, "token_expired");
    } finally {
      await sb.from("vendor_order_tokens").delete().eq("token", token);
    }
  },
);

Deno.test(
  "HTTP: token NON expiré mais used_at IS NOT NULL → PAS de 410",
  opts,
  async () => {
    const sb = admin();
    const { data: vendor } = await sb.from("vendors").select("id").limit(1).maybeSingle();
    const { data: order } = await sb.from("orders").select("id").limit(1).maybeSingle();
    if (!vendor?.id || !order?.id) {
      console.warn("Skip: pas de vendor/order seed disponible");
      return;
    }
    const token = `test-used-${crypto.randomUUID()}`;
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const ins = await sb.from("vendor_order_tokens").insert({
      token,
      order_id: order.id,
      vendor_id: vendor.id,
      expires_at: future,
      used_at: new Date().toISOString(), // déjà utilisé
    }).select("token").maybeSingle();
    if (ins.error) {
      console.warn(`Skip insert token used: ${ins.error.message}`);
      return;
    }
    try {
      // line_id bidon → on attend 403 forbidden, surtout PAS 410.
      const r = await call({
        token,
        line_id: "00000000-0000-0000-0000-000000000000",
        action: "confirm",
      });
      assert(r.status !== 410, `used_at posé ne doit jamais déclencher 410 (got ${r.status})`);
      assertEquals(r.status, 403);
      assertEquals(r.body?.error, "forbidden");
    } finally {
      await sb.from("vendor_order_tokens").delete().eq("token", token);
    }
  },
);

// ---------- 4. Happy path : confirm + ship mettent à jour line + sub_order ----------

Deno.test(
  "HTTP: confirm puis ship → fulfillment_status updaté + sub_orders.status + timestamps",
  opts,
  async () => {
    const sb = admin();
    // On cherche une ligne réelle 'pending' pour ne pas avoir à seeder tout l'arbre.
    const { data: pendingLine } = await sb
      .from("order_lines")
      .select("id, order_id, vendor_id, fulfillment_status, sub_order_id")
      .eq("fulfillment_status", "pending")
      .limit(1)
      .maybeSingle();

    if (!pendingLine) {
      console.warn("Skip: aucune order_line 'pending' disponible pour test live");
      return;
    }

    const token = `test-happy-${crypto.randomUUID()}`;
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const ins = await sb.from("vendor_order_tokens").insert({
      token,
      order_id: pendingLine.order_id,
      vendor_id: pendingLine.vendor_id,
      sub_order_id: pendingLine.sub_order_id,
      expires_at: future,
    }).select("token").maybeSingle();
    if (ins.error) {
      console.warn(`Skip insert token happy: ${ins.error.message}`);
      return;
    }

    // Snapshot avant
    const before = await sb
      .from("sub_orders")
      .select("status, updated_at, vendor_confirmed_at, shipped_at")
      .eq("id", pendingLine.sub_order_id!)
      .maybeSingle();

    try {
      // --- confirm ---
      const r1 = await call({ token, line_id: pendingLine.id, action: "confirm" });
      assertEquals(r1.status, 200);
      assertEquals(r1.body?.success, true);
      assertEquals(r1.body?.new_status, "processing");
      assertEquals(r1.body?.updated_line_id, pendingLine.id);

      const lineAfter1 = await sb.from("order_lines")
        .select("fulfillment_status").eq("id", pendingLine.id).maybeSingle();
      assertEquals(lineAfter1.data?.fulfillment_status, "processing");

      if (pendingLine.sub_order_id) {
        const subAfter1 = await sb.from("sub_orders")
          .select("status, updated_at, vendor_confirmed_at")
          .eq("id", pendingLine.sub_order_id).maybeSingle();
        assertEquals(subAfter1.data?.status, "processing");
        assert(subAfter1.data?.vendor_confirmed_at, "vendor_confirmed_at doit être posé");
        assert(
          !before.data?.updated_at ||
            new Date(subAfter1.data!.updated_at).getTime() >=
              new Date(before.data.updated_at).getTime(),
          "updated_at doit avancer",
        );
      }

      // --- ship avec tracking ---
      const r2 = await call({
        token,
        line_id: pendingLine.id,
        action: "ship",
        tracking_number: "TRK-AUTOTEST-001",
      });
      assertEquals(r2.status, 200);
      assertEquals(r2.body?.new_status, "shipped");

      const lineAfter2 = await sb.from("order_lines")
        .select("fulfillment_status, tracking_number").eq("id", pendingLine.id).maybeSingle();
      assertEquals(lineAfter2.data?.fulfillment_status, "shipped");
      assertEquals(lineAfter2.data?.tracking_number, "TRK-AUTOTEST-001");

      if (pendingLine.sub_order_id) {
        const subAfter2 = await sb.from("sub_orders")
          .select("status, shipped_at")
          .eq("id", pendingLine.sub_order_id).maybeSingle();
        assertEquals(subAfter2.data?.status, "shipped");
        assert(subAfter2.data?.shipped_at, "shipped_at doit être posé");
      }

      // --- transition invalide : reconfirm depuis 'shipped' ---
      const r3 = await call({ token, line_id: pendingLine.id, action: "confirm" });
      assertEquals(r3.status, 400);
      assertEquals(r3.body?.error, "invalid_transition");
    } finally {
      // Best-effort cleanup : on remet la ligne + sub_order dans leur état initial.
      await sb.from("vendor_order_tokens").delete().eq("token", token);
      await sb.from("order_lines")
        .update({ fulfillment_status: pendingLine.fulfillment_status, tracking_number: null })
        .eq("id", pendingLine.id);
      if (pendingLine.sub_order_id && before.data) {
        await sb.from("sub_orders").update({
          status: before.data.status,
          updated_at: before.data.updated_at,
          vendor_confirmed_at: before.data.vendor_confirmed_at,
          shipped_at: before.data.shipped_at,
        }).eq("id", pendingLine.sub_order_id);
      }
    }
  },
);
