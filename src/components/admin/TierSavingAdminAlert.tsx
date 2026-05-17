import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  subscribeTierSavingIssues,
  getTierSavingDiagnostics,
  type TierSavingIssueContext,
  type TierSavingIssueReason,
} from "@/lib/tier-saving-diagnostics";

interface RecentIssue {
  reason: TierSavingIssueReason;
  context: TierSavingIssueContext;
  at: number;
}

const MAX_RECENT = 10;

/**
 * Bannière flottante visible uniquement pour les admins : affiche en temps
 * réel les incidents `compute_returned_null` (palier non-base sans saving
 * calculable) afin de visualiser la donnée manquante côté administration.
 *
 * - Ne s'affiche que si `useAdminAuth().isAdmin === true`.
 * - Compte cumulé + 10 dernières occurrences (where / basePrice / unitPrice
 *   / offerId / productId).
 * - Refermable (state local, recompte si nouveaux incidents).
 */
export function TierSavingAdminAlert() {
  const { isAdmin } = useAdminAuth();
  const [recent, setRecent] = useState<RecentIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number>(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    // Reprend l'état déjà accumulé (cas où le composant monte après coup).
    const snap = getTierSavingDiagnostics();
    const stats = snap.compute_returned_null;
    if (stats) {
      setTotal(stats.count);
      if (stats.lastContext) {
        setRecent([
          {
            reason: "compute_returned_null",
            context: stats.lastContext,
            at: stats.lastSeenAt,
          },
        ]);
      }
    }

    const unsubscribe = subscribeTierSavingIssues((reason, stats) => {
      if (reason !== "compute_returned_null") return;
      setTotal(stats.count);
      setRecent((prev) =>
        [
          {
            reason,
            context: stats.lastContext ?? {},
            at: stats.lastSeenAt,
          },
          ...prev,
        ].slice(0, MAX_RECENT),
      );
    });

    return unsubscribe;
  }, [isAdmin]);

  if (!isAdmin) return null;
  const visibleCount = total - dismissedAt;
  if (visibleCount <= 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-md rounded-md border border-amber-300 bg-amber-50 text-amber-900 shadow-lg"
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1 text-xs">
          <div className="font-semibold">
            Données palier manquantes ({visibleCount})
          </div>
          <div className="text-amber-800">
            <code>computeTierSavingPercent</code> a renvoyé <code>null</code> pour
            un palier non-base. Cliquez pour {expanded ? "réduire" : "voir le détail"}.
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-[11px] font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
          >
            {expanded ? "Masquer" : `Afficher les ${Math.min(recent.length, MAX_RECENT)} derniers`}
          </button>
          {expanded && recent.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto rounded bg-white/70 p-2 font-mono text-[10px] leading-snug">
              {recent.map((issue, idx) => (
                <li key={`${issue.at}-${idx}`} className="break-words">
                  <span className="text-amber-700">
                    {new Date(issue.at).toLocaleTimeString()}
                  </span>{" "}
                  · {issue.context.where ?? "?"} ·{" "}
                  base={String(issue.context.basePrice ?? "—")} ·{" "}
                  unit={String(issue.context.unitPrice ?? "—")}
                  {issue.context.offerId && (
                    <> · offer={issue.context.offerId.slice(0, 8)}</>
                  )}
                  {issue.context.productId && (
                    <> · product={issue.context.productId.slice(0, 8)}</>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissedAt(total);
            setExpanded(false);
          }}
          aria-label="Fermer l'alerte"
          className="rounded p-1 text-amber-900 hover:bg-amber-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
