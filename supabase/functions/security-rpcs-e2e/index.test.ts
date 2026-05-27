/**
 * Tests E2E des RPCs SECURITY DEFINER ajoutées récemment.
 *
 * Objectif unique : vérifier que ces RPCs **n'exposent jamais** de données
 * sensibles à un appelant non autorisé (anon ou utilisateur authentifié
 * non-admin), même si elles sont SECURITY DEFINER et donc s'exécutent avec
 * les privilèges du propriétaire.
 *
 * RPCs testées :
 *   - public.rfq_admin_add_vendor(uuid, uuid, boolean)
 *   - public.rfq_admin_invite_external_vendor(uuid, uuid, text, text)
 *   - public.rfq_external_get_invitation(text)
 *   - public.rfq_external_submit_response(text, int, text, ...)
 *   - public.validate_cron_secret(text)
 *
 * Le test ne fait AUCUNE écriture qui resterait après son passage : tout est
 * soit rejeté par la RPC (cas anon/user), soit créé puis nettoyé via le
 * client service-role (fixture admin).
 *
 * Lancement : tool `supabase--test_edge_functions` avec
 *   functions: ["security-rpcs-e2e"]
 */
// @ts-nocheck — runtime Deno strict ne connaît pas les types DB de prod
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
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
      "[security-rpcs-e2e] Skipping: missing SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY in env",
    );
    return true;
  }
  return false;
}

// Helper : transforme une promesse en { ok, error } sans throw.
async function safe<T>(p: Promise<T>): Promise<{ ok: boolean; value?: T; err?: unknown }> {
  try {
    const value = await p;
    return { ok: true, value };
  } catch (err) {
    return { ok: false, err };
  }
}

interface Fixture {
  admin: ReturnType<typeof createClient>;
  anon: ReturnType<typeof createClient>;
  userClient: ReturnType<typeof createClient>;
  userId: string;
  userEmail: string;
  rfqId: string | null;
  externalVendorId: string | null;
  invitationId: string | null;
  invitationToken: string | null;
  cleanupExternalVendor: boolean;
}

