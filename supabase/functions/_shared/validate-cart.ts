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
    | "invalid_quantity"
    | "price_stale";
  item_index: number | null;
  vendor_name: string | null;
  offer_id?: string | null;
  details: Record<string, unknown>;
}

// Qogita API offers has been down since ~mid-July 2026. Any Qogita-backed offer
// not verified since more than STALE_THRESHOLD_DAYS is considered unsafe for
// checkout (reveal-at-purchase price integrity).
const QOGITA_STALE_THRESHOLD_DAYS = 7;

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
  // Optional: when provided, allows resolving per-buyer overrides on top of the cascade.
  buyerAccountId?: string | null,
  // Optional: buyer profile + country, used to resolve vendor_profile_defaults.
  buyerContext?: { customer_type?: string | null; country_code?: string | null } | null,
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
      "id, vendor_id, product_id, price_excl_vat, price_incl_vat, stock_quantity, moq, mov, is_active, vat_rate, is_qogita_backed, price_stale, last_verified_at, price_source, qogita_base_price, vendors:vendor_id(name, slug, company_name, show_real_name, display_code)",
    )
    .in("id", offerIds);

  if (offerErr) throw new Error(`offers_fetch_failed: ${offerErr.message}`);

  const offerMap = new Map<string, any>((offers || []).map((o: any) => [o.id, o]));

  const staleCutoffMs = Date.now() - QOGITA_STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

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

    // 🔒 Checkout guard : bloque toute offre Qogita dont le prix n'a pas été
    // re-vérifié depuis plus de 7 jours. Sans ça on vendrait à un prix figé
    // au 10/07/2026, avant retrait de l'API. Cohérent avec reveal-at-purchase.
    const lastVerifiedMs = offer.last_verified_at ? Date.parse(offer.last_verified_at) : null;
    // 🛑 Prix d'achat corrompu par le bug de mapping (le nombre d'unités par
    // colis, `unit = 1`, écrit dans le champ prix → 1,00 € d'achat / 1,25 € de
    // vente). Aucune vente possible tant que l'offre n'a pas été re-vérifiée
    // avec le mapping corrigé.
    const corruptedBasePrice =
      offer.price_source === "qogita_api" && Number(offer.qogita_base_price) === 1;
    const isStale =
      offer.price_stale === true ||
      corruptedBasePrice ||
      (offer.is_qogita_backed === true &&
        (lastVerifiedMs == null || lastVerifiedMs < staleCutoffMs));
    if (isStale) {
      errors.push({
        type: "price_stale",
        item_index: idx,
        vendor_name: null,
        offer_id: offer.id,
        details: {
          offer_id: offer.id,
          reason: corruptedBasePrice ? "purchase_price_mapping_invalid" : "qogita_source_unhealthy",
          last_verified_at: offer.last_verified_at,
        },
      });
      continue;
    }


    const v = offer.vendors || {};
    // 🔒 GARDE-FOU : toujours anonymisé côté edge — show_real_name ignoré.
    const vendorName: string = `Fournisseur ${v.display_code || offer.vendor_id.slice(0, 6).toUpperCase()}`;

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

  // Per-buyer overrides (vendor × buyer_account) — highest priority for MOV
  const vendorIdsInCart = [...byVendor.keys()];
  let buyerOverrides: Record<string, { mov: number | null }> = {};
  if (buyerAccountId && vendorIdsInCart.length > 0) {
    const { data: ovs } = await supabase
      .from("vendor_buyer_overrides")
      .select("vendor_id, default_mov")
      .eq("buyer_account_id", buyerAccountId)
      .eq("is_active", true)
      .in("vendor_id", vendorIdsInCart);
    for (const o of (ovs || []) as any[]) {
      buyerOverrides[o.vendor_id] = { mov: o.default_mov != null ? Number(o.default_mov) : null };
    }
  }

  // Vendor types — distinguishes real vendors (which honor vendor_profile_defaults)
  // from Qogita/virtual vendors (which keep the global DEFAULT_MEDIKONG_MOV floor).
  let vendorTypeMap: Record<string, string> = {};
  if (vendorIdsInCart.length > 0) {
    const { data: vrows } = await supabase
      .from("vendors")
      .select("id, type")
      .in("id", vendorIdsInCart);
    for (const v of (vrows || []) as any[]) vendorTypeMap[v.id] = v.type;
  }

  // vendor_profile_defaults — per-vendor MOV cascade (profile + country)
  const realVendorIds = vendorIdsInCart.filter((id) => vendorTypeMap[id] === "real");
  let vendorDefaults: any[] = [];
  if (realVendorIds.length > 0) {
    const { data: vd } = await supabase
      .from("vendor_profile_defaults")
      .select("vendor_id, profile_type, country_code, default_mov")
      .in("vendor_id", realVendorIds);
    vendorDefaults = (vd || []) as any[];
  }

  // Global admin fallback MOV (cents → EUR). Used only when no vendor rule applies.
  // Vendor-defined values (overrides, profile_defaults, offers.mov) always win over this.
  let globalFallbackMov = 0;
  {
    const { data: gRow } = await supabase
      .from("admin_settings")
      .select("value_json")
      .eq("key", "global_default_mov_cents")
      .maybeSingle();
    const cents = gRow?.value_json;
    if (cents != null && Number.isFinite(Number(cents)) && Number(cents) > 0) {
      globalFallbackMov = Number(cents) / 100;
    }
  }


  const profileType = buyerContext?.customer_type || "pharmacy";
  const countryCode = buyerContext?.country_code || "BE";

  const resolveVendorProfileMov = (vendorId: string): number | null => {
    if (vendorDefaults.length === 0) return null;
    const exact = vendorDefaults.find(
      (d) => d.vendor_id === vendorId && d.profile_type === profileType && d.country_code === countryCode,
    );
    if (exact) return Number(exact.default_mov) || 0;
    const byProfile = vendorDefaults.find((d) => d.vendor_id === vendorId && d.profile_type === profileType);
    if (byProfile) return Number(byProfile.default_mov) || 0;
    const byCountry = vendorDefaults.find((d) => d.vendor_id === vendorId && d.country_code === countryCode);
    if (byCountry) return Number(byCountry.default_mov) || 0;
    const any = vendorDefaults.find((d) => d.vendor_id === vendorId);
    if (any) return Number(any.default_mov) || 0;
    return null;
  };

  const vendors: VendorSummary[] = [];
  for (const [vendorId, agg] of byVendor) {
    // Resolution cascade (most → least specific):
    //   1. vendor_buyer_overrides (vendor × buyer)
    //   2. vendor_profile_defaults (vendor × profile × country) — real vendors only
    //   3. offer.mov (per-item, vendor-encoded)
    //   4. admin_settings.global_default_mov_cents (admin fallback) — real vendors only
    //   5. DEFAULT_MEDIKONG_MOV floor — Qogita/virtual vendors only
    const override = buyerOverrides[vendorId];
    const vendorProfileMov = vendorTypeMap[vendorId] === "real" ? resolveVendorProfileMov(vendorId) : null;
    let movRequired: number;
    if (override && override.mov != null) {
      movRequired = override.mov;
    } else if (vendorProfileMov != null) {
      // Real vendor with an explicit MOV setting → honor it as-is (no floor).
      movRequired = Math.max(vendorProfileMov, agg.movMax);
    } else if (vendorTypeMap[vendorId] === "real") {
      // Real vendor with no vendor-side setting → use offers.mov; if missing, fall back
      // to the admin global MOV. The vendor's own MOV (offers.mov) always wins when set.
      movRequired = agg.movMax > 0 ? agg.movMax : globalFallbackMov;
    } else {
      // Qogita / virtual vendors → keep historical 500€ floor.
      movRequired = Math.max(agg.movMax, DEFAULT_MEDIKONG_MOV);
    }
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
