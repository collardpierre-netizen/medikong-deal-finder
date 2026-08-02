import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ValidationError {
  type: "below_moq" | "exceeds_stock" | "offer_not_available" | "vendor_mov_not_reached" | "invalid_quantity" | "price_stale";
  item_index: number | null;
  vendor_name: string | null;
  offer_id?: string | null;
  details: Record<string, any>;
}
export interface ValidatedItem {
  offer_id: string;
  vendor_id: string;
  vendor_name: string;
  product_id: string;
  quantity: number;
  unit_price_excl_vat: number;
  unit_price_incl_vat: number;
  total_excl_vat: number;
  total_incl_vat: number;
  tier_index_applied: number;
  mov_threshold_applied: number;
  vat_rate: number;
}
export interface VendorSummary {
  vendor_id: string;
  vendor_name: string;
  subtotal_excl_vat: number;
  mov_required: number;
  mov_reached: boolean;
  amount_missing: number;
}
export interface ValidateCartResponse {
  valid: boolean;
  errors: ValidationError[];
  items: ValidatedItem[];
  vendors: VendorSummary[];
  totals: { subtotal_excl_vat: number; total_incl_vat: number; n_items: number; n_vendors: number };
}

export interface ValidateCartItemInput { offer_id: string; quantity: number }

/** Calls the `validate-cart` edge function with debouncing. */
export function useCartValidation(items: ValidateCartItemInput[], opts: { debounceMs?: number; enabled?: boolean } = {}) {
  const { debounceMs = 350, enabled = true } = opts;
  const [data, setData] = useState<ValidateCartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const reqIdRef = useRef(0);

  // L'edge function validate-cart exige un Authorization Bearer.
  // On évite l'appel (et donc le 401) quand l'utilisateur n'est pas connecté.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setHasSession(!!session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Stable signature to trigger refetches
  const sig = useMemo(
    () => JSON.stringify(items.map(i => [i.offer_id, i.quantity]).sort()),
    [items],
  );

  useEffect(() => {
    if (!enabled || items.length === 0 || !hasSession) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const myReq = ++reqIdRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: res, error: err } = await supabase.functions.invoke("validate-cart", {
          body: { items: items.map(i => ({ offer_id: i.offer_id, quantity: i.quantity })) },
        });
        if (myReq !== reqIdRef.current) return;
        if (err) throw err;
        setData(res as ValidateCartResponse);
      } catch (e: any) {
        if (myReq !== reqIdRef.current) return;
        setError(e?.message || "validation_failed");
        setData(null);
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled, debounceMs, hasSession]);

  return { data, loading, error };
}

/** One-shot synchronous wrapper used at checkout time. */
export async function validateCartNow(items: ValidateCartItemInput[]): Promise<ValidateCartResponse> {
  const { data, error } = await supabase.functions.invoke("validate-cart", {
    body: { items: items.map(i => ({ offer_id: i.offer_id, quantity: i.quantity })) },
  });
  if (error) throw error;
  return data as ValidateCartResponse;
}

export interface RevalidateStaleOffersResponse {
  ok: boolean;
  triggered: boolean;
  reason?: string;
  products_targeted?: number;
  products_on_cooldown?: number;
  revalidated: string[];
  still_stale: string[];
  should_revalidate_cart?: boolean;
}

/**
 * Relance une vérification ciblée du prix fournisseur sur les offres bloquées
 * par le garde-fou `price_stale`. À appeler juste avant la tentative de commande.
 */
export async function revalidateStaleOffers(offerIds: string[]): Promise<RevalidateStaleOffersResponse> {
  const ids = [...new Set(offerIds.filter(Boolean))];
  if (ids.length === 0) {
    return { ok: true, triggered: false, reason: "no_offer_ids", revalidated: [], still_stale: [] };
  }
  const { data, error } = await supabase.functions.invoke("revalidate-stale-offers", {
    body: { offer_ids: ids },
  });
  if (error) throw error;
  return data as RevalidateStaleOffersResponse;
}

export interface JitVerifyResult {
  offer_id: string;
  product_id: string | null;
  status: "fresh" | "confirmed" | "price_changed" | "switch_vendor" | "unavailable" | "still_stale";
  resolved_offer_id?: string;
  previous_price_excl_vat?: number | null;
  price_excl_vat?: number | null;
  price_incl_vat?: number | null;
  stock_quantity?: number | null;
  moq?: number | null;
  vendor_label?: string | null;
  last_verified_at?: string | null;
  alternative?: {
    offer_id: string;
    price_excl_vat: number;
    price_incl_vat: number | null;
    stock_quantity: number | null;
    moq: number | null;
    vendor_label: string | null;
  } | null;
}

export interface JitVerifyResponse {
  ok: boolean;
  triggered: boolean;
  reason?: string;
  products_targeted?: number;
  products_cached?: number;
  unblocked?: number;
  should_revalidate_cart?: boolean;
  results: JitVerifyResult[];
}

/**
 * Vérification just-in-time des offres fournisseur (prix / stock / paliers)
 * au point de vente : le garde-fou `price_stale` n'est pas contourné, on
 * déclenche la vérification pour qu'il passe légitimement.
 */
export async function verifyOffersJit(offerIds: string[]): Promise<JitVerifyResponse> {
  const ids = [...new Set(offerIds.filter(Boolean))].slice(0, 25);
  if (ids.length === 0) return { ok: true, triggered: false, reason: "no_offer_ids", results: [] };
  const { data, error } = await supabase.functions.invoke("verify-offer-jit", {
    body: { offer_ids: ids },
  });
  if (error) throw error;
  return data as JitVerifyResponse;
}

