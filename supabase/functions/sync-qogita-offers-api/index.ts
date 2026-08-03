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
// ⚠️ Budget CPU des edge functions : un run DOIT terminer avant d'être tué,
// sinon le journal reste bloqué en `running`. Lot volontairement petit.
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 600;
// Anti-429 : concurrence basse + débit global plafonné (req/s), pas 8-10.
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RPS = 2;
const MIN_RPS = 0.4;
const DEFAULT_WALLTIME_MS = 55_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 4;
const FALLBACK_MAX_PRODUCTS = 10;
const CHECKPOINT_EVERY_MS = 8_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cooldown global déclenché par un 429.
let cooldownUntil = 0;

// ── Limiteur de débit GLOBAL (token bucket sérialisé, req/s) ────────────────
// Plafonne le débit réel toutes concurrences confondues et s'auto-dégrade sur
// 429 (halve), puis récupère lentement quand les appels repassent au vert.
class RateLimiter {
  private rps: number;
  private readonly ceiling: number;
  private nextSlot = 0;
  private gate: Promise<void> = Promise.resolve();
  private okStreak = 0;

  constructor(rps: number) {
    this.rps = rps;
    this.ceiling = rps;
  }

  get currentRps() { return Math.round(this.rps * 100) / 100; }

  /** Réserve un créneau d'appel (sérialisé, respecte rps + cooldown 429). */
  take(): Promise<void> {
    const run = this.gate.then(async () => {
      const interval = 1000 / this.rps;
      const now = Date.now();
      const target = Math.max(now, this.nextSlot, cooldownUntil);
      this.nextSlot = target + interval;
      const wait = target - now;
      if (wait > 0) await sleep(wait);
    });
    this.gate = run.catch(() => {});
    return run;
  }

  penalize() {
    this.okStreak = 0;
    this.rps = Math.max(MIN_RPS, this.rps / 2);
  }

  reward() {
    this.okStreak += 1;
    if (this.okStreak >= 20 && this.rps < this.ceiling) {
      this.rps = Math.min(this.ceiling, this.rps * 1.25);
      this.okStreak = 0;
    }
  }
}

let limiter = new RateLimiter(DEFAULT_RPS);

type ProductRow = {
  id: string;
  qogita_fid: string | null;
  qogita_slug: string | null;
  gtin: string | null;
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
  /** Garde-fou permanent : écritures refusées car base < seuil du prix indicatif. */
  offers_blocked_implausible: number;
  /** Garde-fou permanent : écritures refusées car base ≤ plancher suspect (1,00 €). */
  offers_blocked_floor: number;
  /** Détecteur de valeur constante suspecte (ex. 1,25 partout). */
  written_bases: number[];
}

// ── Garde-fous PERMANENTS d'écriture de prix ────────────────────────────────
// 1) Plancher : un prix d'achat ≤ 1,00 € est toujours suspect (c'était la
//    signature exacte du bug de mapping `unit` lu comme prix → vente 1,25 €).
const BASE_PRICE_FLOOR = 1.0;
// 2) Plausibilité croisée avec le référentiel catalogue (Lot 3) : si la base
//    écrite est < 20% du prix indicatif connu, on n'écrit pas et on flague.
const IMPLAUSIBLE_RATIO = 0.2;
// 3) Alerte si un lot d'écritures produit une valeur constante.
const CONSTANT_ALERT_MIN_WRITES = 20;

