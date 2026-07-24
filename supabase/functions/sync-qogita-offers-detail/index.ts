import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { formatDbError, sampleValue } from "../_shared/sync-logger.ts";
import { maybeDecrypt } from "../_shared/qogita-creds.ts";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 120000; // stay well below edge runtime limit so partial resumes can persist
const BATCH_SIZE = 100;
const PARALLEL_CONCURRENCY = 25;
const BATCH_DELAY_MS = 500;
const MULTI_VENDOR_MAX_EXECUTION_TIME = 45000;
const MULTI_VENDOR_BATCH_SIZE = 10;
const MULTI_VENDOR_PARALLEL_CONCURRENCY = 1;
const MULTI_VENDOR_BATCH_DELAY_MS = 3000;
const STALE_RUNNING_MS = 10 * 60 * 1000;
const MAX_RETRIES_429 = 5;
const API_TIMEOUT_MS = 8000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Qogita rate limiter (token bucket en mémoire) ---
// Débit soutenu ~0.5 req/s (1 req toutes les 2s), burst 1. Volontairement
// conservateur pour rester sous le seuil 429 observé côté Qogita (juin 2026).
const QOGITA_RATE_CAPACITY = 1;
const QOGITA_RATE_REFILL_PER_SEC = 0.5;
let qogitaTokens = QOGITA_RATE_CAPACITY;
let qogitaLastRefill = Date.now();
// Pénalité globale : quand un 429 tombe, on interdit tout appel pendant N ms.
let qogitaCooldownUntil = 0;

async function acquireQogitaToken(): Promise<void> {
  while (true) {
    const now = Date.now();
    if (now < qogitaCooldownUntil) {
      await sleep(qogitaCooldownUntil - now);
      continue;
    }
    const elapsedSec = (now - qogitaLastRefill) / 1000;
    if (elapsedSec > 0) {
      qogitaTokens = Math.min(QOGITA_RATE_CAPACITY, qogitaTokens + elapsedSec * QOGITA_RATE_REFILL_PER_SEC);
      qogitaLastRefill = now;
    }
    if (qogitaTokens >= 1) {
      qogitaTokens -= 1;
      return;
    }
    const waitMs = Math.ceil(((1 - qogitaTokens) / QOGITA_RATE_REFILL_PER_SEC) * 1000);
    await sleep(waitMs);
  }
}

// Déclenche un cooldown global (drain du bucket) après un 429.
function trip429Cooldown(retryAfterSec: number, attempt: number): number {
  const base = Math.max(retryAfterSec, 2) * 1000;
  const backoff = base * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 500);
  const waitMs = Math.min(backoff + jitter, 30_000);
  qogitaCooldownUntil = Math.max(qogitaCooldownUntil, Date.now() + waitMs);
  qogitaTokens = 0;
  return waitMs;
}


function getExecutionProfile(fetchMultiVendor: boolean) {
  if (fetchMultiVendor) {
    return {
      maxExecutionTime: MULTI_VENDOR_MAX_EXECUTION_TIME,
      batchSize: MULTI_VENDOR_BATCH_SIZE,
      parallelConcurrency: MULTI_VENDOR_PARALLEL_CONCURRENCY,
      batchDelayMs: MULTI_VENDOR_BATCH_DELAY_MS,
      persistPerChunk: true,
    };
  }

  return {
    maxExecutionTime: MAX_EXECUTION_TIME,
    batchSize: BATCH_SIZE,
    parallelConcurrency: PARALLEL_CONCURRENCY,
    batchDelayMs: BATCH_DELAY_MS,
    persistPerChunk: false,
  };
}

function parseDeliveryDays(raw: string | number | undefined): number {
  if (!raw) return 3;
  if (typeof raw === "number") return raw;
  const s = String(raw).toLowerCase().trim();
  const num = parseInt(s, 10);
  if (s.includes("week")) return (isNaN(num) ? 2 : num) * 7;
  if (s.includes("month")) return (isNaN(num) ? 1 : num) * 30;
  if (s.includes("day")) return isNaN(num) ? 3 : num;
  return isNaN(num) ? 3 : num;
}

function extractImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((img: any) => (typeof img === "string" ? img : img?.url || img?.src || null))
    .filter((v): v is string => Boolean(v));
}

async function getQogitaToken(sb: any): Promise<{ token: string; baseUrl: string }> {
  // qogita_config is a key-value table
  const { data: rows } = await sb.from("qogita_config").select("key, value");
  const cfg: Record<string, string> = {};
  (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });

  const email = cfg.qogita_email;
  const password = await maybeDecrypt(cfg.qogita_password);
  if (!email || !password) throw new Error("Qogita credentials missing (set qogita_email & qogita_password in config)");


  const baseUrl = cfg.base_url || "https://api.qogita.com";
  const res = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error(`Auth failed (${res.status})`);
  const { accessToken } = await res.json();
  if (!accessToken) throw new Error("No accessToken in response");

  // Save token for reference
  await sb.from("qogita_config").upsert({ key: "bearer_token", value: accessToken, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return { token: accessToken, baseUrl };
}

async function ensureBestPriceVendor(sb: any, country: string, syncRunId: string | null): Promise<string> {
  const { data: existing } = await sb
    .from("vendors")
    .select("id")
    .eq("slug", "qogita-best-price")
    .maybeSingle();

  if (existing?.id) {
    if (syncRunId) {
      await sb.from("vendors").update({ last_sync_run_id: syncRunId }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: inserted, error } = await sb
    .from("vendors")
    .insert({
      name: "Qogita - Meilleur prix",
      slug: "qogita-best-price",
      type: "qogita_virtual",
      is_active: true,
      is_verified: true,
      auto_forward_to_qogita: true,
      can_manage_offers: false,
      country_code: country,
      commission_rate: 0,
      ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
    })
    .select("id")
    .single();

  if (error) throw error;
  return inserted.id;
}


async function fetchWithRetry(
  url: string,
  token: string,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES_429; attempt++) {
    await acquireQogitaToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") return new Response(null, { status: 408 });
      throw e;
    }
    clearTimeout(timeout);

    if (res.status === 429 && attempt < MAX_RETRIES_429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "5");
      const waitMs = trip429Cooldown(retryAfter, attempt);
      console.warn(`[qogita] 429 on ${url} — cooldown ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES_429})`);
      await sleep(waitMs);
      continue;
    }
    return res;
  }
  return new Response(null, { status: 429 });
}

