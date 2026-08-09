import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { Button } from "@/components/ui/button";

/**
 * Bandeau d'indisponibilité backend.
 * Visible uniquement quand le health-check signale une panne ou une lenteur
 * anormale sur la base de données ou l'authentification.
 */
export function BackendHealthBanner() {
  const health = useBackendHealth();

  if (health.loading || health.status === "up" || health.status === "unknown") {
    return null;
  }

  const authDown = health.auth?.status === "down";
  const dbDown = health.database?.status === "down";
  const isDown = health.status === "down";

  let message: string;
  if (health.unreachable) {
    message =
      "Impossible de joindre nos services. Vérifiez votre connexion — nous réessayons automatiquement.";
  } else if (authDown && dbDown) {
    message =
      "La connexion et les données sont momentanément indisponibles. Vos actions ne seront pas enregistrées pour l'instant.";
  } else if (authDown) {
    message =
      "Le service de connexion est momentanément indisponible : la connexion et l'inscription peuvent échouer.";
  } else if (dbDown) {
    message =
      "Les données (catalogue, prix, commandes) sont momentanément indisponibles.";
  } else {
    message =
      "Nos services répondent plus lentement que d'habitude : certaines pages peuvent tarder à charger.";
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={
        isDown
          ? "sticky top-0 z-[110] w-full border-b border-destructive/40 bg-destructive text-destructive-foreground"
          : "sticky top-0 z-[110] w-full border-b border-amber-300 bg-amber-100 text-amber-950"
      }
    >
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-xs font-medium sm:text-sm">
        {health.unreachable ? (
          <WifiOff className="h-4 w-4 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        )}
        <span>{message}</span>
        <Button
          type="button"
          size="sm"
          variant={isDown ? "secondary" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={health.refresh}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
