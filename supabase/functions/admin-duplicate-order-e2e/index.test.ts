/**
 * Tests E2E de non-régression — duplication d'une commande admin.
 *
 * Couvre la RPC `public.admin_duplicate_order_payload(_order_id uuid)` :
 *   - Refus pour anon et utilisateur non-admin (SECURITY DEFINER → forbidden).
 *   - Pour un admin : payload renvoie bien la source, le statut, le mode de
 *     paiement, et **toutes les lignes** avec quantités, prix unitaires HT,
 *     taux de TVA et libellé/manual_label correctement transférés.
 *   - L'ordre des lignes est stable (ORDER BY id) et le nombre matche.
 *
 * Lancement : tool `supabase--test_edge_functions` avec
 *   functions: ["admin-duplicate-order-e2e"]
 *
 * Aucune écriture résiduelle : tout est créé puis supprimé via service-role.
 */
// @ts-nocheck — runtime Deno strict ne connaît pas les types DB de prod
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function skipIfNoEnv(): boolean {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    console.warn(
      "[admin-duplicate-order-e2e] Skipping: missing env (SUPABASE_URL / ANON_KEY / SERVICE_ROLE)",
    );
    return true;
  }
  return false;
}

interface Fixture {
  admin: ReturnType<typeof createClient>;
  anon: ReturnType<typeof createClient>;
  adminClient: ReturnType<typeof createClient>; // authentifié admin
  userClient: ReturnType<typeof createClient>; // authentifié non-admin
  adminUserId: string;
  userUserId: string;
  customerId: string;
  vendorId: string;
  orderId: string;
  lineIds: string[];
  lines: Array<{
    id: string;
    quantity: number;
    unit_price_excl_vat: number;
    vat_rate: number;
    manual_label: string | null;
  }>;
  cleanupCustomer: boolean;
}

