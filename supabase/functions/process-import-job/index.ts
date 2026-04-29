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

const updateJob = async (
  jobId: string,
  patch: Record<string, any>,
) => {
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

// ------- Buyer comparator processor -------
async function processBuyerComparator(jobId: string, rows: BuyerLine[]) {
  const sb = admin();
  const allResults: any[] = new Array(rows.length);
  let processed = 0;
  let foundCount = 0;
  let unavailableCount = 0;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    // cancel check
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

    const [byEan, byCnk, bySku] = await Promise.all([
      eans.length
        ? sb.from("products").select("id, name, image_url, gtin, cnk_code, sku")
            .in("gtin", eans).eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
      cnks.length
        ? sb.from("products").select("id, name, image_url, gtin, cnk_code, sku")
            .in("cnk_code", cnks).eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
      skus.length
        ? sb.from("products").select("id, name, image_url, gtin, cnk_code, sku")
            .in("sku", skus).eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const mapEan = new Map<string, any>();
    const mapCnk = new Map<string, any>();
    const mapSku = new Map<string, any>();
    for (const p of [...(byEan.data || []), ...(byCnk.data || []), ...(bySku.data || [])]) {
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

    const productIds = [...new Set(
      chunk.map((l) => resolveMatch(l).product?.id).filter(Boolean),
    )] as string[];

    const offerByProduct = new Map<string, any>();
    if (productIds.length) {
      const { data: offers } = await sb.from("offers")
        .select("id, product_id, price_excl_vat, vendor_id")
        .in("product_id", productIds)
        .eq("is_active", true)
        .order("product_id", { ascending: true })
        .order("price_excl_vat", { ascending: true });
      for (const o of (offers || [])) {
        if (!offerByProduct.has(o.product_id)) offerByProduct.set(o.product_id, o);
      }
    }

    for (const line of chunk) {
      const { product, matchedBy } = resolveMatch(line);
      const offer = product ? offerByProduct.get(product.id) : undefined;
      const mediPrice = offer?.price_excl_vat != null ? Number(offer.price_excl_vat) : undefined;
      const status = product && offer ? "found" : "unavailable";
      if (status === "found") foundCount++; else unavailableCount++;
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

  // Save final results in payload
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
      await processBuyerComparator(jobId, rows as BuyerLine[]);
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

    // Ownership/auth check via JWT
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
