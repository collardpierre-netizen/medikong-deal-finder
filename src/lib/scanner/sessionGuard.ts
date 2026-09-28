/**
 * Scan uniquement : intercepte les appels au backend. Sur un refus de session (401 / JWT expiré),
 * tente un rafraîchissement ; sinon signale « session expirée » et met l'appel en attente,
 * puis le renvoie tel quel après reconnexion par code. Les écrans restent montés : rien n'est perdu.
 */
import { supabase } from "@/integrations/supabase/client";

const BASE = import.meta.env.VITE_SUPABASE_URL as string;
let installed = false;
let waiters: Array<(token: string | null) => void> = [];
const listeners = new Set<(expired: boolean) => void>();

export const onSessionExpired = (fn: (expired: boolean) => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (v: boolean) => listeners.forEach((l) => l(v));

/** À appeler après reconnexion : renvoie les appels en attente avec le nouveau jeton. */
export function releasePending(token: string | null) {
  const w = waiters; waiters = [];
  w.forEach((r) => r(token));
  emit(false);
}

const isAuthFailure = async (res: Response) => {
  if (res.status === 401) return true;
  if (res.status !== 400 && res.status !== 403) return false;
  try { const t = await res.clone().text(); return /jwt expired|invalid jwt|PGRST301|PGRST303/i.test(t); } catch { return false; }
};

export function installScanSessionGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(BASE) || url.includes("/auth/v1/")) return orig(input, init);
    const res = await orig(input, init);
    if (!(await isAuthFailure(res))) return res;
    let token: string | null = null;
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) token = data.session.access_token;
    else {
      emit(true);
      token = await new Promise<string | null>((r) => waiters.push(r));
    }
    if (!token) return res;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${token}`);
    return orig(input instanceof Request ? input.url : input, { ...(init ?? {}), headers,
      method: init?.method ?? (input instanceof Request ? input.method : undefined) });
  };
}
