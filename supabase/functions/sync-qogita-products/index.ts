// Sync Qogita Products — streaming chunked mode
//
// Architecture mémoire-safe (Edge Function limit ~150MB RAM, 150s CPU):
// 1. START: stream HTTP download → upload Storage par chunks (pas de blob.text() global)
//           compte les newlines au passage, persiste { csv_path, total_lines, file_size }
// 2. CHUNK: lit une RANGE de ~12MB depuis Storage (HTTP Range), parse les lignes complètes,
//           garde le résidu partiel pour le chunk suivant. Persiste byte_offset + line_residue.
// 3. FINALIZE: upsert brands/cats, link, cleanup cache, marque completed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Taille de la fenêtre lue depuis Storage par chunk (~12MB ≈ 5-6k lignes Qogita)
const CHUNK_BYTES = 12 * 1024 * 1024;
// Batch d'upsert Postgres
const UPSERT_BATCH = 200;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ───────────────────────── Helpers ─────────────────────────

async function getToken(sb: any) {
  const { data: rows } = await sb.from("qogita_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const r of (rows || [])) cfg[r.key] = r.value;
  if (!cfg.qogita_email || !cfg.qogita_password) throw new Error("Qogita credentials missing");
  const base = cfg.base_url || "https://api.qogita.com";
  const r = await fetch(`${base}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cfg.qogita_email, password: cfg.qogita_password }),
  });
  if (!r.ok) throw new Error(`Auth failed (${r.status})`);
  const { accessToken } = await r.json();
  if (!accessToken) throw new Error("No accessToken");
  await sb.from("qogita_config").upsert(
    { key: "bearer_token", value: accessToken, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return { token: accessToken, baseUrl: base };
}

function sl(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function dedupeSlug(base: string, seen: Set<string>): string {
  if (!seen.has(base)) return base;
  let i = 2;
  while (seen.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
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

function scheduleNext(body: object) {
  fetch(`${SUPABASE_URL}/functions/v1/sync-qogita-products`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch((e) => console.error("scheduleNext failed:", e.message));
}

// Récupère l'URL signée du fichier dans le bucket privé (pour faire des requêtes Range HTTP)
async function getSignedReadUrl(sb: any, path: string): Promise<string> {
  const { data, error } = await sb.storage.from("sync-cache").createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}

// ───────────────────────── Entry point ─────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }

  const action = body?.action || "start";
  const country = body?.country || "BE";

  try {
    if (action === "start") return await handleStart(sb, country);
    if (action === "chunk") return await handleChunk(sb, body.logId);
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(`[${action}] error:`, e.message);
    if (body?.logId) {
      await sb.from("sync_logs").update({
        status: "error", completed_at: new Date().toISOString(),
        error_message: e.message, progress_message: `Erreur: ${e.message}`,
      }).eq("id", body.logId);
    }
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ───────────────────────── Step 1: START (streaming download → Storage) ─────────────────────────

async function handleStart(sb: any, country: string): Promise<Response> {
  const { data: ctryRow } = await sb.from("countries").select("code, default_vat_rate")
    .eq("code", country).eq("is_active", true).eq("qogita_sync_enabled", true).single();
  if (!ctryRow) {
    return new Response(JSON.stringify({ error: `Country ${country} not enabled` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await sb.from("sync_logs").update({
    status: "error", completed_at: new Date().toISOString(),
    error_message: "Superseded by newer sync",
    progress_message: `Arrêtée car nouvelle sync ${country} lancée`,
  }).eq("sync_type", "products").eq("status", "running");

  const { data: log } = await sb.from("sync_logs").insert({
    sync_type: "products", status: "running",
    stats: { country, vat: ctryRow.default_vat_rate || 21 },
    progress_current: 0, progress_total: 0,
    progress_message: `${country}: téléchargement CSV en streaming...`,
  }).select().single();
  const logId = log!.id;

  (globalThis as any).EdgeRuntime.waitUntil(
    streamDownloadToStorage(sb, country, ctryRow.default_vat_rate || 21, logId).catch(async (e: any) => {
      console.error("Stream download error:", e);
      await sb.from("sync_logs").update({
        status: "error", completed_at: new Date().toISOString(),
        error_message: e.message, progress_message: `Erreur téléchargement: ${e.message}`,
      }).eq("id", logId);
    })
  );

  return new Response(JSON.stringify({
    success: true, sync_log_id: logId, country,
    message: `Sync ${country} lancée (streaming chunked).`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Stream HTTP → S3 multipart upload vers Supabase Storage (zero-buffer global)
//
// Stratégie : on lit le body Qogita par chunks ; on accumule un buffer de ~6 MB,
// puis on uploade chaque part via le protocole S3 multipart (PUT signed URL).
// Le pic mémoire reste ~6-7 MB (taille d'une part S3) au lieu de 105 MB.
//
// Supabase Storage expose une API S3 multipart compatible :
//   POST   {endpoint}/{bucket}/{key}?uploads          → CreateMultipartUpload (XML)
//   PUT    {endpoint}/{bucket}/{key}?partNumber=N&uploadId=ID  → UploadPart (renvoie ETag)
//   POST   {endpoint}/{bucket}/{key}?uploadId=ID      → CompleteMultipartUpload (XML body)
//
// Auth : on utilise un AWS SigV4 minimal avec les credentials S3 dérivés
// (Supabase accepte aussi un Bearer SERVICE_ROLE_KEY sur le namespace `/storage/v1/s3/`).
const S3_PART_SIZE = 6 * 1024 * 1024; // 6 MB (min S3 = 5 MB sauf dernière part)
const S3_ENDPOINT = `${SUPABASE_URL}/storage/v1/s3`;

function xmlExtract(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return m ? m[1] : null;
}

async function s3InitiateMultipart(bucket: string, key: string): Promise<string> {
  const url = `${S3_ENDPOINT}/${bucket}/${encodeURIComponent(key)}?uploads`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      "Content-Type": "text/csv",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`S3 initiate failed (${res.status}): ${t.slice(0, 300)}`);
  }
  const xml = await res.text();
  const uploadId = xmlExtract(xml, "UploadId");
  if (!uploadId) throw new Error(`S3 initiate: no UploadId in response: ${xml.slice(0, 300)}`);
  return uploadId;
}

async function s3UploadPart(
  bucket: string, key: string, uploadId: string,
  partNumber: number, body: Uint8Array,
): Promise<string> {
  const url = `${S3_ENDPOINT}/${bucket}/${encodeURIComponent(key)}?partNumber=${partNumber}&uploadId=${uploadId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      "Content-Length": String(body.length),
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`S3 part ${partNumber} failed (${res.status}): ${t.slice(0, 300)}`);
  }
  const etag = res.headers.get("ETag") || res.headers.get("etag");
  if (!etag) throw new Error(`S3 part ${partNumber}: no ETag`);
  return etag.replaceAll('"', "");
}

async function s3CompleteMultipart(
  bucket: string, key: string, uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<void> {
  const partsXml = parts
    .map(p => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag}"</ETag></Part>`)
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
  const url = `${S3_ENDPOINT}/${bucket}/${encodeURIComponent(key)}?uploadId=${uploadId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      "Content-Type": "application/xml",
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`S3 complete failed (${res.status}): ${t.slice(0, 300)}`);
  }
}

async function s3AbortMultipart(bucket: string, key: string, uploadId: string): Promise<void> {
  const url = `${S3_ENDPOINT}/${bucket}/${encodeURIComponent(key)}?uploadId=${uploadId}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    },
  }).catch(() => {});
}