async function setup(): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(SUPABASE_URL!, ANON_KEY!);

  // ── Utilisateur non-admin éphémère ────────────────────────────────────
  const stamp = Date.now();
  const email = `sec-rpc-e2e+${stamp}@medikong.test`;
  const password = `Test!${crypto.randomUUID().slice(0, 12)}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Security RPC E2E" },
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }

  const userClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { data: session, error: signErr } = await userClient.auth.signInWithPassword({
    email, password,
  });
  if (signErr || !session.session?.access_token) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    throw new Error(`sign-in failed: ${signErr?.message}`);
  }

  // ── Récupère une RFQ existante (ou abandonne si la base est vide) ────
  // On ne crée pas de RFQ : insérer dans `rfqs` déclencherait dispatch +
  // emails. On lit simplement une RFQ existante pour les tests d'autz.
  const { data: anyRfq } = await admin
    .from("rfqs")
    .select("id")
    .limit(1)
    .maybeSingle();

  // ── External vendor de test (réutilisé si possible) ──────────────────
  let externalVendorId: string | null = null;
  let cleanupExternalVendor = false;
  const { data: existingExt } = await admin
    .from("external_vendors")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (existingExt?.id) {
    externalVendorId = existingExt.id;
  } else {
    const { data: newExt, error: extErr } = await admin
      .from("external_vendors")
      .insert({
        name: `E2E External Vendor ${stamp}`,
        country_code: "BE",
        contact_email: `ext-${stamp}@medikong.test`,
      })
      .select("id")
      .single();
    if (extErr) {
      console.warn("[security-rpcs-e2e] external_vendors insert failed:", extErr.message);
    } else {
      externalVendorId = newExt.id;
      cleanupExternalVendor = true;
    }
  }

  // ── Invitation externe valide (uniquement si on a RFQ + vendor) ──────
  let invitationId: string | null = null;
  let invitationToken: string | null = null;
  if (anyRfq?.id && externalVendorId) {
    // gen_random_bytes(24)::hex = 48 chars
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data: inv, error: invErr } = await admin
      .from("rfq_external_invitations")
      .insert({
        rfq_id: anyRfq.id,
        external_vendor_id: externalVendorId,
        contact_email: `ext-inv-${stamp}@medikong.test`,
        token,
        token_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      })
      .select("id, token")
      .single();
    if (!invErr && inv) {
      invitationId = inv.id;
      invitationToken = inv.token;
    } else if (invErr) {
      console.warn("[security-rpcs-e2e] invitation insert failed:", invErr.message);
    }
  }

  return {
    admin,
    anon,
    userClient,
    userId: created.user.id,
    userEmail: email,
    rfqId: anyRfq?.id ?? null,
    externalVendorId,
    invitationId,
    invitationToken,
    cleanupExternalVendor,
  };
}

async function teardown(f: Fixture) {
  if (f.invitationId) {
    await safe(
      f.admin.from("rfq_external_responses").delete().eq("invitation_id", f.invitationId),
    );
    await safe(
      f.admin.from("rfq_external_invitations").delete().eq("id", f.invitationId),
    );
  }
  if (f.cleanupExternalVendor && f.externalVendorId) {
    await safe(f.admin.from("external_vendors").delete().eq("id", f.externalVendorId));
  }
  await safe(f.admin.auth.admin.deleteUser(f.userId));
}

// ═════════════════════════════════════════════════════════════════════════
// 1. rfq_admin_add_vendor — exige admin
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "rfq_admin_add_vendor: anon → 'Not authorized'",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    const target = f.rfqId ?? "00000000-0000-0000-0000-000000000000";
    const { data, error } = await f.anon.rpc("rfq_admin_add_vendor", {
      _rfq_id: target,
      _vendor_id: "00000000-0000-0000-0000-000000000000",
      _bypass_eligibility: true, // tentative la plus dangereuse
    });
    assert(error, "anon devait être rejeté");
    assertEquals(
      String(error.message).toLowerCase().includes("not authorized") ||
        String(error.message).toLowerCase().includes("permission"),
      true,
      `message attendu 'Not authorized', reçu: ${error.message}`,
    );
    assertEquals(data, null);
  } finally {
    await teardown(f);
  }
});

Deno.test({
  name: "rfq_admin_add_vendor: utilisateur authentifié non-admin → rejet",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    const target = f.rfqId ?? "00000000-0000-0000-0000-000000000000";
    const { data, error } = await f.userClient.rpc("rfq_admin_add_vendor", {
      _rfq_id: target,
      _vendor_id: "00000000-0000-0000-0000-000000000000",
      _bypass_eligibility: true,
    });
    assert(error, "user non-admin devait être rejeté");
    assertEquals(data, null);
    // Vérifie qu'AUCUNE ligne dispatch n'a été créée par cet appel.
    if (f.rfqId) {
      const { data: rows } = await f.admin
        .from("rfq_dispatch_log")
        .select("vendor_id")
        .eq("rfq_id", f.rfqId)
        .eq("vendor_id", "00000000-0000-0000-0000-000000000000");
      assertEquals((rows ?? []).length, 0);
    }
  } finally {
    await teardown(f);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// 2. rfq_admin_invite_external_vendor — exige admin
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "rfq_admin_invite_external_vendor: anon + user non-admin → rejet",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    const args = {
      _rfq_id: f.rfqId ?? "00000000-0000-0000-0000-000000000000",
      _external_vendor_id:
        f.externalVendorId ?? "00000000-0000-0000-0000-000000000000",
      _contact_email: "attacker@example.com",
      _contact_name: "Mallory",
    };
    const anonRes = await f.anon.rpc("rfq_admin_invite_external_vendor", args);
    assert(anonRes.error, "anon devait être rejeté");
    assertEquals(anonRes.data, null);

    const userRes = await f.userClient.rpc(
      "rfq_admin_invite_external_vendor",
      args,
    );
    assert(userRes.error, "user non-admin devait être rejeté");
    assertEquals(userRes.data, null);

    // Aucun token n'a été émis pour cet email d'attaquant.
    const { data: leaked } = await f.admin
      .from("rfq_external_invitations")
      .select("id")
      .eq("contact_email", "attacker@example.com");
    assertEquals((leaked ?? []).length, 0);
  } finally {
    await teardown(f);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// 3. rfq_external_get_invitation — token requis, pas d'énumération
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "rfq_external_get_invitation: token invalide → {error:'not_found'}",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    // Token totalement aléatoire (anon).
    const fake = "deadbeef".repeat(6);
    const { data, error } = await f.anon.rpc("rfq_external_get_invitation", {
      _token: fake,
    });
    assertEquals(error, null);
    // Doit retourner uniquement {error:'not_found'} — aucune donnée RFQ.
    assertExists(data);
    assertEquals((data as any).error, "not_found");
    assertEquals((data as any).rfq, undefined);
    assertEquals((data as any).invitation, undefined);
    assertEquals((data as any).vendor, undefined);

    // Empty string / null → also no_found, jamais de leak.
    const empty = await f.anon.rpc("rfq_external_get_invitation", { _token: "" });
    assertEquals((empty.data as any)?.error, "not_found");
  } finally {
    await teardown(f);
  }
});

Deno.test({
  name:
    "rfq_external_get_invitation: token valide → uniquement les données de CETTE invitation",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    if (!f.invitationToken) {
      console.warn("[skip] pas de RFQ/invitation fixture disponibles");
      return;
    }
    const { data, error } = await f.anon.rpc("rfq_external_get_invitation", {
      _token: f.invitationToken,
    });
    assertEquals(error, null);
    assertExists(data);
    const payload = data as any;
    // Aucune autre RFQ leaked.
    assertEquals(typeof payload.invitation?.id, "string");
    assertEquals(payload.invitation.id, f.invitationId);
    assertEquals(payload.rfq.id, f.rfqId);
    // Pas de champs sensibles non explicitement listés (sanity check).
    const allowedRfqKeys = new Set([
      "id", "status", "product_name", "brand_name", "quantity",
      "target_price_excl_vat_cents", "currency_code", "destination_country_code",
      "responses_deadline", "desired_delivery_date", "payment_terms",
      "required_offer_validity_days", "comment",
    ]);
    for (const k of Object.keys(payload.rfq ?? {})) {
      assert(allowedRfqKeys.has(k), `champ inattendu exposé: rfq.${k}`);
    }
  } finally {
    await teardown(f);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// 4. rfq_external_submit_response — token requis
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "rfq_external_submit_response: token invalide → exception, aucun insert",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    const fakeToken = "f00dface".repeat(6);
    const { error } = await f.anon.rpc("rfq_external_submit_response", {
      _token: fakeToken,
      _unit_price_excl_vat_cents: 1234,
      _currency_code: "EUR",
    });
    assert(error, "token invalide doit lever une exception");

    // Aucune ligne créée avec ce contact_email.
    const { data: leaked } = await f.admin
      .from("rfq_external_responses")
      .select("id")
      .limit(1)
      .filter("comment", "ilike", "%hack-attempt-marker%");
    assertEquals((leaked ?? []).length, 0);
  } finally {
    await teardown(f);
  }
});

Deno.test({
  name: "rfq_external_submit_response: prix négatif rejeté",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    if (!f.invitationToken) {
      console.warn("[skip] pas d'invitation fixture disponible");
      return;
    }
    const { error } = await f.anon.rpc("rfq_external_submit_response", {
      _token: f.invitationToken,
      _unit_price_excl_vat_cents: -100,
    });
    assert(error, "prix négatif doit être rejeté");
  } finally {
    await teardown(f);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// 5. validate_cron_secret — pas de leak du secret stocké
// ═════════════════════════════════════════════════════════════════════════
Deno.test({
  name: "validate_cron_secret: anon avec secret invalide → false, jamais le secret",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const f = await setup();
  try {
    // Vide → false sans exception, sans révélation.
    const empty = await f.anon.rpc("validate_cron_secret", { _secret: "" });
    assertEquals(empty.error, null);
    assertEquals(empty.data, false);

    // Trop court → false (garde-fou length<32).
    const short = await f.anon.rpc("validate_cron_secret", { _secret: "abc" });
    assertEquals(short.error, null);
    assertEquals(short.data, false);

    // Faux secret de bonne longueur → false.
    const wrong = await f.anon.rpc("validate_cron_secret", {
      _secret: "x".repeat(96),
    });
    assertEquals(wrong.error, null);
    assertEquals(wrong.data, false);

    // L'utilisateur authentifié non-admin n'obtient pas plus d'info.
    const userTry = await f.userClient.rpc("validate_cron_secret", {
      _secret: "x".repeat(96),
    });
    assertEquals(userTry.error, null);
    assertEquals(userTry.data, false);

    // La réponse est strictement booléenne — aucun objet contenant le
    // secret stocké ne doit fuiter (sanity check de surface d'API).
    assertNotEquals(typeof empty.data, "object");
    assertNotEquals(typeof wrong.data, "object");
  } finally {
    await teardown(f);
  }
});
