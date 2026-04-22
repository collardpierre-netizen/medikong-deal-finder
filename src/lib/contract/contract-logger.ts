/**
 * Logger dédié à la chaîne de signature du mandat de facturation.
 *
 * Objectifs :
 *  1. Diagnostiquer rapidement les échecs de génération PDF / upload Storage
 *     en production sans dépendre uniquement des `console.error` opaques.
 *  2. Conserver un buffer en mémoire (ring) consultable à chaud via
 *     `window.__medikongContractLogs` ou exporté en clipboard depuis le banner.
 *  3. Persister un audit trail côté backend dans `audit_logs` (best-effort,
 *     non bloquant) pour les évènements critiques (échec upload, hash mismatch,
 *     erreur RLS) — utile pour le support et l'analyse post-mortem.
 *
 * Volontairement sans dépendance externe (pas de Sentry/Datadog) pour rester
 * RGPD-friendly : aucune donnée sortante en dehors de l'infrastructure projet.
 */
import { supabase } from "@/integrations/supabase/client";

export type ContractLogLevel = "debug" | "info" | "warn" | "error";

export type ContractLogStage =
  | "validate"
  | "render_pdf"
  | "hash_pdf"
  | "upload_pdf"
  | "insert_contract"
  | "update_vendor"
  | "sign_url"
  | "notify_email"
  | "download_signed_pdf"
  | "preview_pdf"
  | "env_validation"
  | "storage_probe";

export interface ContractLogEntry {
  ts: string;
  level: ContractLogLevel;
  stage: ContractLogStage;
  message: string;
  vendorId?: string | null;
  contractVersion?: string | null;
  durationMs?: number;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    code?: string | number;
    statusCode?: number;
    stack?: string;
  };
}

const RING_SIZE = 100;
const ring: ContractLogEntry[] = [];

function pushRing(entry: ContractLogEntry) {
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
}

function exposeOnWindow() {
  if (typeof window === "undefined") return;
  // @ts-expect-error - debug global namespace
  window.__medikongContractLogs = {
    list: () => [...ring],
    clear: () => {
      ring.length = 0;
    },
    download: () => {
      const blob = new Blob([JSON.stringify(ring, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medikong-contract-logs-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}
exposeOnWindow();

function serializeError(err: unknown): ContractLogEntry["error"] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    const anyErr = err as Error & {
      code?: string | number;
      statusCode?: number;
      status?: number;
    };
    return {
      name: err.name,
      message: err.message,
      code: anyErr.code,
      statusCode: anyErr.statusCode ?? anyErr.status,
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
    };
  }
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : JSON.stringify(e),
      code: (e.code as string | number) ?? undefined,
      statusCode: (e.statusCode as number) ?? (e.status as number) ?? undefined,
    };
  }
  return { message: String(err) };
}

interface LogParams {
  stage: ContractLogStage;
  message: string;
  vendorId?: string | null;
  contractVersion?: string | null;
  durationMs?: number;
  context?: Record<string, unknown>;
  error?: unknown;
}

function log(level: ContractLogLevel, params: LogParams) {
  const entry: ContractLogEntry = {
    ts: new Date().toISOString(),
    level,
    stage: params.stage,
    message: params.message,
    vendorId: params.vendorId ?? null,
    contractVersion: params.contractVersion ?? null,
    durationMs: params.durationMs,
    context: params.context,
    error: serializeError(params.error),
  };
  pushRing(entry);

  const prefix = `[contract:${entry.stage}]`;
  const payload = {
    vendorId: entry.vendorId,
    contractVersion: entry.contractVersion,
    durationMs: entry.durationMs,
    context: entry.context,
    error: entry.error,
  };
  if (level === "error") console.error(prefix, entry.message, payload);
  else if (level === "warn") console.warn(prefix, entry.message, payload);
  else if (level === "info") console.info(prefix, entry.message, payload);
  else console.debug(prefix, entry.message, payload);
}

export const contractLogger = {
  debug: (p: LogParams) => log("debug", p),
  info: (p: LogParams) => log("info", p),
  warn: (p: LogParams) => log("warn", p),
  error: (p: LogParams) => log("error", p),
  /** Consulter le buffer mémoire (debug). */
  snapshot: (): ContractLogEntry[] => [...ring],
};

/**
 * Audit trail backend (best-effort). Utilisé uniquement pour les évènements
 * critiques pour ne pas spammer la table `audit_logs`. Échec silencieux : ce
 * log ne doit JAMAIS faire échouer le flux de signature.
 */
export async function recordContractAudit(params: {
  action: string;
  vendorId?: string | null;
  detail?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id ?? null;
    const userEmail = userRes?.user?.email ?? null;
    await supabase.from("audit_logs").insert({
      action: params.action,
      module: "vendor_contract",
      user_id: userId,
      user_name: userEmail,
      user_role: "vendor",
      detail: [
        params.vendorId ? `vendor=${params.vendorId}` : null,
        params.detail ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
        .filter(Boolean)
        .join(" | "),
    });
  } catch (e) {
    // Best-effort uniquement.
    contractLogger.warn({
      stage: "insert_contract",
      message: "audit_logs insert failed (non-blocking)",
      error: e,
    });
  }
}

/**
 * Mesure la durée d'une étape async et trace automatiquement son issue.
 * Re-throw l'erreur d'origine pour ne pas masquer le flow.
 */
export async function measureStage<T>(
  stage: ContractLogStage,
  message: string,
  fn: () => Promise<T>,
  meta: { vendorId?: string | null; contractVersion?: string | null; context?: Record<string, unknown> } = {}
): Promise<T> {
  const start = performance.now();
  try {
    const value = await fn();
    contractLogger.info({
      stage,
      message: `${message} ✓`,
      vendorId: meta.vendorId,
      contractVersion: meta.contractVersion,
      durationMs: Math.round(performance.now() - start),
      context: meta.context,
    });
    return value;
  } catch (error) {
    contractLogger.error({
      stage,
      message: `${message} ✗`,
      vendorId: meta.vendorId,
      contractVersion: meta.contractVersion,
      durationMs: Math.round(performance.now() - start),
      context: meta.context,
      error,
    });
    throw error;
  }
}
