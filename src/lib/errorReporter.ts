/**
 * Lightweight client-side error reporter.
 *
 * - Captures unhandled errors, unhandled promise rejections, and manual reports
 *   (used by SafeBoundary and explicit `report(...)` calls).
 * - Persists each event to `public.client_error_logs` via the Supabase client.
 * - Includes route, component name, user agent, optional auth user id.
 * - Deduplicates by fingerprint within a short window to avoid log floods.
 * - Always logs to the browser console as well, so existing devtools workflows
 *   keep working.
 */

import { supabase } from "@/integrations/supabase/client";

type Level = "error" | "warning" | "info";
type Source = "window" | "unhandledrejection" | "boundary" | "manual";

interface ReportInput {
  message: string;
  stack?: string | null;
  component?: string | null;
  level?: Level;
  source?: Source;
  metadata?: Record<string, unknown>;
}

const RECENT_TTL_MS = 30_000; // dedupe window
const MAX_REPORTS_PER_MINUTE = 20;
const MAX_MESSAGE_LEN = 4_000;
const MAX_STACK_LEN = 8_000;

const recent = new Map<string, number>();
const minuteWindow: number[] = [];
let listenersInstalled = false;

function fingerprint(input: ReportInput, route: string): string {
  // Stable hash-ish: message + first stack line + route + component
  const firstStackLine = (input.stack || "").split("\n").find((l) => l.trim().length > 0) || "";
  return `${input.source || "manual"}|${route}|${input.component || ""}|${input.message}|${firstStackLine}`.slice(0, 512);
}

function isRateLimited(): boolean {
  const now = Date.now();
  while (minuteWindow.length && now - minuteWindow[0] > 60_000) minuteWindow.shift();
  if (minuteWindow.length >= MAX_REPORTS_PER_MINUTE) return true;
  minuteWindow.push(now);
  return false;
}

function truncate(s: string | null | undefined, n: number): string | null {
  if (!s) return null;
  return s.length > n ? s.slice(0, n) + "…[truncated]" : s;
}

async function persist(payload: {
  level: Level;
  source: Source;
  message: string;
  stack: string | null;
  component: string | null;
  route: string;
  user_agent: string;
  user_id: string | null;
  fingerprint: string;
  metadata: Record<string, unknown>;
}) {
  try {
    await (supabase.from("client_error_logs") as any).insert(payload);
  } catch {
    // never throw from the reporter
  }
}

export async function report(input: ReportInput): Promise<void> {
  try {
    const route = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
    const fp = fingerprint(input, route);
    const now = Date.now();

    // Cleanup expired dedupe entries occasionally
    if (recent.size > 200) {
      for (const [k, t] of recent) if (now - t > RECENT_TTL_MS) recent.delete(k);
    }

    const last = recent.get(fp);
    if (last && now - last < RECENT_TTL_MS) {
      // Still log to console but skip persistence
      // eslint-disable-next-line no-console
      console.warn("[errorReporter] (deduped)", input.message);
      return;
    }
    recent.set(fp, now);

    if (isRateLimited()) {
      // eslint-disable-next-line no-console
      console.warn("[errorReporter] rate-limited, dropping report:", input.message);
      return;
    }

    // Always log
    if (input.level === "warning") {
      // eslint-disable-next-line no-console
      console.warn("[client-error]", input.message, input.stack || "");
    } else if (input.level === "info") {
      // eslint-disable-next-line no-console
      console.info("[client-error]", input.message);
    } else {
      // eslint-disable-next-line no-console
      console.error("[client-error]", input.message, input.stack || "");
    }

    // Resolve user (best-effort; do not block on long calls)
    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      userId = null;
    }

    await persist({
      level: input.level || "error",
      source: input.source || "manual",
      message: truncate(input.message, MAX_MESSAGE_LEN) || "(no message)",
      stack: truncate(input.stack ?? null, MAX_STACK_LEN),
      component: input.component ?? null,
      route,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      user_id: userId,
      fingerprint: fp,
      metadata: input.metadata || {},
    });
  } catch {
    // swallow
  }
}

/**
 * Install global listeners for window error + unhandledrejection.
 * Idempotent.
 */
export function installGlobalErrorReporting(): void {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;

  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    void report({
      source: "window",
      level: "error",
      message: err?.message || event.message || "Unknown window error",
      stack: err?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason: any = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason?.message || "Unhandled promise rejection";
    const stack = reason?.stack || (typeof reason === "object" ? JSON.stringify(reason).slice(0, 2000) : null);
    void report({
      source: "unhandledrejection",
      level: "error",
      message,
      stack,
    });
  });
}
