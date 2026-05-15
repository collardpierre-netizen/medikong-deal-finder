import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ValidationError {
  type: "below_moq" | "exceeds_stock" | "offer_not_available" | "vendor_mov_not_reached" | "invalid_quantity";
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
  const reqIdRef = useRef(0);

  // Stable signature to trigger refetches
  const sig = useMemo(
    () => JSON.stringify(items.map(i => [i.offer_id, i.quantity]).sort()),
    [items],
  );

  useEffect(() => {
    if (!enabled || items.length === 0) {
      setData(null);
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
  }, [sig, enabled, debounceMs]);

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
