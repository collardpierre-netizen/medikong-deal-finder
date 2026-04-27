import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { texts, target_locales } = await req.json();
    // texts = { name: "...", description: "..." }
    // target_locales = ["fr", "nl", "de"]

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const fieldsToTranslate = Object.entries(texts).filter(([_, v]) => v && (v as string).trim());
    if (fieldsToTranslate.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `Translate the following texts into these languages: ${target_locales.join(", ")}. 
The source text may be in any language (English, French, or other). Auto-detect the source language.
Return ONLY a valid JSON object with this structure:
{ "fr": { ${fieldsToTranslate.map(([k]) => `"${k}": "..."`).join(", ")} }, "nl": { ... }, "de": { ... } }

Texts to translate:
${fieldsToTranslate.map(([k, v]) => `${k}: "${v}"`).join("\n")}

Rules:
- Keep brand names, product names, and proper nouns unchanged
- Keep the same tone and style
- For each target locale, provide a proper translation in that language
- If the source is already in a target language, return it as-is for that locale
- For "fr", if the source is not French, translate it to French
- Return ONLY the JSON, no markdown, no explanation`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error: ${response.status} - ${err}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse AI response");
    
    const translations = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
