// Shared cart validation logic — used by `validate-cart` and `stripe-checkout`.
// Keep this module pure (no Deno.serve, no CORS): only takes a Supabase client + items.

export const DEFAULT_MEDIKONG_MOV = 500; // €, fallback when offer.mov is null/0

export interface CartInputItem {
  offer_id: string;
  quantity: number;
}

export interface ValidationError {
  type:
    | "below_moq"
    | "exceeds_stock"
    | "offer_not_available"
    | "vendor_mov_not_reached"
    | "invalid_quantity";
  item_index: number | null;
  vendor_name: string | null;
  offer_id?: string | null;
  details: Record<string, unknown>;
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

export interface ValidateCartResult {
  valid: boolean;
  errors: ValidationError[];
  items: ValidatedItem[];
  vendors: VendorSummary[];
  totals: {
    subtotal_excl_vat: number;
    total_incl_vat: number;
    n_items: number;
    n_vendors: number;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function validateCart(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  items: CartInputItem[],
): Promise<ValidateCartResult> {
  const errors: ValidationError[] = [];
  const validated: ValidatedItem[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      errors: [{ type: "invalid_quantity", item_index: null, vendor_name: null, details: { reason: "empty_cart" } }],
      items: [],
      vendors: [],
      totals: { subtotal_excl_vat: 0, total_incl_vat: 0, n_items: 0, n_vendors: 0 },
    };
  }

  const offerIds = [...new Set(items.map((i) => i.offer_id).filter(Boolean))];
  const { data: offers, error: offerErr } = await supabase
    .from("offers")
    .select(
      "id, vendor_id, product_id, price_excl_vat, price_incl_vat, stock_quantity, moq, mov, is_active, vat_rate, vendors:vendor_id(name, slug, company_name, show_real_name, display_code)",
    )
    .in("id", offerIds);

  if (offerErr) throw new Error(`offers_fetch_failed: ${offerErr.message}`);

  const offerMap = new Map<string, any>((offers || []).map((o: any) => [o.id, o]));

  // Per-item validation + tier resolution
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const qty = Number(it.quantity);
    const offer = offerMap.get(it.offer_id);

    if (!offer || offer.is_active === false) {
      errors.push({
        type: "offer_not_available",
        item_index: idx,
        vendor_name: null,
        offer_id: it.offer_id,
        details: { offer_id: it.offer_id },
      });
      continue;
    }

    const v = offer.vendors || {};
    const vendorName: string = v.show_real_name === false
      ? `Fournisseur ${v.display_code || offer.vendor_id.slice(0, 6).toUpperCase()}`
      : (v.name || v.company_name || `Fournisseur ${offer.vendor_id.slice(0, 6).toUpperCase()}`);

    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push({
        type: "invalid_quantity",
        item_index: idx,
        vendor_name: vendorName,
        offer_id: offer.id,
        details: { quantity: it.quantity },
      });
      continue;
    }

    if (qty < (offer.moq || 1)) {
      errors.push({
        type: "below_moq",
        item_index: idx,
        vendor_name: vendorName,
        offer_id: offer.id,
        details: { current: qty, required: offer.moq || 1 },
      });
      continue;
    }

    if (offer.stock_quantity != null && qty > offer.stock_quantity) {
      errors.push({
        type: "exceeds_stock",
        item_index: idx,
        vendor_name: vendorName,
        offer_id: offer.id,
        details: { current: qty, available: offer.stock_quantity },
      });
      continue;
    }

    // Resolve tier price via SQL function
    const { data: tierData, error: tierErr } = await supabase.rpc(
      "calculate_offer_price_for_quantity",
      { p_offer_id: offer.id, p_quantity: qty },
    );
    if (tierErr) throw new Error(`tier_calc_failed: ${tierErr.message}`);

    const tier = Array.isArray(tierData) && tierData.length > 0 ? tierData[0] : null;
    const unitExcl = Number(tier?.price_excl_vat ?? offer.price_excl_vat);
    const unitIncl = Number(tier?.price_incl_vat ?? offer.price_incl_vat);
    const totalExcl = round2(qty * unitExcl);
    const totalIncl = round2(qty * unitIncl);

    validated.push({
      offer_id: offer.id,
      vendor_id: offer.vendor_id,
      vendor_name: vendorName,
      product_id: offer.product_id,
      quantity: qty,
      unit_price_excl_vat: unitExcl,
      unit_price_incl_vat: unitIncl,
      total_excl_vat: totalExcl,
      total_incl_vat: totalIncl,
      tier_index_applied: Number(tier?.tier_index ?? 0),
      mov_threshold_applied: Number(tier?.mov_threshold ?? 0),
      vat_rate: Number(offer.vat_rate ?? 21),
    });
  }

  // Vendor grouping + MOV check
  const byVendor = new Map<string, { name: string; subtotal: number; movMax: number }>();
  for (const v of validated) {
    const offer = offerMap.get(v.offer_id);
    const offerMov = offer?.mov != null ? Number(offer.mov) : 0;
    const cur = byVendor.get(v.vendor_id) || { name: v.vendor_name, subtotal: 0, movMax: 0 };
    cur.subtotal = round2(cur.subtotal + v.total_excl_vat);
    if (offerMov > cur.movMax) cur.movMax = offerMov;
    byVendor.set(v.vendor_id, cur);
  }

  const vendors: VendorSummary[] = [];
  for (const [vendorId, agg] of byVendor) {
    const movRequired = Math.max(agg.movMax, DEFAULT_MEDIKONG_MOV);
    const reached = agg.subtotal >= movRequired;
    const missing = reached ? 0 : round2(movRequired - agg.subtotal);
    vendors.push({
      vendor_id: vendorId,
      vendor_name: agg.name,
      subtotal_excl_vat: agg.subtotal,
      mov_required: movRequired,
      mov_reached: reached,
      amount_missing: missing,
    });
    if (!reached) {
      errors.push({
        type: "vendor_mov_not_reached",
        item_index: null,
        vendor_name: agg.name,
        details: {
          vendor_id: vendorId,
          vendor_name: agg.name,
          current: agg.subtotal,
          required: movRequired,
          missing,
        },
      });
    }
  }

  const subtotalExcl = round2(validated.reduce((s, v) => s + v.total_excl_vat, 0));
  const totalIncl = round2(validated.reduce((s, v) => s + v.total_incl_vat, 0));

  return {
    valid: errors.length === 0,
    errors,
    items: validated,
    vendors,
    totals: {
      subtotal_excl_vat: subtotalExcl,
      total_incl_vat: totalIncl,
      n_items: validated.length,
      n_vendors: vendors.length,
    },
  };
}
