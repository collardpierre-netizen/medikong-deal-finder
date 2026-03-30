import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;
const BATCH_SIZE = 20;
const API_DELAY_MS = 500;
const MAX_RETRIES_429 = 3;

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
  const { data: config } = await sb.from("qogita_config").select("*").eq("id", 1).single();
  if (!config?.qogita_email || !config?.qogita_password) throw new Error("Qogita credentials missing");

  const baseUrl = config.base_url || "https://api.qogita.com";
  const res = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.qogita_email, password: config.qogita_password }),
  });

  if (!res.ok) throw new Error(`Auth failed (${res.status})`);
  const { accessToken } = await res.json();
  if (!accessToken) throw new Error("No accessToken");

  await sb.from("qogita_config").update({ bearer_token: accessToken }).eq("id", 1);
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
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      lastResponse = res;

      if (res.status === 429 && attempt < MAX_RETRIES_429) {
        await sleep(1200 * (attempt + 1));
        continue;
      }

      if (res.status === 404) break; // try fallback URL (qid)
      return res;
    }
  }

  return lastResponse || new Response(null, { status: 404 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let targetCountry = "";
  try {
    const body = await req.json();
    if (body?.country) targetCountry = body.country;
  } catch {
    // no-op
  }

  if (!targetCountry) {
    const { data: cfg } = await sb.from("qogita_config").select("default_country").eq("id", 1).single();
    targetCountry = cfg?.default_country || "BE";
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

  const { data: existingPartial } = await sb
    .from("sync_logs")
    .select("*")
    .eq("sync_type", "offers_detail")
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
      .eq("sync_type", "offers_detail")
      .eq("status", "running");

    const { data: newLog } = await sb
      .from("sync_logs")
      .insert({
        sync_type: "offers_detail",
        status: "running",
        stats: { country: targetCountry },
        progress_current: 0,
        progress_total: 0,
        progress_message: `${targetCountry}: authentification...`,
      })
      .select()
      .single();

    syncLogId = newLog!.id;
  }

  (globalThis as any).EdgeRuntime.waitUntil(
    syncOffers(sb, targetCountry, vatRate, vatMultiplier, syncLogId, lastOffset, startTime).catch(async (e: any) => {
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
    }),
  );

  return new Response(
    JSON.stringify({
      success: true,
      sync_log_id: syncLogId,
      country: targetCountry,
      message: `Sync offres ${targetCountry} lancée en arrière-plan`,
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
) {
  const { token, baseUrl } = await getQogitaToken(sb);
  const vendorId = await ensureBestPriceVendor(sb, country);

  const { data: products, error: pErr } = await sb
    .from("products")
    .select("id, gtin, qogita_qid")
    .eq("source", "qogita")
    .eq("is_active", true)
    .not("gtin", "is", null)
    .order("created_at", { ascending: true })
    .range(0, 49999);

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
      progress_message: `${country}: ${total} produits à enrichir...`,
    })
    .eq("id", logId);

  let stats: any = {
    country,
    products_enriched: 0,
    offers_upserted: 0,
    errors: 0,
    skipped: 0,
    rate_limited: 0,
    last_offset: startOffset,
    first_api_response_keys: null,
    first_flat_sample: null,
  };

  for (let i = startOffset; i < total; i++) {
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      stats.last_offset = i;
      await sb
        .from("sync_logs")
        .update({
          status: "partial",
          stats,
          progress_current: i,
          progress_total: total,
          progress_message: `${country}: pause timeout — ${i}/${total} (reprendra au prochain clic)`,
        })
        .eq("id", logId);
      return;
    }

    const product = products[i];

    try {
      const res = await fetchVariantWithRetry(baseUrl, token, product.gtin, product.qogita_qid, country);

      if (!res.ok) {
        if (res.status === 404) {
          stats.skipped++;
        } else if (res.status === 429) {
          stats.rate_limited++;
          stats.errors++;
          console.error(`API 429 for GTIN ${product.gtin}`);
        } else {
          stats.errors++;
          console.error(`API ${res.status} for GTIN ${product.gtin}`);
        }

        if ((i + 1) % BATCH_SIZE === 0) {
          stats.last_offset = i + 1;
          await sb
            .from("sync_logs")
            .update({
              stats,
              progress_current: i + 1,
              progress_total: total,
              progress_message: `${country}: ${i + 1}/${total} — ${stats.offers_upserted} offres, ${stats.products_enriched} enrichis`,
            })
            .eq("id", logId);
        }

        await sleep(API_DELAY_MS);
        continue;
      }

      const variant = await res.json();

      if (stats.first_api_response_keys === null) {
        stats.first_api_response_keys = Object.keys(variant || {});
        stats.first_flat_sample = {
          price: variant?.price ?? null,
          inventory: variant?.inventory ?? null,
          delay: variant?.delay ?? null,
          has_offers_array: Array.isArray(variant?.offers),
          offers_length: Array.isArray(variant?.offers) ? variant.offers.length : null,
        };
        console.log("API response keys:", stats.first_api_response_keys);
        console.log("Flat sample:", JSON.stringify(stats.first_flat_sample));
      }

      const images = extractImages(variant?.images);
      const productUpdate: any = {
        synced_at: new Date().toISOString(),
      };
      if (variant?.qid) productUpdate.qogita_qid = variant.qid;
      if (variant?.label) productUpdate.description = variant.label;
      if (images.length > 0) productUpdate.image_urls = images;

      await sb.from("products").update(productUpdate).eq("id", product.id);

      const priceInclVat = parseFloat(String(variant?.price ?? "0")) || 0;
      const priceExclVat = priceInclVat > 0 ? Math.round((priceInclVat / vatMultiplier) * 100) / 100 : 0;
      const stockQty = parseInt(String(variant?.inventory ?? "0"), 10) || 0;
      const delayDays = parseDeliveryDays(variant?.delay);
      const offerQid = variant?.qid ? `${variant.qid}-${country}` : `${product.gtin}-${country}`;

      if (priceExclVat > 0) {
        const offerPayload = {
          product_id: product.id,
          vendor_id: vendorId,
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
        };

        const { error: offerErr } = await sb.from("offers").upsert(offerPayload, {
          onConflict: "product_id,vendor_id,country_code",
          ignoreDuplicates: false,
        });

        if (offerErr) {
          stats.errors++;
          console.error(`Offer upsert error for GTIN ${product.gtin}:`, offerErr.message);
        } else {
          stats.offers_upserted++;
        }
      }

      stats.products_enriched++;
    } catch (e: any) {
      stats.errors++;
      console.error(`Error GTIN ${product.gtin}:`, e.message);
    }

    if ((i + 1) % BATCH_SIZE === 0 || i === total - 1) {
      stats.last_offset = i + 1;
      await sb
        .from("sync_logs")
        .update({
          stats,
          progress_current: i + 1,
          progress_total: total,
          progress_message: `${country}: ${i + 1}/${total} — ${stats.offers_upserted} offres, ${stats.products_enriched} enrichis, ${stats.rate_limited} rate-limit`,
        })
        .eq("id", logId);
    }

    await sleep(API_DELAY_MS);
  }

  await sb
    .from("sync_logs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      stats,
      progress_current: total,
      progress_total: total,
      progress_message: `${country}: terminé — ${stats.products_enriched} enrichis, ${stats.offers_upserted} offres ✓`,
    })
    .eq("id", logId);

  await sb
    .from("qogita_config")
    .update({
      last_offers_sync_at: new Date().toISOString(),
      sync_status: "completed",
    })
    .eq("id", 1);
}
