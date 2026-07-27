// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 200;

type JobType = "buyer_comparator" | "product_submission";

interface BuyerLine {
  index: number;
  ean?: string | null;
  cnk?: string | null;
  sku?: string | null;
  raw_name?: string | null;
  raw_brand?: string | null;
  quantity: number;
  currentPrice: number;
}

interface SubmissionLine {
  index: number;
  data: Record<string, any>;
  errors?: string[];
}

const admin = () =>
  createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const updateJob = async (jobId: string, patch: Record<string, any>) => {
  const sb = admin();
  await sb.from("import_jobs").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
};

const failJob = async (jobId: string, message: string) => {
  await updateJob(jobId, {
    status: "failed",
    error_message: message.slice(0, 2000),
    finished_at: new Date().toISOString(),
  });
};

const normalizeForKey = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

// ------- Safe paginated helpers -------
// PostgREST tronque SILENCIEUSEMENT à 1000 lignes tout .select() non paginé.
// Ces helpers protègent tous les balayages > 100 clés / > 1000 lignes attendues.
const IN_CHUNK = 100;
const PAGE_SIZE = 1000;

async function selectInChunked<T = any>(
  sb: any,
  table: string,
  cols: string,
  column: string,
  values: string[],
  applyFilters?: (q: any) => any,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const slice = values.slice(i, i + IN_CHUNK);
    let q = sb.from(table).select(cols).in(column, slice);
    if (applyFilters) q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw new Error(`selectInChunked ${table}.${column}: ${error.message}`);
    if (data) out.push(...(data as T[]));
  }
  return out;
}

