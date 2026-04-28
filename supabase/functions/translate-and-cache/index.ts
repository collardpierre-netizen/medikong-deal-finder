// Edge function: translate-and-cache
// Traduit des textes via Lovable AI Gateway avec un write-through cache
// pour éviter de re-payer la même traduction plusieurs fois.
//
// Stratégie pour chaque texte :
//   1. Si productId+field fourni → vérifier que la colonne products.<field>_<lang>
//      n'est pas déjà remplie en DB (hit gratuit).
//   2. Sinon → lookup dans translation_cache (sha256 source_hash).
//   3. Si miss → appel AI, puis :
//        - INSERT dans translation_cache (write-through global)
//        - Si productId+field → UPDATE de products.<field>_<lang> (write-through produit)
//
// Coût AI : payé 1× par texte unique × langue cible, jamais re-payé.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORTED_TARGETS = ["fr", "nl", "de", "en"] as const;
type TargetLang = (typeof SUPPORTED_TARGETS)[number];

const PRODUCT_FIELD_MAP: Record<string, { col: string; localizedSuffix: string }> = {
  name: { col: "name", localizedSuffix: "_" },
  short_description: { col: "short_description", localizedSuffix: "_" },
  description: { col: "description", localizedSuffix: "_" },
};

interface TranslateItem {
  text: string;
  productId?: string;
  field?: "name" | "short_description" | "description";
}

interface RequestBody {
  texts: (string | TranslateItem)[];
  targetLang: TargetLang;
  sourceLang?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as RequestBody;
    const targetLang = body.targetLang;
    const sourceLang = body.sourceLang || "fr";

    if (!SUPPORTED_TARGETS.includes(targetLang)) {
      return new Response(
        JSON.stringify({ error: `Unsupported targetLang: ${targetLang}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(body.texts) || body.texts.length === 0) {
      return new Response(
        JSON.stringify({ translations: [], fromCache: [], cost: { aiCalls: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalize input
    const items: TranslateItem[] = body.texts.map((t) =>
      typeof t === "string" ? { text: t } : t,
    );

    const translations: string[] = new Array(items.length);
    const fromCache: boolean[] = new Array(items.length).fill(false);
    let aiCalls = 0;

    // Pass 1 : product write-through lookup + cache lookup
    const toTranslateIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const text = (item.text || "").trim();

      if (!text) {
        translations[i] = "";
        fromCache[i] = true;
        continue;
      }

      // Same language → no-op
      if (sourceLang === targetLang) {
        translations[i] = text;
        fromCache[i] = true;
        continue;
      }

      // 1a. Product-backed lookup
      if (item.productId && item.field && PRODUCT_FIELD_MAP[item.field]) {
        const colName = `${PRODUCT_FIELD_MAP[item.field].col}_${targetLang}`;
        const { data: prod } = await admin
          .from("products")
          .select(colName)
          .eq("id", item.productId)
          .maybeSingle();
        const existing = prod ? (prod as Record<string, unknown>)[colName] : null;
        if (existing && typeof existing === "string" && existing.trim()) {
          translations[i] = existing;
          fromCache[i] = true;
          continue;
        }
      }

      // 1b. Global cache lookup
      const hash = await sha256Hex(`${sourceLang}:${targetLang}:${text}`);
      const { data: cached } = await admin
        .from("translation_cache")
        .select("translated_text")
        .eq("source_hash", hash)
        .maybeSingle();

      if (cached?.translated_text) {
        translations[i] = cached.translated_text;
        fromCache[i] = true;
        // Bump hit counter (fire-and-forget)
        admin.rpc("bump_translation_cache_hit", { _source_hash: hash }).then(() => {});
        continue;
      }

      // Need AI translation
      toTranslateIndices.push(i);
    }

    // Pass 2 : batch AI call for remaining
    if (toTranslateIndices.length > 0) {
      const sourcesForAi = toTranslateIndices.map((i) => items[i].text);

      const langLabel: Record<TargetLang, string> = {
        fr: "French",
        nl: "Dutch (Netherlands)",
        de: "German",
        en: "English",
      };

      const prompt = `Translate each of the following texts into ${langLabel[targetLang]}.
Source language: auto-detect (likely ${sourceLang}).
Return ONLY a valid JSON array of strings, same length and order as the input.
Rules:
- Keep brand names, product names, dosages, and proper nouns unchanged
- Preserve tone (B2B pharmaceutical/parapharmaceutical)
- No markdown, no explanation, only the JSON array

Input (JSON array):
${JSON.stringify(sourcesForAi)}`;

      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
          }),
        },
      );

      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit reached, please try again shortly.",
            code: "rate_limited",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Top up your workspace.",
            code: "payment_required",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI gateway error", aiResp.status, t);
        return new Response(
          JSON.stringify({ error: "AI gateway error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      aiCalls = 1;
      const aiJson = await aiResp.json();
      const content: string = aiJson.choices?.[0]?.message?.content ?? "";
      const arrMatch = content.match(/\[[\s\S]*\]/);
      let parsed: string[] = [];
      try {
        parsed = arrMatch ? JSON.parse(arrMatch[0]) : [];
      } catch (e) {
        console.error("Failed to parse AI JSON array", e, content);
      }

      // Map back + write-through cache + product write-through
      for (let k = 0; k < toTranslateIndices.length; k++) {
        const idx = toTranslateIndices[k];
        const original = items[idx].text;
        const out =
          typeof parsed[k] === "string" && parsed[k].trim()
            ? parsed[k]
            : original; // fallback to original on parse miss
        translations[idx] = out;
        fromCache[idx] = false;

        // 2a. Write to global cache
        const hash = await sha256Hex(`${sourceLang}:${targetLang}:${original}`);
        admin
          .from("translation_cache")
          .upsert(
            {
              source_hash: hash,
              source_lang: sourceLang,
              target_lang: targetLang,
              source_text: original,
              translated_text: out,
              hits: 1,
              last_used_at: new Date().toISOString(),
            },
            { onConflict: "source_hash" },
          )
          .then(() => {});

        // 2b. Write to product column when applicable
        const item = items[idx];
        if (item.productId && item.field && PRODUCT_FIELD_MAP[item.field]) {
          const colName = `${PRODUCT_FIELD_MAP[item.field].col}_${targetLang}`;
          admin
            .from("products")
            .update({ [colName]: out })
            .eq("id", item.productId)
            .then(() => {});
        }
      }
    }

    return new Response(
      JSON.stringify({
        translations,
        fromCache,
        cost: { aiCalls },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("translate-and-cache error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
