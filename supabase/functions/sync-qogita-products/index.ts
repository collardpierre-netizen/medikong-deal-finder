import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK = 200;

async function getToken(sb: any) {
  const { data: c } = await sb.from("qogita_config").select("*").eq("id", 1).single();
  if (!c?.qogita_email || !c?.qogita_password) throw new Error("Qogita credentials missing");
  const base = c.base_url || "https://api.qogita.com";
  const r = await fetch(`${base}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: c.qogita_email, password: c.qogita_password }),
  });
  if (!r.ok) throw new Error(`Auth failed (${r.status})`);
  const { accessToken } = await r.json();
  if (!accessToken) throw new Error("No accessToken");
  await sb.from("qogita_config").update({ bearer_token: accessToken }).eq("id", 1);
  return { token: accessToken, baseUrl: base };
}

function sl(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function findCol(headers: string[], ...keywords: string[]): number {
  return headers.findIndex(h => {
    const hl = h.toLowerCase();
    return keywords.every(k => hl.includes(k.toLowerCase()));
  });
}

async function ensureQogitaVendor(sb: any): Promise<string> {
  const { data: existing } = await sb.from("vendors").select("id")
    .eq("type", "qogita_virtual").eq("slug", "qogita").maybeSingle();
  if (existing) return existing.id;
  const { data: nv } = await sb.from("vendors").insert({
    type: "qogita_virtual", name: "Qogita", slug: "qogita",
    qogita_seller_alias: "qogita", auto_forward_to_qogita: true, is_active: true,
  }).select("id").single();
  return nv!.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let targetCountry = "BE";
  try {
    const b = await req.json();
    if (b?.country) targetCountry = b.country;
  } catch { /* */ }

  // Verify country is enabled
  const { data: ctryRow } = await sb.from("countries").select("code, default_vat_rate")
    .eq("code", targetCountry).eq("is_active", true).eq("qogita_sync_enabled", true).single();

  if (!ctryRow) {
    return new Response(JSON.stringify({ error: `Country ${targetCountry} not enabled for sync` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create sync log
  const { data: log } = await sb.from("sync_logs").insert({
    sync_type: "products", status: "running",
    stats: { country: targetCountry },
    progress_current: 0, progress_total: 0,
    progress_message: `${targetCountry}: démarrage...`,
  }).select().single();

  const logId = log!.id;

  // Launch background processing
  (globalThis as any).EdgeRuntime.waitUntil(
    syncCountryStream(sb, targetCountry, ctryRow.default_vat_rate || 21, logId).catch(async (e: any) => {
      console.error("Background sync error:", e);
      await sb.from("sync_logs").update({
        status: "error", completed_at: new Date().toISOString(),
        error_message: e.message, progress_message: `Erreur: ${e.message}`,
      }).eq("id", logId);
    })
  );

  return new Response(JSON.stringify({
    success: true, sync_log_id: logId, country: targetCountry,
    message: `Sync ${targetCountry} lancée en arrière-plan.`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

async function syncCountryStream(sb: any, country: string, vat: number, logId: string) {
  const { token, baseUrl } = await getToken(sb);
  const qogitaVendorId = await ensureQogitaVendor(sb);

  await sb.from("sync_logs").update({
    progress_message: `${country}: téléchargement CSV (~105 MB)...`,
  }).eq("id", logId);

  // CRITICAL: No Accept header — Qogita returns CSV, Accept:application/json causes 406
  const res = await fetch(`${baseUrl}/variants/search/download/?country=${country}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`CSV download ${country}: ${res.status} ${errBody.slice(0, 300)}`);
  }

  // STREAMING: read the response body chunk by chunk to avoid loading 105MB in memory
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let headers: string[] | null = null;
  let colMap: Record<string, number> = {};

  let processed = 0;
  let totalLines = 0;
  let batchLines: string[] = [];
  const brandNames = new Set<string>();
  const catNames = new Set<string>();

  await sb.from("sync_logs").update({
    progress_message: `${country}: streaming & import...`,
  }).eq("id", logId);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // keep incomplete last line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      // First non-empty line = headers
      if (!headers) {
        headers = parseCSVLine(line);
        colMap = {
          gtin: findCol(headers, "gtin"),
          name: findCol(headers, "name"),
          category: findCol(headers, "category"),
          brand: findCol(headers, "brand"),
          price: findCol(headers, "lowest price"),
          inventory: findCol(headers, "inventory"),
          delivery: findCol(headers, "delivery"),
          url: findCol(headers, "product url"),
          image: findCol(headers, "image url"),
          offers: findCol(headers, "number", "offer"),
          preorder: findCol(headers, "pre-order"),
        };
        console.log("CSV headers detected:", headers);
        console.log("Column mapping:", colMap);
        continue;
      }

      totalLines++;
      batchLines.push(line);

      // Flush batch
      if (batchLines.length >= CHUNK) {
        processed += await processBatch(sb, batchLines, colMap, vat, country, brandNames, catNames, qogitaVendorId);
        batchLines = [];

        // Update progress every few chunks — use totalLines as running estimate of total
        if (processed % (CHUNK * 5) < CHUNK) {
          await sb.from("sync_logs").update({
            progress_current: processed,
            progress_total: totalLines,
            progress_message: `${country}: ${processed.toLocaleString()} / ~${totalLines.toLocaleString()} produits importés...`,
          }).eq("id", logId);
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim() && headers) {
    batchLines.push(buffer);
  }
  if (batchLines.length > 0) {
    processed += await processBatch(sb, batchLines, colMap, vat, country, brandNames, catNames, qogitaVendorId);
  }

  // Upsert brands
  await sb.from("sync_logs").update({
    progress_message: `${country}: ${brandNames.size} marques...`,
  }).eq("id", logId);

  const bd = Array.from(brandNames).map(n => ({
    name: n, slug: sl(n), is_active: true, synced_at: new Date().toISOString(),
  }));
  for (let i = 0; i < bd.length; i += 500) {
    await sb.from("brands").upsert(bd.slice(i, i + 500), { onConflict: "slug", ignoreDuplicates: true });
  }

  // Upsert categories
  const cd = Array.from(catNames).map(n => ({
    name: n, slug: sl(n), is_active: true, synced_at: new Date().toISOString(),
  }));
  for (let i = 0; i < cd.length; i += 500) {
    await sb.from("categories").upsert(cd.slice(i, i + 500), { onConflict: "slug", ignoreDuplicates: true });
  }

  // Link brand_id / category_id on products missing them
  await linkBrandsAndCategories(sb, country, logId);

  // Update product counts on brands
  await sb.from("sync_logs").update({
    progress_message: `${country}: mise à jour compteurs...`,
  }).eq("id", logId);
  await sb.rpc("update_brand_product_counts");

  await sb.from("countries").update({ last_sync_at: new Date().toISOString() } as any).eq("code", country);

  await sb.from("sync_logs").update({
    status: "completed", completed_at: new Date().toISOString(),
    progress_current: processed, progress_total: processed,
    stats: { country, products: processed, brands: brandNames.size, categories: catNames.size },
    progress_message: `${country}: ${processed} produits, ${brandNames.size} marques, ${catNames.size} catégories ✓`,
  }).eq("id", logId);

  await sb.from("qogita_config").update({
    last_full_sync_at: new Date().toISOString(), sync_status: "completed",
  }).eq("id", 1);
}

