// First-party visitor id + tracking event helper.
// Cookie mk_ref stores { visitor_id, campaign_slug, code, ts }.
import { supabase } from "@/integrations/supabase/client";

const COOKIE = "mk_ref";
const VISITOR_KEY = "mk_visitor_id";
const TTL_DAYS = 90;

export interface MkRef {
  visitor_id: string;
  campaign_slug?: string;
  code?: string | null;
  ts: number;
}

function setCookie(name: string, value: string, days: number) {
  try {
    const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
}

function getCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

function newVisitorId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = newVisitorId();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return newVisitorId();
  }
}

export function getMkRef(): MkRef | null {
  const raw = getCookie(COOKIE);
  if (!raw) return null;
  try { return JSON.parse(raw) as MkRef; } catch { return null; }
}

export function setMkRef(ref: MkRef) {
  // First-touch: don't overwrite a valid existing attribution
  const existing = getMkRef();
  if (existing?.campaign_slug) return;
  setCookie(COOKIE, JSON.stringify(ref), TTL_DAYS);
}

/** Force-set (used by track-redirect landing). */
export function forceSetMkRef(ref: MkRef) {
  setCookie(COOKIE, JSON.stringify(ref), TTL_DAYS);
}

export type TrackEventType =
  | "visit" | "signup_started" | "signup_completed" | "activated" | "first_purchase" | "code_redeemed";

/** Fire-and-forget event beacon. */
export async function trackEvent(eventType: TrackEventType, opts?: { slug?: string; code?: string; meta?: Record<string, unknown> }) {
  const ref = getMkRef();
  const slug = opts?.slug ?? ref?.campaign_slug;
  const code = opts?.code ?? ref?.code ?? undefined;
  if (!slug && !code) return; // nothing to attribute — skip
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("track-event", {
      body: {
        event_type: eventType,
        slug,
        code,
        visitor_id: getVisitorId(),
        meta: opts?.meta ?? {},
      },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
  } catch (e) {
    // best-effort, never throw
    console.warn("trackEvent failed", e);
  }
}