// Stream HTTP Qogita → S3 multipart upload (peak RAM ≤ 1 part = 6 MB)
async function streamDownloadToStorage(sb: any, country: string, vat: number, logId: string) {
  const { token, baseUrl } = await getToken(sb);

  await sb.from("sync_logs").update({
    progress_message: `${country}: téléchargement Qogita (S3 multipart streaming)...`,
  }).eq("id", logId);

  const res = await fetch(`${baseUrl}/variants/search/download/?country=${country}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`CSV download ${country}: ${res.status} ${errBody.slice(0, 300)}`);
  }

  const csvPath = `qogita-products-${country}-${Date.now()}.csv`;
  const uploadId = await s3InitiateMultipart("sync-cache", csvPath);

  const reader = res.body.getReader();
  let buffer = new Uint8Array(S3_PART_SIZE);
  let bufferLen = 0;
  let partNumber = 1;
  let totalBytes = 0;
  let newlineCount = 0;
  const parts: Array<{ partNumber: number; etag: string }> = [];

  const flushPart = async (final: boolean) => {
    if (bufferLen === 0 && !final) return;
    if (bufferLen === 0 && final && partNumber === 1) {
      // Empty file edge case — push 1 empty part
      const etag = await s3UploadPart("sync-cache", csvPath, uploadId, 1, new Uint8Array(0));
      parts.push({ partNumber: 1, etag });
      return;
    }
    if (bufferLen === 0) return;
    const slice = buffer.subarray(0, bufferLen);
    const etag = await s3UploadPart("sync-cache", csvPath, uploadId, partNumber, slice);
    parts.push({ partNumber, etag });
    partNumber++;
    bufferLen = 0;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      // Compte newlines à la volée (0x0A)
      for (let i = 0; i < value.length; i++) {
        if (value[i] === 0x0A) newlineCount++;
      }

      // Append to buffer, flush per S3_PART_SIZE
      let srcPos = 0;
      while (srcPos < value.length) {
        const space = S3_PART_SIZE - bufferLen;
        const take = Math.min(space, value.length - srcPos);
        buffer.set(value.subarray(srcPos, srcPos + take), bufferLen);
        bufferLen += take;
        srcPos += take;
        if (bufferLen === S3_PART_SIZE) {
          await flushPart(false);
        }
      }
    }
    // Flush dernier morceau (peut être < 5 MB, c'est autorisé pour la dernière part)
    await flushPart(true);
    await s3CompleteMultipart("sync-cache", csvPath, uploadId, parts);
  } catch (e) {
    await s3AbortMultipart("sync-cache", csvPath, uploadId);
    throw e;
  }

  // Libère le buffer
  buffer = new Uint8Array(0);

  const totalLines = Math.max(0, newlineCount - 1); // -1 pour header

  await sb.from("sync_logs").update({
    progress_total: totalLines,
    progress_message: `${country}: ${totalLines.toLocaleString()} produits à traiter (${(totalBytes / 1024 / 1024).toFixed(1)} MB uploadés en ${parts.length} parts)...`,
    chunk_state: {
      csv_path: csvPath,
      country,
      vat,
      file_size: totalBytes,
      byte_offset: 0,
      line_residue: "",
      header_parsed: false,
      header_line: null,
      total_lines: totalLines,
      processed: 0,
      brands_seen: [],
      categories_seen: [],
    },
  }).eq("id", logId);

  scheduleNext({ action: "chunk", logId });
}

// ───────────────────────── Step 2: CHUNK (HTTP Range read from Storage) ─────────────────────────

async function handleChunk(sb: any, logId: string): Promise<Response> {
  if (!logId) throw new Error("logId required for chunk action");

  const { data: log } = await sb.from("sync_logs").select("*").eq("id", logId).single();
  if (!log) throw new Error(`Log ${logId} not found`);
  if (log.status !== "running") {
    return new Response(JSON.stringify({ skipped: true, reason: log.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const state = log.chunk_state;
  if (!state) throw new Error("Missing chunk_state");

  (globalThis as any).EdgeRuntime.waitUntil(
    processChunkStreaming(sb, logId, state).catch(async (e: any) => {
      console.error("Chunk error:", e);
      await sb.from("sync_logs").update({
        status: "error", completed_at: new Date().toISOString(),
        error_message: e.message, progress_message: `Erreur chunk: ${e.message}`,
      }).eq("id", logId);
    })
  );

  return new Response(JSON.stringify({ success: true, byte_offset: state.byte_offset }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function processChunkStreaming(sb: any, logId: string, state: any) {
  const {
    csv_path, country, vat, file_size, byte_offset,
    line_residue, header_parsed, header_line, total_lines,
  } = state;

  const brandNames = new Set<string>(state.brands_seen || []);
  const catNames = new Set<string>(state.categories_seen || []);
  const seenSlugs = new Set<string>();

  // ── Read byte range from Storage via signed URL + Range header ──
  const signedUrl = await getSignedReadUrl(sb, csv_path);
  const rangeEnd = Math.min(byte_offset + CHUNK_BYTES - 1, file_size - 1);
  const isLastRange = rangeEnd >= file_size - 1;

  const rangeRes = await fetch(signedUrl, {
    headers: { Range: `bytes=${byte_offset}-${rangeEnd}` },
  });
  if (!rangeRes.ok && rangeRes.status !== 206) {
    throw new Error(`Range read failed: ${rangeRes.status}`);
  }
  const chunkBuf = new Uint8Array(await rangeRes.arrayBuffer());
  const chunkText = new TextDecoder("utf-8").decode(chunkBuf);

  // Concat avec le résidu de ligne incomplet du chunk précédent
  const fullText = line_residue + chunkText;

  // Sépare les lignes complètes du dernier résidu (sauf si c'est la fin du fichier)
  const lastNl = fullText.lastIndexOf("\n");
  let completeText: string;
  let newResidue: string;
  if (isLastRange) {
    completeText = fullText;
    newResidue = "";
  } else if (lastNl === -1) {
    // Aucun newline dans ce chunk — anormal (CHUNK_BYTES doit toujours capturer plusieurs lignes)
    completeText = "";
    newResidue = fullText;
  } else {
    completeText = fullText.slice(0, lastNl);
    newResidue = fullText.slice(lastNl + 1);
  }

  let allLines = completeText.split("\n").filter(l => l.length > 0);

  // Premier chunk : extraire le header
  let currentHeaderLine = header_line;
  let currentHeaderParsed = header_parsed;
  if (!currentHeaderParsed) {
    if (allLines.length === 0) throw new Error("First chunk has no complete line for header");
    currentHeaderLine = allLines[0];
    allLines = allLines.slice(1);
    currentHeaderParsed = true;
  }

  const headers = parseCSVLine(currentHeaderLine);
  const colMap = {
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

  const qogitaVendorId = await ensureQogitaVendor(sb);

  let processed = 0;
  for (let i = 0; i < allLines.length; i += UPSERT_BATCH) {
    const batch = allLines.slice(i, i + UPSERT_BATCH);
    processed += await processBatch(
      sb, batch, colMap, vat, country, brandNames, catNames, qogitaVendorId, seenSlugs,
    );
  }

  const newOffset = byte_offset + chunkBuf.length;
  const totalProcessed = (state.processed || 0) + processed;
  const eof = isLastRange;

  await sb.from("sync_logs").update({
    progress_current: totalProcessed,
    progress_total: total_lines,
    progress_message: eof
      ? `${country}: ${totalProcessed.toLocaleString()} traités, finalisation...`
      : `${country}: ${totalProcessed.toLocaleString()} / ${total_lines.toLocaleString()} produits (${((newOffset / file_size) * 100).toFixed(1)}%)...`,
    chunk_state: {
      csv_path, country, vat, file_size,
      byte_offset: newOffset,
      line_residue: newResidue,
      header_parsed: currentHeaderParsed,
      header_line: currentHeaderLine,
      total_lines,
      processed: totalProcessed,
      brands_seen: Array.from(brandNames),
      categories_seen: Array.from(catNames),
    },
  }).eq("id", logId);

  if (eof) {
    await finalize(sb, logId, country, csv_path, brandNames, catNames, totalProcessed);
  } else {
    scheduleNext({ action: "chunk", logId });
  }
}

// ───────────────────────── Step 3: FINALIZE ─────────────────────────

async function finalize(
  sb: any, logId: string, country: string, csvPath: string,
  brandNames: Set<string>, catNames: Set<string>, totalProcessed: number,
) {
  await sb.from("sync_logs").update({
    progress_message: `${country}: ${brandNames.size} marques à upserter...`,
  }).eq("id", logId);

  const bd = Array.from(brandNames).map(n => ({
    name: n, slug: sl(n), is_active: true, synced_at: new Date().toISOString(),
  }));
  for (let i = 0; i < bd.length; i += 500) {
    await sb.from("brands").upsert(bd.slice(i, i + 500), { onConflict: "slug", ignoreDuplicates: true });
  }

  const cd = Array.from(catNames).map(n => ({
    name: n, slug: sl(n), is_active: true, synced_at: new Date().toISOString(),
  }));
  for (let i = 0; i < cd.length; i += 500) {
    await sb.from("categories").upsert(cd.slice(i, i + 500), { onConflict: "slug", ignoreDuplicates: true });
  }

  await linkBrandsAndCategories(sb, country, logId);

  await sb.from("sync_logs").update({
    progress_message: `${country}: mise à jour compteurs...`,
  }).eq("id", logId);
  await sb.rpc("update_brand_product_counts");

  await sb.from("countries").update({ last_sync_at: new Date().toISOString() } as any).eq("code", country);

  await sb.storage.from("sync-cache").remove([csvPath]).catch((e: any) => console.error("Cleanup failed:", e));

  await sb.from("sync_logs").update({
    status: "completed", completed_at: new Date().toISOString(),
    progress_current: totalProcessed, progress_total: totalProcessed,
    stats: { country, products: totalProcessed, brands: brandNames.size, categories: catNames.size },
    progress_message: `${country}: ${totalProcessed} produits, ${brandNames.size} marques, ${catNames.size} catégories ✓`,
  }).eq("id", logId);

  await sb.from("qogita_config").update({
    last_full_sync_at: new Date().toISOString(), sync_status: "completed",
  }).eq("id", 1);

  console.log(`[finalize] ${country} done: ${totalProcessed} products`);
}

// ───────────────────────── processBatch (inchangé) ─────────────────────────

async function processBatch(
  sb: any, lines: string[], colMap: Record<string, number>,
  vat: number, country: string,
  brandNames: Set<string>, catNames: Set<string>,
  qogitaVendorId: string,
  seenSlugs: Set<string>,
): Promise<number> {
  const parsedRows: any[] = [];
  const products: any[] = [];
  const csvData: any[] = [];
  const seenBatchGtins = new Set<string>();
  const seenBatchQids = new Set<string>();

  for (const line of lines) {
    const cols = parseCSVLine(line);
    const gtin = (cols[colMap.gtin] || "").trim();
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

    if (seenBatchQids.has(stableId)) continue;
    if (gtin && seenBatchGtins.has(gtin)) continue;
    seenBatchQids.add(stableId);
    if (gtin) seenBatchGtins.add(gtin);

    if (brand) brandNames.add(brand);
    if (category) catNames.add(category);

    const bp = parseFloat(priceStr) || 0;
    const stock = parseInt(inventoryStr, 10) || 0;
    const delivery = parseInt(deliveryStr, 10) || 0;
    const pe = bp > 0 ? Math.round((bp / (1 + vat / 100)) * 100) / 100 : 0;
    const isPreorder = preorderStr.toLowerCase() === "true" || preorderStr === "1";

    parsedRows.push({
      qid: stableId, gtin: gtin || null, name,
      brand: brand || null, category: category || null,
      imageUrl, pe, pi: bp, stock, delivery, isPreorder,
    });
  }

  if (parsedRows.length === 0) return 0;

  const qids = parsedRows.map((row) => row.qid);
  const gtins = parsedRows.map((row) => row.gtin).filter(Boolean);

  const [existingByQidRes, existingByGtinRes] = await Promise.all([
    qids.length > 0
      ? sb.from("products").select("id, qogita_qid, gtin, slug").in("qogita_qid", qids)
      : Promise.resolve({ data: [], error: null }),
    gtins.length > 0
      ? sb.from("products").select("id, qogita_qid, gtin, slug").in("gtin", gtins)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (existingByQidRes.error) throw existingByQidRes.error;
  if (existingByGtinRes.error) throw existingByGtinRes.error;

  const existingByQid = new Map((existingByQidRes.data || []).map((row: any) => [row.qogita_qid, row]));
  const existingByGtin = new Map((existingByGtinRes.data || []).map((row: any) => [row.gtin, row]));

  for (const row of parsedRows) {
    const existingQidRow = existingByQid.get(row.qid);
    const existingGtinRow = row.gtin ? existingByGtin.get(row.gtin) : null;

    if (existingQidRow && existingGtinRow && existingQidRow.id !== existingGtinRow.id) {
      console.warn(`Skipping conflicting product mapping for gtin ${row.gtin} / qid ${row.qid}`);
      continue;
    }

    const existingRow = existingQidRow || existingGtinRow;
    const baseSlug = sl(row.name) + (row.gtin ? `-${row.gtin.slice(-6)}` : `-${row.qid.slice(0, 6)}`);
    const slug = existingRow?.slug || dedupeSlug(baseSlug, seenSlugs);
    seenSlugs.add(slug);

    products.push({
      ...(existingRow ? { id: existingRow.id } : {}),
      qogita_qid: row.qid, gtin: row.gtin, name: row.name, slug,
      brand_name: row.brand, category_name: row.category,
      image_urls: row.imageUrl ? [row.imageUrl] : [],
      source: "qogita", is_active: true, is_published: true,
      synced_at: new Date().toISOString(),
      total_stock: row.stock, is_in_stock: row.stock > 0,
      min_delivery_days: row.delivery > 0 ? row.delivery : null,
      ...(row.pe > 0 ? { best_price_excl_vat: row.pe, best_price_incl_vat: row.pi } : {}),
    });

    csvData.push({ qid: row.qid, pe: row.pe, pi: row.pi, stock: row.stock, delivery: row.delivery, isPreorder: row.isPreorder });
  }

  if (products.length === 0) return 0;

  const existingProducts = products.filter((p) => p.id != null);
  const newProducts = products
    .filter((p) => p.id == null)
    .map((p) => { const { id, ...rest } = p; return rest; });

  if (existingProducts.length > 0) {
    const { error } = await sb.from("products").upsert(existingProducts, { onConflict: "id", ignoreDuplicates: false });
    if (error) throw new Error(`Products upsert failed (existing): ${error.message}`);
  }
  if (newProducts.length > 0) {
    const { error } = await sb.from("products").upsert(newProducts, { onConflict: "qogita_qid", ignoreDuplicates: false });
    if (error) throw new Error(`Products upsert failed (new): ${error.message}`);
  }

  const { data: prods } = await sb.from("products").select("id, qogita_qid").in("qogita_qid", qids);
  const m = new Map((prods || []).map((p: any) => [p.qogita_qid, p.id]));

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

  const offers = csvData
    .filter((s: any) => m.has(s.qid) && s.pe > 0)
    .map((s: any) => ({
      product_id: m.get(s.qid)!, vendor_id: qogitaVendorId, country_code: country,
      qogita_base_price: s.pe, price_excl_vat: s.pe,
      price_incl_vat: s.pi > 0 ? s.pi : Math.round(s.pe * (1 + vat / 100) * 100) / 100,
      vat_rate: vat, stock_quantity: s.stock,
      stock_status: s.stock > 0 ? "in_stock" : (s.isPreorder ? "pre_order" : "out_of_stock"),
      delivery_days: s.delivery > 0 ? s.delivery : 3,
      shipping_from_country: country, is_qogita_backed: true, is_active: true, moq: 1,
      synced_at: new Date().toISOString(),
    }));
  if (offers.length > 0) {
    const { error } = await sb.from("offers").upsert(offers, {
      onConflict: "product_id,vendor_id,country_code", ignoreDuplicates: false,
    });
    if (error) throw new Error(`Offer upsert failed: ${error.message}`);
  }

  return products.length;
}

async function linkBrandsAndCategories(sb: any, country: string, logId: string) {
  await sb.from("sync_logs").update({
    progress_message: `${country}: liaison marques/catégories...`,
  }).eq("id", logId);

  const { data: ab } = await sb.from("brands").select("id, name").limit(10000);
  const bm = new Map((ab || []).map((b: any) => [b.name, b.id]));
  const { data: ac } = await sb.from("categories").select("id, name").limit(10000);
  const cm = new Map((ac || []).map((c: any) => [c.name, c.id]));

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
    if (byB.size === 0) break;
    for (const [bid, pids] of byB) {
      for (let k = 0; k < pids.length; k += 100)
        await sb.from("products").update({ brand_id: bid }).in("id", pids.slice(k, k + 100));
    }
    linked += nb.length;
    if (linked > 100000) break;
  }

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
