// ─────────────────────────────────────────────────────────────────────────────
// Vérification JUST-IN-TIME d'une offre fournisseur au point de vente.
//
// Contexte : la majorité des offres multi-vendeurs recréées ont
// `last_verified_at = NULL` → le garde-fou checkout les bloque (correct : on ne
// vend jamais sur un prix non vérifié). Plutôt que d'attendre le sync de fond
// (plusieurs jours), on vérifie À LA DEMANDE le produit concerné.
//
// Le garde-fou n'est PAS contourné : on déclenche la vérification pour qu'il
// passe légitimement (last_verified_at = now(), prix/stock/paliers réécrits par
// `sync-qogita-offers-api`, seule source d'écriture, en service role).
//
// Après vérification, on ré-apparie l'offre sélectionnée par `qogita_seller_fid` :
//   - même prix        → status "confirmed"      (déblocage)
//   - prix différent   → status "price_changed"  (nouveau prix, marge 25% recalculée en amont)
//   - offre disparue   → status "unavailable" + meilleure alternative vérifiée du produit
//
// Anti-abus / perf :
//   - JWT acheteur obligatoire
//   - max 25 offres par appel
//   - cache court : un produit probé il y a moins de VERIFY_TTL_MS n'est pas re-probé
//   - le débit API et le Retry-After sont mutualisés avec le sync de fond
//     (c'est lui qui exécute les appels HTTP Qogita)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Doit rester aligné sur QOGITA_STALE_THRESHOLD_DAYS de _shared/validate-cart.ts
const STALE_THRESHOLD_DAYS = 7;
const MAX_OFFERS = 25;
// Cache court : une vérification vaut pour 5 minutes (anti-martèlement).
const VERIFY_TTL_MS = 5 * 60 * 1000;
const PRICE_EPSILON = 0.005;

type OfferRow = {
  id: string;
  product_id: string | null;
  vendor_id: string;
  price_excl_vat: number | null;
  price_incl_vat: number | null;
  stock_quantity: number | null;
  moq: number | null;
  is_active: boolean | null;
  is_qogita_backed: boolean | null;
  price_stale: boolean | null;
  last_verified_at: string | null;
  qogita_seller_fid: string | null;
};

const OFFER_COLS =
  "id, product_id, vendor_id, price_excl_vat, price_incl_vat, stock_quantity, moq, is_active, is_qogita_backed, price_stale, last_verified_at, qogita_seller_fid";

