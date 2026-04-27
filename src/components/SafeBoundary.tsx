import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface SafeBoundaryProps {
  children: ReactNode;
  /** Custom fallback. If a function, receives the error. */
  fallback?: ReactNode | ((error: Error) => ReactNode);
  /** Optional label used in the default fallback for context (e.g. "cette offre"). */
  label?: string;
  /** Called once when an error is caught. */
  onError?: (error: Error) => void;
}

interface SafeBoundaryState {
  error: Error | null;
}

/**
 * Lightweight error boundary used to isolate optional UI blocks
 * (e.g. a single offer row) so that one broken record does not
 * blank the whole page.
 */
export class SafeBoundary extends Component<SafeBoundaryProps, SafeBoundaryState> {
  state: SafeBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SafeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
    if (typeof window !== "undefined" && (window as any).console) {
      // eslint-disable-next-line no-console
      console.warn("[SafeBoundary] caught render error:", error);
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback, label } = this.props;
    if (typeof fallback === "function") return fallback(error);
    if (fallback !== undefined) return fallback;

    return (
      <div className="border border-border rounded-lg p-4 my-2 bg-muted/30 text-sm text-muted-foreground flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">
            Données indisponibles{label ? ` pour ${label}` : ""}
          </p>
          <p className="text-xs mt-0.5">
            Cet élément n'a pas pu être affiché. Le reste de la page reste accessible.
          </p>
        </div>
      </div>
    );
  }
}

export default SafeBoundary;
