/**
 * Helpers UI pour le garde-fou DB anti-désactivation de masse.
 *
 * Le trigger DB lève une exception PostgREST avec :
 *   - code = "P0001"
 *   - message commençant par "Garde-fou :"
 *
 * On parse ces erreurs pour afficher un toast clair, et — si l'utilisateur
 * est super_admin — un bouton "Forcer" qui appelle la RPC `force_bulk_deactivate`.
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BulkGuardErrorInfo = {
  isBulkGuard: boolean;
  attempted?: number;
  threshold?: number;
  windowMinutes?: number;
  tableName?: string;
  rawMessage: string;
};

/** Détecte si une erreur Supabase provient du trigger garde-fou. */
export function parseBulkGuardError(err: any): BulkGuardErrorInfo {
  const message: string = err?.message ?? String(err ?? "");
  const code: string = err?.code ?? "";
  const isBulkGuard =
    (code === "P0001" || code === "") && /Garde-fou\s*:/i.test(message);

  if (!isBulkGuard) {
    return { isBulkGuard: false, rawMessage: message };
  }

  // Format attendu :
  // 'Garde-fou : 234 désactivation(s) sur "categories" dans les 5 dernières minutes (limite : 200). ...'
  const m = message.match(
    /(\d+)\s+désactivation\(s\)\s+sur\s+"([^"]+)"\s+dans\s+les\s+(\d+)\s+dernières?\s+minutes?\s+\(limite\s*:\s*(\d+)\)/i,
  );
  return {
    isBulkGuard: true,
    rawMessage: message,
    attempted: m ? parseInt(m[1], 10) : undefined,
    tableName: m ? m[2] : undefined,
    windowMinutes: m ? parseInt(m[3], 10) : undefined,
    threshold: m ? parseInt(m[4], 10) : undefined,
  };
}

const TABLE_LABELS: Record<string, string> = {
  categories: "catégories",
  products: "produits",
  offers: "offres",
};

/**
 * Affiche un toast clair pour une erreur garde-fou.
 * Si `onForce` est fourni et que l'utilisateur est super_admin, affiche un
 * bouton "Forcer" qui appellera ce callback (qui doit invoquer `forceBulkDeactivate`).
 */
export function showBulkGuardToast(
  info: BulkGuardErrorInfo,
  opts: { isSuperAdmin: boolean; onForce?: () => void } = { isSuperAdmin: false },
) {
  const tableLabel =
    (info.tableName && TABLE_LABELS[info.tableName]) ?? info.tableName ?? "lignes";

  const description = info.attempted
    ? `Vous avez tenté de désactiver ${info.attempted} ${tableLabel} en ${info.windowMinutes ?? 5} min (limite : ${info.threshold}). Réessayez en plus petits lots.`
    : info.rawMessage;

  toast.error("Désactivation de masse bloquée", {
    description,
    duration: 12000,
    action:
      opts.isSuperAdmin && opts.onForce
        ? {
            label: "Forcer (super_admin)",
            onClick: () => opts.onForce!(),
          }
        : undefined,
  });
}

/**
 * Appelle la RPC d'override DB. Réservé super_admin (vérifié côté serveur).
 * Retourne le nombre de lignes effectivement désactivées.
 */
export async function forceBulkDeactivate(
  tableName: "categories" | "products" | "offers",
  ids: string[],
): Promise<number> {
  if (!ids.length) return 0;

  const { data, error } = await supabase.rpc("force_bulk_deactivate", {
    _table_name: tableName,
    _ids: ids,
  });
  if (error) {
    toast.error("Override refusé", { description: error.message });
    throw error;
  }
  const updated = (data as any)?.updated ?? 0;
  toast.success(
    `Override appliqué : ${updated} ${TABLE_LABELS[tableName] ?? tableName} désactivé(s).`,
    { description: "L'opération a été journalisée comme « forcée »." },
  );
  return updated;
}

/**
 * Wrapper pratique : exécute une opération de désactivation et, si elle est
 * bloquée par le garde-fou, affiche le toast (avec bouton de force pour
 * super_admin).
 *
 * Renvoie `true` si OK, `false` si bloquée.
 */
export async function runWithBulkGuard(
  op: () => Promise<{ error: any } | void>,
  ctx: {
    isSuperAdmin: boolean;
    /** Callback à appeler si l'utilisateur clique sur "Forcer". */
    onForce?: () => void;
  },
): Promise<boolean> {
  try {
    const res = await op();
    const error = (res as any)?.error;
    if (error) {
      const info = parseBulkGuardError(error);
      if (info.isBulkGuard) {
        showBulkGuardToast(info, ctx);
        return false;
      }
      throw error;
    }
    return true;
  } catch (err) {
    const info = parseBulkGuardError(err);
    if (info.isBulkGuard) {
      showBulkGuardToast(info, ctx);
      return false;
    }
    throw err;
  }
}