// deno-lint-ignore no-explicit-any
async function flagAnomaly(sb: any, row: Record<string, unknown>) {
  try {
    await sb.from("qogita_price_write_anomalies").insert(row);
  } catch (e) {
    console.warn("[qogita-api] anomaly_log_failed", (e as Error).message);
  }
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
    // Créneau accordé par le limiteur global (rps) + respect du cooldown 429.
    await limiter.take();

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
      limiter.penalize();
      // Retry-After honoré tel quel (secondes ou date HTTP), défaut 2 s,
      // puis backoff exponentiel plafonné à 30 s.
      const raw = res.headers.get("Retry-After") || "";
      let retryAfterMs = 2_000;
      const asInt = parseInt(raw, 10);
      if (Number.isFinite(asInt) && String(asInt) === raw.trim()) {
        retryAfterMs = Math.max(asInt, 1) * 1000;
      } else if (raw) {
        const t = Date.parse(raw);
        if (Number.isFinite(t)) retryAfterMs = Math.max(1_000, t - Date.now());
      }
      const waitMs = Math.min(retryAfterMs * Math.pow(2, attempt), 30_000);
      cooldownUntil = Math.max(cooldownUntil, Date.now() + waitMs);
      console.warn(`[qogita-api] 429 fid=${fid} wait=${waitMs}ms rps=${limiter.currentRps} attempt=${attempt + 1}`);
      if (attempt < MAX_RETRIES) continue; // le limiteur attendra le cooldown
      return { status: 429, json: null };
    }
    if (res.status === 404) { limiter.reward(); return { status: 404, json: null }; }
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(500 * Math.pow(2, attempt));
      continue;
    }
    if (!res.ok) return { status: res.status, json: null };
    const json = await res.json().catch(() => null);
    limiter.reward();
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

    // ⚠️ Paliers : `isActive` reflète l'ÉTAT DU PANIER (movProgress), pas la
    // validité du prix — l'API renvoie `isActive: false` sur TOUS les paliers
    // quand le panier est vide. Les filtrer vidait la liste et faisait tomber
    // dans un fallback qui lisait `o.unit` (nombre d'unités par colis, ex. 1)
    // COMME SI c'était un prix → prix d'achat 1,00 € → vente 1,25 €.
    // On garde donc TOUS les paliers portant un `tierPrice` exploitable.
    const rawTiers = Array.isArray(o.tieredPrices) ? o.tieredPrices as unknown[] : [];
    const tiers: NormTier[] = rawTiers
      .map((t) => t as Record<string, unknown>)
      .map((t) => ({ unit: num(t.tierPrice ?? t.price), mov: num(t.tierMov ?? t.mov) }))
      .filter((t) => t.unit > 0)
      // Tri croissant par MOV → tiers[0] = MOV le plus bas = prix unitaire le plus élevé.
      .sort((a, b) => a.mov - b.mov);

    // Prix d'achat de base = palier au MOV le plus BAS (prix unitaire le plus
    // ÉLEVÉ). AUCUN fallback sur un autre champ : `unit` / `inventory` /
    // `movProgress` ne sont PAS des prix. Sans palier prix → offre ignorée.
    if (tiers.length === 0) { skippedNoTier += 1; continue; }
    let basePrice = tiers[0].unit;
    const baseMov = tiers[0].mov;
    // Garde-fou : jamais moins que le prix unitaire max des paliers au MOV mini.
    const maxUnit = Math.max(...tiers.map((t) => t.unit));
    if (basePrice < maxUnit && tiers[0].mov === Math.min(...tiers.map((t) => t.mov))) {
      basePrice = maxUnit;
    }
    if (!(basePrice > 0)) { skippedNoTier += 1; continue; }


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

// ── Vendeurs virtuels anonymisés ────────────────────────────────────────────
// Une offre par (produit, vendeur fournisseur) : chaque vendeur du flux est
// matérialisé en vendeur virtuel anonymisé ("Vendeur <FID>"), affiché anonymisé
// par défaut (show_real_name = false, révélable en admin).
// La conformité (distributeur autorisé + mandat) est portée par le vendeur de
// référence à la COMMANDE, pas par le vendeur affiché.
const virtualVendorCache = new Map<string, string>();

