import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const entityType: string = body.entity_type || "product";
    const brandFilter: string | null = body.brand || null;
    const categoryFilter: string | null = body.category_id || null;
    const firstLocale = targetLocales[0];

    let items: { id: string; name: string; description?: string }[] = [];
    let totalUntranslated = 0;

    if (entityType === "product") {
      // Get IDs of already-translated products for first locale
      const { data: translatedRows } = await supabase
        .from("translations")
        .select("entity_id")
        .eq("entity_type", "product")
        .eq("locale", firstLocale)
        .eq("field", "name");

      const translatedIds = (translatedRows || []).map((t: { entity_id: string }) => t.entity_id);

      // Use RPC or direct query to find untranslated products
      // We'll fetch a larger pool and filter client-side since .not('id', 'in', bigArray) has limits
      const pageSize = 200; // fetch more to find untranslated ones
      const translatedSet = new Set(translatedIds);
      let found: typeof items = [];
      let searchOffset = 0;
      const maxSearchPages = 50; // safety limit

      for (let page = 0; page < maxSearchPages && found.length < batchSize; page++) {
        let query = supabase
          .from("products")
          .select("id, name, name_fr, short_description, description, description_fr")
          .eq("is_active", true)
          .order("name", { ascending: true })
          .range(searchOffset, searchOffset + pageSize - 1);

        if (brandFilter) {
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
        if (!products || products.length === 0) break;

        for (const p of products) {
          if (!translatedSet.has(p.id) && found.length < batchSize) {
            found.push({
              id: p.id,
              name: p.name_fr || p.name,
              description: p.description_fr || p.description || p.short_description || "",
            });
          }
        }

        searchOffset += pageSize;
      }

      items = found;

      // Count untranslated
      const { count: totalCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      totalUntranslated = (totalCount || 0) - translatedIds.length;

    } else if (entityType === "category") {
      const { data: translatedRows } = await supabase
        .from("translations")
        .select("entity_id")
        .eq("entity_type", "category")
        .eq("locale", firstLocale)
        .eq("field", "name");

      const translatedSet = new Set((translatedRows || []).map((t: { entity_id: string }) => t.entity_id));

      const { data: categories, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, description")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;

      items = (categories || [])
        .filter((c: { id: string }) => !translatedSet.has(c.id))
        .slice(0, batchSize)
        .map((c: { id: string; name: string; name_fr?: string | null; description?: string | null }) => ({
          id: c.id,
          name: c.name_fr || c.name,
          description: c.description || "",
        }));

      const { count: totalCount } = await supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      totalUntranslated = (totalCount || 0) - translatedSet.size;
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({
        translated: 0,
        remaining: totalUntranslated,
        message: totalUntranslated <= 0 ? "All items are already translated" : "No items to translate in this batch",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Translating ${items.length} ${entityType}(s) to ${targetLocales.join(", ")}`);

    // Build AI prompt for batch translation
    const itemsList = items.map((item, i) => `${i + 1}. "${item.name}"`).join("\n");

    const prompt = `Translate these ${entityType === "product" ? "medical/pharmaceutical product" : "category"} names from French (or English if not French) to: ${targetLocales.join(", ")}.

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
      console.error("AI API error:", aiResponse.status, err);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please retry in a few seconds" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status} - ${err}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not parse AI response:", content.substring(0, 500));
      throw new Error("Could not parse AI response as JSON array");
    }

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

      // Also write directly into the entity columns for faster reads
      const table = entityType === "product" ? "products" : "categories";
      for (const t of translations) {
        const idx = (Number(t.index) || 1) - 1;
        if (idx < 0 || idx >= items.length) continue;
        const item = items[idx];
        const updates: Record<string, string> = {};
        if (t.nl) updates.name_nl = (t.nl as string).trim();
        if (t.de) updates.name_de = (t.de as string).trim();
        if (Object.keys(updates).length > 0) {
          await supabase.from(table).update(updates).eq("id", item.id);
        }
      }
    }

    console.log(`Translated ${items.length} items, saved ${upsertRows.length} translations`);

    return new Response(JSON.stringify({
      translated: items.length,
      translations_saved: upsertRows.length,
      remaining: Math.max(0, totalUntranslated - items.length),
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
