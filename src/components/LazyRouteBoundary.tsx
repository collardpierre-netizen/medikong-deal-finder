import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { report as reportClientError } from "@/lib/errorReporter";
import {
  getReloadAttempts,
  MAX_AUTO_RELOADS_PER_SESSION,
  resetReloadAttempts,
} from "@/lib/lazy-with-retry";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Boundary spécifique aux routes lazy : si un chunk échoue à charger
 * (déploiement, réseau coupé, cache obsolète) on affiche un écran
 * de retry au lieu d'un blank screen.
 */
export class LazyRouteBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    void reportClientError({
      source: "boundary",
      level: "error",
      message: error.message || String(error),
      stack: error.stack || null,
      component: "LazyRouteBoundary",
    });
  }

  handleRetry = () => {
    this.setState({ error: null });
    // Hard reload to fetch fresh chunks
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center border border-border rounded-xl p-8 bg-card">
          <AlertTriangle className="mx-auto mb-4 text-amber-500" size={36} />
          <h1 className="text-lg font-semibold text-foreground mb-2">
            Cette page n'a pas pu se charger
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Une nouvelle version du site est peut-être disponible, ou votre
            connexion a été interrompue. Réessayez pour continuer.
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} />
            Recharger la page
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-6 text-[11px] text-left text-muted-foreground bg-muted/40 rounded p-2 overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default LazyRouteBoundary;
