import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductRow {
  id: string;
  name: string;
  short_description: string | null;
  description: string | null;
  name_en: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth: only super_admin can run this
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userResult } = await userClient.auth.getUser();
    if (!userResult.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: userResult.user.id });
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "Super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit: number = Math.min(Math.max(Number(body.limit) || 100, 1), 500);
    const dryRun: boolean = body.dryRun === true;

    // Pull top-N most popular active products without name_en yet
    const { data: products, error: selErr } = await admin
      .from("products")
      .select("id, name, short_description, description, name_en")
      .eq("is_active", true)
      .is("name_en", null)
      .order("popularity", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (selErr) throw selErr;
    const items = (products || []) as ProductRow[];

    let translated = 0;
    let skipped = 0;
    let failed = 0;
    const samples: Array<{ id: string; name: string; name_en: string }> = [];

    for (const p of items) {
      const texts: Record<string, string> = {};
      if (p.name) texts.name = p.name;
      if (p.short_description) texts.short_description = p.short_description;
      if (p.description) texts.description = p.description.slice(0, 1500);

      if (Object.keys(texts).length === 0) {
        skipped++;
        continue;
      }

      const prompt = `Translate the following texts into English (B2B pharmaceutical / parapharmacy professional tone).
Return ONLY a valid JSON object: { "name": "...", "short_description": "...", "description": "..." }.
Only include keys that were provided in the input. Keep brand names and product names unchanged.

Input:
${Object.entries(texts).map(([k, v]) => `${k}: "${v}"`).join("\n")}`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        });

        if (!aiResp.ok) {
          if (aiResp.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limited by Lovable AI", translated, skipped, failed }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (aiResp.status === 402) {
            return new Response(
              JSON.stringify({ error: "Lovable AI credits exhausted", translated, skipped, failed }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          failed++;
          continue;
        }

        const aiJson = await aiResp.json();
        const content: string = aiJson.choices?.[0]?.message?.content || "";
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) {
          failed++;
          continue;
        }
        const parsed = JSON.parse(match[0]);

        const update: Record<string, string | null> = {};
        if (parsed.name) update.name_en = String(parsed.name).trim();
        if (parsed.short_description) update.short_description_en = String(parsed.short_description).trim();
        if (parsed.description) update.description_en = String(parsed.description).trim();

        if (Object.keys(update).length === 0) {
          skipped++;
          continue;
        }

        if (samples.length < 5 && update.name_en) {
          samples.push({ id: p.id, name: p.name, name_en: update.name_en as string });
        }

        if (!dryRun) {
          const { error: updErr } = await admin.from("products").update(update).eq("id", p.id);
          if (updErr) {
            failed++;
            continue;
          }
        }
        translated++;
      } catch (err) {
        console.error("Translate error for", p.id, err);
        failed++;
      }

      // Light rate-limiting: small pause between requests
      await new Promise((r) => setTimeout(r, 150));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        candidates: items.length,
        translated,
        skipped,
        failed,
        samples,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("translate-products-en-pilot error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
