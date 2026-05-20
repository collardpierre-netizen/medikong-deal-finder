// Lists active media_assets for a given manufacturer_id, with seasonal sort.
// Mirrors list-brand-media — see that function for details.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const url = new URL(req.url);
  const manufacturer_id = url.searchParams.get("manufacturer_id");
  const language = url.searchParams.get("language");
  const asset_type = url.searchParams.get("asset_type");
  if (!manufacturer_id) return json({ error: "Missing manufacturer_id" }, 400);

  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });

  let q = client
    .from("media_assets")
    .select(
      "id, asset_type, language, visibility, title, description, file_path, thumbnail_path, mime_type, file_size_bytes, duration_seconds, page_count, tags, sort_order, published_at"
    )
    .eq("manufacturer_id", manufacturer_id)
    .eq("is_active", true);

  if (language) q = q.eq("language", language);
  if (asset_type) q = q.eq("asset_type", asset_type);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const sorted = applySeasonalSort(data ?? []);
  return json({ items: sorted, count: sorted.length, season: currentSeason() });
});

function currentSeason(): "hiver" | "printemps" | "ete" | "automne" {
  const m = new Date().getUTCMonth() + 1;
  if (m === 11 || m === 12 || m === 1 || m === 2) return "hiver";
  if (m >= 3 && m <= 5) return "printemps";
  if (m >= 6 && m <= 8) return "ete";
  return "automne";
}

function applySeasonalSort<T extends { tags?: string[] | null; sort_order?: number | null; published_at?: string | null }>(
  rows: T[]
): T[] {
  const season = currentSeason();
  const seasonAliases: Record<string, string[]> = {
    hiver: ["hiver", "winter"],
    printemps: ["printemps", "spring"],
    ete: ["ete", "été", "summer"],
    automne: ["automne", "autumn", "fall"],
  };
  const matchers = seasonAliases[season];

  return [...rows].sort((a, b) => {
    const aSeason = (a.tags ?? []).some((t) => matchers.includes(t.toLowerCase())) ? 0 : 1;
    const bSeason = (b.tags ?? []).some((t) => matchers.includes(t.toLowerCase())) ? 0 : 1;
    if (aSeason !== bSeason) return aSeason - bSeason;

    const aSo = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bSo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (aSo !== bSo) return aSo - bSo;

    const aPub = a.published_at ? Date.parse(a.published_at) : 0;
    const bPub = b.published_at ? Date.parse(b.published_at) : 0;
    return bPub - aPub;
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
