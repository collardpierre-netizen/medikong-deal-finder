// Integration test : flux paiement par facture via l'edge function `create-order`.
// Vérifie qu'un sub_order distinct est créé pour CHAQUE vendor_id éligible
// (un acheteur passant commande multi-fournisseurs en "Paiement sur facture"
// génère exactement 1 sub_order par vendeur, avec payment_method=invoice).
//
// L'edge function exige une auth Bearer JWT acheteur réelle + un panier qui
// passe `validateCart` (offres actives, stock, MOV). On seed donc :
//   - 2 vendors avec `vendor_invoice_payment_settings` activé + 1 règle ouverte
//   - 2 produits + 2 offres actives (1 par vendeur)
//   - 1 user auth éphémère + customer lié (auth_user_id)
// Puis on appelle l'edge function en HTTP avec le JWT de l'acheteur.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;

const opts = { sanitizeOps: false, sanitizeResources: false };
const admin = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

Deno.test(
  "create-order (paiement par facture) crée 1 sub_order distinct par vendor_id éligible",
  opts,
  async () => {
    const sb = admin();
    const tag = suffix();

    // --- 1. Vendors -----------------------------------------------------------
    const mkVendor = (l: string) => ({
      name: `TEST-INV-${l}-${tag}`,
      company_name: `TEST-INV-${l}-${tag}`,
      slug: `test-inv-${l}-${tag}`,
      email: `test-inv-${l}-${tag}@example.invalid`,
      is_active: true,
    });
    const { data: vIns, error: vErr } = await sb
      .from("vendors")
      .insert([mkVendor("A"), mkVendor("B")])
      .select("id");
    assertEquals(vErr, null, `vendors insert: ${vErr?.message}`);
    const vendorA = vIns![0].id as string;
    const vendorB = vIns![1].id as string;

    // --- 2. Invoice payment settings + 1 règle ouverte par vendeur -----------
    const { error: sErr } = await sb.from("vendor_invoice_payment_settings").insert([
      { vendor_id: vendorA, enabled: true, default_net_days: 30, min_order_amount_cents: 0 },
      { vendor_id: vendorB, enabled: true, default_net_days: 45, min_order_amount_cents: 0 },
    ]);
    assertEquals(sErr, null, `settings insert: ${sErr?.message}`);
    const { error: rErr } = await sb.from("vendor_invoice_payment_rules").insert([
      { vendor_id: vendorA, enabled: true, priority: 100, net_days: 30, min_amount_cents: 0, label: "test-A" },
      { vendor_id: vendorB, enabled: true, priority: 100, net_days: 45, min_amount_cents: 0, label: "test-B" },
    ]);
    assertEquals(rErr, null, `rules insert: ${rErr?.message}`);

    // --- 3. Products + Offres actives (1 offre par vendeur) ------------------
    const { data: pIns, error: pErr } = await sb
      .from("products")
      .insert([
        { name: `TEST-INV-P1-${tag}`, slug: `test-inv-p1-${tag}`, is_active: true },
        { name: `TEST-INV-P2-${tag}`, slug: `test-inv-p2-${tag}`, is_active: true },
      ])
      .select("id");
    assertEquals(pErr, null, `products insert: ${pErr?.message}`);
    const productA = pIns![0].id as string;
    const productB = pIns![1].id as string;

    const mkOffer = (vid: string, pid: string, price: number) => ({
      vendor_id: vid,
      product_id: pid,
      price_excl_vat: price,
      price_incl_vat: Math.round(price * 1.21 * 100) / 100,
      vat_rate: 21,
      stock_quantity: 100,
      moq: 1,
      mov: 0,
      is_active: true,
    });
    const { data: oIns, error: oErr } = await sb
      .from("offers")
      .insert([mkOffer(vendorA, productA, 10), mkOffer(vendorB, productB, 20)])
      .select("id");
    assertEquals(oErr, null, `offers insert: ${oErr?.message}`);
    const offerA = oIns![0].id as string;
    const offerB = oIns![1].id as string;

    // --- 4. Auth user + customer lié -----------------------------------------
    const buyerEmail = `test-inv-buyer-${tag}@example.invalid`;
    const buyerPassword = `Pw!${tag}-${Math.random().toString(36).slice(2, 10)}`;
    const { data: uIns, error: uErr } = await sb.auth.admin.createUser({
      email: buyerEmail,
      password: buyerPassword,
      email_confirm: true,
    });
    assertEquals(uErr, null, `auth createUser: ${uErr?.message}`);
    const buyerUserId = uIns.user!.id;

    const { data: cIns, error: cErr } = await sb
      .from("customers")
      .insert({
        auth_user_id: buyerUserId,
        email: buyerEmail,
        company_name: `TEST-INV-CUST-${tag}`,
        address_line1: "Rue test 1",
        postal_code: "1000",
        city: "Bruxelles",
        country_code: "BE",
      })
      .select("id")
      .single();
    assertEquals(cErr, null, `customer insert: ${cErr?.message}`);
    const customerId = cIns!.id as string;

    // --- 5. Sign in pour récupérer un JWT acheteur ---------------------------
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sIn, error: sInErr } = await userClient.auth.signInWithPassword({
      email: buyerEmail,
      password: buyerPassword,
    });
    assertEquals(sInErr, null, `signIn: ${sInErr?.message}`);
    const accessToken = sIn.session!.access_token;

    let orderId: string | null = null;
    let orderNumber: string | null = null;

    try {
      // --- 6. Appel HTTP create-order (paiement sur facture) -----------------
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          shippingAddress: "Rue test 1, 1000 Bruxelles",
          billingAddress: "Rue test 1, 1000 Bruxelles",
          paymentMethod: "Paiement sur facture (30j)",
          items: [
            { offer_id: offerA, product_id: productA, quantity: 2 },
            { offer_id: offerB, product_id: productB, quantity: 3 },
          ],
        }),
      });

      const respBody = await resp.json();
      assertEquals(
        resp.status,
        200,
        `create-order HTTP ${resp.status}: ${JSON.stringify(respBody)}`,
      );
      assertEquals(respBody.payment_method, "invoice");
      orderId = respBody.id as string;
      orderNumber = respBody.order_number as string;
      assert(orderId, "order id attendu");

      // --- 7. Assertions ---------------------------------------------------
      const { data: subs, error: subErr } = await sb
        .from("sub_orders")
        .select("vendor_id, payment_method, payment_status, invoice_net_days, payment_due_date, subtotal_incl_vat")
        .eq("order_id", orderId);
      assertEquals(subErr, null, `sub_orders select: ${subErr?.message}`);
      assert(subs, "sub_orders attendus");

      // 2 sub_orders distincts (1 par vendor_id)
      assertEquals(
        subs!.length,
        2,
        `attendu 2 sub_orders (1 par vendor_id), obtenu ${subs!.length}`,
      );
      const vendorIds = new Set(subs!.map((s) => s.vendor_id));
      assertEquals(vendorIds.size, 2, "vendor_id doit être distinct par sub_order");
      assert(vendorIds.has(vendorA), "sub_order vendor A manquant");
      assert(vendorIds.has(vendorB), "sub_order vendor B manquant");

      // Tous les sub_orders sont en facture, statut pending, net_days conforme
      const byVendor = new Map(subs!.map((s) => [s.vendor_id, s]));
      const sA = byVendor.get(vendorA)!;
      const sB = byVendor.get(vendorB)!;
      assertEquals(sA.payment_method, "invoice", "vendor A : payment_method invoice");
      assertEquals(sB.payment_method, "invoice", "vendor B : payment_method invoice");
      assertEquals(sA.payment_status, "pending");
      assertEquals(sB.payment_status, "pending");
      assertEquals(Number(sA.invoice_net_days), 30, "vendor A : net_days=30");
      assertEquals(Number(sB.invoice_net_days), 45, "vendor B : net_days=45");
      assert(sA.payment_due_date, "vendor A : payment_due_date attendu");
      assert(sB.payment_due_date, "vendor B : payment_due_date attendu");

      // Totaux TTC corrects par vendeur (qty × unit_incl)
      assertEquals(
        Number(sA.subtotal_incl_vat),
        Math.round(2 * 10 * 1.21 * 100) / 100,
        "vendor A : subtotal_incl_vat = 2 × 12.10",
      );
      assertEquals(
        Number(sB.subtotal_incl_vat),
        Math.round(3 * 20 * 1.21 * 100) / 100,
        "vendor B : subtotal_incl_vat = 3 × 24.20",
      );

      // L'order parent passe en confirmed/invoice/pending, due_date = max(30,45)=45j
      const { data: orderRow } = await sb
        .from("orders")
        .select("status, payment_method, payment_status, payment_due_date")
        .eq("id", orderId)
        .single();
      assertEquals(orderRow?.status, "confirmed");
      assertEquals(orderRow?.payment_method, "invoice");
      assertEquals(orderRow?.payment_status, "pending");
      assert(orderRow?.payment_due_date, "order : payment_due_date attendu");
    } finally {
      // --- 8. Cleanup --------------------------------------------------------
      if (orderId) {
        await sb.from("sub_orders").delete().eq("order_id", orderId);
        await sb.from("order_lines").delete().eq("order_id", orderId);
        await sb.from("order_items").delete().eq("order_id", orderId);
        await sb.from("orders").delete().eq("id", orderId);
      }
      await sb.from("offers").delete().in("id", [offerA, offerB]);
      await sb.from("products").delete().in("id", [productA, productB]);
      await sb.from("vendor_invoice_payment_rules").delete().in("vendor_id", [vendorA, vendorB]);
      await sb.from("vendor_invoice_payment_settings").delete().in("vendor_id", [vendorA, vendorB]);
      await sb.from("customers").delete().eq("id", customerId);
      await sb.from("vendors").delete().in("id", [vendorA, vendorB]);
      await sb.auth.admin.deleteUser(buyerUserId);
    }
  },
);
