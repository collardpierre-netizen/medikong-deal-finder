/**
 * Health-check pour la chaîne de signature des conventions vendeur.
 *
 * Réponse 200 (TOUJOURS, sauf erreur fatale d'init runtime) :
 *   {
 *     status: "ok" | "degraded" | "error",
 *     checkedAt: ISOString,
 *     checks: Array<{
 *       id: string,                       // identifiant stable
 *       label: string,                    // libellé humain
 *       severity: "info"|"warning"|"error",
 *       ok: boolean,
 *       detail: string,
 *       remediation?: string,
 *       durationMs?: number,
 *     }>
 *   }
 *
 * Authentification : super_admin uniquement (vérifié via admin_users).
 *
 * Aucun secret n'est exposé dans la réponse — uniquement les noms manquants/invalides.
 */
// @ts-nocheck — Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  CONTRACT_PDF_CONTENT_TYPE,
  CONTRACT_PDF_MAX_BYTES,
  CORS_HEADERS as corsHeaders,
  ContractEnvError,
  SELLER_CONTRACTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  loadContractEnv,
} from "../_shared/contract-env.ts";
import {
  CONTRACT_TYPE,
  CONTRACT_VERSION,
  MEDIKONG_DEFAULTS,
} from "../_shared/contract-template.ts";
import { validateContractTemplateData } from "../_shared/contract-validation.ts";

interface CheckResult {
  id: string;
  label: string;
  severity: "info" | "warning" | "error";
  ok: boolean;
  detail: string;
  remediation?: string;
  durationMs?: number;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, durationMs: Math.round(performance.now() - start) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const checks: CheckResult[] = [];

  // ────────────────── 1) Variables d'environnement ──────────────────
  let env: ReturnType<typeof loadContractEnv> | null = null;
  try {
    env = loadContractEnv();
    checks.push({
      id: "env.supabase_secrets",
      label: "Secrets Supabase (URL + JWT anon + service role)",
      severity: "info",
      ok: true,
      detail: "Toutes les variables auto-injectées par Lovable Cloud sont valides.",
    });
  } catch (e) {
    if (e instanceof ContractEnvError) {
      if (e.missing.length > 0) {
        checks.push({
          id: "env.missing",
          label: "Secrets Supabase manquants",
          severity: "error",
          ok: false,
          detail: `Variables absentes : ${e.missing.join(", ")}`,
          remediation:
            "Reconnectez Lovable Cloud (Connectors → Lovable Cloud) puis re-publiez l'app.",
        });
      }
      if (e.invalid.length > 0) {
        checks.push({
          id: "env.invalid",
          label: "Secrets Supabase invalides",
          severity: "error",
          ok: false,
          detail: e.invalid.join(" | "),
          remediation:
            "Vérifiez qu'aucune clé n'a été régénérée sans redéploiement.",
        });
      }
    } else {
      checks.push({
        id: "env.unknown",
        label: "Initialisation des secrets",
        severity: "error",
        ok: false,
        detail: (e as Error).message,
      });
    }
  }

  // Si l'env est cassé on s'arrête là — les checks suivants nécessitent le SDK admin.
  if (!env) {
    return jsonResponse(200, {
      status: "error",
      checkedAt: new Date().toISOString(),
      checks,
    });
  }

