/**
 * Test E2E "webhook simulé" en staging pour `generate-contract-pdf`.
 *
 * Ce test reproduit l'appel HTTP que fait le front (`signContractOnServer`)
 * directement contre l'edge function déployée sur l'environnement Supabase
 * configuré dans `.env`, et vérifie l'ensemble de la chaîne :
 *   1. Auth JWT (compte de test / service-role pour signer un user éphémère)
 *   2. Réponse 200 + payload conforme (contractId, pdfPath, pdfUrl, hash)
 *   3. PDF effectivement présent dans le bucket privé `seller-contracts`
 *   4. Hash SHA-256 du fichier == hash renvoyé par la fonction
 *   5. Ligne `seller_contracts` créée avec les bons champs
 *   6. Audit log `contract.signed` enregistré
 *   7. Garde-fou 409 quand on tente de re-signer la même version
 *
 * Nettoyage : le test supprime le contrat, le vendor de test, l'utilisateur
 * de test et le PDF du bucket à la fin (succès ou échec).
 *
 * Lancer via le tool `supabase--test_edge_functions` (functions:
 * ["generate-contract-pdf"]).
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

// ─────────────────────────────────────────────────────────────────────────────
// Config (lus depuis .env du projet)
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/generate-contract-pdf`
  : "";

const SELLER_CONTRACTS_BUCKET = "seller-contracts";

// PNG 1x1 transparent — suffisant pour passer la validation Zod côté edge.
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function skipIfNoEnv(): boolean {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    console.warn(
      "[generate-contract-pdf.test] Skipping: missing SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY in env",
    );
    return true;
  }
  return false;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface TestFixture {
  admin: ReturnType<typeof createClient>;
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  vendorId: string;
}

async function setupFixture(): Promise<TestFixture> {
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) User éphémère (auto-confirmé via service-role)
  const stamp = Date.now();
  const email = `contract-pdf-test+${stamp}@medikong.test`;
  const password = `Test!${crypto.randomUUID().slice(0, 12)}`;
  const { data: created, error: createErr } = await admin.auth.admin
    .createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Contract PDF Tester" },
    });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }
  const userId = created.user.id;

  // 2) Vendor de test rattaché à ce user (RLS check côté edge function).
  const { data: vendor, error: vendorErr } = await admin
    .from("vendors")
    .insert({
      name: "Test Vendor PDF",
      slug: `test-vendor-pdf-${stamp}`,
      type: "real",
      user_id: userId,
      is_active: true,
      is_verified: false,
      country_code: "BE",
      commission_rate: 0,
    })
    .select("id")
    .single();
  if (vendorErr || !vendor) {
    // Cleanup user puis throw
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`vendor insert failed: ${vendorErr?.message}`);
  }

  // 3) Sign-in pour obtenir un access_token valide à passer à la edge fn.
  const userClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { data: session, error: signErr } = await userClient.auth
    .signInWithPassword({ email, password });
  if (signErr || !session.session?.access_token) {
    await admin.from("vendors").delete().eq("id", vendor.id);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`sign-in failed: ${signErr?.message}`);
  }

  return {
    admin,
    userId,
    email,
    password,
    accessToken: session.session.access_token,
    vendorId: vendor.id,
  };
}

async function teardownFixture(f: TestFixture, pdfPath?: string | null) {
  // Ordre : storage → contracts → vendor → user
  if (pdfPath) {
    await f.admin.storage.from(SELLER_CONTRACTS_BUCKET).remove([pdfPath]).catch(
      () => {},
    );
  }
  await f.admin.from("seller_contracts").delete().eq("vendor_id", f.vendorId)
    .catch(() => {});
  await f.admin.from("audit_logs").delete().like("detail", `%vendor=${f.vendorId}%`)
    .catch(() => {});
  await f.admin.from("vendors").delete().eq("id", f.vendorId).catch(() => {});
  await f.admin.auth.admin.deleteUser(f.userId).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Test principal : webhook simulé end-to-end
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name:
    "generate-contract-pdf: simulated webhook → PDF + storage + DB row + audit",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const fixture = await setupFixture();
  let pdfPath: string | null = null;

  try {
    // ─── Appel 1 : signature initiale (doit retourner 200) ───────────────
    const signaturePayload = {
      vendorId: fixture.vendorId,
      vendor: {
        company_name: "Test Vendor PDF SRL",
        legal_form: "SRL",
        address: "Rue de Test 1, 1000 Bruxelles, Belgique",
        bce: "0123.456.789",
        vat: "BE0123456789",
        representative_name: "Jean Testeur",
        representative_role: "Gérant",
        signature_location: "Bruxelles",
      },
      signatureDataUrl: TINY_PNG_DATA_URL,
      signatureMethod: "canvas" as const,
      signerName: "Jean Testeur",
      signerRole: "Gérant",
      metadata: { source: "automated_e2e_test", staging: true },
    };

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${fixture.accessToken}`,
        "apikey": ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signaturePayload),
    });
    const json = await res.json();

    assertEquals(
      res.status,
      200,
      `expected 200, got ${res.status}: ${JSON.stringify(json)}`,
    );
    assertExists(json.contractId, "missing contractId in response");
    assertExists(json.pdfPath, "missing pdfPath in response");
    assertExists(json.documentHash, "missing documentHash in response");
    assertExists(json.signedAt, "missing signedAt in response");
    assertEquals(typeof json.pdfUrl, "string");
    assert(
      json.documentHash.length === 64,
      `documentHash should be SHA-256 hex (64 chars), got ${json.documentHash.length}`,
    );
    pdfPath = json.pdfPath as string;

    // ─── Vérif 1 : PDF dans le bucket privé + hash cohérent ──────────────
    const { data: dl, error: dlErr } = await fixture.admin.storage
      .from(SELLER_CONTRACTS_BUCKET)
      .download(pdfPath);
    assertEquals(dlErr, null, `storage download failed: ${dlErr?.message}`);
    assertExists(dl, "downloaded file is null");
    const buf = new Uint8Array(await dl.arrayBuffer());
    assert(buf.byteLength > 1000, `PDF suspiciously small: ${buf.byteLength}b`);
    // Magic bytes "%PDF"
    assertEquals(
      String.fromCharCode(buf[0], buf[1], buf[2], buf[3]),
      "%PDF",
      "downloaded file is not a PDF",
    );
    const computedHash = await sha256Hex(buf);
    assertEquals(
      computedHash,
      json.documentHash,
      "stored PDF hash mismatches response.documentHash (template drift!)",
    );

    // ─── Vérif 2 : ligne seller_contracts créée + correspondante ─────────
    const { data: contractRow, error: rowErr } = await fixture.admin
      .from("seller_contracts")
      .select(
        "id, vendor_id, contract_version, signature_method, signer_name, pdf_storage_path, document_hash, ip_address, user_agent",
      )
      .eq("id", json.contractId)
      .single();
    assertEquals(rowErr, null, `seller_contracts select failed: ${rowErr?.message}`);
    assertExists(contractRow);
    assertEquals(contractRow.vendor_id, fixture.vendorId);
    assertEquals(contractRow.pdf_storage_path, pdfPath);
    assertEquals(contractRow.document_hash, json.documentHash);
    assertEquals(contractRow.signature_method, "canvas");
    assertEquals(contractRow.signer_name, "Jean Testeur");

    // ─── Vérif 3 : audit log "contract.signed" écrit ─────────────────────
    const { data: audits } = await fixture.admin
      .from("audit_logs")
      .select("action, detail")
      .eq("action", "contract.signed")
      .like("detail", `%vendor=${fixture.vendorId}%`)
      .limit(5);
    assert(
      (audits?.length ?? 0) >= 1,
      "audit_logs row 'contract.signed' missing",
    );

    // ─── Vérif 4 : 2e appel doit retourner 409 (already_signed) ──────────
    const res2 = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${fixture.accessToken}`,
        "apikey": ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signaturePayload),
    });
    const json2 = await res2.json();
    assertEquals(
      res2.status,
      409,
      `expected 409 on duplicate sign, got ${res2.status}: ${JSON.stringify(json2)}`,
    );
    assertEquals(json2.error, "already_signed");
  } finally {
    await teardownFixture(fixture, pdfPath);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test secondaire : sans Authorization → 401
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: "generate-contract-pdf: missing bearer → 401 unauthorized",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "apikey": ANON_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ ping: true }),
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "unauthorized");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test secondaire : body invalide → 400
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: "generate-contract-pdf: invalid body → 400 invalid_body",
  ignore: skipIfNoEnv(),
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  // On a besoin d'un token valide pour franchir l'auth, mais on envoie
  // ensuite un payload non conforme au Zod schema → 400.
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const stamp = Date.now();
  const email = `contract-pdf-bodytest+${stamp}@medikong.test`;
  const password = `Test!${crypto.randomUUID().slice(0, 12)}`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(`createUser: ${cErr?.message}`);
  const userId = created.user.id;
  try {
    const userClient = createClient(SUPABASE_URL!, ANON_KEY!);
    const { data: session } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    const token = session?.session?.access_token!;
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vendorId: "not-a-uuid" }),
    });
    const json = await res.json();
    assertEquals(res.status, 400);
    assertEquals(json.error, "invalid_body");
    assertExists(json.issues);
  } finally {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});
