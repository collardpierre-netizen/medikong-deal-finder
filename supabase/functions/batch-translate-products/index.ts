import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductRow {
  id: string;
  name: string;
  name_fr: string | null;
  short_description: string | null;
  description: string | null;
  description_fr: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const batchSize = Math.min(body.batch_size || 20, 50);
    const targetLocales: string[] = body.target_locales || ["nl", "de", "en"];
    const entityType: string = body.entity_type || "product"; // "product" | "category"
    const offset = body.offset || 0;
    const brandFilter: string | null = body.brand || null;
    const categoryFilter: string | null = body.category_id || null;

    let items: { id: string; name: string; description?: string }[] = [];
    let totalUntranslated = 0;

    if (entityType === "product") {
      // Find products that don't have translations yet for the first target locale
      const firstLocale = targetLocales[0];

      // Get products not yet translated
      let query = supabase
        .from("products")
        .select("id, name, name_fr, short_description, description, description_fr")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (brandFilter) {
        // Get brand id first
        const { data: brand } = await supabase
          .from("brands")
          .select("id")
          .ilike("name", `%${brandFilter}%`)
          .limit(1)
          .single();
        if (brand) query = query.eq("brand_id", brand.id);
      }
      if (categoryFilter) {
        query = query.eq("category_id", categoryFilter);
      }

      const { data: products, error } = await query;
      if (error) throw error;

      // Filter out products that already have translations
      const productIds = (products || []).map((p: ProductRow) => p.id);
      const { data: existingTranslations } = await supabase
        .from("translations")
        .select("entity_id")
        .eq("entity_type", "product")
        .eq("locale", firstLocale)
        .eq("field", "name")
        .in("entity_id", productIds);

      const translatedIds = new Set((existingTranslations || []).map((t: { entity_id: string }) => t.entity_id));

      items = (products || [])
        .filter((p: ProductRow) => !translatedIds.has(p.id))
        .map((p: ProductRow) => ({
          id: p.id,
          name: p.name_fr || p.name,
          description: p.description_fr || p.description || p.short_description || "",
        }));

      // Get total count of untranslated products
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      
      const { count: translatedCount } = await supabase
        .from("translations")
        .select("entity_id", { count: "exact", head: true })
        .eq("entity_type", "product")
        .eq("locale", firstLocale)
        .eq("field", "name");

      totalUntranslated = (count || 0) - (translatedCount || 0);

    } else if (entityType === "category") {
      const { data: categories, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, description")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (error) throw error;

      const catIds = (categories || []).map((c: { id: string }) => c.id);
      const firstLocale = targetLocales[0];
      const { data: existingTranslations } = await supabase
        .from("translations")
        .select("entity_id")
        .eq("entity_type", "category")
        .eq("locale", firstLocale)
        .eq("field", "name")
        .in("entity_id", catIds);

      const translatedIds = new Set((existingTranslations || []).map((t: { entity_id: string }) => t.entity_id));

      items = (categories || [])
        .filter((c: { id: string; name: string; name_fr?: string | null }) => !translatedIds.has(c.id))
        .map((c: { id: string; name: string; name_fr?: string | null; description?: string | null }) => ({
          id: c.id,
          name: c.name_fr || c.name,
          description: c.description || "",
        }));

      const { count } = await supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      const { count: translatedCount } = await supabase
        .from("translations")
        .select("entity_id", { count: "exact", head: true })
        .eq("entity_type", "category")
        .eq("locale", firstLocale)
        .eq("field", "name");
      totalUntranslated = (count || 0) - (translatedCount || 0);
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({
        translated: 0,
        remaining: totalUntranslated,
        message: "No items to translate in this batch",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build AI prompt for batch translation
    const itemsList = items.map((item, i) => `${i + 1}. "${item.name}"`).join("\n");
    const localesList = targetLocales.join(", ");

    const prompt = `Translate these ${entityType === "product" ? "medical/pharmaceutical product" : "category"} names from French (or English if not French) to: ${localesList}.

Items:
${itemsList}

Return ONLY a valid JSON array where each element has:
{ "index": 1, ${targetLocales.map(l => `"${l}": "translated name"`).join(", ")} }

Rules:
- Keep brand names unchanged (Vichy, Bioderma, La Roche-Posay, Eucerin, etc.)
- Keep product-specific terms (SPF, B5, H2O, etc.) unchanged
- Translate generic descriptors (cream, serum, shampoo, etc.)
- For Dutch: use Belgian Dutch where applicable
- For German: use standard German
- Return ONLY the JSON array, no markdown`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${err}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not parse AI response as JSON array");

    const translations: Array<Record<string, string | number>> = JSON.parse(jsonMatch[0]);

    // Build upsert rows
    const upsertRows: Array<{
      entity_type: string;
      entity_id: string;
      locale: string;
      field: string;
      value: string;
    }> = [];

    for (const t of translations) {
      const idx = (Number(t.index) || 1) - 1;
      if (idx < 0 || idx >= items.length) continue;
      const item = items[idx];

      for (const locale of targetLocales) {
        const translated = t[locale] as string;
        if (translated && translated.trim()) {
          upsertRows.push({
            entity_type: entityType,
            entity_id: item.id,
            locale,
            field: "name",
            value: translated.trim(),
          });
        }
      }
    }

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("translations")
        .upsert(upsertRows, { onConflict: "entity_type,entity_id,locale,field" });
      if (upsertError) throw upsertError;
    }

    return new Response(JSON.stringify({
      translated: items.length,
      translations_saved: upsertRows.length,
      remaining: Math.max(0, totalUntranslated - items.length),
      next_offset: offset + batchSize,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("batch-translate error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