async function setup(): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(SUPABASE_URL!, ANON_KEY!);
  const stamp = Date.now();

  // ── Utilisateur admin éphémère ───────────────────────────────────────
  const adminEmail = `dup-order-admin+${stamp}@medikong.test`;
  const adminPassword = `Test!${crypto.randomUUID().slice(0, 12)}`;
  const { data: adminCreated, error: adminCreateErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });
  if (adminCreateErr || !adminCreated.user) {
    throw new Error(`admin createUser failed: ${adminCreateErr?.message}`);
  }
  // Enregistre dans admin_users (is_admin() s'appuie dessus)
  const { error: adminInsertErr } = await admin.from("admin_users").insert({
    user_id: adminCreated.user.id,
    name: "Dup Order E2E Admin",
    email: adminEmail,
    role: "admin",
    is_active: true,
  });
  if (adminInsertErr) {
    await admin.auth.admin.deleteUser(adminCreated.user.id).catch(() => {});
    throw new Error(`admin_users insert failed: ${adminInsertErr.message}`);
  }

  // ── Utilisateur non-admin éphémère ────────────────────────────────────
  const userEmail = `dup-order-user+${stamp}@medikong.test`;
  const userPassword = `Test!${crypto.randomUUID().slice(0, 12)}`;
  const { data: userCreated, error: userCreateErr } = await admin.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true,
  });
  if (userCreateErr || !userCreated.user) {
    throw new Error(`user createUser failed: ${userCreateErr?.message}`);
  }

  const adminClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { error: adminSignErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (adminSignErr) throw new Error(`admin sign-in failed: ${adminSignErr.message}`);

  const userClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { error: userSignErr } = await userClient.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  });
  if (userSignErr) throw new Error(`user sign-in failed: ${userSignErr.message}`);

  // ── Vendor existant (premier dispo) ──────────────────────────────────
  const { data: anyVendor, error: vendorErr } = await admin
    .from("vendors")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (vendorErr || !anyVendor?.id) {
    throw new Error(`no vendor available for fixture: ${vendorErr?.message}`);
  }

  // ── Customer éphémère lié à l'admin (pour ne dépendre de personne) ───
  const { data: newCust, error: custErr } = await admin
    .from("customers")
    .insert({
      auth_user_id: adminCreated.user.id,
      company_name: `Dup Order E2E ${stamp}`,
      email: `dup-cust+${stamp}@medikong.test`,
      address_line1: "Rue Test 1",
      city: "Bruxelles",
      postal_code: "1000",
      country_code: "BE",
    })
    .select("id")
    .single();
  if (custErr || !newCust?.id) {
    throw new Error(`customer insert failed: ${custErr?.message}`);
  }

  // ── Order + 2 lignes (montants pré-calculés, valeurs distinctes) ─────
  const orderNumber = `E2E-DUP-${stamp}`;
  const lineA = {
    qty: 3,
    unit_ht: 12.50,
    vat: 6.00,
    label: `LINE-A-${stamp}`,
  };
  const lineB = {
    qty: 7,
    unit_ht: 4.25,
    vat: 21.00,
    label: `LINE-B-${stamp}`,
  };
  const totalAHt = +(lineA.qty * lineA.unit_ht).toFixed(2);
  const totalBHt = +(lineB.qty * lineB.unit_ht).toFixed(2);
  const totalAVat = +(totalAHt * lineA.vat / 100).toFixed(2);
  const totalBVat = +(totalBHt * lineB.vat / 100).toFixed(2);
  const subtotal = +(totalAHt + totalBHt).toFixed(2);
  const vatAmount = +(totalAVat + totalBVat).toFixed(2);
  const totalTtc = +(subtotal + vatAmount).toFixed(2);

  const { data: newOrder, error: orderErr } = await admin
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: newCust.id,
      status: "confirmed",
      payment_method: "invoice",
      payment_status: "pending",
      subtotal_excl_vat: subtotal,
      vat_amount: vatAmount,
      total_incl_vat: totalTtc,
      admin_notes: `E2E duplicate test ${stamp}`,
      is_test: true,
    })
    .select("id")
    .single();
  if (orderErr || !newOrder?.id) {
    await admin.from("customers").delete().eq("id", newCust.id);
    throw new Error(`order insert failed: ${orderErr?.message}`);
  }

  const insertLine = async (l: typeof lineA) => {
    const unitTtc = +(l.unit_ht * (1 + l.vat / 100)).toFixed(2);
    const totalHt = +(l.qty * l.unit_ht).toFixed(2);
    const totalTtcLine = +(l.qty * unitTtc).toFixed(2);
    const { data, error } = await admin
      .from("order_lines")
      .insert({
        order_id: newOrder.id,
        vendor_id: anyVendor.id,
        quantity: l.qty,
        unit_price_excl_vat: l.unit_ht,
        unit_price_incl_vat: unitTtc,
        vat_rate: l.vat,
        line_total_excl_vat: totalHt,
        line_total_incl_vat: totalTtcLine,
        manual_label: l.label,
      })
      .select("id, quantity, unit_price_excl_vat, vat_rate, manual_label")
      .single();
    if (error || !data) throw new Error(`line insert failed: ${error?.message}`);
    return data;
  };
  const insertedA = await insertLine(lineA);
  const insertedB = await insertLine(lineB);

  // Relire le statut effectif (triggers peuvent l'avoir modifié, ex.
  // 'confirmed' → 'processing' à l'insertion de lignes)
  const { data: persistedOrder } = await admin
    .from("orders")
    .select("status, payment_method, payment_status")
    .eq("id", newOrder.id)
    .single();
  const effectiveStatus = persistedOrder?.status ?? "confirmed";
  const effectivePaymentMethod = persistedOrder?.payment_method ?? "invoice";
  const effectivePaymentStatus = persistedOrder?.payment_status ?? "pending";

  return {
    admin,
    anon,
    adminClient,
    userClient,
    adminUserId: adminCreated.user.id,
    userUserId: userCreated.user.id,
    customerId: newCust.id,
    vendorId: anyVendor.id,
    orderId: newOrder.id,
    lineIds: [insertedA.id, insertedB.id],
    lines: [
      {
        id: insertedA.id,
        quantity: Number(insertedA.quantity),
        unit_price_excl_vat: Number(insertedA.unit_price_excl_vat),
        vat_rate: Number(insertedA.vat_rate),
        manual_label: insertedA.manual_label,
      },
      {
        id: insertedB.id,
        quantity: Number(insertedB.quantity),
        unit_price_excl_vat: Number(insertedB.unit_price_excl_vat),
        vat_rate: Number(insertedB.vat_rate),
        manual_label: insertedB.manual_label,
      },
    ],
    cleanupCustomer: true,
  };
}

async function teardown(f: Fixture) {
  // order_lines supprimés en cascade via FK
  await f.admin.from("orders").delete().eq("id", f.orderId).then(() => {}, () => {});
  if (f.cleanupCustomer) {
    await f.admin.from("customers").delete().eq("id", f.customerId).then(() => {}, () => {});
  }
  await f.admin.from("admin_users").delete().eq("user_id", f.adminUserId).then(() => {}, () => {});
  await f.admin.auth.admin.deleteUser(f.adminUserId).catch(() => {});
  await f.admin.auth.admin.deleteUser(f.userUserId).catch(() => {});
}