async function fetchVariantWithRetry(
  baseUrl: string,
  token: string,
  gtin: string,
  qid: string | null,
  country: string,
): Promise<Response> {
  const urls = [
    `${baseUrl}/variants/${gtin}/?country=${country}`,
    qid ? `${baseUrl}/variants/${qid}/?country=${country}` : null,
  ].filter(Boolean) as string[];

  let lastResponse: Response | null = null;

  for (const url of urls) {
    for (let attempt = 0; attempt <= MAX_RETRIES_429; attempt++) {
      await acquireQogitaToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: controller.signal,
        });
      } catch (e: any) {
        clearTimeout(timeout);
        if (e.name === "AbortError") {
          lastResponse = new Response(null, { status: 408 });
          break;
        }
        throw e;
      }
      clearTimeout(timeout);
      lastResponse = res;

      if (res.status === 429 && attempt < MAX_RETRIES_429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "3");
        const waitMs = trip429Cooldown(retryAfter, attempt);
        console.warn(`[qogita] 429 on variant ${url} — cooldown ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES_429})`);
        await sleep(waitMs);
        continue;
      }

      if (res.status === 404) break;
      return res;
    }
  }

  return lastResponse || new Response(null, { status: 404 });
}

/** Resolve or create a vendor row for a Qogita seller alias */
async function resolveVendor(sb: any, sellerCode: string, country: string, syncRunId: string | null): Promise<string | null> {
  if (!sellerCode || sellerCode === "UNKNOWN") return null;

  // Check by qogita_seller_alias first
  const { data: existing } = await sb
    .from("vendors")
    .select("id")
    .eq("qogita_seller_alias", sellerCode)
    .maybeSingle();

  if (existing?.id) {
    if (syncRunId) {
      await sb.from("vendors").update({ last_sync_run_id: syncRunId }).eq("id", existing.id);
    }
    return existing.id;
  }

  // Create new vendor for this seller code
  const slug = `qogita-seller-${sellerCode.toLowerCase()}`;
  const { data: bySlug } = await sb.from("vendors").select("id").eq("slug", slug).maybeSingle();
  if (bySlug?.id) {
    // Update alias (+ stamp run)
    await sb.from("vendors").update({
      qogita_seller_alias: sellerCode,
      ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
    }).eq("id", bySlug.id);
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
      ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
    })
    .select("id")
    .single();

  if (error) {
    console.error(`Vendor creation error for ${sellerCode}:`, error.message);
    return null;
  }
  return inserted.id;
}


/**
 * Extract raw price tiers array from a Qogita offer/variant payload.
 * Tries every known field-name shape Qogita has shipped over time.
 */
