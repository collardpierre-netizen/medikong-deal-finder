import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;
const CHUNK_SIZE = 500;
const PAGE_SIZE = 100;

async function getQogitaToken(supabaseClient: any): Promise<{ token: string; baseUrl: string; config: any }> {
  const { data: config } = await supabaseClient.from("qogita_config").select("*").eq("id", 1).single();
  if (!config) throw new Error("qogita_config not found");
  if (!config.qogita_email || !config.qogita_password) throw new Error("Qogita email/password not configured");
  const baseUrl = config.base_url || "https://api.qogita.com";
  const authResponse = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.qogita_email, password: config.qogita_password }),
  });
  if (!authResponse.ok) throw new Error(`Qogita auth failed (${authResponse.status}): ${await authResponse.text()}`);
  const authData = await authResponse.json();
  const token = authData.accessToken;
  if (!token) throw new Error("No accessToken in Qogita auth response");
  await supabaseClient.from("qogita_config").update({ bearer_token: token }).eq("id", 1);
  return { token, baseUrl, config };
}

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let requestedCountries: string[] | null = null;
  try {
    const body = await req.json();
    if (body?.countries && Array.isArray(body.countries)) requestedCountries = body.countries;
    if (body?.country) requestedCountries = [body.country];
  } catch { /* no body */ }

  const { data: syncCountries } = await supabase.from("countries").select("code, name, default_vat_rate")
    .eq("is_active", true).eq("qogita_sync_enabled", true).order("display_order");
  let countriesToSync = syncCountries || [{ code: "BE", name: "Belgique", default_vat_rate: 21 }];
  if (requestedCountries) {
    countriesToSync = countriesToSync.filter((c: any) => requestedCountries!.includes(c.code));
  }

  // Check for interrupted sync
  const { data: existingSync } = await supabase
    .from("sync_logs").select("*").eq("sync_type", "products").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  let stats: any = { items_processed: 0, items_total: 0, chunks_done: 0, brands_created: 0, categories_created: 0, countries_done: [], current_country: "", last_page: {} };
  let skipCountries: string[] = [];

  if (existingSync && (existingSync.stats as any)?.items_processed > 0) {
    syncLogId = existingSync.id;
    stats = existingSync.stats as any;
    skipCountries = stats.countries_done || [];
    await supabase.from("sync_logs").update({ progress_message: `Reprise...` }).eq("id", syncLogId);
  } else {
    if (existingSync) {
      await supabase.from("sync_logs").update({ status: "error", error_message: "Superseded", completed_at: new Date().toISOString() }).eq("id", existingSync.id);
    }
    const { data: newLog } = await supabase.from("sync_logs").insert({
      sync_type: "products", status: "running", stats: {},
      progress_current: 0, progress_total: 0, progress_message: "Authentification Qogita...",
    }).select().single();
    syncLogId = newLog!.id;
  }

  try {
    const { token, baseUrl } = await getQogitaToken(supabase);

    for (let ci = 0; ci < countriesToSync.length; ci++) {
      const ctry = countriesToSync[ci] as any;
      if (skipCountries.includes(ctry.code)) continue;

      stats.current_country = ctry.code;
      const vatRate = ctry.default_vat_rate || 21;

      // Resume from last page if interrupted
      let page = (stats.last_page && stats.last_page[ctry.code]) || 1;
      let totalPages = 1;
      let countryProcessed = 0;
      const countryStatsBatch: any[] = [];

      await supabase.from("sync_logs").update({
        progress_message: `Pays ${ci + 1}/${countriesToSync.length} (${ctry.code}) — Page ${page}...`,
      }).eq("id", syncLogId);

      while (page <= totalPages) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          stats.last_page = { ...(stats.last_page || {}), [ctry.code]: page };
          await supabase.from("sync_logs").update({
            stats, progress_current: stats.items_processed,
            progress_message: `Pause timeout — ${ctry.code} page ${page}/${totalPages}`,
          }).eq("id", syncLogId);
          return new Response(JSON.stringify({ status: "partial", stats }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const url = `${baseUrl}/variants/search/?country=${ctry.code}&page=${page}&page_size=${PAGE_SIZE}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Qogita API ${res.status} for ${ctry.code} page ${page}: ${errText.substring(0, 200)}`);
        }

        const data = await res.json();
        const results = data.results || [];
        const count = data.count || 0;
        totalPages = Math.ceil(count / PAGE_SIZE);

        if (page === 1) {
          stats.items_total = (stats.items_total || 0) + count;
          await supabase.from("sync_logs").update({ progress_total: stats.items_total }).eq("id", syncLogId);
        }

        // Build batch
        const batchData: any[] = [];
        for (const row of results) {
          const qid = row.qid;
          if (!qid) continue;
          const name = row.name || "";
          if (!name) continue;

          const gtin = row.gtin || "";
          const slug = slugify(name) + (gtin ? `-${gtin.slice(-6)}` : `-${qid.slice(0, 6)}`);
          const bestPrice = parseFloat(row.bestPrice || row.best_price || "0");
          const stockQty = parseInt(row.totalStock || row.total_stock || "0", 10);
          const sellerCount = parseInt(row.sellerCount || row.seller_count || row.offerCount || "0", 10);

          const productRow: any = {
            qogita_qid: qid,
            qogita_fid: row.familyQid || null,
            gtin: gtin || null, name, slug,
            description: row.description || null,
            short_description: row.shortDescription || null,
            label: row.label || null,
            image_urls: row.imageUrl ? [row.imageUrl] : (row.images ? row.images.map((img: any) => img.url || img) : []),
            origin_country: row.originCountry || null,
            source: "qogita", is_active: true, is_published: true,
            synced_at: new Date().toISOString(),
            total_stock: stockQty, offer_count: sellerCount, is_in_stock: stockQty > 0,
            brand_name: row.brandName || (row.brand && typeof row.brand === "object" ? row.brand.name : row.brand) || null,
            brand_qid: row.brandQid || (row.brand && typeof row.brand === "object" ? row.brand.qid : null) || null,
            category_name: row.categoryName || (row.category && typeof row.category === "object" ? row.category.name : row.category) || null,
            category_qid: row.categoryQid || (row.category && typeof row.category === "object" ? row.category.qid : null) || null,
          };
          if (bestPrice > 0) {
            productRow.best_price_excl_vat = bestPrice;
            productRow.best_price_incl_vat = Math.round(bestPrice * (1 + vatRate / 100) * 100) / 100;
          }
          batchData.push(productRow);

          countryStatsBatch.push({
            qogita_qid: qid,
            country_code: ctry.code,
            best_price_excl_vat: bestPrice > 0 ? bestPrice : null,
            best_price_incl_vat: bestPrice > 0 ? Math.round(bestPrice * (1 + vatRate / 100) * 100) / 100 : null,
            offer_count: sellerCount,
            total_stock: stockQty,
            min_delivery_days: null,
            is_in_stock: stockQty > 0,
          });
        }

        if (batchData.length > 0) {
          const { error } = await supabase.from("products").upsert(batchData, {
            onConflict: "qogita_qid", ignoreDuplicates: false,
          });
          if (error) throw error;
        }

        countryProcessed += batchData.length;
        stats.items_processed = (stats.items_processed || 0) + batchData.length;
        stats.last_page = { ...(stats.last_page || {}), [ctry.code]: page + 1 };

        await supabase.from("sync_logs").update({
          stats, progress_current: stats.items_processed, progress_total: stats.items_total,
          progress_message: `${ctry.code}: Page ${page}/${totalPages} — ${countryProcessed}/${count} produits`,
        }).eq("id", syncLogId);

        page++;
        if (page <= totalPages) await new Promise(r => setTimeout(r, 200));
      }

      // Populate product_country_stats for this country
      if (countryStatsBatch.length > 0) {
        await supabase.from("sync_logs").update({
          progress_message: `${ctry.code}: Stats par pays (${countryStatsBatch.length})...`,
        }).eq("id", syncLogId);

        const qids = countryStatsBatch.map(s => s.qogita_qid);
        const qidToId = new Map<string, string>();
        for (let q = 0; q < qids.length; q += 1000) {
          const batch = qids.slice(q, q + 1000);
          const { data: prods } = await supabase.from("products").select("id, qogita_qid").in("qogita_qid", batch);
          for (const p of (prods || [])) qidToId.set(p.qogita_qid, p.id);
        }

        const statsToUpsert = countryStatsBatch
          .filter(s => qidToId.has(s.qogita_qid))
          .map(s => ({
            product_id: qidToId.get(s.qogita_qid)!,
            country_code: s.country_code,
            best_price_excl_vat: s.best_price_excl_vat,
            best_price_incl_vat: s.best_price_incl_vat,
            offer_count: s.offer_count,
            total_stock: s.total_stock,
            min_delivery_days: s.min_delivery_days,
            is_in_stock: s.is_in_stock,
          }));

        for (let s = 0; s < statsToUpsert.length; s += 500) {
          await supabase.from("product_country_stats").upsert(
            statsToUpsert.slice(s, s + 500),
            { onConflict: "product_id,country_code", ignoreDuplicates: false }
          );
        }
        stats.country_stats_created = (stats.country_stats_created || 0) + statsToUpsert.length;
      }

      stats.countries_done = [...(stats.countries_done || []), ctry.code];
      await supabase.from("countries").update({ last_sync_at: new Date().toISOString() } as any).eq("code", ctry.code);
    }

    // Auto-create brands from products
    await supabase.from("sync_logs").update({ progress_message: "Création des marques depuis les produits..." }).eq("id", syncLogId);
    {
      const { data: prods } = await supabase.from("products").select("brand_name, brand_qid")
        .eq("source", "qogita").eq("is_active", true).not("brand_name", "is", null);
      const uniqueBrands = new Map<string, string | null>();
      for (const p of (prods || [])) {
        if (p.brand_name && !uniqueBrands.has(p.brand_name)) uniqueBrands.set(p.brand_name, p.brand_qid);
      }
      const brandsData = Array.from(uniqueBrands.entries()).map(([name, qid]) => ({
        name, qogita_qid: qid,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        is_active: true, synced_at: new Date().toISOString(),
      }));
      for (let j = 0; j < brandsData.length; j += 500) {
        await supabase.from("brands").upsert(brandsData.slice(j, j + 500), { onConflict: "qogita_qid", ignoreDuplicates: false });
      }
      stats.brands_created = brandsData.length;
    }

    // Auto-create categories from products
    await supabase.from("sync_logs").update({ progress_message: "Création des catégories depuis les produits..." }).eq("id", syncLogId);
    {
      const { data: prods } = await supabase.from("products").select("category_name, category_qid")
        .eq("source", "qogita").eq("is_active", true).not("category_name", "is", null);
      const uniqueCats = new Map<string, string | null>();
      for (const p of (prods || [])) {
        if (p.category_name && !uniqueCats.has(p.category_name)) uniqueCats.set(p.category_name, p.category_qid);
      }
      const catsData = Array.from(uniqueCats.entries()).map(([name, qid]) => ({
        name, qogita_qid: qid,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        is_active: true, synced_at: new Date().toISOString(),
      }));
      for (let j = 0; j < catsData.length; j += 500) {
        await supabase.from("categories").upsert(catsData.slice(j, j + 500), { onConflict: "qogita_qid", ignoreDuplicates: false });
      }
      stats.categories_created = catsData.length;
    }

    // Resolve brand_id and category_id
    await supabase.from("sync_logs").update({ progress_message: "Liaison marques et catégories..." }).eq("id", syncLogId);
    {
      const { data: allBrands } = await supabase.from("brands").select("id, qogita_qid, name");
      const brandByQid = new Map((allBrands || []).map(b => [b.qogita_qid, b.id]));
      const brandByName = new Map((allBrands || []).map(b => [b.name, b.id]));
      const { data: allCats } = await supabase.from("categories").select("id, qogita_qid, name");
      const catByQid = new Map((allCats || []).map(c => [c.qogita_qid, c.id]));
      const catByName = new Map((allCats || []).map(c => [c.name, c.id]));

      const { data: noBrand } = await supabase.from("products").select("id, brand_qid, brand_name")
        .eq("source", "qogita").is("brand_id", null).not("brand_name", "is", null).limit(5000);
      for (const p of (noBrand || [])) {
        const bid = (p.brand_qid && brandByQid.get(p.brand_qid)) || brandByName.get(p.brand_name);
        if (bid) await supabase.from("products").update({ brand_id: bid }).eq("id", p.id);
      }

      const { data: noCat } = await supabase.from("products").select("id, category_qid, category_name")
        .eq("source", "qogita").is("category_id", null).not("category_name", "is", null).limit(5000);
      for (const p of (noCat || [])) {
        const cid = (p.category_qid && catByQid.get(p.category_qid)) || catByName.get(p.category_name);
        if (cid) await supabase.from("products").update({ category_id: cid }).eq("id", p.id);
      }
    }

    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: stats.items_processed, progress_total: stats.items_processed,
      progress_message: `Terminé — ${stats.items_processed} produits (${countriesToSync.map((c: any) => c.code).join(", ")}), ${stats.brands_created} marques, ${stats.categories_created} catégories`,
    }).eq("id", syncLogId);

    await supabase.from("qogita_config").update({ last_full_sync_at: new Date().toISOString(), sync_status: "completed" }).eq("id", 1);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync products error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
      progress_message: `Erreur: ${error.message}`,
    }).eq("id", syncLogId);
    await supabase.from("qogita_config").update({ sync_status: "error", sync_error_message: error.message }).eq("id", 1);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
