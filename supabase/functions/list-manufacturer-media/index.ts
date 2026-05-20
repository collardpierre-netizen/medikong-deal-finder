// Lists active media_assets for a given manufacturer_id.
// Mirrors list-brand-media — see that function for full param docs.
//
// Query params:
//   manufacturer_id (required, uuid)
//   language, asset_type, tag, q, sort, order, page, page_size
//
// Visibility is enforced by RLS on media_assets via the caller's JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SEASONAL_FETCH_CAP = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const url = new URL(req.url);
  const manufacturer_id = url.searchParams.get("manufacturer_id");
  if (!manufacturer_id) return json({ error: "Missing manufacturer_id" }, 400);

  const params = parseListParams(url);
  if ("error" in params) return json({ error: params.error }, 400);

  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });

  return await listMedia(client, { ownerField: "manufacturer_id", ownerId: manufacturer_id, ...params });
});

type ListParams = {
  language: string | null;
  asset_type: string | null;
  tag: string | null;
  q: string | null;
  sort: "seasonal" | "recent" | "oldest" | "title" | "sort_order";
  order: "asc" | "desc" | null;
  page: number;
  page_size: number;
};

function parseListParams(url: URL): ListParams | { error: string } {
  const language = url.searchParams.get("language");
  const asset_type = url.searchParams.get("asset_type");
  const tag = url.searchParams.get("tag");
  const q = url.searchParams.get("q");
  const sortRaw = (url.searchParams.get("sort") ?? "seasonal").toLowerCase();
  const orderRaw = url.searchParams.get("order")?.toLowerCase() ?? null;

  const allowedSort = ["seasonal", "recent", "oldest", "title", "sort_order"] as const;
  if (!allowedSort.includes(sortRaw as any)) return { error: `sort must be one of ${allowedSort.join(", ")}` };
  if (orderRaw && orderRaw !== "asc" && orderRaw !== "desc") return { error: "order must be asc or desc" };

  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const page_size = Math.min(100, Math.max(1, Number(url.searchParams.get("page_size") ?? 24) || 24));

  return {
    language,
    asset_type,
    tag,
    q,
    sort: sortRaw as ListParams["sort"],
    order: orderRaw as ListParams["order"],
    page,
    page_size,
  };
}

async function listMedia(
  client: ReturnType<typeof createClient>,
  opts: ListParams & { ownerField: "brand_id" | "manufacturer_id"; ownerId: string },
) {
  const { ownerField, ownerId, language, asset_type, tag, q, sort, order, page, page_size } = opts;

  const selectCols =
    "id, asset_type, language, visibility, title, description, file_path, thumbnail_path, mime_type, file_size_bytes, duration_seconds, page_count, tags, sort_order, published_at";

  const applyFilters = (qb: any) => {
    let x = qb.eq(ownerField, ownerId).eq("is_active", true);
    if (language) x = x.eq("language", language);
    if (asset_type) x = x.eq("asset_type", asset_type);
    if (tag) x = x.contains("tags", [tag]);
    if (q && q.trim()) {
      const safe = q.trim().replace(/[,()]/g, " ");
      x = x.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,tags.cs.{${safe}}`);
    }
    return x;
  };

  if (sort === "seasonal") {
    const { data, error, count } = await applyFilters(
      client.from("media_assets").select(selectCols, { count: "exact" }),
    ).limit(SEASONAL_FETCH_CAP);
    if (error) return json({ error: error.message }, 500);

    const sorted = applySeasonalSort(data ?? []);
    const from = (page - 1) * page_size;
    const items = sorted.slice(from, from + page_size);
    return json({
      items,
      count: items.length,
      total: count ?? sorted.length,
      page,
      page_size,
      sort,
      season: currentSeason(),
      truncated: (count ?? 0) > SEASONAL_FETCH_CAP,
    });
  }

  const direction = order ?? defaultDirection(sort);
  const ascending = direction === "asc";
  let column: string = "sort_order";
  if (sort === "recent" || sort === "oldest") column = "published_at";
  else if (sort === "title") column = "title";
  else if (sort === "sort_order") column = "sort_order";

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  const { data, error, count } = await applyFilters(
    client.from("media_assets").select(selectCols, { count: "exact" }),
  )
    .order(column, { ascending, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) return json({ error: error.message }, 500);

  return json({
    items: data ?? [],
    count: data?.length ?? 0,
    total: count ?? 0,
    page,
    page_size,
    sort,
    order: direction,
  });
}

function defaultDirection(sort: ListParams["sort"]): "asc" | "desc" {
  if (sort === "recent") return "desc";
  if (sort === "oldest") return "asc";
  if (sort === "title") return "asc";
  return "asc";
}

function currentSeason(): "hiver" | "printemps" | "ete" | "automne" {
  const m = new Date().getUTCMonth() + 1;
  if (m === 11 || m === 12 || m === 1 || m === 2) return "hiver";
  if (m >= 3 && m <= 5) return "printemps";
  if (m >= 6 && m <= 8) return "ete";
  return "automne";
}

function applySeasonalSort<T extends { tags?: string[] | null; sort_order?: number | null; published_at?: string | null }>(
  rows: T[],
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