// deno-lint-ignore no-explicit-any
async function resolveVirtualVendorId(sb: any, fid: string, stats: Stats): Promise<string | null> {
  const alias = fid.trim();
  if (!alias) return null;
  const cached = virtualVendorCache.get(alias);
  if (cached) return cached;

  const { data: existing } = await sb
    .from("vendors").select("id").eq("qogita_seller_alias", alias).maybeSingle();
  if (existing?.id) {
    virtualVendorCache.set(alias, existing.id);
    return existing.id;
  }

  const { data: created, error } = await sb.from("vendors").insert({
    type: "qogita_virtual",
    name: `Vendeur ${alias}`,
    slug: `qogita-seller-${alias.toLowerCase()}`,
    qogita_seller_alias: alias,
    country_code: "BE",
    shipping_country: "BE",
    can_manage_offers: false,
    auto_forward_to_qogita: true,
    is_verified: true,
    is_active: true,
    show_real_name: false,
    validation_status: "approved",
  }).select("id").maybeSingle();

  if (error || !created?.id) {
    // Course entre deux workers : relire
    const { data: retry } = await sb
      .from("vendors").select("id").eq("qogita_seller_alias", alias).maybeSingle();
    if (retry?.id) { virtualVendorCache.set(alias, retry.id); return retry.id; }
    console.error("[qogita-api] virtual_vendor_failed", alias, error?.message);
    return null;
  }

  stats.vendors_created += 1;
  virtualVendorCache.set(alias, created.id);
  return created.id;
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
    qogita_seller_fid: offer.seller || null,
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
  const country = "BE";
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

  // Prix indicatif du référentiel catalogue (Lot 3) = filet de sécurité croisé.
  let indicative: number | null = null;
  try {
    const { data: cat } = await sb
      .from("qogita_catalog_items")
      .select("indicative_price")
      .eq("product_id", product.id)
      .not("indicative_price", "is", null)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const v = cat?.indicative_price != null ? Number(cat.indicative_price) : null;
    if (v != null && Number.isFinite(v) && v > 0) indicative = v;
  } catch { /* pas de référentiel → on garde le seul garde-fou plancher */ }

  // Multi-vendeurs : une offre par (produit, vendeur fournisseur), chacune
  // rattachée à son vendeur virtuel anonymisé. Paliers/MOV/stock par offre.
  const seen = new Set<string>();
  for (const o of offers) {
    const fid = (o.seller || "").trim();
    if (!fid || seen.has(fid)) continue; // 1 offre max par vendeur (contrainte produit+vendeur)
    seen.add(fid);

    // ── GARDE-FOU 1 (permanent) : plancher suspect ──
    if (!(o.basePrice > BASE_PRICE_FLOOR)) {
      stats.offers_blocked_floor += 1;
      await flagAnomaly(sb, {
        product_id: product.id, offer_qid: o.qid, seller_fid: fid,
        anomaly_type: "base_price_floor",
        attempted_base_price: o.basePrice, indicative_price: indicative,
        details: { floor: BASE_PRICE_FLOOR, tiers: o.tiers },
      });
      continue;
    }

    // ── GARDE-FOU 2 (permanent) : plausibilité vs prix indicatif catalogue ──
    if (indicative != null && o.basePrice < indicative * IMPLAUSIBLE_RATIO) {
      stats.offers_blocked_implausible += 1;
      await flagAnomaly(sb, {
        product_id: product.id, offer_qid: o.qid, seller_fid: fid,
        anomaly_type: "implausible_vs_indicative",
        attempted_base_price: o.basePrice, indicative_price: indicative,
        details: { ratio_min: IMPLAUSIBLE_RATIO, tiers: o.tiers },
      });
      continue;
    }

    const vendorId = await resolveVirtualVendorId(sb, fid, stats);
    if (!vendorId) { stats.offers_failed += 1; continue; }

    const offerId = await upsertOffer(sb, product.id, vendorId, country, o, vatRate, marginMul);
    if (!offerId) {
      stats.offers_failed += 1;
    } else {
      stats.offers_upserted += 1;
      if (stats.written_bases.length < 5_000) stats.written_bases.push(o.basePrice);
      stats.tiers_written += await syncTiers(sb, offerId, o, vatRate, marginMul);
    }
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
  // Anti-429 : concurrence plafonnée à 6 (10 auparavant) — le vrai levier est `rps`.
  const concurrency = Math.min(Math.max(Number(body.concurrency ?? DEFAULT_CONCURRENCY), 1), 6);
  const rps = Math.min(Math.max(Number(body.rps ?? DEFAULT_RPS), MIN_RPS), 8);
  limiter = new RateLimiter(rps);
  cooldownUntil = 0;
  const walltimeMs = Math.min(Math.max(Number(body.walltimeMs ?? DEFAULT_WALLTIME_MS), 10_000), 240_000);
  const freshHours = Math.min(Math.max(Number(body.freshHours ?? 12), 1), 720);
  const dryRun = Boolean(body.dryRun);
  const enableFallback = body.fallback !== false;
  const productIds = Array.isArray(body.productIds) ? body.productIds as string[] : null;
  // ── Mode RÉPARATION ──
  // Autorise l'écriture MALGRÉ le gel global, uniquement sur une liste ciblée
  // de produits (job de réparation des offres corrompues à 1,00 €). Les
  // garde-fous permanents (plancher + plausibilité) restent actifs.
  const repair = Boolean(body.repair) && !!productIds?.length;

  const stats: Stats = {
    products_scanned: 0, products_with_offers: 0, products_no_offers: 0,
    products_404: 0, products_error: 0, offers_upserted: 0, offers_failed: 0,
    tiers_written: 0, vendors_created: 0, offers_skipped_no_stock: 0,
    offers_skipped_no_active_tier: 0, excluded_offers_reported: 0,
    http_429: 0, fallback_products: [],
    offers_blocked_implausible: 0, offers_blocked_floor: 0, written_bases: [],
  };


  // ── Journal : id + checkpoints périodiques ────────────────────────────────
  // Le budget CPU des edge functions peut tuer le run sans laisser tourner le
  // `finally`. On écrit donc des compteurs PARTIELS toutes les 8 s : même un run
  // tué garde des chiffres réels, et le watchdog SQL le clôture en `partial`.
  let logId: string | null = null;
  let checkpointTimer: number | undefined;
  let targeted = 0;

  const partialStats = () => ({
    products_targeted: targeted,
    products_processed: stats.products_scanned,
    offers_processed: stats.offers_upserted + stats.offers_failed,
    offers_updated: stats.offers_upserted,
    tiers_synced: stats.tiers_written,
    total_errors: stats.products_error + stats.offers_failed,
  });

  const checkpoint = async () => {
    if (!logId) return;
    try {
      await sb.from("qogita_resync_logs").update({
        ...partialStats(),
        duration_ms: Date.now() - startedAt,
        metadata: {
          source: "sync-qogita-offers-api", limit, concurrency, rps,
          dry_run: dryRun, http_429: stats.http_429,
          rps_current: limiter.currentRps, checkpoint_at: new Date().toISOString(),
        },
      }).eq("id", logId);
    } catch { /* best effort */ }
  };

  const finalize = async (status: "success" | "partial" | "error", extra: Record<string, unknown> = {}) => {
    if (checkpointTimer !== undefined) clearInterval(checkpointTimer);
    if (!logId) return;
    const { written_bases: _wb, ...statsForLog } = stats;
    try {
      await sb.rpc("finalize_qogita_resync_log", {
        _id: logId,
        _status: status,
        _stats: {
          ...partialStats(),
          metadata: {
            ...statsForLog, ...extra, duration_ms: Date.now() - startedAt,
            rps_configured: rps, rps_final: limiter.currentRps,
            concurrency, source: "sync-qogita-offers-api",
          },
        },
      });
    } catch { /* best effort */ }
  };


  try {
    // ── 🛑 GEL DES ÉCRITURES DE PRIX (kill switch) ──
    // `qogita_config.price_writes_enabled = 'false'` → aucune écriture de prix
    // (ni sync de fond, ni chemin JIT). Le code reste en place, on court-circuite.
    // Exception unique : `repair: true` + liste `productIds` (job de réparation
    // du mapping de prix), qui doit pouvoir écrire pendant que le gel tient.
    const { data: freezeRow } = await sb.from("qogita_config").select("value").eq("key", "price_writes_enabled").maybeSingle();
    const priceWritesEnabled = String(freezeRow?.value ?? "true").toLowerCase() !== "false";
    if (!priceWritesEnabled && !dryRun && !repair) {
      await finalize("success", { frozen: true });
      return new Response(JSON.stringify({
        ok: true, frozen: true,
        reason: "price_writes_frozen",
        message: "Écritures de prix gelées (qogita_config.price_writes_enabled=false)",
        stats,
      }), { headers: corsHeaders });
    }


    // ── Marge commerciale courante (config) ──
    const { data: cfgRow } = await sb.from("qogita_config").select("value").eq("key", "margin_percentage").maybeSingle();
    const marginPct = cfgRow?.value ? parseFloat(cfgRow.value) : 25;
    const marginMul = 1 + (Number.isFinite(marginPct) ? marginPct : 25) / 100;


    // ── Sélection des cibles : priorité marques puis fraîcheur ──
    let query = sb
      .from("products")
      .select("id, qogita_fid, qogita_slug, gtin, brand_priority")
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

    // ── Journal (qogita_resync_logs) + checkpoints ──
    targeted = products.length;
    try {
      const { data: logRow } = await sb.from("qogita_resync_logs").insert({
        mode: "manual",
        status: "running",
        triggered_by: productIds?.length ? "manual" : "cron",
        metadata: { source: "sync-qogita-offers-api", limit, concurrency, rps, dry_run: dryRun },
      }).select("id").maybeSingle();
      logId = logRow?.id ?? null;
    } catch { /* journal best-effort */ }
    if (logId) checkpointTimer = setInterval(() => { void checkpoint(); }, CHECKPOINT_EVERY_MS);

    const token = await login(sb);

    // ── Boucle bornée par walltime, concurrence basse + débit plafonné ──
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

    // ── GARDE-FOU 3 (permanent) : valeur constante suspecte sur le lot ──
    // Un lot entier qui écrit exactement le même prix d'achat = signature d'un
    // bug de mapping (c'est ainsi que 1,25 € s'est propagé partout).
    const bases = stats.written_bases;
    const distinctBases = new Set(bases.map((b) => Math.round(b * 100)));
    let constantAlert: number | null = null;
    if (bases.length >= CONSTANT_ALERT_MIN_WRITES && distinctBases.size === 1) {
      constantAlert = bases[0];
      console.error("[qogita-api] CONSTANT_PRICE_ALERT", { value: constantAlert, writes: bases.length });
      await flagAnomaly(sb, {
        anomaly_type: "constant_base_price_batch",
        attempted_base_price: constantAlert,
        details: { writes: bases.length, repair, limit, source: "sync-qogita-offers-api" },
      });
    }

    const durationMs = Date.now() - startedAt;
    const { written_bases: _wb2, ...statsOut } = stats;
    await finalize(queue.length > 0 ? "partial" : "success", {
      remaining_in_batch: queue.length,
      fallback_triggered: fallbackTriggered,
      repair,
      constant_price_alert: constantAlert,
    });

    return new Response(JSON.stringify({
      ok: true,
      source: "qogita_api",
      repair,
      duration_ms: durationMs,
      margin_pct: Math.round((marginMul - 1) * 10000) / 100,
      remaining_in_batch: queue.length,
      fallback_triggered: fallbackTriggered,
      rps_configured: rps,
      rps_final: limiter.currentRps,
      concurrency,
      constant_price_alert: constantAlert,
      bases_written_distinct: distinctBases.size,
      stats: statsOut,
    }), { headers: corsHeaders });

  } catch (e) {
    console.error("[qogita-api] fatal", (e as Error).message);
    await finalize("error", { error: (e as Error).message });
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, stats }), {
      status: 500, headers: corsHeaders,
    });
  } finally {
    if (checkpointTimer !== undefined) clearInterval(checkpointTimer);
  }
});
