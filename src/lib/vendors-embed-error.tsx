import type { ReactNode } from "react";

/**
 * Helper partagé pour afficher un message d'erreur détaillé lorsqu'une requête
 * qui embedde `vendors(...)` échoue (typiquement via PostgREST).
 *
 * 3 cas distingués :
 *   - "permission" : GRANT manquant sur public.vendors ou RLS trop restrictive
 *     (code Postgres 42501, ou message contenant permission denied / RLS).
 *   - "network"    : autre erreur SQL/réseau (timeout, JSON parse, etc.).
 *   - "empty"      : la requête a réussi mais 0 ligne renvoyée — peut signaler
 *     une base vide OU un filtre trop restrictif.
 */
export type VendorsEmbedErrorKind = "permission" | "network" | "empty";

export interface VendorsEmbedErrorInfo {
  kind: VendorsEmbedErrorKind;
  title: string;
  details: string;
  code?: string;
}

export function classifyVendorsEmbedError(
  error: unknown,
  options: { rowCount?: number; hasActiveFilters?: boolean } = {}
): VendorsEmbedErrorInfo | null {
  const err = error as { message?: string; code?: string; details?: string } | null | undefined;
  const msg = err?.message ?? "";
  const code = err?.code ?? "";

  if (err) {
    const isPermission =
      code === "42501" ||
      /permission denied|insufficient_privilege|not authorized|\bRLS\b/i.test(msg);

    if (isPermission) {
      return {
        kind: "permission",
        title:
          "Impossible de charger les données : permissions insuffisantes sur la table `vendors`.",
        details:
          "PostgREST a refusé la requête (GRANT manquant pour le rôle authenticated ou RLS trop restrictive). Restaurez les GRANT SELECT/INSERT/UPDATE/DELETE sur public.vendors, ou vérifiez les politiques RLS depuis /admin/table-grants-audit." +
          (code ? ` (code ${code})` : ""),
        code,
      };
    }

    return {
      kind: "network",
      title: "Impossible de charger les données.",
      details: (msg || err?.details || "Erreur inconnue.") + (code ? ` (code ${code})` : ""),
      code,
    };
  }

  if ((options.rowCount ?? 0) === 0) {
    return {
      kind: "empty",
      title: options.hasActiveFilters
        ? "Aucun résultat ne correspond aux filtres actifs."
        : "Aucune donnée en base.",
      details: options.hasActiveFilters
        ? "Essayez de relâcher les filtres ci-dessus."
        : "Si vous en attendiez, vérifiez les GRANT sur public.vendors et les politiques RLS (voir /admin/table-grants-audit).",
    };
  }

  return null;
}

interface Props {
  error: unknown;
  rowCount?: number;
  hasActiveFilters?: boolean;
  /** Texte du titre quand 0 ligne sans erreur. Override l'auto-généré. */
  emptyTitle?: ReactNode;
  className?: string;
}

/**
 * Bloc d'erreur prêt à l'emploi. Retourne `null` si aucune anomalie
 * (erreur absente ET rowCount > 0).
 */
export function VendorsEmbedError({
  error,
  rowCount,
  hasActiveFilters,
  emptyTitle,
  className,
}: Props) {
  const info = classifyVendorsEmbedError(error, { rowCount, hasActiveFilters });
  if (!info) return null;

  const isError = info.kind !== "empty";
  const color = isError ? "#B42318" : "#8B95A5";

  return (
    <div
      className={`py-8 px-6 text-center text-[13px] space-y-2 ${className ?? ""}`}
      style={{ color }}
      role={isError ? "alert" : undefined}
    >
      <div className="font-semibold">
        {info.kind === "empty" && emptyTitle ? emptyTitle : info.title}
      </div>
      {info.details && (
        <div className="text-[12px]" style={{ color: "#8B95A5" }}>
          {info.details}
        </div>
      )}
    </div>
  );
}
