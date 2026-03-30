import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 300;

async function getQogitaToken(supabaseClient: any): Promise<{ token: string; baseUrl: string }> {
  const { data: config } = await supabaseClient.from("qogita_config").select("*").eq("id", 1).single();
  if (!config) throw new Error("qogita_config not found");
  if (!config.qogita_email || !config.qogita_password) throw new Error("Qogita credentials not configured");
  const baseUrl = config.base_url || "https://api.qogita.com";
  const authRes = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.qogita_email, password: config.qogita_password }),
  });
  if (!authRes.ok) throw new Error(`Qogita auth failed (${authRes.status})`);
  const { accessToken } = await authRes.json();
  if (!accessToken) throw new Error("No accessToken in Qogita auth response");
  await supabaseClient.from("qogita_config").update({ bearer_token: accessToken }).eq("id", 1);
  return { token: accessToken, baseUrl };
}

function slugify(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function extractQid(url: string): string | null {
  const m = url?.match(/\/products\/([a-f0-9]+)\//);
  return m ? m[1] : null;
}

function parseCSVStream(text: string): any[] {
  const nlIdx = text.indexOf("\n");
  if (nlIdx === -1) return [];
  const headerLine = text.substring(0, nlIdx);
  const headers = headerLine.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: any[] = [];
  let pos = nlIdx + 1;
  while (pos < text.length) {
    const lineEnd = text.indexOf("\n", pos);
    const line = lineEnd === -1 ? text.substring(pos) : text.substring(pos, lineEnd);
    pos = lineEnd === -1 ? text.length : lineEnd + 1;
    if (!line.trim()) continue;
    const values: string[] = [];
    let current = "", inQ = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());
    const obj: any = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = values[i] || "";
    rows.push(obj);
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let requestedCountries: string[] | null = null;
  let singleCountryMode = false;
  try {
    const body = await req.json();
    if (body?.countries && Array.isArray(body.countries)) requestedCountries = body.countries;
    if (body?.country) { requestedCountries = [body.country]; singleCountryMode = true; }
  } catch { /* no body */ }

  const { data: syncCountries } = await supabase.from("countries").select("code, name, default_vat_rate")
    .eq("is_active", true).eq("qogita_sync_enabled", true).order("display_order");
  let countriesToSync = syncCountries || [{ code: "BE", name: "Belgique", default_vat_rate: 21 }];
  if (requestedCountries) {
    countriesToSync = countriesToSync.filter((c: any) => requestedCountries!.includes(c.code));
  }

  // For multi-country: process only the FIRST country, return remaining
  if (!singleCountryMode && countriesToSync.length > 1) {
    const first = countriesToSync[0] as any;
    const remaining = countriesToSync.slice(1).map((c: any) => c.code);

    // Create master sync log
    const { data: masterLog } = await supabase.from("sync_logs").insert({
      sync_type: "products", status: "running",
      stats: { countries_total: countriesToSync.length, countries_done: [], current_country: first.code },
      progress_current: 0, progress_total: countriesToSync.length,
      progress_message: `Pays 1/${countriesToSync.length} (${first.code})...`,
    }).select().single();

    // Process first country inline
    try {
      const result = await syncOneCountry(supabase, first, masterLog!.id, 1, countriesToSync.length);

      // Update log
      await supabase.from("sync_logs").update({
        stats: { ...result.stats, countries_done: [first.code], remaining_countries: remaining },
        progress_current: 1,
        progress_message: remaining.length > 0
          ? `${first.code} terminé (${result.stats.products} produits). Lancez les pays restants: ${remaining.join(", ")}`
          : `Terminé — ${result.stats.products} produits`,
        ...(remaining.length === 0 ? { status: "completed", completed_at: new Date().toISOString() } : {}),
      }).eq("id", masterLog!.id);

      return new Response(JSON.stringify({
        success: true,
        country_done: first.code,
        remaining_countries: remaining,
        stats: result.stats,
        message: remaining.length > 0
          ? `${first.code} done. Call again with each remaining country individually.`
          : "All done",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
      await supabase.from("sync_logs").update({
        status: "error", completed_at: new Date().toISOString(),
        error_message: err.message, progress_message: `Erreur: ${err.message}`,
      }).eq("id", masterLog!.id);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Single country mode
  const ctry = countriesToSync[0] as any;
  if (!ctry) {
    return new Response(JSON.stringify({ error: "No country to sync" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find or create sync log
  const { data: existingLog } = await supabase.from("sync_logs")
    .select("id").eq("sync_type", "products").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  if (existingLog) {
    syncLogId = existingLog.id;
    await supabase.from("sync_logs").update({
      progress_message: `${ctry.code}: démarrage...`,
    }).eq("id", syncLogId);
  } else {
    const { data: newLog } = await supabase.from("sync_logs").insert({
      sync_type: "products", status: "running",
      stats: {}, progress_current: 0, progress_total: 0,
      progress_message: `${ctry.code}: authentification...`,
    }).select().single();
    syncLogId = newLog!.id;
  }

  try {
    const result = await syncOneCountry(supabase, ctry, syncLogId, 1, 1);

    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(),
      stats: result.stats,
      progress_current: result.stats.products, progress_total: result.stats.products,
      progress_message: `${ctry.code} terminé — ${result.stats.products} produits, ${result.stats.brands} marques, ${result.stats.categories} catégories`,
    }).eq("id", syncLogId);

    await supabase.from("qogita_config").update({
      last_full_sync_at: new Date().toISOString(), sync_status: "completed",
    }).eq("id", 1);

    return new Response(JSON.stringify({ success: true, stats: result.stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Sync error:", err);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(),
      error_message: err.message, progress_message: `Erreur: ${err.message}`,
    }).eq("id", syncLogId);
    await supabase.from("qogita_config").update({
      sync_status: "error", sync_error_message: err.message,
    }).eq("id", 1);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function syncOneCountry(
  supabase: any, ctry: any, syncLogId: string,
  countryIdx: number, countryTotal: number
) {
  const { token, baseUrl } = await getQogitaToken(supabase);
  const vatRate = ctry.default_vat_rate || 21;

  await supabase.from("sync_logs").update({
    progress_message: `${ctry.code}: téléchargement CSV...`,
  }).eq("id", syncLogId);

  const csvUrl = `${baseUrl}/variants/search/download/?country=${ctry.code}`;
  const res = await fetch(csvUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`CSV ${ctry.code}: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const csvText = await res.text();
  const rows = parseCSVStream(csvText);

  await supabase.from("sync_logs").update({
    progress_total: rows.length,
    progress_message: `${ctry.code}: ${rows.length} produits trouvés, import...`,
  }).eq("id", syncLogId);

  let processed = 0;
  const countryStats: any[] = [];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const batch: any[] = [];

    for (const row of chunk) {
      const gtin = row["GTIN"] || "";
      const name = row["Name"] || "";
      if (!name) continue;

      const productUrl = row["Product URL"] || "";
      const qid = extractQid(productUrl) || gtin || slugify(name).slice(0, 32);
      if (!qid) continue;

      const brandName = row["Brand"] || null;
      const categoryName = row["Category"] || null;
      const bestPrice = parseFloat(row["€ Lowest Price inc. shipping"] || "0");
      const stockQty = parseInt(row["Total Inventory of All Offers"] || "0", 10);
      const sellerCount = parseInt(row["Number of Offers"] || "0", 10);
      const imageUrl = row["Image URL"] || "";
      const slug = slugify(name) + (gtin ? `-${gtin.slice(-6)}` : `-${qid.slice(0, 6)}`);
      const priceInclVat = bestPrice;
      const priceExclVat = bestPrice > 0 ? Math.round((bestPrice / (1 + vatRate / 100)) * 100) / 100 : 0;

      batch.push({
        qogita_qid: qid, gtin: gtin || null, name, slug,
        brand_name: brandName, category_name: categoryName,
        image_urls: imageUrl ? [imageUrl] : [], source: "qogita",
        is_active: true, is_published: true, synced_at: new Date().toISOString(),
        total_stock: stockQty, offer_count: sellerCount, is_in_stock: stockQty > 0,
        ...(priceExclVat > 0 ? { best_price_excl_vat: priceExclVat, best_price_incl_vat: priceInclVat } : {}),
      });

      countryStats.push({ qogita_qid: qid, country_code: ctry.code, best_price_excl_vat: priceExclVat > 0 ? priceExclVat : null, best_price_incl_vat: priceInclVat > 0 ? priceInclVat : null, offer_count: sellerCount, total_stock: stockQty, is_in_stock: stockQty > 0 });
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("products").upsert(batch, { onConflict: "qogita_qid", ignoreDuplicates: false });
      if (error) throw error;
    }

    processed += batch.length;
    if (i % (CHUNK_SIZE * 3) === 0) {
      await supabase.from("sync_logs").update({
        progress_current: processed,
        progress_message: `${ctry.code}: ${processed}/${rows.length} produits...`,
      }).eq("id", syncLogId);
    }
  }

  // Country stats
  if (countryStats.length > 0) {
    await supabase.from("sync_logs").update({ progress_message: `${ctry.code}: stats par pays...` }).eq("id", syncLogId);

    const qids = countryStats.map(s => s.qogita_qid);
    const qidToId = new Map<string, string>();
    for (let q = 0; q < qids.length; q += 1000) {
      const { data: prods } = await supabase.from("products").select("id, qogita_qid").in("qogita_qid", qids.slice(q, q + 1000));
      for (const p of (prods || [])) qidToId.set(p.qogita_qid, p.id);
    }

    const toUpsert = countryStats
      .filter(s => qidToId.has(s.qogita_qid))
      .map(s => ({ product_id: qidToId.get(s.qogita_qid)!, country_code: s.country_code, best_price_excl_vat: s.best_price_excl_vat, best_price_incl_vat: s.best_price_incl_vat, offer_count: s.offer_count, total_stock: s.total_stock, min_delivery_days: null, is_in_stock: s.is_in_stock }));

    for (let s = 0; s < toUpsert.length; s += 300) {
      await supabase.from("product_country_stats").upsert(toUpsert.slice(s, s + 300), { onConflict: "product_id,country_code", ignoreDuplicates: false });
    }
  }

  // Auto-create brands (batch, no individual queries)
  await supabase.from("sync_logs").update({ progress_message: `${ctry.code}: marques...` }).eq("id", syncLogId);
  const brandNames = new Set<string>();
  for (const row of rows) { if (row["Brand"]) brandNames.add(row["Brand"]); }
  const brandsData = Array.from(brandNames).map(name => ({
    name, slug: slugify(name), is_active: true, synced_at: new Date().toISOString(),
  }));
  for (let j = 0; j < brandsData.length; j += 300) {
    await supabase.from("brands").upsert(brandsData.slice(j, j + 300), { onConflict: "slug", ignoreDuplicates: true });
  }

  // Auto-create categories
  const catNames = new Set<string>();
  for (const row of rows) { if (row["Category"]) catNames.add(row["Category"]); }
  const catsData = Array.from(catNames).map(name => ({
    name, slug: slugify(name), is_active: true, synced_at: new Date().toISOString(),
  }));
  for (let j = 0; j < catsData.length; j += 300) {
    await supabase.from("categories").upsert(catsData.slice(j, j + 300), { onConflict: "slug", ignoreDuplicates: true });
  }

  // Link brand_id & category_id via batch
  await supabase.from("sync_logs").update({ progress_message: `${ctry.code}: liaison marques/catégories...` }).eq("id", syncLogId);
  {
    const { data: allBrands } = await supabase.from("brands").select("id, name");
    const brandMap = new Map((allBrands || []).map((b: any) => [b.name, b.id]));
    const { data: allCats } = await supabase.from("categories").select("id, name");
    const catMap = new Map((allCats || []).map((c: any) => [c.name, c.id]));

    // Only update products that need linking (no brand_id or category_id)
    const { data: needsBrand } = await supabase.from("products").select("id, brand_name")
      .eq("source", "qogita").is("brand_id", null).not("brand_name", "is", null).limit(2000);
    if (needsBrand && needsBrand.length > 0) {
      // Group by brand_name to batch update
      const byBrand = new Map<string, string[]>();
      for (const p of needsBrand) {
        const bid = brandMap.get(p.brand_name);
        if (bid) {
          if (!byBrand.has(bid)) byBrand.set(bid, []);
          byBrand.get(bid)!.push(p.id);
        }
      }
      for (const [bid, pids] of byBrand) {
        for (let k = 0; k < pids.length; k += 200) {
          await supabase.from("products").update({ brand_id: bid }).in("id", pids.slice(k, k + 200));
        }
      }
    }

    const { data: needsCat } = await supabase.from("products").select("id, category_name")
      .eq("source", "qogita").is("category_id", null).not("category_name", "is", null).limit(2000);
    if (needsCat && needsCat.length > 0) {
      const byCat = new Map<string, string[]>();
      for (const p of needsCat) {
        const cid = catMap.get(p.category_name);
        if (cid) {
          if (!byCat.has(cid)) byCat.set(cid, []);
          byCat.get(cid)!.push(p.id);
        }
      }
      for (const [cid, pids] of byCat) {
        for (let k = 0; k < pids.length; k += 200) {
          await supabase.from("products").update({ category_id: cid }).in("id", pids.slice(k, k + 200));
        }
      }
    }
  }

  await supabase.from("countries").update({ last_sync_at: new Date().toISOString() } as any).eq("code", ctry.code);

  return { stats: { products: processed, brands: brandNames.size, categories: catNames.size, country: ctry.code } };
}
