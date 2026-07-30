// ─────────────────────────────────────────────────────────────────────────────
// LOT 1 — API Qogita = SOURCE PRIMAIRE des offres / prix.
//
// Itère les produits actifs porteurs d'un `qogita_fid`, appelle
// `GET /buyers/variants/{fid}/offers/` et upsert :
//   - une offre par vendeur (offers, price_source='qogita_api')
//   - tous les paliers (offer_price_tiers)
//   - mov_amount, stock, délais, last_verified_at = now()
//
// Priorisation : products.brand_priority DESC (Tier 2 héros → Tier 1 pharma →
// reste), puis fraîcheur (mv_last_probed_at ASC NULLS FIRST). Curseur borné +
// reprise : chaque produit est estampillé `mv_last_probed_at` après CHAQUE
// tentative (succès, 0 offre ou 404), donc le run suivant avance toujours.
//
// ⚠️ CHOIX DU PRIX D'ACHAT DE BASE (critique pour la marge)
// `qogita_base_price` = prix du palier ACTIF au MOV le plus BAS
// (= prix unitaire le plus ÉLEVÉ = ce qu'on paie sur une commande normale).
// On ne prend JAMAIS le plancher (tierPrice mini exige un gros MOV) : cela
// sous-évaluerait le coût et pourrait faire vendre sous le prix d'achat réel.
// Tous les paliers sont stockés à part (offer_price_tiers) pour affinage.
//
// LOT 2 — le scraper storefront devient un FALLBACK : il n'est déclenché que
// sur les produits où l'API répond 404 ou 0 offre exploitable.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";
import { maybeDecrypt } from "../_shared/qogita-creds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

const QOGITA_API = "https://api.qogita.com";
const DEFAULT_LIMIT = 150;
const MAX_LIMIT = 600;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_WALLTIME_MS = 150_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 4;
const FALLBACK_MAX_PRODUCTS = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cooldown global déclenché par un 429 (aucun 429 observé au test, mais prévu).
let cooldownUntil = 0;

type ProductRow = {
  id: string;
  qogita_fid: string | null;
  qogita_slug: string | null;
  gtin: string | null;
  country_code: string | null;
  brand_priority: number | null;
};

interface Stats {
  products_scanned: number;
  products_with_offers: number;
  products_no_offers: number;
  products_404: number;
  products_error: number;
  offers_upserted: number;
  offers_failed: number;
  tiers_written: number;
  vendors_created: number;
  offers_skipped_no_stock: number;
  offers_skipped_no_active_tier: number;
  excluded_offers_reported: number;
  http_429: number;
  fallback_products: string[];
}