// Pagination range keyset pour .in() qui peut ramener > 1000 lignes
// (ex: offers.in(product_id, ...) — plusieurs offres par produit).
async function selectInPaginated<T = any>(
  sb: any,
  table: string,
  cols: string,
  column: string,
  values: string[],
  applyFilters?: (q: any) => any,
  order?: { column: string; ascending?: boolean }[],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const slice = values.slice(i, i + IN_CHUNK);
    let from = 0;
    while (true) {
      let q = sb.from(table).select(cols).in(column, slice);
      if (applyFilters) q = applyFilters(q);
      if (order) for (const o of order) q = q.order(o.column, { ascending: o.ascending !== false });
      q = q.range(from, from + PAGE_SIZE - 1);
      const { data, error } = await q;
      if (error) throw new Error(`selectInPaginated ${table}.${column}: ${error.message}`);
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return out;
}

// ------- Buyer comparator processor -------
async function processBuyerComparator(
  jobId: string,
  userId: string,
  saveToAccount: boolean,
  rows: BuyerLine[],
) {
  const sb = admin();
  const allResults: any[] = new Array(rows.length);
  let processed = 0;
  let foundCount = 0;
  let unavailableCount = 0;

  // Accumulate favorites/watches across all batches (matched only, dedupe by product_id)
  const favoritesMap = new Map<string, { user_id: string; product_id: string }>();
  const watchesMap = new Map<string, { user_id: string; product_id: string; user_price_excl_vat: number }>();

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const { data: jobCheck } = await sb
      .from("import_jobs").select("status").eq("id", jobId).single();
    if (jobCheck?.status === "cancelled") {
      await updateJob(jobId, { finished_at: new Date().toISOString() });
      return;
    }

    const chunk = rows.slice(start, start + BATCH_SIZE);
    const eans = [...new Set(chunk.map((l) => l.ean).filter(Boolean))] as string[];
    const cnks = [...new Set(chunk.map((l) => l.cnk).filter(Boolean))] as string[];
    const skus = [...new Set(chunk.map((l) => l.sku).filter(Boolean))] as string[];

    // Lookup WITHOUT is_active filter — we want inactive matches too.
    // Chunké à 100 clés par .in() (défense en profondeur URL length).
    const productCols = "id, name, image_url, gtin, cnk_code, sku, is_active, brand_id";
    const [byEan, byCnk, bySku] = await Promise.all([
      eans.length ? selectInChunked<any>(sb, "products", productCols, "gtin", eans) : Promise.resolve([]),
      cnks.length ? selectInChunked<any>(sb, "products", productCols, "cnk_code", cnks) : Promise.resolve([]),
      skus.length ? selectInChunked<any>(sb, "products", productCols, "sku", skus) : Promise.resolve([]),
    ]);

    const mapEan = new Map<string, any>();
    const mapCnk = new Map<string, any>();
    const mapSku = new Map<string, any>();
    for (const p of [...byEan, ...byCnk, ...bySku]) {
      if (p.gtin && !mapEan.has(p.gtin)) mapEan.set(p.gtin, p);
      if (p.cnk_code && !mapCnk.has(p.cnk_code)) mapCnk.set(p.cnk_code, p);
      if (p.sku && !mapSku.has(p.sku)) mapSku.set(p.sku, p);
    }

    const resolveMatch = (l: BuyerLine) => {
      if (l.ean) {
        const p = mapEan.get(l.ean);
        if (p) return { product: p, matchedBy: "gtin" as const };
      }
      if (l.cnk) {
        const p = mapCnk.get(l.cnk);
        if (p) return { product: p, matchedBy: "cnk" as const };
      }
      if (l.sku) {
        const p = mapSku.get(l.sku);
        if (p) return { product: p, matchedBy: "sku" as const };
      }
      return { product: undefined, matchedBy: undefined };
    };

    // Active products only have offers worth checking
    const activeProductIds = [...new Set(
      chunk.map((l) => {
        const m = resolveMatch(l);
        return m.product?.is_active ? m.product.id : null;
      }).filter(Boolean),
    )] as string[];

    // BUG FIX: sans pagination, un batch de 200 produits × N offres pouvait dépasser
    // le plafond silencieux de 1000 lignes de PostgREST et perdre des offres →
    // produits marqués "unavailable" à tort. `selectInPaginated` garantit qu'on
    // récupère TOUTES les offres actives des produits du batch.
    const offerByProduct = new Map<string, any>();
    if (activeProductIds.length) {
      const offers = await selectInPaginated<any>(
        sb,
        "offers",
        "id, product_id, price_excl_vat, vendor_id",
        "product_id",
        activeProductIds,
        (q) => q.eq("is_active", true),
        [
          { column: "product_id", ascending: true },
          { column: "price_excl_vat", ascending: true },
        ],
      );
      for (const o of offers) {
        if (!offerByProduct.has(o.product_id)) offerByProduct.set(o.product_id, o);
      }
    }

    for (const line of chunk) {
      const { product, matchedBy } = resolveMatch(line);
      const offer = product?.is_active ? offerByProduct.get(product.id) : undefined;
      const mediPrice = offer?.price_excl_vat != null ? Number(offer.price_excl_vat) : undefined;
      const status = product && offer ? "found" : "unavailable";
      if (status === "found") foundCount++; else unavailableCount++;

      // Sourcing pipeline classification
      let sourcingStatus: "unmatched" | "inactive_product" | "no_active_offer" | null = null;
      if (!product) sourcingStatus = "unmatched";
      else if (!product.is_active) sourcingStatus = "inactive_product";
      else if (!offer) sourcingStatus = "no_active_offer";

      if (sourcingStatus) {
        // Build dedupe key
        let dedupeKey: string;
        if (product?.id) {
          dedupeKey = `pid:${product.id}`;
        } else if (line.ean) {
          dedupeKey = `gtin:${line.ean}`;
        } else if (line.cnk) {
          dedupeKey = `cnk:${line.cnk}`;
        } else if (line.raw_name) {
          dedupeKey = `name:${normalizeForKey(line.raw_name)}`;
        } else {
          dedupeKey = `sku:${line.sku ?? "unknown"}`;
        }

        const buyerPriceCents = line.currentPrice > 0
          ? Math.round(line.currentPrice * 100)
          : null;

        try {
          await sb.rpc("upsert_sourcing_item", {
            _dedupe_key: dedupeKey,
            _product_id: product?.id ?? null,
            _brand_id: product?.brand_id ?? null,
            _gtin: line.ean ?? null,
            _cnk: line.cnk ?? null,
            _raw_name: line.raw_name ?? product?.name ?? null,
            _raw_brand: line.raw_brand ?? null,
            _status: sourcingStatus,
            _user_id: userId,
            _quantity: line.quantity ?? 1,
            _buyer_price_cents: buyerPriceCents,
          });
        } catch (e) {
          console.error("[sourcing] upsert failed", dedupeKey, e);
        }
      }

      // Favorites + watch list: ALL matched lines (active or not), if save_to_account
      if (saveToAccount && product?.id && line.currentPrice > 0) {
        favoritesMap.set(product.id, { user_id: userId, product_id: product.id });
        watchesMap.set(product.id, {
          user_id: userId,
          product_id: product.id,
          user_price_excl_vat: line.currentPrice,
        });
      }

      allResults[line.index] = {
        ean: line.ean ?? undefined,
        cnk: line.cnk ?? undefined,
        sku: line.sku ?? undefined,
        quantity: line.quantity,
        currentPrice: line.currentPrice,
        productId: product?.id,
        productName: product?.name,
        productImage: product?.image_url,
        productSku: product?.sku,
        mediPrice,
        offerId: offer?.id,
        matchedBy,
        status,
        saving: mediPrice != null && line.currentPrice > mediPrice
          ? Math.max(0, line.currentPrice - mediPrice) : 0,
      };
    }

    processed = Math.min(rows.length, start + chunk.length);
    await updateJob(jobId, {
      processed_rows: processed,
      found_count: foundCount,
      unavailable_count: unavailableCount,
    });
  }

  // Bulk upsert favorites + watches at the end
  if (favoritesMap.size > 0) {
    const favRows = Array.from(favoritesMap.values());
    const { error: favErr } = await sb.from("favorites")
      .upsert(favRows, { onConflict: "user_id,product_id", ignoreDuplicates: true });
    if (favErr) console.error("[favorites] upsert failed", favErr);
  }
  if (watchesMap.size > 0) {
    const watchRows = Array.from(watchesMap.values());
    const { error: wErr } = await sb.from("user_price_watches")
      .upsert(watchRows, { onConflict: "user_id,product_id" });
    if (wErr) console.error("[watches] upsert failed", wErr);
  }

  await sb.from("import_job_payload").update({
    results: allResults,
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);

  await updateJob(jobId, {
    status: "completed",
    processed_rows: rows.length,
    found_count: foundCount,
    unavailable_count: unavailableCount,
    finished_at: new Date().toISOString(),
    result_summary: {
      total: rows.length,
      found: foundCount,
      unavailable: unavailableCount,
      favorites_added: favoritesMap.size,
      watches_added: watchesMap.size,
    },
  });
}

// ------- Product submission processor -------
async function processProductSubmission(
  jobId: string,
  userId: string,
  vendorId: string | null,
  rows: SubmissionLine[],
) {
  const sb = admin();
  const errors: any[] = [];
  let created = 0;
  let rejected = 0;
  let processed = 0;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const { data: jobCheck } = await sb
      .from("import_jobs").select("status").eq("id", jobId).single();
    if (jobCheck?.status === "cancelled") {
      await updateJob(jobId, { finished_at: new Date().toISOString() });
      return;
    }

    const chunk = rows.slice(start, start + BATCH_SIZE);
    const valid: SubmissionLine[] = [];
    for (const r of chunk) {
      if (r.errors && r.errors.length > 0) {
        rejected++;
        errors.push({ index: r.index, errors: r.errors, data: r.data });
      } else {
        valid.push(r);
      }
    }

    if (valid.length) {
      const inserts = valid.map((r) => ({
        vendor_id: vendorId,
        status: "pending" as const,
        proposed_payload: { ...r.data, _source: "xlsx_import", _submitted_by: userId },
      }));
      const { error: insErr, data: insData } = await sb
        .from("product_submissions").insert(inserts).select("id");
      if (insErr) {
        for (const r of valid) {
          rejected++;
          errors.push({ index: r.index, errors: [insErr.message], data: r.data });
        }
      } else {
        created += insData?.length ?? valid.length;
      }
    }

    processed = Math.min(rows.length, start + chunk.length);
    await updateJob(jobId, {
      processed_rows: processed,
      created_count: created,
      rejected_count: rejected,
    });
  }

  await sb.from("import_job_payload").update({
    errors,
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);

  await updateJob(jobId, {
    status: "completed",
    processed_rows: rows.length,
    created_count: created,
    rejected_count: rejected,
    finished_at: new Date().toISOString(),
    result_summary: { total: rows.length, created, rejected },
  });
}

async function runJob(jobId: string) {
  const sb = admin();
  try {
    const { data: job, error: jobErr } = await sb.from("import_jobs")
      .select("*").eq("id", jobId).single();
    if (jobErr || !job) throw new Error(`Job introuvable: ${jobErr?.message}`);
    if (job.status !== "pending") return;

    await updateJob(jobId, {
      status: "processing",
      started_at: new Date().toISOString(),
    });

    const { data: payload, error: payErr } = await sb.from("import_job_payload")
      .select("rows").eq("job_id", jobId).single();
    if (payErr || !payload) throw new Error(`Payload introuvable: ${payErr?.message}`);

    const rows = (payload.rows || []) as any[];
    if (job.job_type === "buyer_comparator") {
      const saveToAccount = !!job.metadata?.save_to_account;
      await processBuyerComparator(jobId, job.user_id, saveToAccount, rows as BuyerLine[]);
    } else if (job.job_type === "product_submission") {
      const vendorId = (job.metadata?.vendor_id as string | null) ?? null;
      await processProductSubmission(jobId, job.user_id, vendorId, rows as SubmissionLine[]);
    } else {
      throw new Error(`Type de job non supporté: ${job.job_type}`);
    }
  } catch (e: any) {
    console.error("[process-import-job] error", e);
    await failJob(jobId, e?.message || String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { jobId } = await req.json();
    if (!jobId || typeof jobId !== "string") {
      return new Response(JSON.stringify({ error: "jobId requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = admin();
    const { data: job } = await sb.from("import_jobs")
      .select("user_id, status").eq("id", jobId).single();
    if (!job || job.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Job introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (job.status !== "pending") {
      return new Response(JSON.stringify({ error: `Job déjà ${job.status}` }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-ignore EdgeRuntime is provided by Supabase Functions runtime
    EdgeRuntime.waitUntil(runJob(jobId));

    return new Response(JSON.stringify({ ok: true, jobId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[process-import-job] handler error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
