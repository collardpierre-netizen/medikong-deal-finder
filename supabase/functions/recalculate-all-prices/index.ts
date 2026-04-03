import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Load default margin from qogita_config
    const { data: configRow } = await supabase
      .from("qogita_config")
      .select("value")
      .eq("key", "margin_percentage")
      .maybeSingle();
    const defaultMarginPct = configRow?.value ? parseFloat(configRow.value) : 15.0;

    // Load margin rules sorted by priority desc
    const { data: marginRules } = await supabase
      .from("margin_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    // Load all Qogita-backed offers
    const { data: offers, error } = await supabase
      .from("offers")
      .select("*, products(category_id, brand_id)")
      .eq("is_qogita_backed", true)
      .eq("is_active", true);

    if (error) throw error;

    let updated = 0;

    for (const offer of (offers || [])) {
      if (!offer.qogita_base_price) continue;

      const basePrice = Number(offer.qogita_base_price);
      const product = offer.products as any;

      // Find matching rule — fallback to config default margin
      let marginPct = defaultMarginPct, extraDelay = 2, roundTo = 0.01;
      let matchedRuleId: string | null = null;

      for (const rule of (marginRules || [])) {
        const matchCat = !rule.category_id || rule.category_id === product?.category_id;
        const matchBrand = !rule.brand_id || rule.brand_id === product?.brand_id;
        const matchVendor = !rule.vendor_id || rule.vendor_id === offer.vendor_id;
        const matchMin = rule.min_base_price == null || basePrice >= Number(rule.min_base_price);
        const matchMax = rule.max_base_price == null || basePrice <= Number(rule.max_base_price);

        if (matchCat && matchBrand && matchVendor && matchMin && matchMax) {
          marginPct = Number(rule.margin_percentage);
          extraDelay = rule.extra_delay_days;
          roundTo = Number(rule.round_price_to);
          matchedRuleId = rule.id;
          break;
        }
      }

      const priceExclVat = Math.round(basePrice * (1 + marginPct / 100) / roundTo) * roundTo;
      const priceInclVat = Math.round(priceExclVat * (1 + Number(offer.vat_rate) / 100) * 100) / 100;
      const marginAmount = priceExclVat - basePrice;
      const deliveryDays = (offer.qogita_base_delay_days || 3) + extraDelay;

      // Recalculate price tiers
      let priceTiers = offer.price_tiers;
      if (priceTiers && Array.isArray(priceTiers)) {
        priceTiers = priceTiers.map((t: any) => ({
          ...t,
          price_excl_vat: t.qogita_base_price
            ? Math.round(t.qogita_base_price * (1 + marginPct / 100) / roundTo) * roundTo
            : t.price_excl_vat,
        }));
      }

      await supabase.from("offers").update({
        price_excl_vat: priceExclVat,
        price_incl_vat: priceInclVat,
        margin_amount: marginAmount,
        applied_margin_rule_id: matchedRuleId,
        applied_margin_percentage: marginPct,
        delivery_days: deliveryDays,
        price_tiers: priceTiers,
      }).eq("id", offer.id);

      updated++;
    }

    return new Response(JSON.stringify({ success: true, updated, default_margin: defaultMarginPct }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Recalculate error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
