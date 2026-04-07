import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Load thresholds
    const { data: settings } = await supabase
      .from("price_alert_settings")
      .select("setting_key, setting_value");

    const getNum = (key: string, fb: number) => {
      const s = settings?.find((r: any) => r.setting_key === key);
      return s ? parseFloat(s.setting_value) : fb;
    };

    const thInfo = getNum("threshold_info", 5);
    const thWarn = getNum("threshold_warning", 15);
    const thCrit = getNum("threshold_critical", 25);

    // 2. Build competitor best price per product from market_prices
    const competitorBest: Record<string, { price: number; source: string }> = {};

    // Process in batches - get all matched market prices
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data: mp, error } = await supabase
        .from("market_prices")
        .select("product_id, prix_pharmacien, prix_grossiste, prix_public")
        .eq("is_matched", true)
        .not("product_id", "is", null)
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!mp || mp.length === 0) break;

      for (const row of mp) {
        const refPrice = row.prix_pharmacien || row.prix_grossiste || row.prix_public;
        if (!refPrice || refPrice <= 0) continue;
        const pid = row.product_id;
        if (!competitorBest[pid] || refPrice < competitorBest[pid].price) {
          competitorBest[pid] = { price: refPrice, source: "market_price" };
        }
      }

      if (mp.length < batchSize) break;
      offset += batchSize;
    }

    // Also check external_offers
    offset = 0;
    while (true) {
      const { data: eo, error } = await supabase
        .from("external_offers")
        .select("product_id, unit_price")
        .eq("is_active", true)
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!eo || eo.length === 0) break;

      for (const row of eo) {
        if (!row.unit_price || row.unit_price <= 0) continue;
        const pid = row.product_id;
        if (!competitorBest[pid] || row.unit_price < competitorBest[pid].price) {
          competitorBest[pid] = { price: row.unit_price, source: "external_offer" };
        }
      }

      if (eo.length < batchSize) break;
      offset += batchSize;
    }

    const competitorProductIds = Object.keys(competitorBest);
    console.log(`Found competitor prices for ${competitorProductIds.length} products`);

    if (competitorProductIds.length === 0) {
      return new Response(JSON.stringify({ message: "No competitor prices found", alerts_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get MediKong prices for those products (batch)
    let alertsCreated = 0;
    let alertsUpdated = 0;
    let alertsResolved = 0;
    let refPricesSet = 0;

    const chunkSize = 200;
    for (let i = 0; i < competitorProductIds.length; i += chunkSize) {
      const chunk = competitorProductIds.slice(i, i + chunkSize);

      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id, name, best_price_incl_vat")
        .in("id", chunk)
        .eq("is_active", true)
        .gt("best_price_incl_vat", 0);

      if (pErr) { console.error("Product fetch error:", pErr.message); continue; }
      if (!products || products.length === 0) continue;

      for (const product of products) {
        const comp = competitorBest[product.id];
        if (!comp) continue;

        const mkPrice = product.best_price_incl_vat;
        const refPrice = comp.price;

        // Update reference_price
        await supabase
          .from("products")
          .update({ reference_price: refPrice })
          .eq("id", product.id);
        refPricesSet++;

        // Only alert if MediKong is MORE expensive
        if (mkPrice <= refPrice) continue;

        const gapAmount = mkPrice - refPrice;
        const gapPct = Math.round((gapAmount / refPrice) * 100 * 10) / 10;

        let severity: string;
        let alertType: string;
        if (gapPct >= thCrit) {
          severity = "critical"; alertType = "critical_gap";
        } else if (gapPct >= thWarn) {
          severity = "warning"; alertType = "significant_gap";
        } else if (gapPct >= thInfo) {
          severity = "info"; alertType = "minor_gap";
        } else {
          continue;
        }

        // Check existing alert
        const { data: existing } = await supabase
          .from("price_alerts")
          .select("id")
          .eq("product_id", product.id)
          .in("status", ["open", "acknowledged"])
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase
            .from("price_alerts")
            .update({
              reference_price: refPrice, best_medikong_price: mkPrice,
              gap_amount: gapAmount, gap_percentage: gapPct,
              severity, alert_type: alertType, updated_at: new Date().toISOString(),
            })
            .eq("id", existing[0].id);
          alertsUpdated++;
        } else {
          const { data: newAlert, error: aErr } = await supabase
            .from("price_alerts")
            .insert({
              product_id: product.id, alert_type: alertType, severity,
              reference_price: refPrice, best_medikong_price: mkPrice,
              gap_amount: gapAmount, gap_percentage: gapPct, status: "open",
            })
            .select("id")
            .single();

          if (aErr) { console.error(`Alert err ${product.id}:`, aErr.message); continue; }

          // Link affected vendors
          const { data: offers } = await supabase
            .from("offers")
            .select("vendor_id, price_incl_vat")
            .eq("product_id", product.id)
            .eq("is_active", true);

          if (offers && offers.length > 0) {
            const rows = offers.map((o: any) => ({
              alert_id: newAlert.id,
              vendor_id: o.vendor_id,
              vendor_price: o.price_incl_vat,
              vendor_gap_percentage: Math.round(((o.price_incl_vat - refPrice) / refPrice) * 100 * 10) / 10,
              suggested_price: Math.round(refPrice * 0.99 * 100) / 100,
            }));
            await supabase.from("price_alert_vendors").insert(rows);
          }
          alertsCreated++;
        }
      }
    }

    // 4. Auto-resolve alerts where MediKong now cheaper
    const { data: openAlerts } = await supabase
      .from("price_alerts")
      .select("id, product_id, reference_price")
      .in("status", ["open", "acknowledged"]);

    for (const alert of openAlerts || []) {
      const comp = competitorBest[alert.product_id];
      if (!comp) continue;
      const { data: prod } = await supabase
        .from("products")
        .select("best_price_incl_vat")
        .eq("id", alert.product_id)
        .single();

      if (prod && prod.best_price_incl_vat <= comp.price) {
        await supabase
          .from("price_alerts")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", alert.id);
        alertsResolved++;
      }
    }

    const result = {
      competitor_prices_found: competitorProductIds.length,
      alerts_created: alertsCreated,
      alerts_updated: alertsUpdated,
      alerts_resolved: alertsResolved,
      reference_prices_set: refPricesSet,
    };

    console.log("Price alert detection completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in detect-price-alerts:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
