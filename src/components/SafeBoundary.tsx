import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { report as reportClientError } from "@/lib/errorReporter";

interface SafeBoundaryProps {
  children: ReactNode;
  /** Custom fallback. If a function, receives the error. */
  fallback?: ReactNode | ((error: Error) => ReactNode);
  /** Optional label used in the default fallback for context (e.g. "cette offre"). */
  label?: string;
  /** Called once when an error is caught. */
  onError?: (error: Error) => void;
  /**
   * Structured context merged into the persisted metadata (product id, slug,
   * feature name, …). Kept small — the reporter truncates aggressive keys.
   */
  context?: Record<string, unknown>;
}

interface SafeBoundaryState {
  error: Error | null;
}

/**
 * Classify a caught error to help future triage without opening the stack.
 * Returned as `probableReason` in the persisted metadata.
 */
export function classifyBoundaryError(error: Error): string {
  const msg = `${error?.message || ""} ${error?.stack || ""}`;
  if (
    /Minified React error #310|Rendered (more|fewer) hooks|change in the order of Hooks/i.test(
      msg,
    )
  ) {
    return "react_hook_order_310";
  }
  if (/Minified React error #(185|418|419|423|425)/i.test(msg)) {
    return "react_hydration_or_suspense";
  }
  if (/Loading chunk .* failed|Failed to fetch dynamically imported module|ChunkLoadError/i.test(msg)) {
    return "chunk_load_failure";
  }
  if (/NetworkError|Failed to fetch|net::ERR_/i.test(msg)) {
    return "network_error";
  }
  if (/Cannot read propert(y|ies) of (undefined|null)|is not a function|is not iterable/i.test(msg)) {
    return "null_or_type_error";
  }
  if (/Minified React error #\d+/i.test(msg)) {
    return "react_generic";
  }
  return "unknown";
}

/**
 * Lightweight error boundary used to isolate optional UI blocks
 * (e.g. a single offer row) so that one broken record does not
 * blank the whole page.
 *
 * Every catch is journalised via `errorReporter.report` with:
 *   - source: "boundary"
 *   - route  : window.location (added by the reporter)
 *   - component: `label`
 *   - metadata: componentStack + probableReason + user-supplied context
 */
export class SafeBoundary extends Component<SafeBoundaryProps, SafeBoundaryState> {
  state: SafeBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SafeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error);
    const probableReason = classifyBoundaryError(error);
    // Centralised reporting (console + persisted to client_error_logs)
    void reportClientError({
      source: "boundary",
      level: "error",
      message: error.message || String(error),
      stack: error.stack || info.componentStack || null,
      component: this.props.label || null,
      metadata: {
        componentStack: info.componentStack,
        probableReason,
        errorName: error.name || null,
        boundaryLabel: this.props.label || null,
        ...(this.props.context || {}),
      },
    });
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

