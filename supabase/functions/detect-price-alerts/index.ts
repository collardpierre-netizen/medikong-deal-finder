import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Load alert settings (thresholds)
    const { data: settings } = await supabase
      .from("price_alert_settings")
      .select("setting_key, setting_value");

    const getSettingNum = (key: string, fallback: number) => {
      const s = settings?.find((r: any) => r.setting_key === key);
      return s ? parseFloat(s.setting_value) : fallback;
    };

    const thresholdInfo = getSettingNum("threshold_info", 5);
    const thresholdWarning = getSettingNum("threshold_warning", 15);
    const thresholdCritical = getSettingNum("threshold_critical", 25);

    // 2. Get all active products with offers and their best MediKong price
    // We compare against market_prices and external_offers
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, best_price_incl_vat, best_price_excl_vat, gtin")
      .eq("is_active", true)
      .gt("best_price_incl_vat", 0)
      .not("best_price_incl_vat", "is", null)
      .limit(1000);

    if (prodErr) throw prodErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: "No products to check", alerts_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = products.map((p: any) => p.id);

    // 3. Get market prices (reference prices from competitors)
    const { data: marketPrices } = await supabase
      .from("market_prices")
      .select("product_id, prix_pharmacien, prix_grossiste, prix_public, source_id")
      .in("product_id", productIds)
      .eq("is_matched", true);

    // 4. Get external offers
    const { data: externalOffers } = await supabase
      .from("external_offers")
      .select("product_id, unit_price, external_vendor_id")
      .in("product_id", productIds)
      .eq("is_active", true);

    // 5. Build best competitor price per product
    const competitorBest: Record<string, { price: number; source: string }> = {};

    for (const mp of marketPrices || []) {
      const refPrice = mp.prix_pharmacien || mp.prix_grossiste || mp.prix_public;
      if (!refPrice || refPrice <= 0) continue;
      const pid = mp.product_id;
      if (!competitorBest[pid] || refPrice < competitorBest[pid].price) {
        competitorBest[pid] = { price: refPrice, source: "market_price" };
      }
    }

    for (const eo of externalOffers || []) {
      if (!eo.unit_price || eo.unit_price <= 0) continue;
      const pid = eo.product_id;
      if (!competitorBest[pid] || eo.unit_price < competitorBest[pid].price) {
        competitorBest[pid] = { price: eo.unit_price, source: "external_offer" };
      }
    }

    // 6. Detect alerts: MediKong price > competitor price
    let alertsCreated = 0;
    let alertsUpdated = 0;
    let refPricesSet = 0;

    for (const product of products) {
      const comp = competitorBest[product.id];
      if (!comp) continue;

      const mkPrice = product.best_price_incl_vat;
      const refPrice = comp.price;

      // Update reference_price on the product if not set or changed
      // This feeds the promotions system
      await supabase
        .from("products")
        .update({ reference_price: refPrice })
        .eq("id", product.id)
        .is("reference_price", null);
      refPricesSet++;

      // Only alert if MediKong is MORE expensive than competitor
      if (mkPrice <= refPrice) continue;

      const gapAmount = mkPrice - refPrice;
      const gapPercentage = Math.round((gapAmount / refPrice) * 100 * 10) / 10;

      // Determine severity
      let severity: string;
      let alertType: string;
      if (gapPercentage >= thresholdCritical) {
        severity = "critical";
        alertType = "critical_gap";
      } else if (gapPercentage >= thresholdWarning) {
        severity = "warning";
        alertType = "significant_gap";
      } else if (gapPercentage >= thresholdInfo) {
        severity = "info";
        alertType = "minor_gap";
      } else {
        continue; // Below threshold
      }

      // Check if an open alert already exists for this product
      const { data: existingAlerts } = await supabase
        .from("price_alerts")
        .select("id")
        .eq("product_id", product.id)
        .in("status", ["open", "acknowledged"])
        .limit(1);

      if (existingAlerts && existingAlerts.length > 0) {
        // Update existing alert
        await supabase
          .from("price_alerts")
          .update({
            reference_price: refPrice,
            best_medikong_price: mkPrice,
            gap_amount: gapAmount,
            gap_percentage: gapPercentage,
            severity,
            alert_type: alertType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAlerts[0].id);
        alertsUpdated++;
      } else {
        // Create new alert
        const { data: newAlert, error: alertErr } = await supabase
          .from("price_alerts")
          .insert({
            product_id: product.id,
            alert_type: alertType,
            severity,
            reference_price: refPrice,
            best_medikong_price: mkPrice,
            gap_amount: gapAmount,
            gap_percentage: gapPercentage,
            status: "open",
          })
          .select("id")
          .single();

        if (alertErr) {
          console.error(`Alert creation failed for product ${product.id}:`, alertErr.message);
          continue;
        }

        // Link affected vendors (those with offers on this product)
        const { data: offers } = await supabase
          .from("offers")
          .select("vendor_id, price_incl_vat")
          .eq("product_id", product.id)
          .eq("is_active", true);

        if (offers && offers.length > 0) {
          const vendorRows = offers.map((o: any) => ({
            alert_id: newAlert.id,
            vendor_id: o.vendor_id,
            vendor_price: o.price_incl_vat,
            vendor_gap_percentage: Math.round(((o.price_incl_vat - refPrice) / refPrice) * 100 * 10) / 10,
            suggested_price: Math.round(refPrice * 0.97 * 100) / 100, // 3% under competitor
          }));

          await supabase.from("price_alert_vendors").insert(vendorRows);
        }

        alertsCreated++;
      }
    }

    // 7. Auto-resolve alerts where MediKong is now cheaper
    const { data: openAlerts } = await supabase
      .from("price_alerts")
      .select("id, product_id, reference_price")
      .in("status", ["open", "acknowledged"]);

    let alertsResolved = 0;
    for (const alert of openAlerts || []) {
      const product = products.find((p: any) => p.id === alert.product_id);
      if (!product) continue;
      if (product.best_price_incl_vat <= alert.reference_price) {
        await supabase
          .from("price_alerts")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", alert.id);
        alertsResolved++;
      }
    }

    const result = {
      products_checked: products.length,
      competitor_prices_found: Object.keys(competitorBest).length,
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
