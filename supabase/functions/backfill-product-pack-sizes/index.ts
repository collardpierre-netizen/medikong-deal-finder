// Backfill products.pack_size from product name (regex) with GTIN twin fallback.
// Mirrors src/lib/pack-size.ts extractPackSizeFromName so DB & front agree.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---- pack-size extraction (port of src/lib/pack-size.ts) ----
function extractPackSizeFromName(name: string | null): number | null {
  if (!name || typeof name !== "string") return null;
  const cleaned = name.trim();
  if (!cleaned) return null;

  const cerpSlash = cleaned.match(/(?:^|\s)\/\s*(\d{1,3})\b\s*$/);
  if (cerpSlash) {
    const n = Number(cerpSlash[1]);
    if (n >= 2 && n <= 500) return n;
  }

  const cerpTrailing = cleaned.match(/(?:^|\s)([A-Za-zÀ-ÿ./]+)\s+(\d{1,3})\s*$/);
  if (cerpTrailing) {
    const prevToken = cerpTrailing[1].toLowerCase().replace(/\.$/, "");
    const n = Number(cerpTrailing[2]);
    const isUnit = /^(mg|ml|g|kg|cl|l|kcal|cc|oz|mcg|µg|ug|ui|iu|mm|cm|m|%)$/.test(prevToken);
    if (!isUnit && n >= 2 && n <= 50) return n;
  }

  const multiPack = cleaned.match(
    /\b(\d{1,3})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(ml|cl|l|g|mg|kg|cc)\b/i,
  );
  if (multiPack) {
    const n = Number(multiPack[1]);
    if (n >= 2 && n <= 500) return n;
  }

  const galenic =
    /\b(\d{1,4})\s*(caps?|capsules?|cps|comprim[eé]s?|cpr?|c[oó]mp|g[eé]lules?|gel\.?|sachets?|sticks?|ampoules?|amp\.?|doses?|sprays?|patchs?|tabl(?:ettes)?|pastilles?|suppositoires?|supp\.?|ovules?|lingettes?|pi[èe]ces?|pcs?)\b/i;
  const g = cleaned.match(galenic);
  if (g) {
    const n = Number(g[1]);
    if (n >= 2 && n <= 1000) return n;
  }

  const containerOf = cleaned.match(
    /\b(?:bo[iî]te|pack|lot|paquet|box|set)\s*(?:de|d['’]|of)\s*(\d{1,4})\b/i,
  );
  if (containerOf) {
    const n = Number(containerOf[1]);
    if (n >= 2 && n <= 1000) return n;
  }

  return null;
}

interface RunBody {
  dryRun?: boolean;
  batchSize?: number;
  maxBatches?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body: RunBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dryRun === true;
    const batchSize = Math.min(Math.max(body.batchSize ?? 1000, 100), 5000);
    const maxBatches = Math.min(Math.max(body.maxBatches ?? 50, 1), 1000);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let totalScanned = 0;
    let totalRegexHits = 0;
    let totalGtinHits = 0;
    let totalNoMatch = 0;
    let totalUpdated = 0;
    const sample: { id: string; name: string; pack_size: number; source: string }[] = [];
    let cursor: string | null = null;

    for (let batch = 0; batch < maxBatches; batch++) {
      let q = sb
        .from("products")
        .select("id, name, gtin, pack_size")
        .or("pack_size.is.null,pack_size.eq.1")
        .order("id", { ascending: true })
        .limit(batchSize);
      if (cursor) q = q.gt("id", cursor);

      const { data: rows, error } = await q;
      if (error) throw error;
      if (!rows || rows.length === 0) break;

      cursor = rows[rows.length - 1].id;
      totalScanned += rows.length;

      // Collect GTINs for fallback lookup (only those without regex hit)
      const updates: { id: string; pack_size: number; source: string }[] = [];
      const gtinsToLookup: string[] = [];
      const pendingGtin: { id: string; gtin: string }[] = [];

      for (const r of rows) {
        const fromName = extractPackSizeFromName(r.name);
        if (fromName && fromName > 1) {
          updates.push({ id: r.id, pack_size: fromName, source: "name_regex" });
          totalRegexHits++;
        } else if (r.gtin) {
          gtinsToLookup.push(r.gtin);
          pendingGtin.push({ id: r.id, gtin: r.gtin });
        } else {
          totalNoMatch++;
        }
      }

      // GTIN twin lookup: products that already have pack_size > 1 with same GTIN
      if (gtinsToLookup.length > 0) {
        const uniq = Array.from(new Set(gtinsToLookup));
        const { data: twins, error: twinErr } = await sb
          .from("products")
          .select("gtin, pack_size")
          .in("gtin", uniq)
          .gt("pack_size", 1);
        if (twinErr) throw twinErr;

        const twinMap = new Map<string, number>();
        for (const t of twins ?? []) {
          if (t.gtin && t.pack_size && !twinMap.has(t.gtin)) {
            twinMap.set(t.gtin, t.pack_size);
          }
        }
        for (const p of pendingGtin) {
          const ps = twinMap.get(p.gtin);
          if (ps && ps > 1) {
            updates.push({ id: p.id, pack_size: ps, source: "gtin_twin" });
            totalGtinHits++;
          } else {
            totalNoMatch++;
          }
        }
      }

      // Sample first 20 for response
      for (const u of updates) {
        if (sample.length < 20) {
          const src = rows.find((r) => r.id === u.id);
          sample.push({
            id: u.id,
            name: src?.name ?? "",
            pack_size: u.pack_size,
            source: u.source,
          });
        }
      }

      if (!dryRun && updates.length > 0) {
        // Group by (pack_size, source) to minimize round-trips
        const grouped = new Map<string, string[]>();
        for (const u of updates) {
          const k = `${u.pack_size}|${u.source}`;
          if (!grouped.has(k)) grouped.set(k, []);
          grouped.get(k)!.push(u.id);
        }
        for (const [key, ids] of grouped.entries()) {
          const [psStr, source] = key.split("|");
          const { error: upErr } = await sb
            .from("products")
            .update({
              pack_size: Number(psStr),
              pack_size_source: source,
              pack_size_updated_at: new Date().toISOString(),
            })
            .in("id", ids);
          if (upErr) throw upErr;
          totalUpdated += ids.length;
        }
      }

      if (rows.length < batchSize) break;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        scanned: totalScanned,
        regex_hits: totalRegexHits,
        gtin_hits: totalGtinHits,
        no_match: totalNoMatch,
        updated: totalUpdated,
        sample,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
