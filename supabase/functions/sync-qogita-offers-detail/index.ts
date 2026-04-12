import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 290000; // 290s — leave 10s margin for 300s timeout
const BATCH_SIZE = 100;
const PARALLEL_CONCURRENCY = 25;
const BATCH_DELAY_MS = 500;
const MAX_RETRIES_429 = 3;
const API_TIMEOUT_MS = 8000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

  const { data: existingPartial } = await sb
    .from("sync_logs")
    .select("*")
    .eq("sync_type", syncType)
    .eq("status", "partial")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let syncLogId: string;
  let lastOffset = 0;

  if (existingPartial) {
    syncLogId = existingPartial.id;
    const prevStats = (existingPartial.stats as any) || {};
    lastOffset = prevStats.last_offset || 0;
    await sb
      .from("sync_logs")
      .update({
        status: "running",
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

  // Count products with active offers (incremental: only those with offer_count > 0)
  const { count: totalProducts } = await sb
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .not("gtin", "is", null)
    .gt("offer_count", 0);

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
  const { token, baseUrl } = await getQogitaToken(sb);
  const bestPriceVendorId = await ensureBestPriceVendor(sb, country);

  // INCREMENTAL: only products with active offers
  const { data: products, error: pErr } = await sb
    .from("products")
    .select("id, gtin, qogita_qid, qogita_fid, slug")
    .eq("is_active", true)
    .not("gtin", "is", null)
    .gt("offer_count", 0)
    .order("created_at", { ascending: true })
    .range(0, 59999);

  if (pErr) throw pErr;

  if (!products?.length) {
    await sb
      .from("sync_logs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        progress_message: `${country}: aucun produit avec GTIN`,
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

  // Process in parallel batches of BATCH_SIZE, subdivided into PARALLEL_GROUPS
  for (let batchStart = startOffset; batchStart < total; batchStart += BATCH_SIZE) {
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
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

    const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
    const batchProducts = products.slice(batchStart, batchEnd);

    // Process PARALLEL_CONCURRENCY products at the same time
    const chunks: typeof batchProducts[] = [];
    for (let i = 0; i < batchProducts.length; i += PARALLEL_CONCURRENCY) {
      chunks.push(batchProducts.slice(i, i + PARALLEL_CONCURRENCY));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map((p) =>
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
    await sleep(BATCH_DELAY_MS);
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
        await sleep(API_DELAY_MS);
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

      if (priceExclVat > 0) {
        const { error: offerErr } = await sb.from("offers").upsert(
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
            moq: 1,
            mov: null,
            stock_quantity: stockQty,
            stock_status: stockQty > 0 ? "in_stock" : "out_of_stock",
            delivery_days: delayDays,
            shipping_from_country: country,
            is_active: true,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "product_id,vendor_id,country_code", ignoreDuplicates: false },
        );

        if (offerErr) {
          localStats.errors++;
          console.error(`Offer upsert error for GTIN ${product.gtin}:`, offerErr.message);
        } else {
          localStats.offers_upserted++;
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

              const { error: mvErr } = await sb.from("offers").upsert(
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
                  moq: 1,
                  mov: oMov > 0 ? oMov : null,
                  stock_quantity: oStock,
                  stock_status: oStock > 0 ? "in_stock" : "out_of_stock",
                  delivery_days: delayDays,
                  shipping_from_country: country,
                  is_active: true,
                  synced_at: new Date().toISOString(),
                },
                { onConflict: "qogita_offer_qid", ignoreDuplicates: false },
              );

              if (mvErr) {
                console.error(`Multi-vendor offer error ${sellerCode}/${product.gtin}:`, mvErr.message);
              } else {
                localStats.multi_vendor_offers++;
              }
            }
          } else if (offersRes.status === 429) {
            localStats.rate_limited++;
          }
        } catch (mvError: any) {
          console.error(`Multi-vendor fetch error for ${product.gtin}:`, mvError.message);
        }
      }

      localStats.products_enriched++;
    } catch (e: any) {
      localStats.errors++;
      console.error(`Error GTIN ${product.gtin}:`, e.message);
    }

  return localStats;
}
