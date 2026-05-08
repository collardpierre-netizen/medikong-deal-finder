/**
 * Tracking client de l'encart "Comparaison live" de la home.
 * - dataLayer (GTM) pour analytics web
 * - persistance DB via `home_showcase_events` (insert public RLS)
 *
 * Impressions dédoublonnées par session (clé produit+variant) pour éviter
 * de gonfler les compteurs sur les re-renders.
 */
import { supabase } from "@/integrations/supabase/client";

export type ShowcaseVariant = "ok" | "no_offers" | "single_offer" | "fallback" | "not_found";

type ShowcasePayload = {
  productId: string | null;
  productSlug?: string | null;
  variant: ShowcaseVariant;
  deltaPct?: number | null;
  offerCount?: number | null;
  locale?: string | null;
  countryCode?: string | null;
};

const IMPRESSION_SESSION_PREFIX = "mk:hs:imp:";

function getSessionId(): string {
  try {
    const k = "mk:hs:sid";
    let sid = sessionStorage.getItem(k);
    if (!sid) {
      sid = (crypto as any)?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(k, sid!);
    }
    return sid!;
  } catch {
    return `s_${Date.now()}`;
  }
}

function pushDataLayer(event: string, payload: Record<string, unknown>) {
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event, ...payload });
  } catch {
    /* no-op */
  }
}

async function persist(kind: "impression" | "click", p: ShowcasePayload) {
  try {
    await (supabase as any).from("home_showcase_events").insert({
      kind,
      product_id: p.productId,
      variant: p.variant,
      locale: p.locale ?? null,
      country_code: p.countryCode ?? null,
      session_id: getSessionId(),
      delta_pct: p.deltaPct ?? null,
      offer_count: p.offerCount ?? null,
    });
  } catch {
    /* best-effort, never block UI */
  }
}

export function trackShowcaseImpression(p: ShowcasePayload) {
  if (typeof window === "undefined") return;
  const dedupeKey = `${IMPRESSION_SESSION_PREFIX}${p.productId ?? "none"}:${p.variant}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    /* ignore quota errors, still fire */
  }
  pushDataLayer("home_price_delta_impression", {
    productId: p.productId,
    productSlug: p.productSlug,
    variant: p.variant,
    deltaPct: p.deltaPct,
    offerCount: p.offerCount,
  });
  void persist("impression", p);
}

export function trackShowcaseClick(p: ShowcasePayload) {
  pushDataLayer("home_price_delta_click", {
    productId: p.productId,
    productSlug: p.productSlug,
    variant: p.variant,
    deltaPct: p.deltaPct,
    offerCount: p.offerCount,
  });
  void persist("click", p);
}