// ═════════════════════════════════════════════════════════════════════════
// 1. Anon → forbidden
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "admin_duplicate_order_payload: anon rejeté",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const f = await setup();
    try {
      const { data, error } = await f.anon.rpc(
        "admin_duplicate_order_payload",
        { _order_id: f.orderId },
      );
      assert(
        error || !data,
        "anon ne doit JAMAIS récupérer un payload de duplication",
      );
    } finally {
      await teardown(f);
    }
  },
});

// ═════════════════════════════════════════════════════════════════════════
// 2. User non-admin → forbidden
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "admin_duplicate_order_payload: user non-admin rejeté",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const f = await setup();
    try {
      const { data, error } = await f.userClient.rpc(
        "admin_duplicate_order_payload",
        { _order_id: f.orderId },
      );
      assert(
        error || !data,
        "user authentifié non-admin ne doit pas récupérer le payload",
      );
    } finally {
      await teardown(f);
    }
  },
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Admin → payload complet & cohérent (lignes / quantités / montants)
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "admin_duplicate_order_payload: admin → lignes & montants transférés fidèlement",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const f = await setup();
    try {
      const { data, error } = await f.adminClient.rpc(
        "admin_duplicate_order_payload",
        { _order_id: f.orderId },
      );
      assertEquals(error, null, `admin doit pouvoir dupliquer: ${error?.message}`);
      assertExists(data, "payload non vide");

      // Champs racine
      assertEquals(data.source_order_id, f.orderId, "source_order_id");
      assertExists(data.source_order_number, "source_order_number présent");
      assertEquals(data.customer_id, f.customerId, "customer_id transféré");
      assertEquals(data.status, "confirmed", "status transféré");
      assertEquals(data.payment_method, "invoice", "payment_method transféré");
      assertEquals(data.payment_status, "pending", "payment_status transféré");
      assert(
        typeof data.admin_notes === "string" && data.admin_notes.includes("E2E"),
        "admin_notes transférées",
      );

      // Lignes — ordre stable (ORDER BY id) côté SQL
      assert(Array.isArray(data.lines), "lines est un tableau");
      assertEquals(
        data.lines.length,
        f.lines.length,
        `nombre de lignes (${data.lines.length} vs ${f.lines.length})`,
      );

      // Réordonner par id pour comparaison déterministe
      const expectedSorted = [...f.lines].sort((a, b) => a.id.localeCompare(b.id));
      const actualSorted = [...data.lines].sort((a, b) =>
        String(a.manual_label).localeCompare(String(b.manual_label)),
      );
      // On retrouve chaque ligne source par son manual_label unique
      for (const exp of expectedSorted) {
        const found = data.lines.find(
          (l: any) => l.manual_label === exp.manual_label,
        );
        assertExists(found, `ligne ${exp.manual_label} retrouvée dans le payload`);
        assertEquals(Number(found.quantity), exp.quantity, `quantité ligne ${exp.manual_label}`);
        assertEquals(
          Number(found.unit_price_excl_vat),
          exp.unit_price_excl_vat,
          `prix HT ligne ${exp.manual_label}`,
        );
        assertEquals(
          Number(found.vat_rate),
          exp.vat_rate,
          `TVA ligne ${exp.manual_label}`,
        );
        assertEquals(
          found.vendor_id,
          f.vendorId,
          `vendor_id ligne ${exp.manual_label}`,
        );
        // Nouvelle ligne = nouvel id (jamais l'id source)
        assert(
          found.id && found.id !== exp.id,
          `id ligne dupliquée doit être neuf (était ${exp.id})`,
        );
        // free vs offer mode (ces fixtures n'ont ni offer_id ni product_id → 'free')
        assertEquals(found.mode, "free", `mode ligne ${exp.manual_label}`);
      }

      // Total HT recalculable depuis le payload doit matcher la commande source
      const sumHt = data.lines.reduce(
        (acc: number, l: any) =>
          acc + Number(l.quantity) * Number(l.unit_price_excl_vat),
        0,
      );
      const expectedHt = f.lines.reduce(
        (acc, l) => acc + l.quantity * l.unit_price_excl_vat,
        0,
      );
      assertEquals(
        +sumHt.toFixed(2),
        +expectedHt.toFixed(2),
        "somme HT recalculée depuis le payload = somme HT source",
      );
    } finally {
      await teardown(f);
    }
  },
});
