import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { formatDbError, sampleValue } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 120000; // stay well below edge runtime limit so partial resumes can persist
const BATCH_SIZE = 100;
const PARALLEL_CONCURRENCY = 25;
const BATCH_DELAY_MS = 500;
const MULTI_VENDOR_MAX_EXECUTION_TIME = 45000;
const MULTI_VENDOR_BATCH_SIZE = 20;
const MULTI_VENDOR_PARALLEL_CONCURRENCY = 5;
const MULTI_VENDOR_BATCH_DELAY_MS = 800;
const STALE_RUNNING_MS = 10 * 60 * 1000;
const MAX_RETRIES_429 = 3;
const API_TIMEOUT_MS = 8000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  const password = cfg.qogita_password;
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

async function ensureBestPriceVendor(sb: any, country: string): Promise<string> {
  const { data: existing } = await sb
    .from("vendors")
    .select("id")
    .eq("slug", "qogita-best-price")
    .maybeSingle();

  if (existing?.id) return existing.id;

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
      await sleep(retryAfter * 1000);
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
        await sleep(1200 * (attempt + 1));
        continue;
      }

      if (res.status === 404) break;
      return res;
    }
  }

  return lastResponse || new Response(null, { status: 404 });
}

/** Resolve or create a vendor row for a Qogita seller alias */
async function resolveVendor(sb: any, sellerCode: string, country: string): Promise<string | null> {
  if (!sellerCode || sellerCode === "UNKNOWN") return null;

  // Check by qogita_seller_alias first
  const { data: existing } = await sb
    .from("vendors")
    .select("id")
    .eq("qogita_seller_alias", sellerCode)
    .maybeSingle();

  if (existing?.id) return existing.id;

  // Create new vendor for this seller code
  const slug = `qogita-seller-${sellerCode.toLowerCase()}`;
  const { data: bySlug } = await sb.from("vendors").select("id").eq("slug", slug).maybeSingle();
  if (bySlug?.id) {
    // Update alias
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
async function syncOfferTiers(
  sb: any,
  offerId: string,
  unitPriceBase: number,
  movBase: number,
  moqBase: number,
  vatMultiplier: number,
  rawTiers: any[],
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let targetCountry = "";
  let fetchMultiVendor = false;
  try {
    const body = await req.json();
    if (body?.country) targetCountry = body.country;
    if (body?.multi_vendor) fetchMultiVendor = true;
  } catch {
    // no-op
  }

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
  const incrementalProductFilter = "offer_count.gt.0,synced_at.is.null,qogita_qid.is.null";

  const { data: resumableLogs } = await sb
    .from("sync_logs")
    .select("*")
    .eq("sync_type", syncType)
    .in("status", ["partial", "running"])
    .order("started_at", { ascending: false })
    .limit(5);

  const staleCutoff = Date.now() - STALE_RUNNING_MS;
  const existingPartial = (resumableLogs || []).find((log: any) => (
    log.status === "partial" ||
    (log.status === "running" && new Date(log.started_at).getTime() < staleCutoff)
  ));

  let syncLogId: string;
  let lastOffset = 0;

  if (existingPartial) {
    syncLogId = existingPartial.id;
    const prevStats = (existingPartial.stats as any) || {};
    lastOffset = prevStats.last_offset || existingPartial.progress_current || 0;
    await sb
      .from("sync_logs")
      .update({
        status: "running",
        completed_at: null,
        error_message: null,
        progress_current: lastOffset,
        progress_message: `Reprise ${targetCountry} à partir de ${lastOffset}...`,
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
        stats: { country: targetCountry, multi_vendor: fetchMultiVendor },
        progress_current: 0,
        progress_total: 0,
        progress_message: `${targetCountry}: authentification...`,
      })
      .select()
      .single();

    syncLogId = newLog!.id;
  }

  const { count: totalProducts } = await sb
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .not("gtin", "is", null)
    .or(incrementalProductFilter);

  const remaining = Math.max((totalProducts || 0) - lastOffset, 0);

  // Run sync synchronously (not in background) so we can return accurate remaining
  let productsEnriched = 0;
  let offersUpserted = 0;
  try {
    const result = await syncOffers(sb, targetCountry, vatRate, vatMultiplier, syncLogId, lastOffset, startTime, fetchMultiVendor);
    productsEnriched = result?.products_enriched || 0;
    offersUpserted = result?.offers_upserted || 0;
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

  // Re-check remaining after this batch
  const { data: updatedLog } = await sb.from("sync_logs").select("status, stats").eq("id", syncLogId).single();
  const finalRemaining = updatedLog?.status === "partial" ? ((updatedLog.stats as any)?.last_offset ? (totalProducts || 0) - (updatedLog.stats as any).last_offset : 0) : 0;

  return new Response(
    JSON.stringify({
      success: true,
      sync_log_id: syncLogId,
      country: targetCountry,
      multi_vendor: fetchMultiVendor,
      products_enriched: productsEnriched,
      offers_upserted: offersUpserted,
      remaining: finalRemaining,
      status: updatedLog?.status || "unknown",
      message: `Sync offres ${targetCountry} — ${productsEnriched} enrichis, ${finalRemaining} restants`,
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
  startOffset: number,
  startTime: number,
  fetchMultiVendor: boolean,
) {
  const executionProfile = getExecutionProfile(fetchMultiVendor);
  const { token, baseUrl } = await getQogitaToken(sb);
  const bestPriceVendorId = await ensureBestPriceVendor(sb, country);

  const incrementalProductFilter = "offer_count.gt.0,synced_at.is.null,qogita_qid.is.null";

  const { data: products, error: pErr } = await sb
    .from("products")
    .select("id, gtin, qogita_qid, qogita_fid, slug")
    .eq("is_active", true)
    .not("gtin", "is", null)
    .or(incrementalProductFilter)
    .order("created_at", { ascending: true })
    .range(0, 59999);

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
    return;
  }

  const total = products.length;
  await sb
    .from("sync_logs")
    .update({
      progress_total: total,
      progress_current: startOffset,
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
    errors: 0,
    skipped: 0,
    rate_limited: 0,
    last_offset: startOffset,
    first_api_response_keys: null,
    first_flat_sample: null,
  };

  // Process in parallel batches tuned per mode
  for (let batchStart = startOffset; batchStart < total; batchStart += executionProfile.batchSize) {
    if (Date.now() - startTime > executionProfile.maxExecutionTime) {
      stats.last_offset = batchStart;
      await sb
        .from("sync_logs")
        .update({
          status: "partial",
          stats,
          progress_current: batchStart,
          progress_total: total,
          progress_message: `${country}: pause timeout — ${batchStart}/${total} (reprendra au prochain clic)`,
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
          processSingleProduct(sb, p, baseUrl, token, country, vatRate, vatMultiplier, bestPriceVendorId, fetchMultiVendor, stats)
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

      stats.last_offset = currentChunkEnd;
      if (executionProfile.persistPerChunk) {
        await sb
          .from("sync_logs")
          .update({
            status: "partial",
            stats,
            progress_current: stats.last_offset,
            progress_total: total,
            progress_message: `${country}: ${stats.last_offset}/${total} — ${stats.offers_upserted} offres, ${stats.multi_vendor_offers} multi-vendeur, ${stats.products_enriched} enrichis`,
          })
          .eq("id", logId);
      }

      if (Date.now() - startTime > executionProfile.maxExecutionTime) {
        await sb
          .from("sync_logs")
          .update({
            status: "partial",
            stats,
            progress_current: stats.last_offset,
            progress_total: total,
            progress_message: `${country}: pause contrôlée — ${stats.last_offset}/${total} (reprendra automatiquement)`,
          })
          .eq("id", logId);
        return stats;
      }
    }

    stats.last_offset = batchEnd;
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

  await sb
    .from("sync_logs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      stats,
      progress_current: total,
      progress_total: total,
      progress_message: `${country}: terminé — ${stats.products_enriched} enrichis, ${stats.offers_upserted} offres, ${stats.multi_vendor_offers} multi-vendeur ✓`,
    })
    .eq("id", logId);

  await sb.from("qogita_config").upsert({ key: "last_offers_sync_at", value: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "key" });
  await sb.from("qogita_config").upsert({ key: "sync_status", value: "completed", updated_at: new Date().toISOString() }, { onConflict: "key" });

  return stats;
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
      const res = await fetchVariantWithRetry(baseUrl, token, product.gtin, product.qogita_qid, country);

      if (!res.ok) {
        if (res.status === 404) localStats.skipped++;
        else if (res.status === 429) { localStats.rate_limited++; localStats.errors++; }
        else localStats.errors++;
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
      const productUpdate: any = { synced_at: new Date().toISOString() };
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
      const priceInclVat = parseFloat(String(variant?.price ?? "0")) || 0;
      const priceExclVat = priceInclVat > 0 ? Math.round((priceInclVat / vatMultiplier) * 100) / 100 : 0;
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

              const vendorId = await resolveVendor(sb, sellerCode, country);
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

              const { data: upsertedOffer, error: mvErr } = await sb.from("offers").upsert(
                {
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
                },
                // Use qogita_offer_qid as the conflict target — it is the canonical
                // unique identifier per (seller, variant, country) on Qogita's side
                // and matches the offers_qogita_offer_qid_unique constraint.
                { onConflict: "qogita_offer_qid", ignoreDuplicates: false },
              ).select("id").maybeSingle();

              if (mvErr) {
                console.error(formatDbError("qogita.offers_detail.multi_vendor.upsert", mvErr, {
                  product_id: product.id, gtin: product.gtin, seller: sellerCode,
                  country, vendor_id: vendorId, offer_qid: oQid,
                  price_excl_vat: oExclVat, price_incl_vat: oInclVat, stock: oStock, mov: oMov,
                  offer_sample: sampleValue(offer, 200),
                }));
              } else {
                localStats.multi_vendor_offers++;

                // --- Sync ALL price tiers (base + degressive thresholds) ---
                if (upsertedOffer?.id) {
                  try {
                    const inserted = await syncOfferTiers(
                      sb, upsertedOffer.id, oExclVat, oMov, oMoq, vatMultiplier, rawTiers,
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