// ── Auth ────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function login(sb: any): Promise<string> {
  const { data: rows } = await sb
    .from("qogita_config")
    .select("key, value")
    .in("key", ["qogita_email", "qogita_password"]);
  const cfg: Record<string, string> = {};
  (rows || []).forEach((r: { key: string; value: string }) => { cfg[r.key] = r.value; });
  const email = cfg.qogita_email;
  const password = await maybeDecrypt(cfg.qogita_password);
  if (!email || !password) throw new Error("Credentials Qogita manquants (qogita_config)");
  const res = await fetch(`${QOGITA_API}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.accessToken) throw new Error(`Login Qogita échoué (${res.status})`);
  try {
    await sb.from("qogita_config").upsert(
      { key: "bearer_token", value: body.accessToken, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  } catch { /* best effort */ }
  return body.accessToken as string;
}

// ── HTTP avec backoff 429 / Retry-After ─────────────────────────────────────
async function fetchOffers(
  fid: string,
  token: string,
  stats: Stats,
): Promise<{ status: number; json: unknown | null }> {
  const url = `${QOGITA_API}/buyers/variants/${fid}/offers/`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const now = Date.now();
    if (now < cooldownUntil) await sleep(cooldownUntil - now);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if ((e as Error).name === "AbortError") {
        if (attempt < MAX_RETRIES) { await sleep(500 * (attempt + 1)); continue; }
        return { status: 408, json: null };
      }
      throw e;
    }
    clearTimeout(timer);

    if (res.status === 429) {
      stats.http_429 += 1;
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      const waitMs = Math.min(Math.max(retryAfter, 1) * 1000 * Math.pow(2, attempt), 30_000);
      cooldownUntil = Math.max(cooldownUntil, Date.now() + waitMs);
      console.warn(`[qogita-api] 429 fid=${fid} cooldown=${waitMs}ms attempt=${attempt + 1}`);
      if (attempt < MAX_RETRIES) { await sleep(waitMs); continue; }
      return { status: 429, json: null };
    }
    if (res.status === 404) return { status: 404, json: null };
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(500 * Math.pow(2, attempt));
      continue;
    }
    if (!res.ok) return { status: res.status, json: null };
    const json = await res.json().catch(() => null);
    return { status: 200, json };
  }
  return { status: 429, json: null };
}

// ── Normalisation payload ───────────────────────────────────────────────────
type NormTier = { unit: number; mov: number };
type NormOffer = {
  qid: string;
  seller: string;
  inventory: number;
  tiers: NormTier[];
  basePrice: number; // palier actif au MOV le plus BAS
  baseMov: number;
  downPaymentPct: number | null;
  isTraceable: boolean;
  isTopSeller: boolean;
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    const amount = (v as { amount?: unknown }).amount;
    if (amount !== undefined) return parseFloat(String(amount)) || 0;
    return 0;
  }
  return parseFloat(String(v)) || 0;
}

function normalizeOffers(payload: unknown): { offers: NormOffer[]; excluded: number; skippedNoStock: number; skippedNoTier: number } {
  const root = payload as Record<string, unknown> | null;
  const rawList: unknown[] = Array.isArray(root)
    ? root
    : (Array.isArray(root?.offers) ? root!.offers as unknown[]
      : Array.isArray(root?.results) ? root!.results as unknown[]
      : []);
  const excluded = Number((root as { numberOfExcludedOffers?: number } | null)?.numberOfExcludedOffers ?? 0) || 0;

  const offers: NormOffer[] = [];
  let skippedNoStock = 0;
  let skippedNoTier = 0;

  for (const raw of rawList) {
    const o = raw as Record<string, unknown>;
    const qid = String(o.qid ?? o.id ?? "");
    const sellerRaw = o.seller ?? o.sellerName ?? o.sellerCode;
    const seller = typeof sellerRaw === "object" && sellerRaw !== null
      ? String((sellerRaw as Record<string, unknown>).name ?? (sellerRaw as Record<string, unknown>).code ?? "")
      : String(sellerRaw ?? "");
    if (!qid || !seller) continue;

    const inventory = Math.max(0, Math.trunc(num(o.inventory ?? o.stock ?? 0)));
    // Offres sans stock : ignorées (jamais publiées comme commandables).
    if (inventory <= 0) { skippedNoStock += 1; continue; }

    // Paliers : on ignore ceux marqués isActive === false.
    const rawTiers = Array.isArray(o.tieredPrices) ? o.tieredPrices as unknown[] : [];
    const tiers: NormTier[] = rawTiers
      .map((t) => t as Record<string, unknown>)
      .filter((t) => t.isActive !== false)
      .map((t) => ({ unit: num(t.tierPrice ?? t.price), mov: num(t.tierMov ?? t.mov) }))
      .filter((t) => t.unit > 0)
      // Tri croissant par MOV → tiers[0] = MOV le plus bas = prix unitaire le plus élevé.
      .sort((a, b) => a.mov - b.mov);

    let basePrice = 0;
    let baseMov = 0;
    if (tiers.length > 0) {
      basePrice = tiers[0].unit;
      baseMov = tiers[0].mov;
    } else {
      // Pas de palier actif exploitable → prix unitaire de l'offre si présent.
      const unit = num(o.unit ?? o.price ?? o.unitPrice);
      if (unit > 0) { basePrice = unit; baseMov = num(o.mov); }
    }
    if (!(basePrice > 0)) { skippedNoTier += 1; continue; }

    // Garde-fou : le prix retenu doit être le MAX des paliers actifs au MOV mini,
    // jamais le plancher. On vérifie explicitement.
    const floor = Math.min(...tiers.map((t) => t.unit), basePrice);
    if (tiers.length > 1 && basePrice < floor) basePrice = floor;

    offers.push({
      qid,
      seller,
      inventory,
      tiers,
      basePrice,
      baseMov,
      downPaymentPct: o.downPaymentPercentage !== undefined ? num(o.downPaymentPercentage) : null,
      isTraceable: Boolean(o.isTraceable),
      isTopSeller: Boolean(o.isTopSeller),
    });
  }

  return { offers, excluded, skippedNoStock, skippedNoTier };
}

// ── Vendeurs ────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function resolveVendorId(sb: any, sellerCode: string, country: string, stats: Stats): Promise<string | null> {
  if (!sellerCode || sellerCode === "UNKNOWN") return null;
  const { data: byAlias } = await sb
    .from("vendors").select("id").eq("qogita_seller_alias", sellerCode).maybeSingle();
  if (byAlias?.id) return byAlias.id;

  const slug = `qogita-seller-${sellerCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const { data: bySlug } = await sb.from("vendors").select("id").eq("slug", slug).maybeSingle();
  if (bySlug?.id) {
    await sb.from("vendors").update({ qogita_seller_alias: sellerCode }).eq("id", bySlug.id);
    return bySlug.id;
  }

  const { data: inserted, error } = await sb
    .from("vendors")
    .insert({
      name: `Vendeur ${sellerCode}`,
      slug,
      type: "qogita_virtual",
      is_active: true,
      is_verified: false,
      auto_forward_to_qogita: true,
      can_manage_offers: false,
      country_code: country,
      commission_rate: 0,
      qogita_seller_alias: sellerCode,
      display_code: sellerCode,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted?.id) {
    console.error("[qogita-api] vendor_insert_failed", sellerCode, error?.message);
    return null;
  }
  stats.vendors_created += 1;
  return inserted.id;
}

// ── Upsert offre + paliers ──────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function upsertOffer(
  // deno-lint-ignore no-explicit-any
  sb: any,
  productId: string,
  vendorId: string,
  country: string,
  offer: NormOffer,
  vatRate: number,
  marginMul: number,
): Promise<string | null> {
  const now = new Date().toISOString();
  const base = offer.basePrice;
  const sellExcl = Math.round(base * marginMul * 100) / 100;
  const payload = {
    product_id: productId,
    vendor_id: vendorId,
    country_code: country,
    qogita_offer_qid: offer.qid,
    qogita_base_price: base,
    is_qogita_backed: true,
    price_excl_vat: sellExcl,
    price_incl_vat: Math.round(sellExcl * (1 + vatRate) * 100) / 100,
    margin_amount: Math.round((sellExcl - base) * 100) / 100,
    applied_margin_percentage: Math.round((marginMul - 1) * 10000) / 100,
    vat_rate: vatRate,
    stock_quantity: offer.inventory,
    stock_status: offer.inventory > 0 ? "in_stock" : "out_of_stock",
    mov_amount: offer.baseMov,
    mov_currency: "EUR",
    down_payment_pct: offer.downPaymentPct,
    is_traceable: offer.isTraceable,
    is_top_seller: offer.isTopSeller,
    is_active: true,
    price_stale: false,
    price_stale_since: null,
    price_source: "qogita_api",
    price_source_updated_at: now,
    synced_at: now,
    last_verified_at: now,
  };

  const { data: byCombo } = await sb
    .from("offers").select("id")
    .eq("product_id", productId).eq("vendor_id", vendorId).eq("country_code", country)
    .maybeSingle();
  if (byCombo?.id) {
    await sb.from("offers").update({ qogita_offer_qid: null })
      .eq("qogita_offer_qid", offer.qid).neq("id", byCombo.id);
    const { error } = await sb.from("offers").update(payload).eq("id", byCombo.id);
    if (error) { console.error("[qogita-api] offer_update_failed", error.message); return null; }
    return byCombo.id;
  }

  const { data: byQid } = await sb.from("offers").select("id").eq("qogita_offer_qid", offer.qid).maybeSingle();
  if (byQid?.id) {
    const { error } = await sb.from("offers").update(payload).eq("id", byQid.id);
    if (error) { console.error("[qogita-api] offer_update_failed", error.message); return null; }
    return byQid.id;
  }

  const { data: inserted, error } = await sb.from("offers").insert(payload).select("id").maybeSingle();
  if (error) { console.error("[qogita-api] offer_insert_failed", error.message); return null; }
  return inserted?.id ?? null;
}

// deno-lint-ignore no-explicit-any
async function syncTiers(
  // deno-lint-ignore no-explicit-any
  sb: any,
  offerId: string,
  offer: NormOffer,
  vatRate: number,
  marginMul: number,
): Promise<number> {
  const vm = 1 + vatRate;
  const sell = (b: number) => Math.round(b * marginMul * 100) / 100;
  const rows: Array<Record<string, unknown>> = [];

  const baseSell = sell(offer.basePrice);
  rows.push({
    offer_id: offerId,
    tier_index: 0,
    mov_threshold: offer.baseMov > 0 ? offer.baseMov : 0,
    mov_currency: "EUR",
    qogita_unit_price: offer.basePrice,
    price_excl_vat: baseSell,
    price_incl_vat: Math.round(baseSell * vm * 100) / 100,
    margin_amount: Math.round((baseSell - offer.basePrice) * 100) / 100,
    is_active: true,
  });

  let idx = 1;
  for (const t of offer.tiers) {
    if (Math.abs(t.unit - offer.basePrice) < 0.0001 && Math.abs(t.mov - offer.baseMov) < 0.0001) continue;
    const s = sell(t.unit);
    rows.push({
      offer_id: offerId,
      tier_index: idx++,
      mov_threshold: t.mov > 0 ? t.mov : 0,
      mov_currency: "EUR",
      qogita_unit_price: t.unit,
      price_excl_vat: s,
      price_incl_vat: Math.round(s * vm * 100) / 100,
      margin_amount: Math.round((s - t.unit) * 100) / 100,
      is_active: true,
    });
  }

  await sb.from("offer_price_tiers").delete().eq("offer_id", offerId);
  const { error } = await sb.from("offer_price_tiers").insert(rows);
  if (error) { console.error("[qogita-api] tiers_insert_failed", error.message); return 0; }
  return rows.length;
}

// ── Traitement d'un produit ─────────────────────────────────────────────────
async function processProduct(
  // deno-lint-ignore no-explicit-any
  sb: any,
  product: ProductRow,
  token: string,
  marginMul: number,
  stats: Stats,
  dryRun: boolean,
): Promise<void> {
  stats.products_scanned += 1;
  const country = product.country_code || "BE";
  const fid = product.qogita_fid!;

  let result: { status: number; json: unknown | null };
  try {
    result = await fetchOffers(fid, token, stats);
  } catch (e) {
    stats.products_error += 1;
    console.error("[qogita-api] fetch_failed", fid, (e as Error).message);
    await stampProbed(sb, product.id);
    return;
  }

  if (result.status === 404) {
    stats.products_404 += 1;
    if (stats.fallback_products.length < FALLBACK_MAX_PRODUCTS) stats.fallback_products.push(product.id);
    await stampProbed(sb, product.id);
    return;
  }
  if (result.status !== 200) {
    stats.products_error += 1;
    await stampProbed(sb, product.id);
    return;
  }

  const { offers, excluded, skippedNoStock, skippedNoTier } = normalizeOffers(result.json);
  stats.excluded_offers_reported += excluded;
  stats.offers_skipped_no_stock += skippedNoStock;
  stats.offers_skipped_no_active_tier += skippedNoTier;

  if (offers.length === 0) {
    stats.products_no_offers += 1;
    if (stats.fallback_products.length < FALLBACK_MAX_PRODUCTS) stats.fallback_products.push(product.id);
    await stampProbed(sb, product.id);
    return;
  }
  stats.products_with_offers += 1;
  if (dryRun) { await stampProbed(sb, product.id); return; }

  let vatRate = 0.06;
  try {
    const { data: vat } = await sb.rpc("resolve_product_vat_rate", {
      _product_id: product.id,
      _country_code: country,
    });
    if (typeof vat === "number" && vat >= 0) vatRate = vat;
  } catch { /* fallback */ }

  for (const offer of offers) {
    const vendorId = await resolveVendorId(sb, offer.seller, country, stats);
    if (!vendorId) { stats.offers_failed += 1; continue; }
    const offerId = await upsertOffer(sb, product.id, vendorId, country, offer, vatRate, marginMul);
    if (!offerId) { stats.offers_failed += 1; continue; }
    stats.offers_upserted += 1;
    stats.tiers_written += await syncTiers(sb, offerId, offer, vatRate, marginMul);
  }

  await stampProbed(sb, product.id);
}

// deno-lint-ignore no-explicit-any
async function stampProbed(sb: any, productId: string) {
  try {
    await sb.from("products").update({ mv_last_probed_at: new Date().toISOString() }).eq("id", productId);
  } catch (e) {
    console.warn("[qogita-api] probe_stamp_failed", productId, (e as Error).message);
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: corsHeaders });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const startedAt = Date.now();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const limit = Math.min(Math.max(Number(body.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const concurrency = Math.min(Math.max(Number(body.concurrency ?? DEFAULT_CONCURRENCY), 1), 10);
  const walltimeMs = Math.min(Math.max(Number(body.walltimeMs ?? DEFAULT_WALLTIME_MS), 10_000), 240_000);
  const freshHours = Math.min(Math.max(Number(body.freshHours ?? 12), 1), 720);
  const dryRun = Boolean(body.dryRun);
  const enableFallback = body.fallback !== false;
  const productIds = Array.isArray(body.productIds) ? body.productIds as string[] : null;

  const stats: Stats = {
    products_scanned: 0, products_with_offers: 0, products_no_offers: 0,
    products_404: 0, products_error: 0, offers_upserted: 0, offers_failed: 0,
    tiers_written: 0, vendors_created: 0, offers_skipped_no_stock: 0,
    offers_skipped_no_active_tier: 0, excluded_offers_reported: 0,
    http_429: 0, fallback_products: [],
  };

  try {
    // ── Marge commerciale courante (config) ──
    const { data: cfgRow } = await sb.from("qogita_config").select("value").eq("key", "margin_percentage").maybeSingle();
    const marginPct = cfgRow?.value ? parseFloat(cfgRow.value) : 25;
    const marginMul = 1 + (Number.isFinite(marginPct) ? marginPct : 25) / 100;

    // ── Sélection des cibles : priorité marques puis fraîcheur ──
    let query = sb
      .from("products")
      .select("id, qogita_fid, qogita_slug, gtin, country_code, brand_priority")
      .not("qogita_fid", "is", null)
      .eq("is_active", true);

    if (productIds?.length) {
      query = query.in("id", productIds).limit(limit);
    } else {
      const cutoff = new Date(Date.now() - freshHours * 3600_000).toISOString();
      query = query
        .or(`mv_last_probed_at.is.null,mv_last_probed_at.lt.${cutoff}`)
        .order("brand_priority", { ascending: false, nullsFirst: false })
        .order("mv_last_probed_at", { ascending: true, nullsFirst: true })
        .limit(limit);
    }

    const { data: products, error: prodErr } = await query;
    if (prodErr) throw prodErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "no_targets", stats }), { headers: corsHeaders });
    }

    // ── Journal (qogita_resync_logs) ──
    let logId: string | null = null;
    try {
      const { data: logRow } = await sb.from("qogita_resync_logs").insert({
        mode: "manual",
        status: "running",
        triggered_by: productIds?.length ? "manual" : "cron",
        metadata: { source: "sync-qogita-offers-api", limit, concurrency, dry_run: dryRun },
      }).select("id").maybeSingle();
      logId = logRow?.id ?? null;
    } catch { /* journal best-effort */ }

    const token = await login(sb);

    // ── Boucle bornée par walltime, concurrence 5–10 ──
    const queue = [...products] as ProductRow[];
    let stopped = false;
    const worker = async () => {
      while (!stopped) {
        if (Date.now() - startedAt > walltimeMs) { stopped = true; break; }
        const p = queue.shift();
        if (!p) break;
        await processProduct(sb, p, token, marginMul, stats, dryRun);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    // ── LOT 2 : fallback storefront UNIQUEMENT sur 404 / 0 offre ──
    let fallbackTriggered = 0;
    if (enableFallback && !dryRun && stats.fallback_products.length > 0) {
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape-qogita-storefront`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            source: "api_fallback",
            productIds: stats.fallback_products,
            limit: stats.fallback_products.length,
            resourceOffers: true,
          }),
        });
        if (res.ok) fallbackTriggered = stats.fallback_products.length;
        else console.warn("[qogita-api] fallback_storefront_failed", res.status);
      } catch (e) {
        console.warn("[qogita-api] fallback_storefront_error", (e as Error).message);
      }
    }

    const durationMs = Date.now() - startedAt;
    if (logId) {
      try {
        await sb.rpc("finalize_qogita_resync_log", {
          _id: logId,
          _status: "success",
          _stats: { ...stats, remaining_in_batch: queue.length, duration_ms: durationMs, fallback_triggered: fallbackTriggered },
        });
      } catch { /* best effort */ }
    }

    return new Response(JSON.stringify({
      ok: true,
      source: "qogita_api",
      duration_ms: durationMs,
      margin_pct: Math.round((marginMul - 1) * 10000) / 100,
      remaining_in_batch: queue.length,
      fallback_triggered: fallbackTriggered,
      stats,
    }), { headers: corsHeaders });
  } catch (e) {
    console.error("[qogita-api] fatal", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, stats }), {
      status: 500, headers: corsHeaders,
    });
  }
});
