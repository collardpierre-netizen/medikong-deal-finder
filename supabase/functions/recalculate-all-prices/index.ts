import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";
import { recalcOfferPricing } from "../_shared/recalc-offer-pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), {
      status: guard.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }



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
    const defaultMarginPct = configRow?.value ? parseFloat(configRow.value) : 25.0;

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
    let skippedStale = 0;
    let skippedNoBase = 0;
    const nowIso = new Date().toISOString();

    for (const offer of (offers || [])) {
      const result = recalcOfferPricing(
        offer as any,
        (marginRules || []) as any,
        defaultMarginPct,
      );
      if (result.action === "skipped_no_base") { skippedNoBase++; continue; }
      if (result.action === "skipped_stale") { skippedStale++; continue; }

      await supabase.from("offers").update({
        ...result.patch,
        price_source: "qogita_margin_recalc",
        price_source_updated_at: nowIso,
      }).eq("id", offer.id);

      updated++;
    }

    return new Response(JSON.stringify({
      success: true,
      updated,
      skipped_stale: skippedStale,
      skipped_no_base: skippedNoBase,
      default_margin: defaultMarginPct,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Recalculate error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
