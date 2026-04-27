import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEILI_URL = Deno.env.get("MEILISEARCH_URL")!;
const MEILI_ADMIN_KEY = Deno.env.get("MEILISEARCH_ADMIN_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function meiliRequest(path: string, method = "GET", body?: unknown, retries = 3): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${MEILI_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MEILI_ADMIN_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.json();

    const text = await res.text();
    // Meilisearch creates indexes asynchronously via tasks. A 404 right after a POST
    // /indexes call usually means the index isn't materialized yet. Retry with backoff.
    const isRetryable = res.status === 404 || res.status === 409 || res.status >= 500;
    if (isRetryable && attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    throw new Error(`Meilisearch ${method} ${path} → ${res.status}: ${text}`);
  }
  throw new Error(`Meilisearch ${method} ${path} → failed after ${retries} retries`);
}

// Wait until an index actually exists. Meilisearch creates indexes via async tasks,
// so we must (1) trigger creation, (2) await the task completion, (3) confirm the
// index responds to GET before issuing settings PATCH.
async function waitForTask(taskUid: number, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${MEILI_URL}/tasks/${taskUid}`, {
      headers: { Authorization: `Bearer ${MEILI_ADMIN_KEY}` },
    });
    if (r.ok) {
      const t = await r.json();
      if (t.status === "succeeded") return;
      if (t.status === "failed" || t.status === "canceled") {
        throw new Error(`Meilisearch task ${taskUid} ${t.status}: ${JSON.stringify(t.error || {})}`);
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Meilisearch task ${taskUid} timed out`);
}

async function ensureIndexReady(uid: string, primaryKey: string) {
  // Check if index already exists
  const existing = await fetch(`${MEILI_URL}/indexes/${uid}`, {
    headers: { Authorization: `Bearer ${MEILI_ADMIN_KEY}` },
  });
  if (existing.ok) return;

  // Create it and wait for the task to succeed
  const createRes = await fetch(`${MEILI_URL}/indexes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MEILI_ADMIN_KEY}`,
    },
    body: JSON.stringify({ uid, primaryKey }),
  });
  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(`Failed to create index ${uid}: ${createRes.status} ${await createRes.text()}`);
  }
  if (createRes.ok) {
    const taskInfo = await createRes.json();
    if (taskInfo?.taskUid != null) {
      await waitForTask(taskInfo.taskUid).catch((e) => console.warn(`Task wait warn: ${e.message}`));
    }
  }

  // Final confirmation
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${MEILI_URL}/indexes/${uid}`, {
      headers: { Authorization: `Bearer ${MEILI_ADMIN_KEY}` },
    });
    if (r.ok) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Index ${uid} not ready after creation`);
}

// Setup index settings
async function setupIndexes() {
  // Products index
  await ensureIndexReady("products", "id");
  await meiliRequest("/indexes/products/settings", "PATCH", {
    searchableAttributes: ["name", "brand_name", "gtin", "cnk_code", "short_description"],
    displayedAttributes: ["id", "name", "slug", "brand_name", "gtin", "cnk_code", "image_url", "best_price_excl_vat", "best_price_incl_vat", "offer_count", "is_in_stock", "category_name"],
    filterableAttributes: ["brand_name", "category_name", "is_in_stock", "is_active"],
    sortableAttributes: ["best_price_excl_vat", "name", "offer_count"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      disableOnAttributes: ["gtin", "cnk_code"],
    },
    synonyms: {
      creme: ["crème"],
      serum: ["sérum"],
      vitamine: ["vitamin"],
    },
    pagination: { maxTotalHits: 1000 },
  });

  // Brands index
  await ensureIndexReady("brands", "id");
  await meiliRequest("/indexes/brands/settings", "PATCH", {
    searchableAttributes: ["name", "description"],
    displayedAttributes: ["id", "name", "slug", "logo_url", "product_count"],
    filterableAttributes: ["is_active"],
    typoTolerance: { enabled: true },
  });

  // Categories index
  await ensureIndexReady("categories", "id");
  await meiliRequest("/indexes/categories/settings", "PATCH", {
    searchableAttributes: ["name", "description"],
    displayedAttributes: ["id", "name", "slug", "icon", "image_url"],
    filterableAttributes: ["is_active"],
    typoTolerance: { enabled: true },
  });
}