const isStale = (o: OfferRow, cutoffMs: number) => {
  if (o.price_stale === true) return true;
  if (o.is_qogita_backed !== true) return false;
  const ms = o.last_verified_at ? Date.parse(o.last_verified_at) : null;
  return ms == null || Number.isNaN(ms) || ms < cutoffMs;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth acheteur ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rawIds = Array.isArray(body.offer_ids)
    ? body.offer_ids
    : typeof body.offer_id === "string"
      ? [body.offer_id]
      : [];
  const offerIds = [...new Set(rawIds.filter((v): v is string => typeof v === "string" && v.length > 0))].slice(0, MAX_OFFERS);

  if (offerIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, triggered: false, reason: "no_offer_ids", results: [] }), { headers: corsHeaders });
  }

  const admin = createClient(url, serviceKey);
  const cutoffMs = () => Date.now() - STALE_THRESHOLD_DAYS * 24 * 3600 * 1000;

  const { data: before, error: offErr } = await admin.from("offers").select(OFFER_COLS).in("id", offerIds);
  if (offErr) {
    return new Response(JSON.stringify({ error: "offers_fetch_failed", details: offErr.message }), { status: 500, headers: corsHeaders });
  }

  const beforeRows = (before || []) as OfferRow[];
  const staleOffers = beforeRows.filter((o) => isStale(o, cutoffMs()));

  // Offres déjà fraîches : rien à faire.
  const results: Record<string, unknown>[] = beforeRows
    .filter((o) => !staleOffers.some((s) => s.id === o.id))
    .map((o) => ({
      offer_id: o.id,
      product_id: o.product_id,
      status: "fresh",
      price_excl_vat: o.price_excl_vat,
      last_verified_at: o.last_verified_at,
    }));

  if (staleOffers.length === 0) {
    return new Response(JSON.stringify({ ok: true, triggered: false, reason: "nothing_stale", results, should_revalidate_cart: false }), { headers: corsHeaders });
  }

  const productIds = [...new Set(staleOffers.map((o) => o.product_id).filter((v): v is string => !!v))];

  // ── Cache court : produit déjà probé il y a moins de VERIFY_TTL_MS ───────
  const { data: prodRows } = await admin
    .from("products")
    .select("id, mv_last_probed_at, qogita_fid")
    .in("id", productIds);

  const ttlCut = Date.now() - VERIFY_TTL_MS;
  const targets: string[] = [];
  const cachedProducts: string[] = [];
  for (const p of (prodRows || []) as any[]) {
    if (!p.qogita_fid) continue;
    const ms = p.mv_last_probed_at ? Date.parse(p.mv_last_probed_at) : null;
    if (ms != null && !Number.isNaN(ms) && ms >= ttlCut) cachedProducts.push(p.id);
    else targets.push(p.id);
  }

  let syncStatus: number | null = null;
  let syncError: string | null = null;

  // 🛑 GEL : si les écritures de prix sont gelées, on ne déclenche AUCUNE
  // vérification (le garde-fou price_stale reste actif → commande bloquée).
  const { data: freezeRow } = await admin
    .from("qogita_config").select("value").eq("key", "price_writes_enabled").maybeSingle();
  const frozen = String(freezeRow?.value ?? "true").toLowerCase() === "false";
  if (frozen) {
    return new Response(JSON.stringify({
      ok: true,
      triggered: false,
      frozen: true,
      reason: "price_writes_frozen",
      should_revalidate_cart: false,
      results,
    }), { headers: corsHeaders });
  }

  if (targets.length > 0) {

    try {
      // Le sync de fond exécute l'appel /buyers/variants/{fid}/offers/ :
      // limiteur de débit + Retry-After mutualisés, écriture en service role.
      const res = await fetch(`${url}/functions/v1/sync-qogita-offers-api`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: targets,
          limit: targets.length,
          concurrency: 2,
          rps: 2,
          walltimeMs: 25_000,
          fallback: true,
        }),
      });
      syncStatus = res.status;
      await res.text().catch(() => "");
      if (!res.ok) syncError = `sync_http_${res.status}`;
    } catch (e) {
      syncError = (e as Error).message;
    }
  }

  // ── Ré-appariement après vérification ────────────────────────────────────
  const { data: afterRows } = await admin
    .from("offers")
    .select(OFFER_COLS)
    .in("product_id", productIds)
    .eq("is_active", true);

  const after = (afterRows || []) as OfferRow[];
  const afterById = new Map(after.map((o) => [o.id, o]));

  // Étiquette vendeur anonymisée (jamais le vrai nom côté edge).
  const vendorIds = [...new Set(after.map((o) => o.vendor_id))];
  const labelMap = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vrows } = await admin.from("vendors").select("id, display_code").in("id", vendorIds);
    for (const v of (vrows || []) as any[]) {
      labelMap.set(v.id, `Fournisseur ${v.display_code || String(v.id).slice(0, 6).toUpperCase()}`);
    }
  }

  let unblocked = 0;

  for (const o of staleOffers) {
    const cut = cutoffMs();
    // 1) même ligne d'offre
    let match = afterById.get(o.id) || null;
    // 2) sinon ré-appariement par vendeur Qogita (offre recréée)
    if ((!match || isStale(match, cut)) && o.qogita_seller_fid) {
      const bySeller = after.find(
        (x) => x.product_id === o.product_id && x.qogita_seller_fid === o.qogita_seller_fid && !isStale(x, cut),
      );
      if (bySeller) match = bySeller;
    }

    const stillStale = !match || isStale(match, cut);
    const hasStock = !!match && (match.stock_quantity == null || Number(match.stock_quantity) > 0);

    if (!stillStale && hasStock) {
      const oldPrice = o.price_excl_vat != null ? Number(o.price_excl_vat) : null;
      const newPrice = match!.price_excl_vat != null ? Number(match!.price_excl_vat) : null;
      const changed =
        oldPrice == null || newPrice == null || Math.abs(newPrice - oldPrice) > PRICE_EPSILON;
      unblocked += 1;
      results.push({
        offer_id: o.id,
        product_id: o.product_id,
        status: changed ? "price_changed" : "confirmed",
        resolved_offer_id: match!.id,
        previous_price_excl_vat: oldPrice,
        price_excl_vat: newPrice,
        price_incl_vat: match!.price_incl_vat != null ? Number(match!.price_incl_vat) : null,
        stock_quantity: match!.stock_quantity,
        moq: match!.moq,
        vendor_label: labelMap.get(match!.vendor_id) ?? null,
        last_verified_at: match!.last_verified_at,
      });
      continue;
    }

    // 3) offre disparue / hors stock → meilleure alternative VÉRIFIÉE du produit
    const alternatives = after
      .filter(
        (x) =>
          x.product_id === o.product_id &&
          x.id !== o.id &&
          !isStale(x, cut) &&
          (x.stock_quantity == null || Number(x.stock_quantity) > 0) &&
          x.price_excl_vat != null,
      )
      .sort((a, b) => Number(a.price_excl_vat) - Number(b.price_excl_vat));
    const alt = alternatives[0] || null;

    results.push({
      offer_id: o.id,
      product_id: o.product_id,
      status: alt ? "switch_vendor" : stillStale ? "still_stale" : "unavailable",
      alternative: alt
        ? {
            offer_id: alt.id,
            price_excl_vat: Number(alt.price_excl_vat),
            price_incl_vat: alt.price_incl_vat != null ? Number(alt.price_incl_vat) : null,
            stock_quantity: alt.stock_quantity,
            moq: alt.moq,
            vendor_label: labelMap.get(alt.vendor_id) ?? null,
          }
        : null,
      previous_price_excl_vat: o.price_excl_vat != null ? Number(o.price_excl_vat) : null,
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    triggered: targets.length > 0,
    products_targeted: targets.length,
    products_cached: cachedProducts.length,
    verify_ttl_ms: VERIFY_TTL_MS,
    unblocked,
    should_revalidate_cart: unblocked > 0,
    results,
    sync_status: syncStatus,
    sync_error: syncError,
  }), { headers: corsHeaders });
});
