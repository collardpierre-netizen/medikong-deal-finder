import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;
const BATCH_SIZE = 50;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function getQogitaToken(supabaseClient: any): Promise<{ token: string; baseUrl: string }> {
  const { data: config } = await supabaseClient.from("qogita_config").select("*").eq("id", 1).single();
  if (!config) throw new Error("qogita_config not found");
  if (!config.qogita_email || !config.qogita_password) throw new Error("Qogita email/password not configured");
  const baseUrl = config.base_url || "https://api.qogita.com";
  const authResponse = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.qogita_email, password: config.qogita_password }),
  });
  if (!authResponse.ok) throw new Error(`Qogita auth failed (${authResponse.status}): ${await authResponse.text()}`);
  const authData = await authResponse.json();
  const token = authData.accessToken;
  if (!token) throw new Error("No accessToken in Qogita auth response");
  await supabaseClient.from("qogita_config").update({ bearer_token: token }).eq("id", 1);
  return { token, baseUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Parse optional country filter from request body
  let requestedCountries: string[] | null = null;
  try {
    const body = await req.json();
    if (body?.countries && Array.isArray(body.countries)) requestedCountries = body.countries;
    if (body?.country) requestedCountries = [body.country];
  } catch { /* no body */ }

  // Get active countries with sync enabled
  const { data: syncCountries } = await supabase
    .from("countries").select("code, name, default_vat_rate")
    .eq("is_active", true).eq("qogita_sync_enabled", true).order("display_order");
  let countriesToSync = syncCountries || [{ code: "BE", name: "Belgique", default_vat_rate: 21 }];
  if (requestedCountries) {
    countriesToSync = countriesToSync.filter((c: any) => requestedCountries!.includes(c.code));
  }

  const { data: existingSync } = await supabase
    .from("sync_logs").select("*").eq("sync_type", "offers_detail").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  let stats = {
    products_processed: 0, products_total: 0, vendors_created: 0,
    offers_upserted: 0, offers_deactivated: 0, errors: 0,
    countries_done: [] as string[], current_country: "",
  };
  let resumeOffset = 0;
  let skipCountries: string[] = [];

  if (existingSync && (existingSync.stats as any)?.products_processed > 0) {
    syncLogId = existingSync.id;
    stats = existingSync.stats as any;
    resumeOffset = stats.products_processed;
    skipCountries = stats.countries_done || [];
    await supabase.from("sync_logs").update({ progress_message: `Reprise...` }).eq("id", syncLogId);
  } else {
    if (existingSync) {
      await supabase.from("sync_logs").update({ status: "error", error_message: "Superseded", completed_at: new Date().toISOString() }).eq("id", existingSync.id);
    }
    const { data: newLog } = await supabase.from("sync_logs").insert({
      sync_type: "offers_detail", status: "running", stats: {},
      progress_current: 0, progress_total: 0, progress_message: "Authentification Qogita...",
    }).select().single();
    syncLogId = newLog!.id;
  }

  try {
    const { token, baseUrl } = await getQogitaToken(supabase);

    // Get all Qogita products
    const { data: products, error: pError } = await supabase
      .from("products").select("id, qogita_qid, category_id, brand_id")
      .eq("source", "qogita").eq("is_active", true).not("qogita_qid", "is", null);
    if (pError) throw pError;
    if (!products || products.length === 0) {
      await supabase.from("sync_logs").update({
        status: "completed", completed_at: new Date().toISOString(),
        progress_message: "Aucun produit Qogita",
      }).eq("id", syncLogId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    stats.products_total = products.length;
    const { data: marginRules } = await supabase.from("margin_rules").select("*").eq("is_active", true).order("priority", { ascending: false });

    // Pre-load existing vendors
    const { data: existingVendors } = await supabase.from("vendors").select("id, qogita_seller_alias");
    const vendorMap = new Map((existingVendors || []).map(v => [v.qogita_seller_alias, v.id]));

    // Process each country
    for (let ci = 0; ci < countriesToSync.length; ci++) {
      const ctry = countriesToSync[ci] as any;
      if (skipCountries.includes(ctry.code)) continue;

      stats.current_country = ctry.code;
      const vatRate = ctry.default_vat_rate || 21;
      const vatMultiplier = 1 + vatRate / 100;

      await supabase.from("sync_logs").update({
        progress_total: products.length * countriesToSync.length,
        progress_message: `Pays ${ci + 1}/${countriesToSync.length} (${ctry.code}) — ${products.length} produits`,
      }).eq("id", syncLogId);

      const processedOfferQids = new Set<string>();
      let offerBatch: any[] = [];

      async function flushOfferBatch() {
        if (offerBatch.length === 0) return;
        const { error } = await supabase.from("offers").upsert(offerBatch, {
          onConflict: "qogita_offer_qid",
          ignoreDuplicates: false,
        });
        if (error) throw error;
        stats.offers_upserted += offerBatch.length;
        offerBatch = [];
      }

      // Determine resume point for this country
      const countryResumeOffset = (skipCountries.length === 0 && ci === 0) ? resumeOffset : 0;

      for (let i = countryResumeOffset; i < products.length; i++) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          await flushOfferBatch();
          stats.products_processed = i;
          await supabase.from("sync_logs").update({
            stats, progress_current: stats.products_processed + (ci * products.length),
            progress_total: products.length * countriesToSync.length,
            progress_message: `Pause timeout — ${ctry.code} ${i}/${products.length}`,
          }).eq("id", syncLogId);
          return new Response(JSON.stringify({ status: "partial", resumeAt: i, stats }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const product = products[i];
        try {
          // Fetch variant detail with country parameter
          const res = await fetch(`${baseUrl}/variants/${product.qogita_qid}/?country=${ctry.code}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          });
          if (!res.ok) {
            if (res.status === 404) continue;
            stats.errors++;
            continue;
          }

          const variant = await res.json();
          const offers = variant.offers || [];

          for (const offer of offers) {
            const offerQid = offer.offerQid || offer.qid;
            if (!offerQid) continue;
            // Country-specific offer QID to allow same offer in different countries
            const countryOfferQid = `${offerQid}-${ctry.code}`;
            processedOfferQids.add(countryOfferQid);

            const sellerAlias = offer.sellerAlias || offer.seller?.alias || `seller-${offerQid.slice(0, 8)}`;
            let vendorId = vendorMap.get(sellerAlias);
            if (!vendorId) {
              const slug = sellerAlias.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              const { data: newVendor } = await supabase.from("vendors").insert({
                type: "qogita_virtual", name: sellerAlias, slug, qogita_seller_alias: sellerAlias,
                auto_forward_to_qogita: true, is_active: true,
              }).select("id").single();
              if (newVendor) {
                vendorId = newVendor.id;
                vendorMap.set(sellerAlias, vendorId);
                stats.vendors_created++;
              } else continue;
            }

            const basePrice = parseFloat(offer.price || offer.unitPrice || "0");
            const stockQty = parseInt(offer.stockQuantity || offer.stock || "0", 10);
            const delayDays = parseInt(offer.deliveryDays || offer.delay || "3", 10);
            const shipFrom = offer.shipsFromCountry || offer.shipFromCountry || ctry.code;
            const moq = parseInt(offer.minimumOrderQuantity || offer.moq || "1", 10);

            let marginPct = 15.0, extraDelay = 2, roundTo = 0.01, matchedRuleId: string | null = null;
            for (const rule of (marginRules || [])) {
              const match = (!rule.category_id || rule.category_id === product.category_id)
                && (!rule.brand_id || rule.brand_id === product.brand_id)
                && (!rule.vendor_id || rule.vendor_id === vendorId)
                && (rule.min_base_price == null || basePrice >= rule.min_base_price)
                && (rule.max_base_price == null || basePrice <= rule.max_base_price);
              if (match) { marginPct = rule.margin_percentage; extraDelay = rule.extra_delay_days; roundTo = rule.round_price_to; matchedRuleId = rule.id; break; }
            }

            const priceExclVat = Math.round(basePrice * (1 + marginPct / 100) / roundTo) * roundTo;
            const priceInclVat = Math.round(priceExclVat * vatMultiplier * 100) / 100;

            offerBatch.push({
              product_id: product.id, vendor_id: vendorId,
              qogita_offer_qid: countryOfferQid, // country-specific QID
              country_code: ctry.code, // ← KEY: set country on offer
              qogita_base_price: basePrice, qogita_base_delay_days: delayDays, is_qogita_backed: true,
              price_excl_vat: priceExclVat, price_incl_vat: priceInclVat,
              vat_rate: vatRate, // ← use country-specific VAT
              moq,
              stock_quantity: stockQty, stock_status: stockQty > 0 ? "in_stock" : "out_of_stock",
              delivery_days: delayDays + extraDelay, shipping_from_country: shipFrom,
              applied_margin_rule_id: matchedRuleId, applied_margin_percentage: marginPct,
              margin_amount: priceExclVat - basePrice, is_active: true, synced_at: new Date().toISOString(),
            });

            if (offerBatch.length >= 100) await flushOfferBatch();
          }
        } catch (e: any) {
          console.error(`Error product ${product.qogita_qid} (${ctry.code}):`, e.message);
          stats.errors++;
        }

        stats.products_processed = i + 1;

        if ((i + 1) % BATCH_SIZE === 0 || i === products.length - 1) {
          await flushOfferBatch();
          await supabase.from("sync_logs").update({
            stats,
            progress_current: (ci * products.length) + i + 1,
            progress_total: products.length * countriesToSync.length,
            progress_message: `${ctry.code}: ${i + 1}/${products.length} produits — ${stats.offers_upserted} offres total`,
          }).eq("id", syncLogId);
          if (i + 1 < products.length) await sleep(300);
        }
      }

      await flushOfferBatch();

      // Deactivate absent offers for this country
      await supabase.from("sync_logs").update({ progress_message: `${ctry.code}: Désactivation offres absentes...` }).eq("id", syncLogId);
      const { data: existingQOffers } = await supabase.from("offers").select("id, qogita_offer_qid")
        .eq("is_qogita_backed", true).eq("is_active", true).eq("country_code", ctry.code)
        .not("qogita_offer_qid", "is", null);
      const toDeactivate = (existingQOffers || [])
        .filter(o => o.qogita_offer_qid && !processedOfferQids.has(o.qogita_offer_qid))
        .map(o => o.id);
      if (toDeactivate.length > 0) {
        for (let i = 0; i < toDeactivate.length; i += 200) {
          await supabase.from("offers").update({ is_active: false }).in("id", toDeactivate.slice(i, i + 200));
        }
      }
      stats.offers_deactivated += toDeactivate.length;

      // Mark country done
      stats.countries_done = [...(stats.countries_done || []), ctry.code];
      stats.products_processed = 0; // Reset for next country
    }

    await supabase.from("sync_logs").update({
      status: stats.errors > 0 ? "partial" : "completed", completed_at: new Date().toISOString(), stats,
      progress_current: products.length * countriesToSync.length,
      progress_total: products.length * countriesToSync.length,
      progress_message: `Terminé — ${stats.offers_upserted} offres (${countriesToSync.map((c: any) => c.code).join(", ")}), ${stats.offers_deactivated} désactivées`,
    }).eq("id", syncLogId);

    await supabase.from("qogita_config").update({ last_offers_sync_at: new Date().toISOString(), sync_status: "completed" }).eq("id", 1);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync offers detail error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
      progress_message: `Erreur: ${error.message}`,
    }).eq("id", syncLogId);
    await supabase.from("qogita_config").update({ sync_status: "error", sync_error_message: error.message }).eq("id", 1);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
