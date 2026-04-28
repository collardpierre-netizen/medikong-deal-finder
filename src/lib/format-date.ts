/**
 * Standard date formatters used across the site.
 * Keep a single source of truth so "Mise à jour" labels stay consistent.
 */

/**
 * Short absolute date in French, e.g. "04 avr. 2026".
 * Returns null when the input is missing or invalid.
 */
export function formatUpdatedAt(iso?: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Full date+time tooltip, e.g. "04 avril 2026 à 14:32".
 */
export function formatUpdatedAtFull(iso?: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
