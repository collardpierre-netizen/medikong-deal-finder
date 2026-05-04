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
    const enriched = error as Error & {
      chunkKey?: string;
      probe?: {
        url: string;
        status: number | null;
        statusText: string | null;
        contentType: string | null;
        contentLength: string | null;
        bodySnippet: string | null;
        looksLikeHtml: boolean;
        fetchError?: string;
      } | null;
    };
    void reportClientError({
      source: "boundary",
      level: "error",
      message: error.message || String(error),
      stack: error.stack || null,
      component: "LazyRouteBoundary",
      metadata: {
        chunkKey: enriched.chunkKey ?? null,
        chunkUrl: enriched.probe?.url ?? null,
        chunkStatus: enriched.probe?.status ?? null,
        chunkStatusText: enriched.probe?.statusText ?? null,
        chunkContentType: enriched.probe?.contentType ?? null,
        chunkContentLength: enriched.probe?.contentLength ?? null,
        chunkLooksLikeHtml: enriched.probe?.looksLikeHtml ?? null,
        chunkFetchError: enriched.probe?.fetchError ?? null,
        chunkBodySnippet: enriched.probe?.bodySnippet ?? null,
      },
    });
  }

  handleRetry = () => {
    // Manual retry: reset the session-level reload counter so auto-recovery
    // works again on the next chunk error after this fresh load.
    resetReloadAttempts();
    this.setState({ error: null });
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const attempts = getReloadAttempts();
    const exhausted = attempts >= MAX_AUTO_RELOADS_PER_SESSION;

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center border border-border rounded-xl p-8 bg-card">
          <AlertTriangle className="mx-auto mb-4 text-amber-500" size={36} />
          <h1 className="text-lg font-semibold text-foreground mb-2">
            Cette page n'a pas pu se charger
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {exhausted
              ? `Le chargement a échoué après ${attempts} rechargement${attempts > 1 ? "s" : ""} automatique${attempts > 1 ? "s" : ""}. Vérifiez votre connexion puis réessayez manuellement.`
              : "Une nouvelle version du site est peut-être disponible, ou votre connexion a été interrompue. Réessayez pour continuer."}
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
