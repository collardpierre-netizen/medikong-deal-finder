/**
 * Edge function : génération + stockage du PDF de la convention de mandat
 * de facturation, exécutée côté serveur (production-ready).
 *
 * Pourquoi côté serveur :
 *  - Mémoriser la version exacte du template + des coordonnées MediKong
 *    appliquées (pas de divergence client/serveur sur la valeur juridique).
 *  - Empreinte SHA-256 calculée sur le PDF réellement stocké.
 *  - Logs structurés et audit_logs centralisés en cas d'échec.
 *  - Le client ne peut pas court-circuiter la validation contractuelle.
 *
 * Réponse 200 :
 *   { contractId, pdfPath, pdfUrl, signedAt, documentHash, contractVersion }
 *
 * Erreurs :
 *   400 (validation), 401 (auth), 403 (vendor mismatch), 409 (déjà signé),
 *   500 (génération/upload/insert).
 */
// @ts-nocheck — Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { jsPDF } from "npm:jspdf@2.5.2";
import { z } from "npm:zod@3.23.8";
import {
  CONTRACT_ARTICLES,
  CONTRACT_TYPE,
  CONTRACT_VERSION,
  MEDIKONG_DEFAULTS,
  type ContractMediKongData,
  type ContractVendorData,
} from "../_shared/contract-template.ts";
import { validateContractTemplateData } from "../_shared/contract-validation.ts";
import {
  CONTRACT_PDF_CONTENT_TYPE,
  CONTRACT_PDF_MAX_BYTES,
  CORS_HEADERS as corsHeaders,
  ContractEnvError,
  SELLER_CONTRACTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  loadContractEnv,
} from "../_shared/contract-env.ts";

const VendorSchema = z.object({
  company_name: z.string().min(1),
  legal_form: z.string().nullish(),
  address: z.string().nullish(),
  bce: z.string().min(1),
  vat: z.string().min(1),
  representative_name: z.string().min(1),
  representative_role: z.string().nullish(),
  signature_location: z.string().nullish(),
});

const BodySchema = z.object({
  vendorId: z.string().uuid(),
  vendor: VendorSchema,
  signatureDataUrl: z.string().min(20), // PNG base64 (préfixe data:image/png;base64,)
  signatureMethod: z.enum(["canvas", "typed_name"]),
  signerName: z.string().min(1),
  signerRole: z.string().nullish(),
  metadata: z.record(z.unknown()).optional(),
  signedAt: z.string().datetime().optional(), // sinon now()
});

type RequestBody = z.infer<typeof BodySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Logging structuré (lisible dans Supabase Edge Function logs)
// ─────────────────────────────────────────────────────────────────────────────
type Stage =
  | "auth"
  | "parse_body"
  | "validate_contract"
  | "load_vendor"
  | "guard_already_signed"
  | "render_pdf"
  | "hash_pdf"
  | "upload_pdf"
  | "insert_contract"
  | "update_vendor"
  | "sign_url"
  | "audit"
  | "done";

