import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AccountKind = "buyer" | "vendor" | "admin";

export interface AccountEntry {
  kind: AccountKind;
  account_id: string;
  role: string;
  display_name: string;
  status: string;
  is_owner: boolean;
}

interface ActiveAccountValue {
  loading: boolean;
  accounts: AccountEntry[];
  activeKind: AccountKind | null;
  activeId: string | null;
  needsSelection: boolean;
  setActive: (kind: AccountKind, id: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

const ActiveAccountContext = createContext<ActiveAccountValue | undefined>(undefined);
const STORAGE_KEY = "medikong.active_account";

/**
 * Injects `x-active-account-id` / `x-active-account-kind` into every PostgREST
 * request so the SQL helpers `current_active_account_id()` /
 * `current_active_account_kind()` can read them.
 */
function applyHeaders(kind: AccountKind | null, id: string | null) {
  try {
    // supabase.rest is the PostgrestClient; mutating its `headers` object
    // affects subsequent .from() / .rpc() calls.
    const rest = (supabase as unknown as { rest?: { headers?: Record<string, string> } }).rest;
    if (!rest || !rest.headers) return;
    if (kind && id) {
      rest.headers["x-active-account-id"] = id;
      rest.headers["x-active-account-kind"] = kind;
    } else {
      delete rest.headers["x-active-account-id"];
      delete rest.headers["x-active-account-kind"];
    }
  } catch {
    /* ignore */
  }
}

export function ActiveAccountProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [activeKind, setActiveKind] = useState<AccountKind | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback((kind: AccountKind | null, id: string | null) => {
    try {
      if (kind && id) localStorage.setItem(STORAGE_KEY, JSON.stringify({ kind, id }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    applyHeaders(kind, id);
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setActiveKind(null);
      setActiveId(null);
      persist(null, null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_accounts");
    if (error) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as AccountEntry[];
    setAccounts(rows);

    // Restore previous selection if still valid
    let saved: { kind: AccountKind; id: string } | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch { /* ignore */ }

    const isValid = saved && rows.some(a => a.kind === saved!.kind && a.account_id === saved!.id);
    if (isValid && saved) {
      setActiveKind(saved.kind);
      setActiveId(saved.id);
      applyHeaders(saved.kind, saved.id);
    } else if (rows.length === 1) {
      setActiveKind(rows[0].kind);
      setActiveId(rows[0].account_id);
      persist(rows[0].kind, rows[0].account_id);
    } else {
      setActiveKind(null);
      setActiveId(null);
      applyHeaders(null, null);
    }
    setLoading(false);
  }, [user, persist]);

  useEffect(() => {
    if (authLoading) return;
    void loadAccounts();
  }, [authLoading, loadAccounts]);

  const setActive = useCallback(async (kind: AccountKind, id: string) => {
    // Optimistic — set headers first so RPC below sees the new context
    applyHeaders(kind, id);
    const { error } = await supabase.rpc("set_active_account", { _kind: kind, _account_id: id });
    if (error) {
      // rollback
      applyHeaders(activeKind, activeId);
      throw error;
    }
    setActiveKind(kind);
    setActiveId(id);
    persist(kind, id);
  }, [activeKind, activeId, persist]);

  const clear = useCallback(() => {
    setActiveKind(null);
    setActiveId(null);
    persist(null, null);
  }, [persist]);

  const needsSelection = !loading && !!user && accounts.length > 1 && (!activeKind || !activeId);

  const value = useMemo<ActiveAccountValue>(() => ({
    loading, accounts, activeKind, activeId, needsSelection,
    setActive, refresh: loadAccounts, clear,
  }), [loading, accounts, activeKind, activeId, needsSelection, setActive, loadAccounts, clear]);

  return <ActiveAccountContext.Provider value={value}>{children}</ActiveAccountContext.Provider>;
}

export function useActiveAccount() {
  const ctx = useContext(ActiveAccountContext);
  if (!ctx) throw new Error("useActiveAccount must be used within ActiveAccountProvider");
  return ctx;
}
