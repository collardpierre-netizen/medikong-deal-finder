// Helper partagé : crée un token de vérification d'attache + envoie l'email.
// Utilisé par `create-vendor-account` (branche ATTACH) et `attach-user-to-vendor`.
//
// Le token brut est renvoyé pour construire le lien d'email ; seul le SHA-256 est stocké.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type AnyClient = ReturnType<typeof createClient>;

export const VERIFY_REDIRECT_BASE = "https://www.medikong.pro/vendor/verifier-acces";
export const VERIFY_TOKEN_TTL_HOURS = 24;

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(buf);
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes.buffer);
}

export function resolveAttachLocale(
  preferredLanguage?: string | null,
  countryCode?: string | null,
): "fr" | "nl" | "en" {
  const lang = (preferredLanguage || "").toLowerCase();
  if (lang === "fr" || lang === "nl" || lang === "en") return lang;
  const c = (countryCode || "").toUpperCase();
  if (c === "NL") return "nl";
  if (c === "FR" || c === "BE" || c === "LU") return "fr";
  return "en";
}

export type AttachLogMode = "create" | "attach" | "self_register";

export interface IssueAttachVerificationInput {
  supabaseAdmin: AnyClient;
  vendorId: string;
  userId: string;
  email: string;
  companyName: string;
  locale: "fr" | "nl" | "en";
  createdByAdminId?: string | null;
  /** Mode logged in `vendor_onboarding_email_logs.mode`. Defaults to "attach" for back-compat. */
  mode?: AttachLogMode;
}

export interface IssueAttachVerificationResult {
  verificationId: string;
  expiresAt: string;
  verifyUrl: string;
  emailStatus: "enqueued" | "failed";
  emailError: string | null;
  idempotencyKey: string;
}

export async function issueAttachVerification(
  input: IssueAttachVerificationInput,
): Promise<IssueAttachVerificationResult> {
  const { supabaseAdmin, vendorId, userId, email, companyName, locale, createdByAdminId, mode } = input;
  const logMode: AttachLogMode = mode ?? "attach";

  // Invalide les éventuels tokens pendants pour ce vendor (un seul lien valide à la fois)
  await supabaseAdmin
    .from("vendor_attach_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("vendor_id", vendorId)
    .is("consumed_at", null);

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 3600 * 1000).toISOString();

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("vendor_attach_verifications")
    .insert({
      vendor_id: vendorId,
      user_id: userId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by_admin_id: createdByAdminId ?? null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    throw new Error(`Impossible de créer la vérification: ${insErr?.message ?? "inconnue"}`);
  }

  const verifyUrl = `${VERIFY_REDIRECT_BASE}?token=${encodeURIComponent(token)}`;
  const idempotencyKey = `vendor-attach-verify-${inserted.id}`;

  let emailStatus: "enqueued" | "failed" = "enqueued";
  let emailError: string | null = null;
  try {
    const { error: invokeErr } = await supabaseAdmin.functions.invoke("send-app-email", {
      body: {
        templateName: "vendor-attach-verification",
        recipientEmail: email,
        idempotencyKey,
        templateData: { companyName, loginEmail: email, verifyUrl, locale },
      },
    });
    if (invokeErr) {
      emailStatus = "failed";
      emailError = invokeErr.message ?? String(invokeErr);
    }
  } catch (e) {
    emailStatus = "failed";
    emailError = e instanceof Error ? e.message : String(e);
  }

  // Log dans vendor_onboarding_email_logs (mode dynamique : create | attach | self_register)
  try {
    await supabaseAdmin.from("vendor_onboarding_email_logs").insert({
      vendor_id: vendorId,
      mode: logMode,
      template_name: "vendor-attach-verification",
      locale,
      recipient_email: email,
      idempotency_key: idempotencyKey,
      status: emailStatus,
      error_message: emailError,
    });
  } catch (e) {
    console.warn("[issueAttachVerification] log insert failed:", e);
  }

  return {
    verificationId: inserted.id,
    expiresAt,
    verifyUrl,
    emailStatus,
    emailError,
    idempotencyKey,
  };
}
