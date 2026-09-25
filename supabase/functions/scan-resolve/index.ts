import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { parseCode } from "./parse.ts";
import { computeVerdict, resolveDiscountPct, round2 } from "./pricing.ts";
import { getVendorPublicName, sanitizeVendorLabel } from "../_shared/vendor-display.ts";

const TEST_SCOPE = /(^nan\b|nancare|nestl|nutricia|nutrilon|fortimel|fresubin|fresenius)/i;

const Body = z.object({
  raw_code: z.string().min(1).max(512),
  symbology: z.enum(["ean13", "datamatrix", "manual_cnk", "other"]),
  session_id: z.string().uuid().optional().nullable(),
  mode: z.enum(["single", "burst"]).default("single"),
  client_decode_ms: z.number().int().min(0).max(60000).optional().nullable(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const t0 = performance.now();

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const input = parsed.data;

  // Officine : propriétaire direct ou membre actif
  const [{ data: own }, { data: mem }, { data: cfg }] = await Promise.all([
    admin.from("customers").select("id, scan_enabled, country_code, buyer_profile_id, is_test").eq("auth_user_id", userId).limit(1),
    admin.from("account_memberships").select("account_id").eq("user_id", userId).eq("account_kind", "buyer").eq("status", "active").limit(1),
    admin.from("site_config").select("scan_enabled").eq("id", 1).maybeSingle(),
  ]);
  let customer = own?.[0] ?? null;
  if (!customer && mem?.[0]) {
    const { data } = await admin.from("customers").select("id, scan_enabled, country_code, buyer_profile_id, is_test").eq("id", mem[0].account_id).maybeSingle();
    customer = data;
  }
  if (!customer) return json({ error: "no_pharmacy_account" }, 403);
  if (!cfg?.scan_enabled || !customer.scan_enabled) return json({ error: "scan_disabled" }, 403);

  const code = parseCode(input.raw_code, input.symbology);

  // Résolution produit : GTIN → product_market_codes → CNK normalisé
  const cols = "id, name, pack_size, cnk_code, gtin, image_url, brand_id, brand_name, category_id, primary_category_id";
  let candidates: any[] = [];
  let matchedCode: { packaging_level: "unit" | "pack" | "carton" | "unknown"; units_per_pack: number } | null = null;
  // Normalisation unique côté base : public.normalize_gtin (suffixe .0/,0 retiré,
  // chiffres seuls, zéros de tête retirés) appliquée à products.gtin ET product_market_codes.
  const lookup = code.cnk;
  const v = code.gtin ?? code.cnk;
  if (v) {
    const { data: hits } = await admin.rpc("scan_find_products_by_code", { _code: v });
    const rows = (hits ?? []) as Array<{ product_id: string; origin: string; packaging_level: string | null; units_per_pack: number | null }>;
    const gtinHits = rows.filter((r) => r.origin === "gtin");
    const useRows = gtinHits.length ? gtinHits : rows.filter((r) => r.origin === "market_code");
    const ids = Array.from(new Set(useRows.map((r) => r.product_id)));
    if (ids.length) {
      const { data } = await admin.from("products").select(cols).in("id", ids).eq("is_active", true);
      candidates = data ?? [];
      if (candidates.length) {
        if (gtinHits.length) {
          const units = Math.max(1, Number(candidates[0]?.pack_size ?? 1));
          matchedCode = { packaging_level: units > 1 ? "pack" : "unit", units_per_pack: units };
        } else {
          const codeRow = useRows.find((r) => candidates.some((c) => c.id === r.product_id));
          if (codeRow) matchedCode = {
            packaging_level: (codeRow.packaging_level ?? "unknown") as any,
            units_per_pack: Math.max(1, Number(codeRow.units_per_pack ?? 1)),
          };
        }
      }
    }
  }
  if (!candidates.length && lookup) {
    // CNK stocké en « 4761-839 » ou « 4761839 »
    const dashed = `${lookup.slice(0, 4)}-${lookup.slice(4)}`;
    const { data } = await admin.from("products").select(cols).in("cnk_code", [lookup, dashed]).eq("is_active", true);
    candidates = data ?? [];
  }

  const country = customer.country_code ?? "BE";
  let offers: any[] = [];
  if (candidates.length) {
    const { data } = await admin.rpc("get_best_offers_for_products", {
      _product_ids: candidates.map((c) => c.id), _country: country, _buyer_profile_id: customer.buyer_profile_id ?? null,
    });
    offers = data ?? [];
  }
  const bestByProduct = new Map<string, any>();
  for (const o of offers) {
    const cur = bestByProduct.get(o.product_id);
    if (!cur || Number(o.effective_price_excl_vat) < Number(cur.effective_price_excl_vat)) bestByProduct.set(o.product_id, o);
  }
  let product = candidates[0] ?? null;
  if (candidates.length > 1) {
    const withOffer = candidates.filter((c) => bestByProduct.has(c.id))
      .sort((a, b) => Number(bestByProduct.get(a.id).effective_price_excl_vat) - Number(bestByProduct.get(b.id).effective_price_excl_vat));
    product = withOffer[0] ?? candidates[0];
  }
  const best = product ? bestByProduct.get(product.id) ?? null : null;
  const matchStatus = !product ? "not_found" : candidates.length > 1 ? "ambiguous_match" : "matched";

  // Prix de référence pharmacien (service_role, jamais renvoyé au-delà du résultat)
  const references: any[] = [];
  let refMin: number | null = null;
  let refSource = "none";
  let hideDetail = false;
  if (product) {
    const { data: declared } = await admin.from("pharmacy_product_declared_prices")
      .select("price_excl_vat_cents, supplier_name")
      .eq("customer_id", customer.id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (declared?.price_excl_vat_cents) {
      refMin = round2(Number(declared.price_excl_vat_cents) / 100);
      refSource = "DECLARED";
      references.push({ source: "DECLARED", label: `Prix déclaré · ${declared.supplier_name}`, discount_pct: null, net: refMin, _allowed: true });
    }
    const { data: settings } = await admin.from("pharmacist_wholesaler_settings")
      .select("wholesaler_profile_id, override_default_discount_pct, override_rules_json, is_supplier_of_pharmacist")
      .eq("customer_id", customer.id);
    const active = (settings ?? []).filter((s) => s.is_supplier_of_pharmacist !== false);
    if (active.length) {
      const wpIds = active.map((s) => s.wholesaler_profile_id);
      const [{ data: wps }, { data: sourcesAll }] = await Promise.all([
        admin.from("wholesaler_profiles").select("id, slug, display_name, default_discount_pct, display_prices_allowed").in("id", wpIds),
        admin.from("market_price_sources").select("id, wholesaler_profile_id, is_test").in("wholesaler_profile_id", wpIds),
      ]);
      // Sources de test : visibles uniquement pour les comptes de test
      const sources = (sourcesAll ?? []).filter((s: any) => !s.is_test || customer.is_test === true);
      const srcIds = sources.map((s) => s.id);
      const { data: prices } = srcIds.length
        ? await admin.from("market_prices").select("source_id, prix_grossiste, prix_pharmacien, period, imported_at")
            .eq("product_id", product.id).in("source_id", srcIds)
            .order("period", { ascending: false, nullsFirst: false }).order("imported_at", { ascending: false })
        : { data: [] as any[] };
      for (const s of active) {
        const wp = (wps ?? []).find((w) => w.id === s.wholesaler_profile_id);
        const src = (sources ?? []).filter((x) => x.wholesaler_profile_id === s.wholesaler_profile_id).map((x) => x.id);
        const row = (prices ?? []).find((p) => src.includes(p.source_id));
        const gross = Number(row?.prix_pharmacien ?? row?.prix_grossiste ?? 0);
        if (!wp || !gross) continue;
        const pct = resolveDiscountPct({
          rules: s.override_rules_json as any, overrideDefaultPct: s.override_default_discount_pct,
          wholesalerDefaultPct: wp.default_discount_pct, brandId: product.brand_id,
          categoryIds: [product.primary_category_id, product.category_id],
        });
        const net = round2(gross * (1 - pct / 100));
        if (!wp.display_prices_allowed) hideDetail = true;
        references.push({ source: (wp.slug ?? "").toUpperCase(), label: wp.display_name, discount_pct: pct, net, _allowed: wp.display_prices_allowed });
        if (refSource !== "DECLARED" && (refMin == null || net < refMin)) { refMin = net; refSource = (wp.slug ?? "").toUpperCase(); }
      }
    }
  }

  const bestPrice = best ? round2(Number(best.effective_price_excl_vat)) : null;
  const { verdict, delta } = computeVerdict(refMin, bestPrice);
  const result = !product ? "unknown" : best ? "offer" : "known_no_offer";
  const inScope = !!product && TEST_SCOPE.test(`${product.brand_name ?? ""} ${product.name ?? ""}`);
  const latency = Math.round(performance.now() - t0);

  const { data: ev, error: evErr } = await admin.from("scan_events").insert({
    session_id: input.session_id ?? null, customer_id: customer.id, user_id: userId,
    symbology: input.symbology, raw_code: code.sanitized_raw, gtin: code.gtin ?? product?.gtin ?? null,
    cnk: code.cnk ?? product?.cnk_code ?? null, lot: code.lot, expiry_date: code.expiry_date,
    product_id: product?.id ?? null, match_status: matchStatus,
    candidate_product_ids: candidates.length > 1 ? candidates.map((c) => c.id) : [],
    in_test_scope: inScope, result, best_offer_id: best?.offer_id ?? null, best_price_excl_vat: bestPrice,
    ref_price_excl_vat: refMin, ref_source: refSource, delta_excl_vat: delta, verdict, latency_ms: latency, client_decode_ms: input.client_decode_ms ?? null,
  }).select("id").single();
  if (evErr) return json({ error: "log_failed", detail: evErr.message }, 500);

  // Produit inconnu (GTIN puis CNK) ou connu sans offre (id produit) → item de sourcing dédoublonné
  const sourcingArgs = result === "unknown" && (code.gtin || code.cnk)
    ? { _dedupe_key: code.gtin ? `gtin:${code.gtin}` : `cnk:${code.cnk}`, _product_id: null, _brand_id: null,
        _gtin: code.gtin ?? null, _cnk: code.cnk ?? null, _status: "unmatched" }
    : result === "known_no_offer" && product
    ? { _dedupe_key: product.id, _product_id: product.id, _brand_id: product.brand_id ?? null,
        _gtin: code.gtin ?? product.gtin ?? null, _cnk: code.cnk ?? product.cnk_code ?? null, _status: "no_active_offer" }
    : null;
  if (sourcingArgs) {
    const { error: sErr } = await admin.rpc("upsert_sourcing_item", {
      ...sourcingArgs, _raw_name: null, _raw_brand: null, _user_id: userId,
      _quantity: null, _buyer_price_cents: null,
    });
    if (sErr) console.error("sourcing upsert failed", sErr.message);
    else {
      const { error: aErr } = await admin.from("scan_events").update({ action: "sourcing_request" }).eq("id", ev.id);
      if (aErr) console.error("scan action update failed", aErr.message);
    }
  }

  const vendorLabel = best
    ? best.vendor_show_real_name_resolved
      ? sanitizeVendorLabel(best.vendor_company_name || best.vendor_name, best.vendor_display_code)
      : getVendorPublicName({ display_code: best.vendor_display_code })
    : null;

  return json({
    scan_event_id: ev.id,
    match_status: matchStatus,
    candidates: candidates.length > 1 ? candidates.map((c) => ({ id: c.id, name: c.name })) : [],
    product: product ? { id: product.id, name: product.name, pack: product.pack_size, cnk: product.cnk_code, image: product.image_url } : null,
    scanned_packaging: matchedCode,
    lot: code.lot, expiry_date: code.expiry_date, verdict, delta,
    best: best ? { price: bestPrice, vendor_label: vendorLabel, vendor_id: best.vendor_id, franco: null, lead_time_days: best.delivery_days ?? null, offer_id: best.offer_id, stock_quantity: best.stock_quantity ?? null } : null,
    references: hideDetail ? [] : references.map(({ _allowed, ...r }) => r),
    best_reference_price: refMin,
    stock_signals: [],
    in_test_scope: inScope,
    latency_ms: latency,
  });
});
