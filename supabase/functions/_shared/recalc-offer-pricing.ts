// Pure recalculation logic for Qogita-backed offers.
// Extracted so it can be unit-tested without a live database.
//
// Contract:
//  - Offer must be Qogita-backed and active (filtered by caller).
//  - Skip if no positive base price -> reason "no_base".
//  - Skip if price_stale === true       -> reason "stale".
//  - Otherwise compute new price / margin using the first matching rule,
//    falling back to `defaultMarginPct` (typically 25%).

export interface MarginRule {
  id: string;
  category_id?: string | null;
  brand_id?: string | null;
  vendor_id?: string | null;
  min_base_price?: number | null;
  max_base_price?: number | null;
  margin_percentage: number;
  extra_delay_days: number;
  round_price_to: number;
}

export interface OfferForRecalc {
  id: string;
  vendor_id?: string | null;
  qogita_base_price: number | null;
  qogita_base_delay_days?: number | null;
  vat_rate: number;
  price_stale?: boolean | null;
  price_tiers?: Array<{ qogita_base_price?: number; price_excl_vat?: number; [k: string]: unknown }> | null;
  products?: { category_id?: string | null; brand_id?: string | null } | null;
}

export interface RecalcResult {
  action: "updated" | "skipped_stale" | "skipped_no_base";
  patch?: {
    price_excl_vat: number;
    price_incl_vat: number;
    margin_amount: number;
    applied_margin_rule_id: string | null;
    applied_margin_percentage: number;
    delivery_days: number;
    price_tiers: OfferForRecalc["price_tiers"];
  };
}

export function recalcOfferPricing(
  offer: OfferForRecalc,
  rules: MarginRule[],
  defaultMarginPct: number,
): RecalcResult {
  const base = Number(offer.qogita_base_price);
  if (!offer.qogita_base_price || !(base > 0)) {
    return { action: "skipped_no_base" };
  }
  if (offer.price_stale === true) {
    return { action: "skipped_stale" };
  }

  const product = offer.products ?? null;
  let marginPct = defaultMarginPct;
  let extraDelay = 2;
  let roundTo = 0.01;
  let matchedRuleId: string | null = null;

  for (const rule of rules) {
    const matchCat = !rule.category_id || rule.category_id === product?.category_id;
    const matchBrand = !rule.brand_id || rule.brand_id === product?.brand_id;
    const matchVendor = !rule.vendor_id || rule.vendor_id === offer.vendor_id;
    const matchMin = rule.min_base_price == null || base >= Number(rule.min_base_price);
    const matchMax = rule.max_base_price == null || base <= Number(rule.max_base_price);
    if (matchCat && matchBrand && matchVendor && matchMin && matchMax) {
      marginPct = Number(rule.margin_percentage);
      extraDelay = rule.extra_delay_days;
      roundTo = Number(rule.round_price_to);
      matchedRuleId = rule.id;
      break;
    }
  }

  const priceExclVat = Math.round((base * (1 + marginPct / 100)) / roundTo) * roundTo;
  const priceInclVat = Math.round(priceExclVat * (1 + Number(offer.vat_rate) / 100) * 100) / 100;
  const marginAmount = priceExclVat - base;
  const deliveryDays = (offer.qogita_base_delay_days || 3) + extraDelay;

  let priceTiers = offer.price_tiers ?? null;
  if (priceTiers && Array.isArray(priceTiers)) {
    priceTiers = priceTiers.map((t) => ({
      ...t,
      price_excl_vat: t.qogita_base_price
        ? Math.round((Number(t.qogita_base_price) * (1 + marginPct / 100)) / roundTo) * roundTo
        : t.price_excl_vat,
    }));
  }

  return {
    action: "updated",
    patch: {
      price_excl_vat: priceExclVat,
      price_incl_vat: priceInclVat,
      margin_amount: marginAmount,
      applied_margin_rule_id: matchedRuleId,
      applied_margin_percentage: marginPct,
      delivery_days: deliveryDays,
      price_tiers: priceTiers,
    },
  };
}