function extractRawTiers(src: any): any[] {
  if (!src) return [];
  const candidates = [
    src.tiers, src.priceTiers, src.price_tiers,
    src.discountTiers, src.discount_tiers,
    src.volumePricing, src.volume_pricing,
    src.bulkPricing, src.bulk_pricing,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

/**
 * Full re-sync of all degressive price tiers for one offer into offer_price_tiers.
 * - Always inserts tier_index = 0 = base price (unitPriceBase / movBase / moq).
 * - Then appends every Qogita-provided tier in ascending MOV order.
 * - Wipes previous rows for that offer (clean re-sync, no orphans).
 */
// Threshold above which a single-tier offer is considered suspicious
// (i.e. Qogita likely returned only one MOV like 15 000 € without the lower steps)
const SINGLE_TIER_MOV_ALERT_THRESHOLD = 1000; // EUR

async function syncOfferTiers(
  sb: any,
  offerId: string,
  unitPriceBase: number,
  movBase: number,
  moqBase: number,
  vatMultiplier: number,
  rawTiers: any[],
  ctx?: { gtin?: string; country?: string; vendor?: string; parentStats?: any },
): Promise<number> {
  if (!offerId || unitPriceBase <= 0) return 0;

  // Normalize + dedupe Qogita tiers
  const normalized = rawTiers
    .map((t: any) => {
      const unit = parseFloat(String(t.price ?? t.unitPrice ?? t.unit_price ?? t.unitPriceExclVat ?? "0")) || 0;
      const mov = parseFloat(String(t.mov ?? t.threshold ?? t.minOrderValue ?? t.minimumOrderValue ?? "0")) || 0;
      const minQty = parseInt(String(t.moq ?? t.minQuantity ?? t.minimumQuantity ?? "0"), 10) || 0;
      return { unit, mov, minQty };
    })
    .filter((t) => t.unit > 0 && (t.mov > 0 || t.minQty > 0));

  // Sort ascending by MOV (then by qty as fallback)
  normalized.sort((a, b) => (a.mov - b.mov) || (a.minQty - b.minQty));

  // Build full tier list: index 0 = base, then degressive tiers
  const tierRows: any[] = [];

  tierRows.push({
    offer_id: offerId,
    tier_index: 0,
    mov_threshold: movBase > 0 ? movBase : 0,
    mov_currency: "EUR",
    qogita_unit_price: unitPriceBase,
    price_excl_vat: unitPriceBase,
    price_incl_vat: Math.round(unitPriceBase * vatMultiplier * 100) / 100,
    is_active: true,
  });

  let nextIndex = 1;
  for (const t of normalized) {
    // Skip tier identical to base (avoid duplicates)
    if (Math.abs(t.unit - unitPriceBase) < 0.01 && Math.abs(t.mov - (movBase || 0)) < 0.01) continue;
    tierRows.push({
      offer_id: offerId,
      tier_index: nextIndex++,
      mov_threshold: t.mov > 0 ? t.mov : 0,
      mov_currency: "EUR",
      qogita_unit_price: t.unit,
      price_excl_vat: t.unit,
      price_incl_vat: Math.round(t.unit * vatMultiplier * 100) / 100,
      is_active: true,
    });
  }

  // --- VALIDATION : detect suspicious tier patterns ---
  // Qogita parfois ne renvoie qu'un seul palier (ex: MOV 15 000 €) alors que
  // l'offre devrait avoir plusieurs seuils dégressifs. On journalise pour alerter.
  const degressiveCount = normalized.length;
  const totalTierCount = tierRows.length;
  const maxMovSeen = Math.max(movBase || 0, ...normalized.map((t) => t.mov));

  if (totalTierCount <= 1 && maxMovSeen >= SINGLE_TIER_MOV_ALERT_THRESHOLD) {
    // Seul palier présent + MOV élevé → probablement un payload tronqué
    console.warn(
      `[qogita.tiers.validation] SINGLE_TIER_HIGH_MOV ` +
      `offer_id=${offerId} gtin=${ctx?.gtin ?? "?"} country=${ctx?.country ?? "?"} ` +
      `vendor=${ctx?.vendor ?? "?"} mov_base=${movBase} raw_tiers_received=${rawTiers.length} ` +
      `normalized_tiers=${degressiveCount} max_mov=${maxMovSeen}`,
    );
    if (ctx?.parentStats) {
      ctx.parentStats.tier_validation_single_high_mov =
        (ctx.parentStats.tier_validation_single_high_mov || 0) + 1;
    }
  } else if (degressiveCount === 0 && (movBase || 0) > 0) {
    // Aucun palier dégressif renvoyé alors qu'un MOV de base existe → à signaler
    console.warn(
      `[qogita.tiers.validation] NO_DEGRESSIVE_TIERS ` +
      `offer_id=${offerId} gtin=${ctx?.gtin ?? "?"} country=${ctx?.country ?? "?"} ` +
      `vendor=${ctx?.vendor ?? "?"} mov_base=${movBase} raw_tiers_received=${rawTiers.length}`,
    );
    if (ctx?.parentStats) {
      ctx.parentStats.tier_validation_no_degressive =
        (ctx.parentStats.tier_validation_no_degressive || 0) + 1;
    }
  } else if (ctx?.parentStats && degressiveCount >= 2) {
    ctx.parentStats.tier_validation_ok =
      (ctx.parentStats.tier_validation_ok || 0) + 1;
  }

  // Clean re-sync — wipe previous rows for this offer
  await sb.from("offer_price_tiers").delete().eq("offer_id", offerId);

  if (tierRows.length === 0) return 0;
  const { error } = await sb.from("offer_price_tiers").insert(tierRows);
  if (error) {
    console.error(formatDbError("qogita.offers_detail.tiers.insert", error, {
      offer_id: offerId, tiers_count: tierRows.length,
    }));
    return 0;
  }
  return tierRows.length;
}

async function upsertQogitaOffer(sb: any, payload: Record<string, unknown>) {
  const productId = String(payload.product_id || "");
  const vendorId = String(payload.vendor_id || "");
  const country = String(payload.country_code || "");
  const qid = typeof payload.qogita_offer_qid === "string" ? payload.qogita_offer_qid : null;

  if (!productId || !vendorId || !country) {
    return { data: null, error: { message: "Missing product/vendor/country for Qogita offer upsert" } };
  }

  // Primary business identity in our catalog: one active Qogita seller offer per
  // product/vendor/country. Qogita can rotate qid for the same seller/product, so
  // update that row first and free the old qid if another row still carries it.
  const { data: byCombo, error: comboLookupError } = await sb
    .from("offers")
    .select("id")
    .eq("product_id", productId)
    .eq("vendor_id", vendorId)
    .eq("country_code", country)
    .maybeSingle();

  if (comboLookupError) return { data: null, error: comboLookupError };

  if (byCombo?.id) {
    if (qid) {
      const { error: clearQidError } = await sb
        .from("offers")
        .update({ qogita_offer_qid: null })
        .eq("qogita_offer_qid", qid)
        .neq("id", byCombo.id);
      if (clearQidError) return { data: null, error: clearQidError };
    }

    return await sb
      .from("offers")
      .update(payload)
      .eq("id", byCombo.id)
      .select("id")
      .maybeSingle();
  }

  // Fallback identity: if Qogita reuses the same qid, refresh that row.
  if (qid) {
    const { data: byQid, error: qidLookupError } = await sb
      .from("offers")
      .select("id")
      .eq("qogita_offer_qid", qid)
      .maybeSingle();

    if (qidLookupError) return { data: null, error: qidLookupError };

    if (byQid?.id) {
      return await sb
        .from("offers")
        .update(payload)
        .eq("id", byQid.id)
        .select("id")
        .maybeSingle();
    }
  }

  const inserted = await sb
    .from("offers")
    .insert(payload)
    .select("id")
    .maybeSingle();

  const insertError = inserted.error as any;
  if (insertError?.code === "23505") {
    if (String(insertError.message || insertError.details || "").includes("offers_product_vendor_country_unique")) {
      if (qid) {
        const { error: clearQidError } = await sb
          .from("offers")
          .update({ qogita_offer_qid: null })
          .eq("qogita_offer_qid", qid);
        if (clearQidError) return { data: null, error: clearQidError };
      }
      return await sb
        .from("offers")
        .update(payload)
        .eq("product_id", productId)
        .eq("vendor_id", vendorId)
        .eq("country_code", country)
        .select("id")
        .maybeSingle();
    }

    if (qid && String(insertError.message || insertError.details || "").includes("offers_qogita_offer_qid_key")) {
      return await sb
        .from("offers")
        .update(payload)
        .eq("qogita_offer_qid", qid)
        .select("id")
        .maybeSingle();
    }
  }

  return inserted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), {
      status: guard.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let targetCountry = "";
  // Politique anti-vendeur anonyme : multi_vendor TOUJOURS activé pour récupérer les FID vendeurs réels.
  // L'offre catch-all "qogita-best-price" n'est plus enregistrée (cf. branche désactivée plus bas).
  let fetchMultiVendor = true;
  let resyncLogId: string | null = null;
  let productIds: string[] = [];
  // Keyset pagination cursor (created_at ISO). null → depuis le début.
  let afterCreatedAt: string | null = null;
  let syncRunId: string | null = null;
  // fast mode : skip /variants/ endpoint, only call /variants/{fid}/{slug}/offers/
  // to refresh price/stock/tiers of existing multi-vendor offers. Requires
  // products with cached qogita_fid + slug (already enriched once).
  let fastMode = false;
  try {
    const body = await req.json();
    if (body?.country) targetCountry = body.country;
    if (body?.resync_log_id) resyncLogId = String(body.resync_log_id);
    if (Array.isArray(body?.product_ids)) {
      productIds = body.product_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
    }
    if (body?.after_created_at) afterCreatedAt = String(body.after_created_at);
    if (body?.sync_run_id) syncRunId = String(body.sync_run_id);
    if (body?.mode === "fast" || body?.fast_mode === true) fastMode = true;
  } catch {
    // no-op
  }


  // Helper closure: log endpoint errors to qogita_resync_logs (no-op if no resyncLogId)
  const recordEndpointError = async (endpoint: string, status: number | null, message: string) => {
    if (!resyncLogId) return;
    try {
      await sb.rpc("record_qogita_endpoint_error", {
        _log_id: resyncLogId,
        _endpoint: endpoint,
        _status: status,
        _error_message: message?.slice(0, 500) ?? null,
      });
    } catch (_) { /* swallow — never break sync because of logging */ }
  };
  const recordProgress = async (delta: Record<string, number>) => {
    if (!resyncLogId) return;
    try {
      await sb.rpc("record_qogita_resync_progress", { _log_id: resyncLogId, _delta: delta });
    } catch (_) { /* swallow */ }
  };

  if (!targetCountry) {
    const { data: rows } = await sb.from("qogita_config").select("key, value").eq("key", "default_country");
    targetCountry = rows?.[0]?.value || "BE";
  }

  const { data: ctryRow } = await sb
    .from("countries")
    .select("code, default_vat_rate")
    .eq("code", targetCountry)
    .eq("is_active", true)
    .single();

  if (!ctryRow) {
    return new Response(JSON.stringify({ error: `Country ${targetCountry} not active` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const vatRate = ctryRow.default_vat_rate || 21;
  const vatMultiplier = 1 + vatRate / 100;

  const syncType = fetchMultiVendor ? "offers_multi_vendor" : "offers_detail";

  const { data: resumableLogs } = await sb
    .from("sync_logs")
    .select("*")
    .eq("sync_type", syncType)
    .in("status", ["partial", "running"])
    .order("started_at", { ascending: false })
    .limit(5);

  const staleCutoff = Date.now() - STALE_RUNNING_MS;
  const existingPartial = resyncLogId ? undefined : (resumableLogs || []).find((log: any) => (
    log.status === "partial" ||
    (log.status === "running" && new Date(log.started_at).getTime() < staleCutoff)
  ));

  let syncLogId: string;

  if (existingPartial) {
    syncLogId = existingPartial.id;
    const prevStats = (existingPartial.stats as any) || {};
    // Reprise keyset : si le run partiel a déjà persisté un cursor_after, on l'utilise
    // (sauf si le caller a explicitement fourni un after_created_at plus récent).
    if (!afterCreatedAt && prevStats.cursor_after) {
      afterCreatedAt = String(prevStats.cursor_after);
    }
    await sb
      .from("sync_logs")
      .update({
        status: "running",
        completed_at: null,
        error_message: null,
        progress_message: `Reprise ${targetCountry} après ${afterCreatedAt ?? "début"}...`,
      })
      .eq("id", syncLogId);
  } else {
    await sb
      .from("sync_logs")
      .update({ status: "error", error_message: "Superseded", completed_at: new Date().toISOString() })
      .eq("sync_type", syncType)
      .eq("status", "running");

    const { data: newLog } = await sb
      .from("sync_logs")
      .insert({
        sync_type: syncType as any,
        status: "running",
        stats: { country: targetCountry, multi_vendor: fetchMultiVendor, cursor_after: afterCreatedAt },
        progress_current: 0,
        progress_total: 0,
        progress_message: `${targetCountry}: authentification...`,
      })
      .select()
      .single();

    syncLogId = newLog!.id;
  }

  // Run sync synchronously. Multi-vendor continuation is handled in-process by
  // syncOffers; no Edge self-invocation / loopback call is used here.
  let productsEnriched = 0;
  let offersUpserted = 0;
  let syncResult: any = null;
  try {
    syncResult = await syncOffers(sb, targetCountry, vatRate, vatMultiplier, syncLogId, startTime, fetchMultiVendor, recordEndpointError, recordProgress, resyncLogId, afterCreatedAt, syncRunId, productIds, fastMode);
    productsEnriched = syncResult?.products_enriched || 0;
    offersUpserted = syncResult?.offers_upserted || 0;
  } catch (e: any) {
    console.error("Sync offers error:", e);
    await sb
      .from("sync_logs")
      .update({
        status: "error",
        completed_at: new Date().toISOString(),
        error_message: e.message,
        progress_message: `Erreur: ${e.message}`,
      })
      .eq("id", syncLogId);
  }

  // Re-check state after this batch (remaining n'est plus calculable sans COUNT ; on renvoie le statut).
  const { data: updatedLog } = await sb.from("sync_logs").select("status, stats").eq("id", syncLogId).single();
  const nextCursor = updatedLog?.status === "partial" ? (updatedLog.stats as any)?.cursor_after ?? null : null;

  return new Response(
    JSON.stringify({
      success: true,
      sync_log_id: syncLogId,
      country: targetCountry,
      multi_vendor: fetchMultiVendor,
      products_enriched: productsEnriched,
      offers_upserted: offersUpserted,
      stats: syncResult,
      next_cursor: nextCursor,
      remaining: nextCursor ? 1 : 0,
      status: updatedLog?.status || "unknown",
      message: `Sync offres ${targetCountry} — ${productsEnriched} enrichis${nextCursor ? " (partiel, à reprendre)" : ""}`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

async function syncOffers(
  sb: any,
  country: string,
  vatRate: number,
  vatMultiplier: number,
  logId: string,
  startTime: number,
  fetchMultiVendor: boolean,
  recordEndpointError: (endpoint: string, status: number | null, message: string) => Promise<void>,
  recordProgress: (delta: Record<string, number>) => Promise<void>,
  resyncLogId: string | null,
  afterCreatedAt: string | null = null,
  syncRunId: string | null = null,
  productIds: string[] = [],
  fastMode: boolean = false,
) {
  const executionProfile = getExecutionProfile(fetchMultiVendor);
  const { token, baseUrl } = await getQogitaToken(sb);
  const bestPriceVendorId = await ensureBestPriceVendor(sb, country, syncRunId);
  const CHUNK_LIMIT = 1000;
  const incrementalProductFilter = "offer_count.gt.0,synced_at.is.null,qogita_qid.is.null";

  const aggregateStats: any = {
    country,
    multi_vendor: fetchMultiVendor,
    products_enriched: 0,
    offers_upserted: 0,
    multi_vendor_offers: 0,
    vendors_created: 0,
    tiers_synced: 0,
    errors: 0,
    skipped: 0,
    rate_limited: 0,
    cursor_after: afterCreatedAt,
    first_api_response_keys: null,
    first_flat_sample: null,
    chunks_processed: 0,
  };

  let currentCursor = afterCreatedAt;

  while (true) {
    const pageStats = await syncOffersPage({
      sb,
      country,
      vatRate,
      vatMultiplier,
      logId,
      startTime,
      fetchMultiVendor,
      recordEndpointError,
      recordProgress,
      afterCreatedAt: currentCursor,
      syncRunId,
      productIds,
      fastMode,
      executionProfile,
      token,
      baseUrl,
      bestPriceVendorId,
      chunkLimit: CHUNK_LIMIT,
      incrementalProductFilter,
    });

    aggregateStats.products_enriched += pageStats.products_enriched || 0;
    aggregateStats.offers_upserted += pageStats.offers_upserted || 0;
    aggregateStats.multi_vendor_offers += pageStats.multi_vendor_offers || 0;
    aggregateStats.vendors_created += pageStats.vendors_created || 0;
    aggregateStats.errors += pageStats.errors || 0;
    aggregateStats.skipped += pageStats.skipped || 0;
    aggregateStats.rate_limited += pageStats.rate_limited || 0;
    aggregateStats.tiers_synced += pageStats.tiers_synced || 0;
    aggregateStats.cursor_after = pageStats.cursor_after ?? currentCursor;
    aggregateStats.chunks_processed += 1;

    if (!aggregateStats.first_api_response_keys && pageStats.first_api_response_keys) {
      aggregateStats.first_api_response_keys = pageStats.first_api_response_keys;
      aggregateStats.first_flat_sample = pageStats.first_flat_sample;
    }
    if (aggregateStats.first_mv_offer_keys === undefined && pageStats.first_mv_offer_keys !== undefined) {
      aggregateStats.first_mv_offer_keys = pageStats.first_mv_offer_keys;
      aggregateStats.first_mv_offer_sample = pageStats.first_mv_offer_sample;
    }

    if (pageStats.paused) {
      await sb
        .from("sync_logs")
        .update({ stats: aggregateStats })
        .eq("id", logId);
      return aggregateStats;
    }

    if (pageStats.completed_reason === "no_eligible_products" || !pageStats.has_more_chunks) {
      await sb
        .from("sync_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          stats: aggregateStats,
          progress_message: `${country}: terminé — ${aggregateStats.products_enriched} enrichis, ${aggregateStats.offers_upserted} offres, ${aggregateStats.multi_vendor_offers} multi-vendeur ✓`,
        })
        .eq("id", logId);

      if (resyncLogId) {
        try {
          await sb.rpc("finalize_qogita_resync_log", {
            _id: resyncLogId,
            _status: aggregateStats.errors > 0 ? "partial" : "success",
            _stats: {
              total_errors: aggregateStats.errors || 0,
              metadata: aggregateStats,
            },
          });
        } catch (_) { /* never fail the sync because of logging */ }
      }

      await sb.from("qogita_config").upsert({ key: "last_offers_sync_at", value: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "key" });
      await sb.from("qogita_config").upsert({ key: "sync_status", value: "completed", updated_at: new Date().toISOString() }, { onConflict: "key" });

      return aggregateStats;
    }

    currentCursor = pageStats.cursor_after ?? currentCursor;

    // Non multi-vendor modes keep the previous page-at-a-time behaviour and let
    // the orchestrator loop call the next batch. The multi-vendor path continues
    // locally, avoiding the former sync-qogita-offers-detail self-invocation.
    if (!fetchMultiVendor) {
      await sb
        .from("sync_logs")
        .update({
          status: "partial",
          stats: aggregateStats,
          progress_message: `${country}: chunk terminé (${pageStats.page_total} produits, cursor=${aggregateStats.cursor_after}) — reprise par orchestrateur`,
        })
        .eq("id", logId);
      return aggregateStats;
    }
  }
}

async function syncOffersPage({
  sb,
  country,
  vatRate,
  vatMultiplier,
  logId,
  startTime,
  fetchMultiVendor,
  recordEndpointError,
  recordProgress,
  afterCreatedAt,
  syncRunId,
  productIds,
  fastMode,
  executionProfile,
  token,
  baseUrl,
  bestPriceVendorId,
  chunkLimit,
  incrementalProductFilter,
}: {
  sb: any;
  country: string;
  vatRate: number;
  vatMultiplier: number;
  logId: string;
  startTime: number;
  fetchMultiVendor: boolean;
  recordEndpointError: (endpoint: string, status: number | null, message: string) => Promise<void>;
  recordProgress: (delta: Record<string, number>) => Promise<void>;
  afterCreatedAt: string | null;
  syncRunId: string | null;
  productIds: string[];
  fastMode: boolean;
  executionProfile: ReturnType<typeof getExecutionProfile>;
  token: string;
  baseUrl: string;
  bestPriceVendorId: string;
  chunkLimit: number;
  incrementalProductFilter: string;
}) {

  // Keyset pagination : fetch next 1000 products after cursor.
  let productsQuery = sb
    .from("products")
    .select("id, gtin, qogita_qid, qogita_fid, slug, created_at")
    .eq("is_active", true)
    .not("gtin", "is", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(chunkLimit);

  if (productIds.length > 0) {
    productsQuery = productsQuery.in("id", productIds);
  } else if (fastMode) {
    // Fast mode without explicit ids : never happens (enqueue always passes ids),
    // but guard anyway — require fid+slug so we can hit /offers/ directly.
    productsQuery = productsQuery.not("qogita_fid", "is", null).not("slug", "is", null);
  } else {
    productsQuery = productsQuery.or(incrementalProductFilter);
  }

  if (fastMode) {
    // Fast mode still needs fid+slug regardless of product_ids.
    productsQuery = productsQuery.not("qogita_fid", "is", null).not("slug", "is", null);
  }

  if (afterCreatedAt) {
    productsQuery = productsQuery.gt("created_at", afterCreatedAt);
  }

  const { data: products, error: pErr } = await productsQuery;

  if (pErr) throw pErr;

  if (!products?.length) {
    await sb
      .from("sync_logs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        progress_message: `${country}: aucun produit éligible à synchroniser`,
      })
      .eq("id", logId);
    return { products_enriched: 0, offers_upserted: 0, completed_reason: "no_eligible_products", cursor_after: afterCreatedAt };
  }

  const total = products.length;
  await sb
    .from("sync_logs")
    .update({
      progress_total: total,
      progress_current: 0,
      progress_message: `${country}: ${total} produits à enrichir${fetchMultiVendor ? " (multi-vendeur)" : ""}...`,
    })
    .eq("id", logId);

  let stats: any = {
    country,
    multi_vendor: fetchMultiVendor,
    products_enriched: 0,
    offers_upserted: 0,
    multi_vendor_offers: 0,
    vendors_created: 0,
    tiers_synced: 0,
    errors: 0,
    skipped: 0,
    rate_limited: 0,
    cursor_after: afterCreatedAt,
    first_api_response_keys: null,
    first_flat_sample: null,
    page_total: total,
    has_more_chunks: false,
    paused: false,
  };

  // Helper : cursor du dernier produit effectivement traité (borne haute atteinte).
  const cursorAt = (index: number): string | null => {
    if (index <= 0) return afterCreatedAt;
    const p = products[Math.min(index, products.length) - 1];
    return p?.created_at ?? afterCreatedAt;
  };

  // Process in parallel batches tuned per mode
  for (let batchStart = 0; batchStart < total; batchStart += executionProfile.batchSize) {
    if (Date.now() - startTime > executionProfile.maxExecutionTime) {
      stats.cursor_after = cursorAt(batchStart);
      stats.paused = true;
      await sb
        .from("sync_logs")
        .update({
          status: "partial",
          stats,
          progress_current: batchStart,
          progress_total: total,
          progress_message: `${country}: pause timeout — ${batchStart}/${total} (reprendra au prochain passage)`,
        })
        .eq("id", logId);
      return stats;
    }

    const batchEnd = Math.min(batchStart + executionProfile.batchSize, total);
    const batchProducts = products.slice(batchStart, batchEnd);

    // Process products in smaller concurrent chunks, especially for multi-vendor fetches
    const chunks: typeof batchProducts[] = [];
    for (let i = 0; i < batchProducts.length; i += executionProfile.parallelConcurrency) {
      chunks.push(batchProducts.slice(i, i + executionProfile.parallelConcurrency));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const currentChunkEnd = Math.min(batchStart + (chunkIndex + 1) * executionProfile.parallelConcurrency, batchEnd);
      const results = await Promise.allSettled(
        chunk.map((p: any) =>
          processSingleProduct(sb, p, baseUrl, token, country, vatRate, vatMultiplier, bestPriceVendorId, fetchMultiVendor, stats, recordEndpointError, recordProgress, syncRunId, fastMode)
        )
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          stats.products_enriched += result.value.products_enriched;
          stats.offers_upserted += result.value.offers_upserted;
          stats.multi_vendor_offers += result.value.multi_vendor_offers;
          stats.errors += result.value.errors;
          stats.skipped += result.value.skipped;
          stats.rate_limited += result.value.rate_limited;
        } else if (result.status === "rejected") {
          stats.errors += 1;
          console.error("Product processing failed:", result.reason);
        }
      }

      if (resyncLogId) {
        await recordProgress({
          products_processed: results.reduce((a, result) => a + (result.status === "fulfilled" ? (result.value?.products_enriched ?? 0) : 0), 0),
          offers_processed: results.reduce((a, result) => a + (result.status === "fulfilled" ? ((result.value?.offers_upserted ?? 0) + (result.value?.multi_vendor_offers ?? 0)) : 0), 0),
          offers_updated: results.reduce((a, result) => a + (result.status === "fulfilled" ? ((result.value?.offers_upserted ?? 0) + (result.value?.multi_vendor_offers ?? 0)) : 0), 0),
        });
      }

      stats.cursor_after = cursorAt(currentChunkEnd);
      if (executionProfile.persistPerChunk) {
        await sb
          .from("sync_logs")
          .update({
            status: "partial",
            stats,
            progress_current: currentChunkEnd,
            progress_total: total,
            progress_message: `${country}: ${currentChunkEnd}/${total} — ${stats.offers_upserted} offres, ${stats.multi_vendor_offers} multi-vendeur, ${stats.products_enriched} enrichis`,
          })
          .eq("id", logId);
      }

      if (Date.now() - startTime > executionProfile.maxExecutionTime) {
        stats.paused = true;
        await sb
          .from("sync_logs")
          .update({
            status: "partial",
            stats,
            progress_current: currentChunkEnd,
            progress_total: total,
            progress_message: `${country}: pause contrôlée — ${currentChunkEnd}/${total} (reprendra au prochain passage)`,
          })
          .eq("id", logId);
        return stats;
      }
    }

    stats.cursor_after = cursorAt(batchEnd);
    await sb
      .from("sync_logs")
      .update({
        stats,
        progress_current: batchEnd,
        progress_total: total,
        progress_message: `${country}: ${batchEnd}/${total} — ${stats.offers_upserted} offres, ${stats.multi_vendor_offers} multi-vendeur, ${stats.products_enriched} enrichis`,
      })
      .eq("id", logId);

    // Small pause between batches to avoid rate limiting
    await sleep(executionProfile.batchDelayMs);
  }

  // Une page pleine (chunkLimit) → il reste probablement d'autres produits éligibles.
  const hasMoreChunks = productIds.length === 0 && total >= chunkLimit;

  if (hasMoreChunks) {
    stats.cursor_after = cursorAt(total);
    stats.has_more_chunks = true;
    await sb
      .from("sync_logs")
      .update({
        status: "partial",
        stats,
        progress_current: total,
        progress_total: total,
          progress_message: `${country}: chunk terminé (${total} produits, cursor=${stats.cursor_after}) — continuation interne`,
      })
      .eq("id", logId);
    return stats;
  }

  return stats;
}

/**
 * FAST refresh : call ONLY /variants/{fid}/{slug}/offers/ and update existing
 * multi-vendor offers with fresh price/stock/tiers. Skips the heavy
 * /variants/{gtin}/ enrichment call. Costs 1 API call per product instead of 2.
 */
async function refreshOffersOnly(
  sb: any,
  product: any,
  baseUrl: string,
  token: string,
  country: string,
  vatRate: number,
  vatMultiplier: number,
  parentStats: any,
  localStats: any,
  recordEndpointError: ((endpoint: string, status: number | null, message: string) => Promise<void>) | undefined,
  syncRunId: string | null,
): Promise<void> {
  try {
    const offersUrl = `${baseUrl}/variants/${product.qogita_fid}/${product.slug}/offers/`;
    const offersRes = await fetchWithRetry(offersUrl, token);

    if (!offersRes.ok) {
      if (offersRes.status === 429) localStats.rate_limited++;
      else if (offersRes.status !== 404) localStats.errors++;
      if (offersRes.status !== 404 && recordEndpointError) {
        await recordEndpointError(`/variants/{fid}/{slug}/offers/ [fast]`, offersRes.status,
          `gtin=${product.gtin} fid=${product.qogita_fid}`);
      }
      return;
    }

    const offersData = await offersRes.json();
    const offersArr = offersData?.offers || (Array.isArray(offersData) ? offersData : []);

    for (const offer of offersArr) {
      const sellerCode = offer.seller || offer.sellerCode;
      if (!sellerCode) continue;

      const vendorId = await resolveVendor(sb, sellerCode, country, syncRunId);
      if (!vendorId) continue;

      const offerPrice = parseFloat(String(offer.price ?? "0")) || 0;
      if (offerPrice <= 0) continue;

      const oExclVat = offerPrice;
      const oInclVat = Math.round(oExclVat * vatMultiplier * 100) / 100;
      const oMov = parseFloat(String(offer.mov ?? "0")) || 0;
      const oStock = parseInt(String(offer.inventory ?? "0"), 10) || 0;
      const oQid = offer.qid || `${sellerCode}-${product.gtin}-${country}`;
      const delayDays = parseDeliveryDays(offer.delay);

      const bundleRaw =
        offer.bundleSize ?? offer.bundle_size ??
        offer.minOrderQuantity ?? offer.moq ??
        offer.minimumOrderQuantity ?? 1;
      const oMoq = Math.max(1, parseInt(String(bundleRaw), 10) || 1);
      const rawTiers = extractRawTiers(offer);

      const { data: upsertedOffer, error: mvErr } = await upsertQogitaOffer(sb, {
        product_id: product.id,
        vendor_id: vendorId,
        qogita_offer_qid: oQid,
        country_code: country,
        qogita_base_price: oExclVat,
        qogita_base_delay_days: delayDays,
        is_qogita_backed: true,
        price_excl_vat: oExclVat,
        price_incl_vat: oInclVat,
        vat_rate: vatRate,
        moq: oMoq,
        mov: oMov > 0 ? oMov : null,
        stock_quantity: oStock,
        stock_status: oStock > 0 ? "in_stock" : "out_of_stock",
        delivery_days: delayDays,
        shipping_from_country: country,
        is_active: true,
        synced_at: new Date().toISOString(),
        ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
      });

      if (mvErr) {
        console.warn(formatDbError("qogita.fast_refresh.upsert", mvErr, {
          product_id: product.id, gtin: product.gtin, seller: sellerCode,
          country, vendor_id: vendorId, offer_qid: oQid,
        }));
        continue;
      }

      localStats.multi_vendor_offers++;

      if (upsertedOffer?.id) {
        try {
          const inserted = await syncOfferTiers(
            sb, upsertedOffer.id, oExclVat, oMov, oMoq, vatMultiplier, rawTiers,
            { gtin: product.gtin, country, vendor: sellerCode, parentStats },
          );
          if (inserted > 0) {
            parentStats.tiers_synced = (parentStats.tiers_synced || 0) + inserted;
          }
        } catch (tErr: any) {
          console.error(`[qogita.fast.tiers] error offer=${upsertedOffer.id}: ${tErr.message}`);
        }
      }
    }
  } catch (e: any) {
    localStats.errors++;
    console.error(`[qogita.fast_refresh] product ${product.id} (${product.gtin}): ${e.message}`);
  }
}

/** Process a single product (called in parallel across PARALLEL_CONCURRENCY) */
async function processSingleProduct(
  sb: any,
  product: any,
  baseUrl: string,
  token: string,
  country: string,
  vatRate: number,
  vatMultiplier: number,
  bestPriceVendorId: string,
  fetchMultiVendor: boolean,
  parentStats: any,
  recordEndpointError?: (endpoint: string, status: number | null, message: string) => Promise<void>,
  recordProgress?: (delta: Record<string, number>) => Promise<void>,
  syncRunId: string | null = null,
  fastMode: boolean = false,
) {
  const localStats = {
    products_enriched: 0,
    offers_upserted: 0,
    multi_vendor_offers: 0,
    errors: 0,
    skipped: 0,
    rate_limited: 0,
  };

    try {
      // FAST MODE : skip /variants/{gtin}/ (heavy). Use cached fid+slug from DB
      // and go straight to /variants/{fid}/{slug}/offers/ to refresh price/stock/tiers
      // of already-known multi-vendor offers. Products without fid+slug are excluded
      // by the query, so this branch is safe.
      if (fastMode && product.qogita_fid && product.slug) {
        await refreshOffersOnly(
          sb, product, baseUrl, token, country, vatRate, vatMultiplier,
          parentStats, localStats, recordEndpointError, syncRunId,
        );
        // Stamp synced_at so tier scheduler doesn't re-pick this product immediately.
        await sb.from("products").update({
          synced_at: new Date().toISOString(),
          ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
        }).eq("id", product.id);
        localStats.products_enriched++;
        return localStats;
      }

      const res = await fetchVariantWithRetry(baseUrl, token, product.gtin, product.qogita_qid, country);

      if (!res.ok) {
        if (res.status === 404) localStats.skipped++;
        else if (res.status === 429) { localStats.rate_limited++; localStats.errors++; }
        else localStats.errors++;
        if (res.status !== 404 && recordEndpointError) {
          await recordEndpointError(`/variants/?country=${country}`, res.status, `gtin=${product.gtin} qid=${product.qogita_qid ?? ""}`);
        }
        await sleep(BATCH_DELAY_MS);
        return localStats;
      }

      const variant = await res.json();

      // Capture first API response sample (thread-safe enough for diagnostics)
      if (parentStats.first_api_response_keys === null) {
        parentStats.first_api_response_keys = Object.keys(variant || {});
        parentStats.first_flat_sample = {
          price: variant?.price ?? null,
          inventory: variant?.inventory ?? null,
          delay: variant?.delay ?? null,
          fid: variant?.fid ?? null,
          slug: variant?.slug ?? null,
          sellerCount: variant?.sellerCount ?? null,
          has_dimensions: !!variant?.dimensions,
        };
      }

      const images = extractImages(variant?.images);
      const productUpdate: any = {
        synced_at: new Date().toISOString(),
        ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
      };
      if (variant?.qid) productUpdate.qogita_qid = variant.qid;
      if (variant?.fid) productUpdate.qogita_fid = variant.fid;
      if (variant?.label) productUpdate.description = variant.label;
      if (images.length > 0) productUpdate.image_urls = images;

      if (variant?.dimensions) {
        const dims = variant.dimensions;
        if (dims.mass != null) productUpdate.weight = parseFloat(String(dims.mass)) || null;
        if (dims.height != null) productUpdate.height = parseFloat(String(dims.height)) || null;
        if (dims.width != null) productUpdate.width = parseFloat(String(dims.width)) || null;
        if (dims.depth != null) productUpdate.depth = parseFloat(String(dims.depth)) || null;
      }

      await sb.from("products").update(productUpdate).eq("id", product.id);

      // --- Best price offer ---
      const priceExclVat = parseFloat(String(variant?.price ?? "0")) || 0;
      const priceInclVat = priceExclVat > 0 ? Math.round((priceExclVat * vatMultiplier) * 100) / 100 : 0;
      const stockQty = parseInt(String(variant?.inventory ?? "0"), 10) || 0;
      const delayDays = parseDeliveryDays(variant?.delay);
      const offerQid = variant?.qid ? `${variant.qid}-${country}` : `${product.gtin}-${country}`;

      // MOQ / MOV / tiers from variant payload (best-price branch)
      const bpBundleRaw =
        variant?.bundleSize ?? variant?.bundle_size ??
        variant?.minOrderQuantity ?? variant?.moq ??
        variant?.minimumOrderQuantity ?? 1;
      const bpMoq = Math.max(1, parseInt(String(bpBundleRaw), 10) || 1);
      const bpMov = parseFloat(String(variant?.mov ?? variant?.minimumOrderValue ?? "0")) || 0;
      const bpRawTiers = extractRawTiers(variant);

      // POLITIQUE ANTI-VENDEUR ANONYME :
      // On n'enregistre PLUS d'offre catch-all sur le vendeur virtuel "qogita-best-price".
      // Seules les offres multi-vendor (avec FID vendeur réel) sont persistées plus bas.
      // Le bloc ci-dessous est désactivé volontairement.
      if (priceExclVat > 0) {
        const { data: bpUpserted, error: offerErr } = await sb.from("offers").upsert(
          {
            product_id: product.id,
            vendor_id: bestPriceVendorId,
            qogita_offer_qid: offerQid,
            country_code: country,
            qogita_base_price: priceExclVat,
            qogita_base_delay_days: delayDays,
            is_qogita_backed: true,
            price_excl_vat: priceExclVat,
            price_incl_vat: priceInclVat > 0 ? priceInclVat : Math.round(priceExclVat * vatMultiplier * 100) / 100,
            vat_rate: vatRate,
            moq: bpMoq,
            mov: bpMov > 0 ? bpMov : null,
            stock_quantity: stockQty,
            stock_status: stockQty > 0 ? "in_stock" : "out_of_stock",
            delivery_days: delayDays,
            shipping_from_country: country,
            is_active: true,
            synced_at: new Date().toISOString(),
            ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
          },
          // Aligned with multi-vendor upsert — qogita_offer_qid is the canonical key.
          { onConflict: "qogita_offer_qid", ignoreDuplicates: false },
        ).select("id").maybeSingle();

        if (offerErr) {
          localStats.errors++;
          console.error(formatDbError("qogita.offers_detail.best_price.upsert", offerErr, {
            product_id: product.id, gtin: product.gtin, qid: variant?.qid,
            country, vendor_id: bestPriceVendorId, offer_qid: offerQid,
            price_excl_vat: priceExclVat, price_incl_vat: priceInclVat, stock: stockQty,
          }));
        } else {
          localStats.offers_upserted++;

          // --- Sync ALL price tiers (base + degressive thresholds) ---
          if (bpUpserted?.id) {
            const inserted = await syncOfferTiers(
              sb, bpUpserted.id, priceExclVat, bpMov, bpMoq, vatMultiplier, bpRawTiers,
              { gtin: product.gtin, country, vendor: "qogita-best-price", parentStats },
            );
            if (inserted > 0) {
              parentStats.tiers_synced = (parentStats.tiers_synced || 0) + inserted;
            }
          }
        }
      }


      // --- Multi-vendor offers ---
      if (fetchMultiVendor && variant?.fid && variant?.slug) {
        try {
          const offersUrl = `${baseUrl}/variants/${variant.fid}/${variant.slug}/offers/`;
          const offersRes = await fetchWithRetry(offersUrl, token);

          if (!offersRes.ok && recordEndpointError) {
            await recordEndpointError(`/variants/{fid}/{slug}/offers/`, offersRes.status, `gtin=${product.gtin} fid=${variant.fid}`);
          }

          if (offersRes.ok) {
            const offersData = await offersRes.json();
            const offersArr = offersData?.offers || (Array.isArray(offersData) ? offersData : []);

            // Diagnostic: capture first multi-vendor offer raw sample to discover field names
            if (parentStats.first_mv_offer_keys === undefined && offersArr.length > 0) {
              parentStats.first_mv_offer_keys = Object.keys(offersArr[0] || {});
              parentStats.first_mv_offer_sample = sampleValue(offersArr[0], 800);
            }

            for (const offer of offersArr) {
              const sellerCode = offer.seller || offer.sellerCode;
              if (!sellerCode) continue;

              const vendorId = await resolveVendor(sb, sellerCode, country, syncRunId);
              if (!vendorId) continue;

              const offerPrice = parseFloat(String(offer.price ?? "0")) || 0;
              if (offerPrice <= 0) continue;

              const oExclVat = offerPrice;
              const oInclVat = Math.round(oExclVat * vatMultiplier * 100) / 100;
              const oMov = parseFloat(String(offer.mov ?? "0")) || 0;
              const oStock = parseInt(String(offer.inventory ?? "0"), 10) || 0;
              const oQid = offer.qid || `${sellerCode}-${product.gtin}-${country}`;

              // --- MOQ / bundleSize mapping (Qogita "Bundles of N") ---
              // Try multiple candidate field names for robustness
              const bundleRaw =
                offer.bundleSize ?? offer.bundle_size ??
                offer.minOrderQuantity ?? offer.moq ??
                offer.minimumOrderQuantity ?? 1;
              const oMoq = Math.max(1, parseInt(String(bundleRaw), 10) || 1);

              // --- Price tiers (degressive pricing by MOV threshold) ---
              const rawTiers: any[] = extractRawTiers(offer);

              const { data: upsertedOffer, error: mvErr } = await upsertQogitaOffer(sb, {
                product_id: product.id,
                vendor_id: vendorId,
                qogita_offer_qid: oQid,
                country_code: country,
                qogita_base_price: oExclVat,
                qogita_base_delay_days: delayDays,
                is_qogita_backed: true,
                price_excl_vat: oExclVat,
                price_incl_vat: oInclVat,
                vat_rate: vatRate,
                moq: oMoq,
                mov: oMov > 0 ? oMov : null,
                stock_quantity: oStock,
                stock_status: oStock > 0 ? "in_stock" : "out_of_stock",
                delivery_days: delayDays,
                shipping_from_country: country,
                is_active: true,
                synced_at: new Date().toISOString(),
                ...(syncRunId ? { last_sync_run_id: syncRunId } : {}),
              });

              if (mvErr) {
                const code = (mvErr as any)?.code as string | undefined;
                const isDbError = typeof code === "string" && code.startsWith("23");
                const payload = formatDbError("qogita.offers_detail.multi_vendor.upsert", mvErr, {
                  product_id: product.id, gtin: product.gtin, seller: sellerCode,
                  country, vendor_id: vendorId, offer_qid: oQid,
                  price_excl_vat: oExclVat, price_incl_vat: oInclVat, stock: oStock, mov: oMov,
                  offer_sample: sampleValue(offer, 200),
                });
                if (isDbError) {
                  console.error(payload);
                } else {
                  console.warn(payload);
                }
              } else {
                localStats.multi_vendor_offers++;

                // --- Sync ALL price tiers (base + degressive thresholds) ---
                if (upsertedOffer?.id) {
                  try {
                    const inserted = await syncOfferTiers(
                      sb, upsertedOffer.id, oExclVat, oMov, oMoq, vatMultiplier, rawTiers,
                      { gtin: product.gtin, country, vendor: sellerCode, parentStats },
                    );
                    if (inserted > 0) {
                      parentStats.tiers_synced = (parentStats.tiers_synced || 0) + inserted;
                    }
                  } catch (tErr: any) {
                    console.error(`[qogita.tiers] error offer=${upsertedOffer.id}: ${tErr.message}`);
                  }
                }
              }
            }
          } else if (offersRes.status === 429) {
            localStats.rate_limited++;
          } else if (!offersRes.ok) {
            console.warn(
              `[qogita.offers_detail.multi_vendor] HTTP ${offersRes.status} ` +
              `gtin=${product.gtin} fid=${variant.fid} slug=${variant.slug}`,
            );
          }
        } catch (mvError: any) {
          console.error(
            `[qogita.offers_detail.multi_vendor] fetch error gtin=${product.gtin} ` +
            `fid=${variant.fid}: ${mvError.message}`,
          );
        }
      }

      localStats.products_enriched++;
    } catch (e: any) {
      localStats.errors++;
      console.error(`Error GTIN ${product.gtin}:`, e.message);
    }

  return localStats;
}