async function processBatch(
  sb: any, lines: string[], colMap: Record<string, number>,
  vat: number, country: string,
  brandNames: Set<string>, catNames: Set<string>,
  qogitaVendorId: string,
  seenSlugs: Set<string>,
): Promise<number> {
  const products: any[] = [];
  const csvData: any[] = [];

  for (const line of lines) {
    const cols = parseCSVLine(line);
    const gtin = cols[colMap.gtin] || "";
    const name = cols[colMap.name] || "";
    if (!name) continue;

    const brand = cols[colMap.brand] || "";
    const category = cols[colMap.category] || "";
    const priceStr = cols[colMap.price] || "0";
    const inventoryStr = cols[colMap.inventory] || "0";
    const deliveryStr = cols[colMap.delivery] || "";
    const productUrl = cols[colMap.url] || "";
    const imageUrl = cols[colMap.image] || "";
    const preorderStr = colMap.preorder >= 0 ? (cols[colMap.preorder] || "") : "";

    const qidMatch = productUrl.match(/\/products\/([a-f0-9]+)\//);
    const qid = qidMatch?.[1] || null;
    const stableId = qid || gtin || sl(name).slice(0, 32);
    if (!stableId) continue;

    if (brand) brandNames.add(brand);
    if (category) catNames.add(category);

    const bp = parseFloat(priceStr) || 0;
    const stock = parseInt(inventoryStr, 10) || 0;
    const delivery = parseInt(deliveryStr, 10) || 0;
    const pe = bp > 0 ? Math.round((bp / (1 + vat / 100)) * 100) / 100 : 0;
    const baseSlug = sl(name) + (gtin ? `-${gtin.slice(-6)}` : `-${stableId.slice(0, 6)}`);
    const slug = dedupeSlug(baseSlug, seenSlugs);
    seenSlugs.add(slug);
    const isPreorder = preorderStr.toLowerCase() === "true" || preorderStr === "1";

    products.push({
      qogita_qid: stableId, gtin: gtin || null, name, slug,
      brand_name: brand || null, category_name: category || null,
      image_urls: imageUrl ? [imageUrl] : [], source: "qogita",
      is_active: true, is_published: true,
      synced_at: new Date().toISOString(),
      total_stock: stock, is_in_stock: stock > 0,
      min_delivery_days: delivery > 0 ? delivery : null,
      ...(pe > 0 ? { best_price_excl_vat: pe, best_price_incl_vat: bp } : {}),
    });

    csvData.push({ qid: stableId, pe, pi: bp, stock, delivery, isPreorder });
  }

  if (products.length === 0) return 0;

  // Upsert products
  const { error } = await sb.from("products").upsert(products, {
    onConflict: "qogita_qid", ignoreDuplicates: false,
  });
  if (error) console.error("Upsert error:", error.message);

  // Get product IDs for offers + stats
  const qids = csvData.map((s: any) => s.qid);
  const { data: prods } = await sb.from("products").select("id, qogita_qid").in("qogita_qid", qids);
  const m = new Map((prods || []).map((p: any) => [p.qogita_qid, p.id]));

  // Upsert country stats
  const countryStats = csvData
    .filter((s: any) => m.has(s.qid))
    .map((s: any) => ({
      product_id: m.get(s.qid)!, country_code: country,
      best_price_excl_vat: s.pe > 0 ? s.pe : null,
      best_price_incl_vat: s.pi > 0 ? s.pi : null,
      total_stock: s.stock, is_in_stock: s.stock > 0,
      offer_count: 1, min_delivery_days: s.delivery > 0 ? s.delivery : null,
    }));

  if (countryStats.length > 0) {
    await sb.from("product_country_stats").upsert(countryStats, {
      onConflict: "product_id,country_code", ignoreDuplicates: false,
    });
  }

  // Create/update offers for each product
  const offers = csvData
    .filter((s: any) => m.has(s.qid) && s.pe > 0)
    .map((s: any) => ({
      product_id: m.get(s.qid)!,
      vendor_id: qogitaVendorId,
      country_code: country,
      qogita_base_price: s.pe,
      price_excl_vat: s.pe,
      price_incl_vat: s.pi > 0 ? s.pi : Math.round(s.pe * (1 + vat / 100) * 100) / 100,
      vat_rate: vat,
      stock_quantity: s.stock,
      stock_status: s.stock > 0 ? "in_stock" : (s.isPreorder ? "pre_order" : "out_of_stock"),
      delivery_days: s.delivery > 0 ? s.delivery : 3,
      shipping_from_country: country,
      is_qogita_backed: true,
      is_active: true,
      moq: 1,
      synced_at: new Date().toISOString(),
    }));

  if (offers.length > 0) {
    const { error: offerErr } = await sb.from("offers").upsert(offers, {
      onConflict: "product_id,vendor_id,country_code", ignoreDuplicates: false,
    });
    if (offerErr) console.error("Offer upsert error:", offerErr.message);
  }

  return products.length;
}

async function linkBrandsAndCategories(sb: any, country: string, logId: string) {
  await sb.from("sync_logs").update({
    progress_message: `${country}: liaison marques/catégories...`,
  }).eq("id", logId);

  // Load ALL brands and categories (no limit issue — these tables are small)
  const { data: ab } = await sb.from("brands").select("id, name").limit(10000);
  const bm = new Map((ab || []).map((b: any) => [b.name, b.id]));
  const { data: ac } = await sb.from("categories").select("id, name").limit(10000);
  const cm = new Map((ac || []).map((c: any) => [c.name, c.id]));

  // Link brands in pages of 1000 until none remain
  let linked = 0;
  while (true) {
    const { data: nb } = await sb.from("products").select("id, brand_name")
      .eq("source", "qogita").is("brand_id", null).not("brand_name", "is", null).limit(1000);
    if (!nb?.length) break;

    const byB = new Map<string, string[]>();
    for (const p of nb) {
      const bid = bm.get(p.brand_name);
      if (bid) { if (!byB.has(bid)) byB.set(bid, []); byB.get(bid)!.push(p.id); }
    }
    if (byB.size === 0) break; // no matches possible
    for (const [bid, pids] of byB) {
      for (let k = 0; k < pids.length; k += 100)
        await sb.from("products").update({ brand_id: bid }).in("id", pids.slice(k, k + 100));
    }
    linked += nb.length;
    if (linked > 100000) break; // safety
  }

  // Link categories in pages
  linked = 0;
  while (true) {
    const { data: nc } = await sb.from("products").select("id, category_name")
      .eq("source", "qogita").is("category_id", null).not("category_name", "is", null).limit(1000);
    if (!nc?.length) break;

    const byC = new Map<string, string[]>();
    for (const p of nc) {
      const cid = cm.get(p.category_name);
      if (cid) { if (!byC.has(cid)) byC.set(cid, []); byC.get(cid)!.push(p.id); }
    }
    if (byC.size === 0) break;
    for (const [cid, pids] of byC) {
      for (let k = 0; k < pids.length; k += 100)
        await sb.from("products").update({ category_id: cid }).in("id", pids.slice(k, k + 100));
    }
    linked += nc.length;
    if (linked > 100000) break;
  }
}