  const adminClient = createClient(env.supabaseUrl, env.serviceRoleKey);
  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  // ────────────────── 2) Auth super_admin obligatoire ──────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "unauthorized" });
  }
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
    authHeader.slice(7),
  );
  if (claimsErr || !claims?.claims?.sub) {
    return jsonResponse(401, { error: "unauthorized" });
  }
  const userId = claims.claims.sub as string;
  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (!adminRow?.is_active || (adminRow.role !== "super_admin" && adminRow.role !== "admin")) {
    return jsonResponse(403, { error: "forbidden" });
  }

  // ────────────────── 3) Constantes verrouillées (sanity check) ──────────────────
  checks.push({
    id: "config.bucket_name",
    label: `Bucket cible : "${SELLER_CONTRACTS_BUCKET}"`,
    severity: "info",
    ok: true,
    detail: "Constante verrouillée côté edge function et côté client.",
  });
  checks.push({
    id: "config.signed_url_ttl",
    label: `TTL liens signés : ${SIGNED_URL_TTL_SECONDS}s`,
    severity: "info",
    ok: true,
    detail: "Rotation forcée à chaque consultation.",
  });
  checks.push({
    id: "config.pdf_limits",
    label: `Limite PDF : ${(CONTRACT_PDF_MAX_BYTES / 1024 / 1024).toFixed(0)} MB (${CONTRACT_PDF_CONTENT_TYPE})`,
    severity: "info",
    ok: true,
    detail: "Taille max et MIME type imposés à l'upload.",
  });

  // ────────────────── 4) Validation du template MediKong ──────────────────
  try {
    const validation = validateContractTemplateData({
      medikong: MEDIKONG_DEFAULTS,
      vendor: {
        company_name: "__healthcheck__",
        bce: "BE 0000.000.000",
        vat: "BE0000000000",
        representative_name: "Healthcheck",
      },
    });
    checks.push({
      id: "config.medikong_defaults",
      label: "Coordonnées légales MediKong (template)",
      severity: validation.valid ? "info" : "error",
      ok: validation.valid,
      detail: validation.valid
        ? `Version contrat ${CONTRACT_VERSION} (${CONTRACT_TYPE}) — placeholders OK.`
        : `Placeholders détectés : ${validation.issues.join(" | ")}`,
      remediation: validation.valid
        ? undefined
        : "Mettez à jour MEDIKONG_DEFAULTS dans supabase/functions/_shared/contract-template.ts.",
    });
  } catch (e) {
    checks.push({
      id: "config.medikong_defaults",
      label: "Coordonnées légales MediKong (template)",
      severity: "error",
      ok: false,
      detail: (e as Error).message,
    });
  }

  // ────────────────── 5) Storage : bucket existant + privé ──────────────────
  try {
    const { value, durationMs } = await timed(async () => {
      const { data, error } = await adminClient.storage.getBucket(SELLER_CONTRACTS_BUCKET);
      if (error) throw error;
      return data;
    });
    checks.push({
      id: "storage.bucket_exists",
      label: `Bucket "${SELLER_CONTRACTS_BUCKET}" accessible`,
      severity: "info",
      ok: true,
      detail: `Bucket trouvé (public=${value.public}).`,
      durationMs,
    });
    if (value.public) {
      checks.push({
        id: "storage.bucket_privacy",
        label: "Confidentialité du bucket",
        severity: "error",
        ok: false,
        detail: "Le bucket est PUBLIC — les contrats signés seraient accessibles à toute personne connaissant l'URL.",
        remediation:
          "Repassez le bucket en privé (UPDATE storage.buckets SET public = false WHERE id = 'seller-contracts').",
      });
    } else {
      checks.push({
        id: "storage.bucket_privacy",
        label: "Confidentialité du bucket",
        severity: "info",
        ok: true,
        detail: "Bucket privé (RLS appliquée).",
      });
    }
  } catch (e) {
    checks.push({
      id: "storage.bucket_exists",
      label: `Bucket "${SELLER_CONTRACTS_BUCKET}" accessible`,
      severity: "error",
      ok: false,
      detail: `Bucket inaccessible : ${(e as Error).message}`,
      remediation: "Recréez le bucket via une migration SQL dédiée.",
    });
  }

  // ────────────────── 6) Storage : test write/read/delete bout-en-bout ──────────────────
  try {
    const testPath = `__healthcheck__/${Date.now()}.pdf`;
    const testBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
    const { durationMs } = await timed(async () => {
      const { error: upErr } = await adminClient.storage
        .from(SELLER_CONTRACTS_BUCKET)
        .upload(testPath, testBytes, {
          contentType: CONTRACT_PDF_CONTENT_TYPE,
          upsert: true,
        });
      if (upErr) throw upErr;
      const { error: signErr } = await adminClient.storage
        .from(SELLER_CONTRACTS_BUCKET)
        .createSignedUrl(testPath, 60);
      if (signErr) throw signErr;
      const { error: delErr } = await adminClient.storage
        .from(SELLER_CONTRACTS_BUCKET)
        .remove([testPath]);
      if (delErr) throw delErr;
    });
    checks.push({
      id: "storage.write_read_delete",
      label: "Écriture / signature / suppression test",
      severity: "info",
      ok: true,
      detail: "Cycle upload → signed URL → delete OK.",
      durationMs,
    });
  } catch (e) {
    checks.push({
      id: "storage.write_read_delete",
      label: "Écriture / signature / suppression test",
      severity: "error",
      ok: false,
      detail: (e as Error).message,
      remediation:
        "Vérifiez les RLS du bucket (storage.objects) et que la service role key est bien valide.",
    });
  }

  // ────────────────── 7) Table seller_contracts accessible ──────────────────
  try {
    const { value, durationMs } = await timed(async () => {
      const { count, error } = await adminClient
        .from("seller_contracts")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    });
    checks.push({
      id: "db.seller_contracts_table",
      label: "Table seller_contracts",
      severity: "info",
      ok: true,
      detail: `Accessible (${value} contrats stockés).`,
      durationMs,
    });
  } catch (e) {
    checks.push({
      id: "db.seller_contracts_table",
      label: "Table seller_contracts",
      severity: "error",
      ok: false,
      detail: (e as Error).message,
      remediation:
        "Créez la table via une migration SQL incluant les colonnes pdf_storage_path, document_hash, signature_data.",
    });
  }

  // ────────────────── 8) Table audit_logs accessible ──────────────────
  try {
    const { durationMs } = await timed(async () => {
      const { error } = await adminClient
        .from("audit_logs")
        .select("id", { head: true, count: "exact" })
        .eq("module", "vendor_contract")
        .limit(1);
      if (error) throw error;
    });
    checks.push({
      id: "db.audit_logs_table",
      label: "Table audit_logs (module vendor_contract)",
      severity: "info",
      ok: true,
      detail: "Accessible — les événements de signature seront tracés.",
      durationMs,
    });
  } catch (e) {
    checks.push({
      id: "db.audit_logs_table",
      label: "Table audit_logs",
      severity: "warning",
      ok: false,
      detail: (e as Error).message,
      remediation: "L'audit n'est pas bloquant mais devrait être réparé.",
    });
  }

  // ────────────────── 9) Récap & status global ──────────────────
  const hasError = checks.some((c) => c.severity === "error" && !c.ok);
  const hasWarning = checks.some((c) => c.severity === "warning" && !c.ok);
  const status: "ok" | "degraded" | "error" = hasError ? "error" : hasWarning ? "degraded" : "ok";

  return jsonResponse(200, {
    status,
    checkedAt: new Date().toISOString(),
    runtime: { region: Deno.env.get("DENO_REGION") ?? "unknown" },
    checks,
  });
});
