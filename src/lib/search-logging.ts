import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "mk_search_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

export interface LogSearchInput {
  query: string;
  resultsCount?: number | null;
  clickedType?: "product" | "brand" | "category" | null;
  clickedId?: string | null;
  clickedSlug?: string | null;
  filters?: Record<string, unknown>;
  country?: string | null;
  locale?: string | null;
  source?: string | null;
}

/**
 * Fire-and-forget search logging. Never throws, never blocks navigation.
 */
export async function logSearch(input: LogSearchInput): Promise<void> {
  const q = (input.query ?? "").trim();
  if (!q) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;

    const payload = {
      user_id: userId,
      session_id: getSessionId() || null,
      query: q,
      results_count: input.resultsCount ?? null,
      clicked_type: input.clickedType ?? null,
      clicked_id: input.clickedId ?? null,
      clicked_slug: input.clickedSlug ?? null,
      filters: (input.filters ?? {}) as Record<string, unknown>,
      country: input.country ?? null,
      locale: input.locale ?? (typeof navigator !== "undefined" ? navigator.language : null),
      source: input.source ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    };
    await supabase.from("search_logs").insert(payload as never);
  } catch (err) {
    // Silent: tracking should never break UX
    if (import.meta.env.DEV) console.warn("[search-logging] insert failed", err);
  }
}