function logEvent(level: "info" | "warn" | "error", stage: Stage, message: string, ctx: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    fn: "generate-contract-pdf",
    stage,
    message,
    ...ctx,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

async function measure<T>(stage: Stage, ctx: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const value = await fn();
    logEvent("info", stage, "ok", { ...ctx, durationMs: Math.round(performance.now() - start) });
    return value;
  } catch (e) {
    const err = e as Error & { code?: string | number; statusCode?: number };
    logEvent("error", stage, "failed", {
      ...ctx,
      durationMs: Math.round(performance.now() - start),
      error: { name: err.name, message: err.message, code: err.code, statusCode: err.statusCode },
    });
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF generator (équivalent au src/lib/contract/generate-pdf.ts mais Deno-side)
// ─────────────────────────────────────────────────────────────────────────────
function generatePdf(args: {
  vendor: ContractVendorData;
  medikong: ContractMediKongData;
  signedAt: Date;
  signatureDataUrl: string;
  signatureMethod: "canvas" | "typed_name";
  signerName: string;
  signerRole?: string | null;
}): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, opts?: { fontSize?: number; bold?: boolean; spacing?: number }) => {
    const fontSize = opts?.fontSize ?? 10;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.45;
    ensureSpace(lines.length * lineHeight);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + (opts?.spacing ?? 2);
  };

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CONVENTION DE MANDAT DE FACTURATION", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "Conformément à l'article 53 §2 du Code de la TVA belge — Circulaire AGFisc N° 53/2013",
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Version ${CONTRACT_VERSION}`, pageWidth / 2, y, { align: "center" });
  y += 8;

  const v = args.vendor;
  const m = args.medikong;

  writeWrapped("ENTRE LES SOUSSIGNÉS", { fontSize: 11, bold: true, spacing: 3 });
  writeWrapped("Le Mandant (ci-après désigné « le Vendeur ») :", { fontSize: 10, bold: true });
  writeWrapped(v.company_name);
  if (v.legal_form) writeWrapped(`Forme juridique : ${v.legal_form}`);
  if (v.address) writeWrapped(`Siège social : ${v.address}`);
  if (v.bce) writeWrapped(`Numéro d'entreprise (BCE) : ${v.bce}`);
  if (v.vat) writeWrapped(`Numéro de TVA : ${v.vat}`);
  writeWrapped(
    `Représenté par : ${v.representative_name}${v.representative_role ? `, en qualité de ${v.representative_role}` : ""}`,
    { spacing: 4 }
  );

  writeWrapped("ET", { fontSize: 10, bold: true, spacing: 2 });
  writeWrapped("Le Mandataire (ci-après désigné « MediKong ») :", { fontSize: 10, bold: true });
  writeWrapped(`MediKong ${m.legal_form}`);
  writeWrapped(`Siège social : ${m.address}`);
  writeWrapped(`Numéro d'entreprise (BCE) : ${m.bce}`);
  writeWrapped(`Numéro de TVA : ${m.vat}`);
  writeWrapped(`Représenté par : ${m.representative_name}, en qualité de ${m.representative_role}`, { spacing: 6 });

  for (const article of CONTRACT_ARTICLES) {
    writeWrapped(`Article ${article.number} — ${article.title}`, { fontSize: 11, bold: true, spacing: 3 });
    for (const p of article.paragraphs) {
      if (typeof p === "string") {
        writeWrapped(p, { spacing: 3 });
      } else if (p.type === "list") {
        for (const item of p.items) writeWrapped(`  • ${item}`, { spacing: 2 });
        y += 1;
      } else if (p.type === "subarticle") {
        writeWrapped(`${p.number} — ${p.text}`, { spacing: 3 });
      }
    }
    y += 2;
  }

  ensureSpace(60);
  y += 4;
  const dateStr = args.signedAt.toLocaleDateString("fr-BE", { year: "numeric", month: "long", day: "numeric" });
  writeWrapped(`Fait à ${v.signature_location || "—"}, le ${dateStr}`, { bold: true, spacing: 6 });

  writeWrapped("Pour le Vendeur (Mandant) :", { bold: true, spacing: 2 });
  writeWrapped(args.signerName);
  if (args.signerRole) writeWrapped(args.signerRole);
  writeWrapped(v.company_name, { spacing: 2 });

  if (args.signatureDataUrl && args.signatureDataUrl.startsWith("data:image/")) {
    try {
      ensureSpace(28);
      doc.addImage(args.signatureDataUrl, "PNG", margin, y, 60, 22);
      y += 24;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text(
        `Signature électronique (${args.signatureMethod === "canvas" ? "tracée" : "saisie"}) — Valeur juridique eIDAS n°910/2014`,
        margin,
        y
      );
      y += 6;
    } catch {
      writeWrapped("[Signature électronique apposée]", { fontSize: 9 });
    }
  } else {
    writeWrapped("[Signature électronique apposée]", { fontSize: 9 });
  }

  writeWrapped("Pour MediKong (Mandataire) :", { bold: true, spacing: 2 });
  writeWrapped(`${m.representative_name} — ${m.representative_role}`);
  writeWrapped("Signature électronique pré-enregistrée", { fontSize: 9 });

  // jsPDF en runtime Deno : on exporte en arraybuffer puis Uint8Array.
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(ab);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function recordAudit(
  adminClient: ReturnType<typeof createClient>,
  params: { action: string; vendorId: string; userId?: string | null; userEmail?: string | null; detail?: string; metadata?: Record<string, unknown> }
) {
  try {
    await adminClient.from("audit_logs").insert({
      action: params.action,
      module: "vendor_contract",
      user_id: params.userId ?? null,
      user_name: params.userEmail ?? null,
      user_role: "vendor",
      detail: [
        `vendor=${params.vendorId}`,
        params.detail ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
        .filter(Boolean)
        .join(" | "),
    });
  } catch (e) {
    logEvent("warn", "audit", "audit_logs insert failed (non-blocking)", { error: (e as Error).message });
  }
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  // 0) Validation stricte des secrets injectés par Lovable Cloud.
  //    En prod, les 3 variables sont auto-provisionnées. Toute absence ou
  //    altération (clé rotée sans redéploiement, JWT expiré) est détectée
  //    immédiatement et renvoyée comme 500 explicite.
  let env;
  try {
    env = loadContractEnv();
  } catch (e) {
    if (e instanceof ContractEnvError) {
      logEvent("error", "auth", "env misconfigured", {
        missing: e.missing,
        invalid: e.invalid,
      });
      return jsonResponse(500, {
        error: "env_misconfigured",
        // On ne fuite pas les valeurs, juste les noms manquants/invalides.
        missing: e.missing,
        invalid: e.invalid.map((s) => s.split(":")[0]),
      });
    }
    throw e;
  }
  const { supabaseUrl: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE, anonKey: ANON_KEY } = env;

  // 1) Auth — JWT obligatoire (verify_jwt désactivé, on valide en code).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    logEvent("warn", "auth", "missing bearer token");
    return jsonResponse(401, { error: "unauthorized" });
  }
  const token = authHeader.slice(7);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    logEvent("warn", "auth", "invalid token", { error: claimsErr?.message });
    return jsonResponse(401, { error: "unauthorized" });
  }
  const userId = claims.claims.sub as string;
  const userEmail = (claims.claims.email as string | undefined) ?? null;

  // Admin client (RLS bypass) pour upload Storage + insert audit.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 2) Parse + validation du body.
  let body: RequestBody;
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      logEvent("warn", "parse_body", "invalid body", { issues: parsed.error.flatten() });
      return jsonResponse(400, { error: "invalid_body", issues: parsed.error.flatten() });
    }
    body = parsed.data;
  } catch (e) {
    logEvent("warn", "parse_body", "json parse failed", { error: (e as Error).message });
    return jsonResponse(400, { error: "invalid_json" });
  }

  // 3) Validation contractuelle (placeholders, champs vides).
  const validation = validateContractTemplateData({ medikong: MEDIKONG_DEFAULTS, vendor: body.vendor });
  if (!validation.valid) {
    logEvent("warn", "validate_contract", "validation failed", { issues: validation.issues });
    return jsonResponse(400, { error: "contract_invalid", issues: validation.issues });
  }

  try {
    // 4) Vérifier que le vendor appartient bien à l'utilisateur (sécurité critique).
    const vendor = await measure("load_vendor", { vendorId: body.vendorId, userId }, async () => {
      const { data, error } = await adminClient
        .from("vendors")
        .select("id, user_id, commissionnaire_agreement_accepted_at, commissionnaire_agreement_version")
        .eq("id", body.vendorId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error("vendor_not_found"), { statusCode: 404 });
      if (data.user_id && data.user_id !== userId) {
        throw Object.assign(new Error("vendor_user_mismatch"), { statusCode: 403 });
      }
      return data;
    });

    // 5) Garde-fou : refuser de re-signer la même version.
    if (
      vendor.commissionnaire_agreement_accepted_at &&
      vendor.commissionnaire_agreement_version === CONTRACT_VERSION
    ) {
      logEvent("warn", "guard_already_signed", "contract already signed for this version", {
        vendorId: body.vendorId,
      });
      return jsonResponse(409, { error: "already_signed", contractVersion: CONTRACT_VERSION });
    }

    const signedAt = body.signedAt ? new Date(body.signedAt) : new Date();

    // 6) Génération PDF (CPU-bound, instrumenté).
    const pdfBytes = await measure("render_pdf", { vendorId: body.vendorId }, async () =>
      generatePdf({
        vendor: body.vendor,
        medikong: MEDIKONG_DEFAULTS,
        signedAt,
        signatureDataUrl: body.signatureDataUrl,
        signatureMethod: body.signatureMethod,
        signerName: body.signerName,
        signerRole: body.signerRole ?? null,
      })
    );

    const documentHash = await measure("hash_pdf", { sizeBytes: pdfBytes.byteLength }, () =>
      sha256Hex(pdfBytes)
    );

    // 7) Upload bucket privé (nom isolé par vendor → RLS conforme).
    const path = `${body.vendorId}/${CONTRACT_TYPE}-${CONTRACT_VERSION}-${signedAt.getTime()}.pdf`;
    try {
      await measure("upload_pdf", { path, sizeBytes: pdfBytes.byteLength }, async () => {
        const { error } = await adminClient.storage
          .from(SELLER_CONTRACTS_BUCKET)
          .upload(path, pdfBytes, { contentType: "application/pdf", upsert: false });
        if (error) throw error;
      });
    } catch (e) {
      void recordAudit(adminClient, {
        action: "contract.upload_failed",
        vendorId: body.vendorId,
        userId,
        userEmail,
        detail: (e as Error).message,
        metadata: { path, sizeBytes: pdfBytes.byteLength, contractVersion: CONTRACT_VERSION },
      });
      throw e;
    }

    // 8) Insertion seller_contracts (User-Agent + IP côté serveur).
    const userAgent = req.headers.get("user-agent") ?? null;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;

    const contract = await measure("insert_contract", { vendorId: body.vendorId }, async () => {
      const { data, error } = await adminClient
        .from("seller_contracts")
        .insert({
          vendor_id: body.vendorId,
          contract_type: CONTRACT_TYPE,
          contract_version: CONTRACT_VERSION,
          signed_at: signedAt.toISOString(),
          signature_data: body.signatureDataUrl,
          signature_method: body.signatureMethod,
          signer_name: body.signerName,
          signer_role: body.signerRole ?? null,
          pdf_storage_path: path,
          document_hash: documentHash,
          user_agent: userAgent,
          ip_address: ipAddress,
          metadata: { ...(body.metadata ?? {}), generated_server_side: true },
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    });

    // 9) Marquer le vendor.
    await measure("update_vendor", { vendorId: body.vendorId }, async () => {
      const { error } = await adminClient
        .from("vendors")
        .update({
          commissionnaire_agreement_accepted_at: signedAt.toISOString(),
          commissionnaire_agreement_version: CONTRACT_VERSION,
        })
        .eq("id", body.vendorId);
      if (error) throw error;
    });

    // 10) URL signée à courte durée.
    const signedUrl = await measure("sign_url", { path }, async () => {
      const { data, error } = await adminClient.storage
        .from(SELLER_CONTRACTS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: true });
      if (error) throw error;
      return data?.signedUrl ?? null;
    });

    void recordAudit(adminClient, {
      action: "contract.signed",
      vendorId: body.vendorId,
      userId,
      userEmail,
      detail: `contract_id=${contract.id} version=${CONTRACT_VERSION}`,
      metadata: { path, documentHash, signatureMethod: body.signatureMethod },
    });

    logEvent("info", "done", "contract generated and stored", {
      vendorId: body.vendorId,
      contractId: contract.id,
      path,
      documentHash,
    });

    return jsonResponse(200, {
      contractId: contract.id,
      pdfPath: path,
      pdfUrl: signedUrl,
      signedAt: signedAt.toISOString(),
      documentHash,
      contractVersion: CONTRACT_VERSION,
    });
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    const status = err.statusCode ?? 500;
    logEvent("error", "done", "request failed", {
      vendorId: body.vendorId,
      error: { name: err.name, message: err.message, statusCode: status },
    });
    return jsonResponse(status, { error: err.message || "internal_error" });
  }
});
