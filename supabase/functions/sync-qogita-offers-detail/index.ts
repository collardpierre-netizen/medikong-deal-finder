import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: syncLog } = await supabase.from("sync_logs").insert({
    sync_type: "offers_detail", status: "running", stats: {},
  }).select().single();

  try {
    const { data: config } = await supabase.from("qogita_config").select("*").eq("id", 1).single();
    if (!config?.bearer_token) throw new Error("Qogita bearer token not configured");

    const baseUrl = config.base_url || "https://api.qogita.com";
    const headers = { Authorization: `Bearer ${config.bearer_token}`, Accept: "application/json" };

    // Get all Qogita products
    const { data: products, error: pError } = await supabase
      .from("products")
      .select("id, qogita_qid, gtin, category_id, brand_id")
      .eq("source", "qogita")
      .eq("is_active", true)
      .not("qogita_qid", "is", null);

    if (pError) throw pError;
    if (!products || products.length === 0) {
      const stats = { message: "No Qogita products to sync" };
      await supabase.from("sync_logs").update({
        status: "completed", completed_at: new Date().toISOString(), stats,
      }).eq("id", syncLog?.id);
      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-load margin rules (sorted by priority desc)
    const { data: marginRules } = await supabase
      .from("margin_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    let vendorsCreated = 0, offersCreated = 0, offersUpdated = 0, offersDeactivated = 0, errors = 0;
    const processedOfferQids = new Set<string>();

    // Process in batches
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      for (const product of batch) {
        try {
          const res = await fetch(`${baseUrl}/variants/${product.qogita_qid}/`, { headers });
          if (!res.ok) {
            if (res.status === 404) continue;
            console.error(`Variant ${product.qogita_qid} fetch failed: ${res.status}`);
            errors++;
            continue;
          }

          const variant = await res.json();
          const offers = variant.offers || [];

          for (const offer of offers) {
            const offerQid = offer.offerQid || offer.qid;
            if (!offerQid) continue;
            processedOfferQids.add(offerQid);

            const sellerAlias = offer.sellerAlias || offer.seller?.alias || `seller-${offerQid.slice(0, 8)}`;

            // Find or create vendor
            let { data: vendor } = await supabase
              .from("vendors")
              .select("id")
              .eq("qogita_seller_alias", sellerAlias)
              .maybeSingle();

            if (!vendor) {
              const slug = sellerAlias.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              const { data: newVendor } = await supabase.from("vendors").insert({
                type: "qogita_virtual",
                name: sellerAlias,
                slug,
                qogita_seller_alias: sellerAlias,
                auto_forward_to_qogita: true,
                is_active: true,
              }).select("id").single();
              vendor = newVendor;
              vendorsCreated++;
            }

            if (!vendor) continue;

            // Extract pricing
            const basePrice = parseFloat(offer.price || offer.unitPrice || "0");
            const stockQty = parseInt(offer.stockQuantity || offer.stock || "0", 10);
            const delayDays = parseInt(offer.deliveryDays || offer.delay || "3", 10);
            const shipFrom = offer.shipsFromCountry || offer.shipFromCountry || "BE";
            const moq = parseInt(offer.minimumOrderQuantity || offer.moq || "1", 10);

            // Extract price tiers
            let priceTiers: any[] | null = null;
            if (offer.priceTiers || offer.volumePricing) {
              const tiers = offer.priceTiers || offer.volumePricing || [];
              priceTiers = tiers.map((t: any) => ({
                min_qty: t.minimumQuantity || t.minQty || t.quantity,
                qogita_base_price: parseFloat(t.price || t.unitPrice || "0"),
              }));
            }

            // Find matching margin rule
            let marginPct = 15.0;
            let extraDelay = 2;
            let roundTo = 0.01;
            let matchedRuleId: string | null = null;

            for (const rule of (marginRules || [])) {
              const matchCat = !rule.category_id || rule.category_id === product.category_id;
              const matchBrand = !rule.brand_id || rule.brand_id === product.brand_id;
              const matchVendor = !rule.vendor_id || rule.vendor_id === vendor.id;
              const matchMinPrice = rule.min_base_price == null || basePrice >= rule.min_base_price;
              const matchMaxPrice = rule.max_base_price == null || basePrice <= rule.max_base_price;

              if (matchCat && matchBrand && matchVendor && matchMinPrice && matchMaxPrice) {
                marginPct = rule.margin_percentage;
                extraDelay = rule.extra_delay_days;
                roundTo = rule.round_price_to;
                matchedRuleId = rule.id;
                break;
              }
            }

            const priceExclVat = Math.round(basePrice * (1 + marginPct / 100) / roundTo) * roundTo;
            const priceInclVat = Math.round(priceExclVat * 1.21 * 100) / 100;
            const marginAmount = priceExclVat - basePrice;

            // Apply margin to price tiers
            const finalPriceTiers = priceTiers?.map(t => ({
              min_qty: t.min_qty,
              price_excl_vat: Math.round(t.qogita_base_price * (1 + marginPct / 100) / roundTo) * roundTo,
            })) || null;

            const offerRow = {
              product_id: product.id,
              vendor_id: vendor.id,
              qogita_offer_qid: offerQid,
              qogita_base_price: basePrice,
              qogita_base_delay_days: delayDays,
              is_qogita_backed: true,
              price_excl_vat: priceExclVat,
              price_incl_vat: priceInclVat,
              vat_rate: 21.0,
              moq,
              stock_quantity: stockQty,
              stock_status: stockQty > 0 ? "in_stock" : "out_of_stock",
              delivery_days: delayDays + extraDelay,
              shipping_from_country: shipFrom,
              price_tiers: finalPriceTiers,
              applied_margin_rule_id: matchedRuleId,
              applied_margin_percentage: marginPct,
              margin_amount: marginAmount,
              is_active: true,
              synced_at: new Date().toISOString(),
            };

            // Upsert by qogita_offer_qid
            const { data: existingOffer } = await supabase
              .from("offers")
              .select("id")
              .eq("qogita_offer_qid", offerQid)
              .maybeSingle();

            if (existingOffer) {
              await supabase.from("offers").update(offerRow).eq("id", existingOffer.id);
              offersUpdated++;
            } else {
              await supabase.from("offers").insert(offerRow);
              offersCreated++;
            }
          }
        } catch (e: any) {
          console.error(`Error processing product ${product.qogita_qid}:`, e.message);
          errors++;
        }
      }

      // Pause between batches
      if (i + BATCH_SIZE < products.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // Deactivate absent Qogita offers
    const { data: existingQOffers } = await supabase
      .from("offers")
      .select("id, qogita_offer_qid")
      .eq("is_qogita_backed", true)
      .eq("is_active", true)
      .not("qogita_offer_qid", "is", null);

    for (const o of (existingQOffers || [])) {
      if (o.qogita_offer_qid && !processedOfferQids.has(o.qogita_offer_qid)) {
        await supabase.from("offers").update({ is_active: false }).eq("id", o.id);
        offersDeactivated++;
      }
    }

    const stats = {
      products_processed: products.length,
      vendors_created: vendorsCreated,
      offers_created: offersCreated,
      offers_updated: offersUpdated,
      offers_deactivated: offersDeactivated,
      errors,
    };

    await supabase.from("sync_logs").update({
      status: errors > 0 ? "partial" : "completed",
      completed_at: new Date().toISOString(),
      stats,
    }).eq("id", syncLog?.id);

    await supabase.from("qogita_config").update({
      last_offers_sync_at: new Date().toISOString(),
      sync_status: "completed",
    }).eq("id", 1);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync offers detail error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
    }).eq("id", syncLog?.id);
    await supabase.from("qogita_config").update({
      sync_status: "error", sync_error_message: error.message,
    }).eq("id", 1);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
