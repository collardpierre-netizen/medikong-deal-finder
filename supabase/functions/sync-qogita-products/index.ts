import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;
const CHUNK_SIZE = 500;

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

function parseCSV(text: string): any[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = "", inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Check for interrupted sync
  const { data: existingSync } = await supabase
    .from("sync_logs").select("*").eq("sync_type", "products").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  let resumeOffset = 0;
  let stats = { items_processed: 0, items_total: 0, chunks_done: 0, deactivated: 0, brands_created: 0, categories_created: 0 };

  if (existingSync && (existingSync.stats as any)?.items_processed > 0) {
    syncLogId = existingSync.id;
    stats = existingSync.stats as any;
    resumeOffset = stats.items_processed;
    await supabase.from("sync_logs").update({ progress_message: `Reprise à l'élément ${resumeOffset}...` }).eq("id", syncLogId);
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
    const { token, baseUrl, config } = await getQogitaToken(supabase);
    const country = config.default_country || "BE";

    // Step 1: Download CSV
    await supabase.from("sync_logs").update({ progress_message: "Téléchargement CSV..." }).eq("id", syncLogId);
    const csvUrl = `${baseUrl}/variants/search/download/?country=${country}`;
    const res = await fetch(csvUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" } });
    if (!res.ok) throw new Error(`Qogita CSV download failed ${res.status}: ${await res.text()}`);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    stats.items_total = rows.length;
    await supabase.from("sync_logs").update({ progress_total: rows.length, progress_message: `${rows.length} produits trouvés — import en cours` }).eq("id", syncLogId);

    const processedQids = new Set<string>();

    // Step 2: Batch upsert products in chunks
    for (let i = resumeOffset; i < rows.length; i += CHUNK_SIZE) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        stats.items_processed = i;
        await supabase.from("sync_logs").update({
          stats, progress_current: i, progress_total: rows.length,
          progress_message: `Pause timeout — reprendra à l'élément ${i}/${rows.length}`,
        }).eq("id", syncLogId);
        return new Response(JSON.stringify({ status: "partial", resumeAt: i, stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batchData: any[] = [];

      for (const row of chunk) {
        const qid = row.qid || row.variantQid || row.variant_qid;
        if (!qid) continue;
        const name = row.name || row.title || row.productName || "";
        if (!name) continue;
        processedQids.add(qid);

        const gtin = row.gtin || row.ean || "";
        const slug = slugify(name) + (gtin ? `-${gtin.slice(-6)}` : `-${qid.slice(0, 6)}`);
        const bestPrice = parseFloat(row.bestPrice || row.best_price || "0");
        const stockQty = parseInt(row.totalStock || row.total_stock || "0", 10);
        const sellerCount = parseInt(row.sellerCount || row.seller_count || row.offerCount || "0", 10);

        const productRow: any = {
          qogita_qid: qid,
          qogita_fid: row.familyQid || row.family_qid || null,
          gtin: gtin || null, name, slug,
          description: row.description || null,
          short_description: row.shortDescription || row.short_description || null,
          label: row.label || null,
          image_urls: row.imageUrl ? [row.imageUrl] : [],
          origin_country: row.originCountry || row.origin_country || null,
          source: "qogita", is_active: true, is_published: true,
          synced_at: new Date().toISOString(),
          total_stock: stockQty, offer_count: sellerCount, is_in_stock: stockQty > 0,
          // Store brand/category names for later resolution
          brand_name: row.brandName || row.brand_name || row.brand || null,
          brand_qid: row.brandQid || row.brand_qid || null,
          category_name: row.categoryName || row.category_name || row.category || null,
          category_qid: row.categoryQid || row.category_qid || null,
        };
        if (bestPrice > 0) {
          productRow.best_price_excl_vat = bestPrice;
          productRow.best_price_incl_vat = Math.round(bestPrice * 1.21 * 100) / 100;
        }
        batchData.push(productRow);
      }

      if (batchData.length > 0) {
        const { error } = await supabase.from("products").upsert(batchData, {
          onConflict: "qogita_qid",
          ignoreDuplicates: false,
        });
        if (error) throw error;
      }

      stats.items_processed = Math.min(i + CHUNK_SIZE, rows.length);
      stats.chunks_done++;

      await supabase.from("sync_logs").update({
        stats, progress_current: stats.items_processed, progress_total: rows.length,
        progress_message: `Import ${stats.items_processed}/${rows.length} produits`,
      }).eq("id", syncLogId);

      await new Promise(r => setTimeout(r, 50));
    }

    // Step 3: Auto-create brands from products
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

    // Step 4: Auto-create categories from products
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

    // Step 5: Resolve brand_id and category_id on products
    await supabase.from("sync_logs").update({ progress_message: "Liaison marques et catégories aux produits..." }).eq("id", syncLogId);
    {
      const { data: allBrands } = await supabase.from("brands").select("id, qogita_qid, name");
      const brandByQid = new Map((allBrands || []).map(b => [b.qogita_qid, b.id]));
      const brandByName = new Map((allBrands || []).map(b => [b.name, b.id]));

      const { data: allCats } = await supabase.from("categories").select("id, qogita_qid, name");
      const catByQid = new Map((allCats || []).map(c => [c.qogita_qid, c.id]));
      const catByName = new Map((allCats || []).map(c => [c.name, c.id]));

      // Update products missing brand_id
      const { data: noBrand } = await supabase.from("products").select("id, brand_qid, brand_name")
        .eq("source", "qogita").is("brand_id", null).not("brand_name", "is", null).limit(5000);
      for (const p of (noBrand || [])) {
        const bid = (p.brand_qid && brandByQid.get(p.brand_qid)) || brandByName.get(p.brand_name);
        if (bid) await supabase.from("products").update({ brand_id: bid }).eq("id", p.id);
      }

      // Update products missing category_id
      const { data: noCat } = await supabase.from("products").select("id, category_qid, category_name")
        .eq("source", "qogita").is("category_id", null).not("category_name", "is", null).limit(5000);
      for (const p of (noCat || [])) {
        const cid = (p.category_qid && catByQid.get(p.category_qid)) || catByName.get(p.category_name);
        if (cid) await supabase.from("products").update({ category_id: cid }).eq("id", p.id);
      }
    }

    // Step 6: Deactivate absent products
    await supabase.from("sync_logs").update({ progress_message: "Désactivation des produits absents..." }).eq("id", syncLogId);
    const { data: qProducts } = await supabase.from("products").select("id, qogita_qid").eq("source", "qogita").eq("is_active", true);
    const toDeactivate = (qProducts || []).filter(p => p.qogita_qid && !processedQids.has(p.qogita_qid)).map(p => p.id);
    if (toDeactivate.length > 0) {
      for (let i = 0; i < toDeactivate.length; i += 200) {
        await supabase.from("products").update({ is_in_stock: false, total_stock: 0 }).in("id", toDeactivate.slice(i, i + 200));
      }
    }
    stats.deactivated = toDeactivate.length;

    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: rows.length, progress_total: rows.length,
      progress_message: `Terminé — ${rows.length} produits, ${stats.brands_created} marques, ${stats.categories_created} catégories`,
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
