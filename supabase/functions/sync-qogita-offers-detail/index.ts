import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;
const BATCH_SIZE = 50;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function getQogitaToken(supabaseClient: any): Promise<{ token: string; baseUrl: string; config: any }> {
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
  return { token, baseUrl, config };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Check for interrupted sync
  const { data: existingSync } = await supabase
    .from("sync_logs").select("*").eq("sync_type", "offers_detail").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  let resumeOffset = 0;
  let stats = { products_processed: 0, products_total: 0, vendors_created: 0, offers_created: 0, offers_updated: 0, offers_deactivated: 0, errors: 0 };

  if (existingSync && (existingSync.stats as any)?.products_processed > 0) {
    syncLogId = existingSync.id;
    stats = existingSync.stats as any;
    resumeOffset = stats.products_processed;
    await supabase.from("sync_logs").update({ progress_message: `Reprise au produit ${resumeOffset}...` }).eq("id", syncLogId);
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
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };

    // Get all Qogita products
    const { data: products, error: pError } = await supabase
      .from("products").select("id, qogita_qid, gtin, category_id, brand_id")
      .eq("source", "qogita").eq("is_active", true).not("qogita_qid", "is", null);
    if (pError) throw pError;
    if (!products || products.length === 0) {
      await supabase.from("sync_logs").update({
        status: "completed", completed_at: new Date().toISOString(),
        stats: { message: "No Qogita products" }, progress_message: "Aucun produit Qogita",
      }).eq("id", syncLogId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    stats.products_total = products.length;
    await supabase.from("sync_logs").update({ progress_total: products.length, progress_message: `${products.length} produits à traiter` }).eq("id", syncLogId);

    const { data: marginRules } = await supabase.from("margin_rules").select("*").eq("is_active", true).order("priority", { ascending: false });
    const processedOfferQids = new Set<string>();

    for (let i = resumeOffset; i < products.length; i++) {
      // Timeout safety
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        stats.products_processed = i;
        await supabase.from("sync_logs").update({
          stats, progress_current: i, progress_total: products.length,
          progress_message: `Pause timeout — reprendra au produit ${i}/${products.length}`,
        }).eq("id", syncLogId);
        return new Response(JSON.stringify({ status: "partial", resumeAt: i, stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const product = products[i];
      try {
        const res = await fetch(`${baseUrl}/variants/${product.qogita_qid}/`, { headers });
        if (!res.ok) {
          if (res.status === 404) continue;
          console.error(`Variant ${product.qogita_qid} fetch failed: ${res.status}`);
          stats.errors++;
          continue;
        }

        const variant = await res.json();
        const offers = variant.offers || [];

        for (const offer of offers) {
          const offerQid = offer.offerQid || offer.qid;
          if (!offerQid) continue;
          processedOfferQids.add(offerQid);

          const sellerAlias = offer.sellerAlias || offer.seller?.alias || `seller-${offerQid.slice(0, 8)}`;
          let { data: vendor } = await supabase.from("vendors").select("id").eq("qogita_seller_alias", sellerAlias).maybeSingle();
          if (!vendor) {
            const slug = sellerAlias.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const { data: newVendor } = await supabase.from("vendors").insert({
              type: "qogita_virtual", name: sellerAlias, slug, qogita_seller_alias: sellerAlias,
              auto_forward_to_qogita: true, is_active: true,
            }).select("id").single();
            vendor = newVendor;
            stats.vendors_created++;
          }
          if (!vendor) continue;

          const basePrice = parseFloat(offer.price || offer.unitPrice || "0");
          const stockQty = parseInt(offer.stockQuantity || offer.stock || "0", 10);
          const delayDays = parseInt(offer.deliveryDays || offer.delay || "3", 10);
          const shipFrom = offer.shipsFromCountry || offer.shipFromCountry || "BE";
          const moq = parseInt(offer.minimumOrderQuantity || offer.moq || "1", 10);

          let priceTiers: any[] | null = null;
          if (offer.priceTiers || offer.volumePricing) {
            priceTiers = (offer.priceTiers || offer.volumePricing || []).map((t: any) => ({
              min_qty: t.minimumQuantity || t.minQty || t.quantity,
              qogita_base_price: parseFloat(t.price || t.unitPrice || "0"),
            }));
          }

          let marginPct = 15.0, extraDelay = 2, roundTo = 0.01, matchedRuleId: string | null = null;
          for (const rule of (marginRules || [])) {
            const match = (!rule.category_id || rule.category_id === product.category_id)
              && (!rule.brand_id || rule.brand_id === product.brand_id)
              && (!rule.vendor_id || rule.vendor_id === vendor.id)
              && (rule.min_base_price == null || basePrice >= rule.min_base_price)
              && (rule.max_base_price == null || basePrice <= rule.max_base_price);
            if (match) { marginPct = rule.margin_percentage; extraDelay = rule.extra_delay_days; roundTo = rule.round_price_to; matchedRuleId = rule.id; break; }
          }

          const priceExclVat = Math.round(basePrice * (1 + marginPct / 100) / roundTo) * roundTo;
          const priceInclVat = Math.round(priceExclVat * 1.21 * 100) / 100;
          const finalPriceTiers = priceTiers?.map(t => ({ min_qty: t.min_qty, price_excl_vat: Math.round(t.qogita_base_price * (1 + marginPct / 100) / roundTo) * roundTo })) || null;

          const offerRow = {
            product_id: product.id, vendor_id: vendor.id, qogita_offer_qid: offerQid,
            qogita_base_price: basePrice, qogita_base_delay_days: delayDays, is_qogita_backed: true,
            price_excl_vat: priceExclVat, price_incl_vat: priceInclVat, vat_rate: 21.0, moq,
            stock_quantity: stockQty, stock_status: stockQty > 0 ? "in_stock" : "out_of_stock",
            delivery_days: delayDays + extraDelay, shipping_from_country: shipFrom, price_tiers: finalPriceTiers,
            applied_margin_rule_id: matchedRuleId, applied_margin_percentage: marginPct,
            margin_amount: priceExclVat - basePrice, is_active: true, synced_at: new Date().toISOString(),
          };

          const { data: existingOffer } = await supabase.from("offers").select("id").eq("qogita_offer_qid", offerQid).maybeSingle();
          if (existingOffer) { await supabase.from("offers").update(offerRow).eq("id", existingOffer.id); stats.offers_updated++; }
          else { await supabase.from("offers").insert(offerRow); stats.offers_created++; }
        }
      } catch (e: any) {
        console.error(`Error processing product ${product.qogita_qid}:`, e.message);
        stats.errors++;
      }

      stats.products_processed = i + 1;

      if ((i + 1) % BATCH_SIZE === 0 || i === products.length - 1) {
        await supabase.from("sync_logs").update({
          stats, progress_current: i + 1, progress_total: products.length,
          progress_message: `${i + 1}/${products.length} produits — ${stats.offers_created + stats.offers_updated} offres traitées`,
        }).eq("id", syncLogId);
        if (i + 1 < products.length) await sleep(500);
      }
    }

    // Deactivate absent offers
    await supabase.from("sync_logs").update({ progress_message: "Désactivation des offres absentes..." }).eq("id", syncLogId);
    const { data: existingQOffers } = await supabase.from("offers").select("id, qogita_offer_qid").eq("is_qogita_backed", true).eq("is_active", true).not("qogita_offer_qid", "is", null);
    for (const o of (existingQOffers || [])) {
      if (o.qogita_offer_qid && !processedOfferQids.has(o.qogita_offer_qid)) {
        await supabase.from("offers").update({ is_active: false }).eq("id", o.id);
        stats.offers_deactivated++;
      }
    }

    await supabase.from("sync_logs").update({
      status: stats.errors > 0 ? "partial" : "completed", completed_at: new Date().toISOString(), stats,
      progress_current: products.length, progress_total: products.length,
      progress_message: `Terminé — ${stats.offers_created} créées, ${stats.offers_updated} mises à jour, ${stats.offers_deactivated} désactivées`,
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
