import { APP_ENV, IS_PROD } from "@/config/env";
import { AlertTriangle } from "lucide-react";

/**
 * Bandeau d'environnement non-prod.
 * Sticky top, visible uniquement si !IS_PROD. Bloque aussi l'indexation via meta robots
 * (cf. EnvNoIndex monté au même endroit).
 */
export function EnvBanner() {
  if (IS_PROD) return null;

  const label =
    APP_ENV === "staging" ? "pré-production" : APP_ENV === "dev" ? "développement" : APP_ENV;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[100] w-full bg-orange-200 text-orange-950 border-b border-orange-300"
    >
      <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-1 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          Environnement de <strong className="uppercase">{label}</strong> — données non
          commerciales, ne pas indexer.
        </span>
      </div>
    </div>
  );
}