// Bulk sync a table to an index
async function bulkSync(supabase: any, table: string, indexUid: string, transform?: (row: any) => any, filter?: { column: string; value: any }) {
  const BATCH = 1000;
  let offset = 0;
  let total = 0;

  while (true) {
    let query = supabase.from(table).select("*");
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = await query.range(offset, offset + BATCH - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const docs = transform ? data.map(transform) : data;
    await meiliRequest(`/indexes/${indexUid}/documents`, "POST", docs);
    total += docs.length;
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  return total;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "webhook";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "get-search-key") {
      const searchKey = Deno.env.get("MEILISEARCH_SEARCH_KEY");
      if (!searchKey) {
        return new Response(JSON.stringify({ error: "MEILISEARCH_SEARCH_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ url: MEILI_URL, searchKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "setup") {
      await setupIndexes();
      return new Response(JSON.stringify({ success: true, message: "Indexes configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync-products-batch") {
      const offset = body.offset || 0;
      const batchSize = body.batch_size || 2000;
      
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, brand_name, gtin, cnk_code, short_description, image_url, image_urls, best_price_excl_vat, best_price_incl_vat, offer_count, is_in_stock, is_active, category_name")
        .range(offset, offset + batchSize - 1);
      
      if (error) throw error;
      if (!data || data.length === 0) {
        return new Response(JSON.stringify({ success: true, indexed: 0, done: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const docs = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand_name: p.brand_name || "",
        gtin: p.gtin || "",
        cnk_code: p.cnk_code || "",
        short_description: p.short_description || "",
        image_url: p.image_urls?.[0] || p.image_url || "",
        best_price_excl_vat: p.best_price_excl_vat || 0,
        best_price_incl_vat: p.best_price_incl_vat || 0,
        offer_count: p.offer_count || 0,
        is_in_stock: p.is_in_stock,
        is_active: p.is_active,
        category_name: p.category_name || "",
      }));

      await meiliRequest("/indexes/products/documents", "POST", docs);

      return new Response(JSON.stringify({ 
        success: true, 
        indexed: docs.length, 
        next_offset: offset + docs.length,
        done: docs.length < batchSize,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync-brands-categories") {
      const activeFilter = { column: "is_active", value: true };
      const brandCount = await bulkSync(supabase, "brands", "brands", (b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logo_url: b.logo_url || "",
        description: b.description || "",
        product_count: b.product_count || 0,
        is_active: b.is_active,
      }), activeFilter);

      const catCount = await bulkSync(supabase, "categories", "categories", (c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || "",
        icon: c.icon || "",
        image_url: c.image_url || "",
        is_active: c.is_active,
      }), activeFilter);

      return new Response(JSON.stringify({
        success: true,
        synced: { brands: brandCount, categories: catCount },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "full-sync") {
      await setupIndexes();

      const productCount = await bulkSync(supabase, "products", "products", (p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand_name: p.brand_name || "",
        gtin: p.gtin || "",
        cnk_code: p.cnk_code || "",
        short_description: p.short_description || "",
        image_url: p.image_urls?.[0] || p.image_url || "",
        best_price_excl_vat: p.best_price_excl_vat || 0,
        best_price_incl_vat: p.best_price_incl_vat || 0,
        offer_count: p.offer_count || 0,
        is_in_stock: p.is_in_stock,
        is_active: p.is_active,
        category_name: p.category_name || "",
      }));

      const activeFilter = { column: "is_active", value: true };
      const brandCount = await bulkSync(supabase, "brands", "brands", (b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logo_url: b.logo_url || "",
        description: b.description || "",
        product_count: b.product_count || 0,
        is_active: b.is_active,
      }), activeFilter);

      const catCount = await bulkSync(supabase, "categories", "categories", (c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || "",
        icon: c.icon || "",
        image_url: c.image_url || "",
        is_active: c.is_active,
      }), activeFilter);

      return new Response(JSON.stringify({
        success: true,
        synced: { products: productCount, brands: brandCount, categories: catCount },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Webhook mode: single record upsert/delete
    const { type, table, record, old_record } = body;
    if (!type || !table) {
      return new Response(JSON.stringify({ error: "Missing type/table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const indexUid = table;
    if (type === "DELETE" && old_record?.id) {
      await meiliRequest(`/indexes/${indexUid}/documents/${old_record.id}`, "DELETE");
    } else if (record) {
      await meiliRequest(`/indexes/${indexUid}/documents`, "POST", [record]);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-meilisearch error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
