import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;
const BATCH_SIZE = 20;
const API_DELAY_MS = 500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function getQogitaToken(sb: any): Promise<{ token: string; baseUrl: string }> {
  const { data: config } = await sb.from("qogita_config").select("*").eq("id", 1).single();
  if (!config?.qogita_email || !config?.qogita_password) throw new Error("Qogita credentials missing");
  const baseUrl = config.base_url || "https://api.qogita.com";
  const res = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.qogita_email, password: config.qogita_password }),
  });
  if (!res.ok) throw new Error(`Auth failed (${res.status})`);
  const { accessToken } = await res.json();
  if (!accessToken) throw new Error("No accessToken");
  await sb.from("qogita_config").update({ bearer_token: accessToken }).eq("id", 1);
  return { token: accessToken, baseUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let targetCountry = "";
  try {
    const body = await req.json();
    if (body?.country) targetCountry = body.country;
  } catch { /* */ }

  // Default country from config
  if (!targetCountry) {
    const { data: cfg } = await sb.from("qogita_config").select("default_country").eq("id", 1).single();
    targetCountry = cfg?.default_country || "BE";
  }

  // Verify country
  const { data: ctryRow } = await sb.from("countries").select("code, default_vat_rate")
    .eq("code", targetCountry).eq("is_active", true).single();
  if (!ctryRow) {
    return new Response(JSON.stringify({ error: `Country ${targetCountry} not active` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const vatRate = ctryRow.default_vat_rate || 21;
  const vatMultiplier = 1 + vatRate / 100;

  // Check for resumable partial sync
  const { data: existingPartial } = await sb.from("sync_logs")
    .select("*").eq("sync_type", "offers_detail").eq("status", "partial")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  let lastOffset = 0;

  if (existingPartial) {
    syncLogId = existingPartial.id;
    const prevStats = (existingPartial.stats as any) || {};
    lastOffset = prevStats.last_offset || 0;
    await sb.from("sync_logs").update({
      status: "running",
      progress_message: `Reprise ${targetCountry} à partir de ${lastOffset}...`,
    }).eq("id", syncLogId);
  } else {
    // Cancel any stale running
    await sb.from("sync_logs").update({ status: "error", error_message: "Superseded", completed_at: new Date().toISOString() })
      .eq("sync_type", "offers_detail").eq("status", "running");

    const { data: newLog } = await sb.from("sync_logs").insert({
      sync_type: "offers_detail", status: "running",
      stats: { country: targetCountry },
      progress_current: 0, progress_total: 0,
      progress_message: `${targetCountry}: authentification...`,
    }).select().single();
    syncLogId = newLog!.id;
  }

  // Launch background
  (globalThis as any).EdgeRuntime.waitUntil(
    syncOffers(sb, targetCountry, vatRate, vatMultiplier, syncLogId, lastOffset, startTime).catch(async (e: any) => {
      console.error("Sync offers error:", e);
      await sb.from("sync_logs").update({
        status: "error", completed_at: new Date().toISOString(),
        error_message: e.message, progress_message: `Erreur: ${e.message}`,
      }).eq("id", syncLogId);
    })
  );

  return new Response(JSON.stringify({
    success: true, sync_log_id: syncLogId, country: targetCountry,
    message: `Sync offres ${targetCountry} lancée en arrière-plan`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

async function syncOffers(
  sb: any, country: string, vatRate: number, vatMultiplier: number,
  logId: string, startOffset: number, startTime: number,
) {
  const { token, baseUrl } = await getQogitaToken(sb);

  // Get products with GTIN for this country
  const { data: products, error: pErr } = await sb.from("products")
    .select("id, gtin, qogita_qid, category_id, brand_id")
    .eq("source", "qogita").eq("is_active", true)
    .not("gtin", "is", null)
    .order("created_at", { ascending: true })
    .range(0, 49999); // up to 50k

  if (pErr) throw pErr;
  if (!products?.length) {
    await sb.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(),
      progress_message: `${country}: aucun produit avec GTIN`,
    }).eq("id", logId);
    return;
  }

  const total = products.length;
  await sb.from("sync_logs").update({
    progress_total: total,
    progress_current: startOffset,
    progress_message: `${country}: ${total} produits à enrichir...`,
  }).eq("id", logId);

  // Pre-load margin rules
  const { data: marginRules } = await sb.from("margin_rules").select("*").eq("is_active", true).order("priority", { ascending: false });

  // Ensure virtual Qogita vendor exists
  let qogitaVendorId: string;
  const { data: existingVendor } = await sb.from("vendors").select("id")
    .eq("type", "qogita_virtual").eq("slug", "qogita").maybeSingle();
  if (existingVendor) {
    qogitaVendorId = existingVendor.id;
  } else {
    const { data: nv } = await sb.from("vendors").insert({
      type: "qogita_virtual", name: "Qogita", slug: "qogita",
      qogita_seller_alias: "qogita", auto_forward_to_qogita: true, is_active: true,
    }).select("id").single();
    qogitaVendorId = nv!.id;
  }

  let stats = {
    country, products_enriched: 0, offers_upserted: 0, errors: 0, last_offset: startOffset,
  };
  let offerBatch: any[] = [];

  async function flushOffers() {
    if (!offerBatch.length) return;
    const { error } = await sb.from("offers").upsert(offerBatch, {
      onConflict: "qogita_offer_qid", ignoreDuplicates: false,
    });
    if (error) console.error("Offer upsert error:", error.message);
    else stats.offers_upserted += offerBatch.length;
    offerBatch = [];
  }

  for (let i = startOffset; i < total; i++) {
    // Timeout check
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      await flushOffers();
      stats.last_offset = i;
      await sb.from("sync_logs").update({
        status: "partial", stats,
        progress_current: i, progress_total: total,
        progress_message: `${country}: pause timeout — ${i}/${total} (reprendra au prochain clic)`,
      }).eq("id", logId);
      return;
    }

    const product = products[i];
    try {
      const res = await fetch(`${baseUrl}/variants/${product.gtin}/?country=${country}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 404) { /* product not found on Qogita for this country */ }
        else { stats.errors++; console.error(`API ${res.status} for GTIN ${product.gtin}`); }
        continue;
      }

      const variant = await res.json();

      // Update product with enriched data
      const productUpdate: any = { synced_at: new Date().toISOString() };
      if (variant.qid) productUpdate.qogita_qid = variant.qid;
      if (variant.description) productUpdate.description = variant.description;
      if (variant.images?.length) productUpdate.image_urls = variant.images.map((img: any) => typeof img === "string" ? img : img.url || img.src);
      if (variant.name) productUpdate.name = variant.name;

      await sb.from("products").update(productUpdate).eq("id", product.id);

      // Process offers
      const offers = variant.offers || [];
      for (const offer of offers) {
        const offerQid = offer.qid || offer.offerQid;
        if (!offerQid) continue;

        const countryOfferQid = `${offerQid}-${country}`;
        const basePrice = parseFloat(offer.unitPrice || offer.price || "0");
        const stockQty = parseInt(offer.inventory || offer.stockQuantity || "0", 10);
        const delayDays = parseInt(offer.estimatedDelivery || offer.deliveryDays || "3", 10);
        const moq = parseInt(offer.minimumOrderQuantity || offer.moq || "1", 10);

        // Find matching margin rule
        let marginPct = 15.0, extraDelay = 2, roundTo = 0.01, ruleId: string | null = null;
        for (const rule of (marginRules || [])) {
          const match = (!rule.category_id || rule.category_id === product.category_id)
            && (!rule.brand_id || rule.brand_id === product.brand_id)
            && (rule.min_base_price == null || basePrice >= rule.min_base_price)
            && (rule.max_base_price == null || basePrice <= rule.max_base_price);
          if (match) { marginPct = rule.margin_percentage; extraDelay = rule.extra_delay_days; roundTo = rule.round_price_to; ruleId = rule.id; break; }
        }

        const priceExcl = Math.round(basePrice * (1 + marginPct / 100) / roundTo) * roundTo;
        const priceIncl = Math.round(priceExcl * vatMultiplier * 100) / 100;

        offerBatch.push({
          product_id: product.id, vendor_id: qogitaVendorId,
          qogita_offer_qid: countryOfferQid, country_code: country,
          qogita_base_price: basePrice, qogita_base_delay_days: delayDays,
          is_qogita_backed: true,
          price_excl_vat: priceExcl, price_incl_vat: priceIncl, vat_rate: vatRate,
          moq, stock_quantity: stockQty,
          stock_status: stockQty > 0 ? "in_stock" : "out_of_stock",
          delivery_days: delayDays + extraDelay, shipping_from_country: country,
          applied_margin_rule_id: ruleId, applied_margin_percentage: marginPct,
          margin_amount: priceExcl - basePrice, is_active: true,
          synced_at: new Date().toISOString(),
        });

        if (offerBatch.length >= 100) await flushOffers();
      }

      stats.products_enriched++;
    } catch (e: any) {
      stats.errors++;
      console.error(`Error GTIN ${product.gtin}:`, e.message);
    }

    // Progress update every batch
    if ((i + 1) % BATCH_SIZE === 0 || i === total - 1) {
      await flushOffers();
      stats.last_offset = i + 1;
      await sb.from("sync_logs").update({
        stats, progress_current: i + 1, progress_total: total,
        progress_message: `${country}: ${i + 1}/${total} — ${stats.offers_upserted} offres, ${stats.products_enriched} enrichis`,
      }).eq("id", logId);
    }

    // Rate limiting
    await sleep(API_DELAY_MS);
  }

  await flushOffers();

  // Done
  await sb.from("sync_logs").update({
    status: "completed", completed_at: new Date().toISOString(),
    stats, progress_current: total, progress_total: total,
    progress_message: `${country}: terminé — ${stats.products_enriched} enrichis, ${stats.offers_upserted} offres ✓`,
  }).eq("id", logId);

  await sb.from("qogita_config").update({
    last_offers_sync_at: new Date().toISOString(), sync_status: "completed",
  }).eq("id", 1);
}
