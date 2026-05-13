import { useEffect, useState, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

export type CatalogView = "grid" | "trivago";

const STORAGE_KEY = "medikong.catalog.view";
const VALID: CatalogView[] = ["grid", "trivago"];

function isValid(v: string | null | undefined): v is CatalogView {
  return !!v && (VALID as string[]).includes(v);
}

function trackEvent(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...payload });
}

function getDefaultView(pathname: string, params: URLSearchParams, isMobile: boolean): CatalogView {
  if (isMobile) return "trivago";
  if (pathname.startsWith("/promotions")) {
    return "grid";
  }
  if (
    pathname.startsWith("/marques") ||
    pathname.startsWith("/marque/") ||
    pathname.startsWith("/catalogue") ||
    pathname.startsWith("/recherche")
  ) {
    return "trivago";
  }
  return "grid";
}

async function persistRemote(view: CatalogView) {
  try {
    await (supabase.rpc as any)("set_user_preference", { _key: "catalog_view", _value: view });
  } catch {
    // best-effort
  }
}

export function useCatalogViewMode() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Read remote preference once when user logs in
  const [remotePref, setRemotePref] = useState<CatalogView | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setRemotePref(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const v = (data?.preferences as any)?.catalog_view as string | undefined;
      if (isValid(v)) setRemotePref(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const localPref =
    typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as string | null) : null;
  const userPref: CatalogView | null = isValid(remotePref)
    ? remotePref
    : isValid(localPref)
    ? (localPref as CatalogView)
    : null;

  const contextualDefault = getDefaultView(location.pathname, params, isMobile);

  const [view, setViewState] = useState<CatalogView>(userPref ?? contextualDefault);
  const [hasUserOverride, setHasUserOverride] = useState<boolean>(!!userPref);

  // Recompute when context changes and no user override
  useEffect(() => {
    if (!hasUserOverride) {
      setViewState(getDefaultView(location.pathname, params, isMobile));
    }
  }, [location.pathname, params.toString(), isMobile, hasUserOverride]);

  // If user pref arrives from remote later, apply it
  useEffect(() => {
    if (userPref) {
      setViewState(userPref);
      setHasUserOverride(true);
    }
  }, [userPref]);

  const setView = useCallback(
    (next: CatalogView) => {
      setViewState((prev) => {
        trackEvent("catalog_view_toggled", {
          from: prev,
          to: next,
          pathname: location.pathname,
          has_search: params.has("q") || params.has("search"),
        });
        return next;
      });
      setHasUserOverride(true);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      if (user?.id) void persistRemote(next);
    },
    [location.pathname, params, user?.id]
  );

  // Page view event whenever pathname / effective view changes
  useEffect(() => {
    trackEvent("catalog_page_viewed", {
      pathname: location.pathname,
      view,
      is_mobile: isMobile,
      is_user_pref: hasUserOverride,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, view]);

  return { view, setView, isMobile, hasUserOverride };
}
