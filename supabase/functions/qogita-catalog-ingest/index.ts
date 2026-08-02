// ─────────────────────────────────────────────────────────────────────────────
// LOT 3bis — Worker d'ingestion du CSV Catalog Download (Qogita).
//
// Pourquoi une fonction dédiée : un export FULL (~450k lignes, >50 Mo) ne peut
// pas être téléchargé + parsé + upserté dans la fenêtre d'une requête webhook.
// Le webhook se contente donc d'enregistrer `download_url` puis délègue ici.
//
// Reprise : `qogita_catalog_downloads.ingest_cursor` = offset OCTETS déjà
// ingérés (requêtes HTTP Range sur l'URL présignée). Chaque invocation traite
// ~90 s puis se ré-invoque elle-même jusqu'à épuisement du flux.
//
// ⚠️ RÈGLE PRIX inchangée : `indicative_price` (prix plancher CSV) ne sert
// QUE au référentiel/couverture, jamais au calcul de marge.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";
import { normalizeCatalogRow } from "../_shared/qogita-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const CHUNK = 500;
const TIME_BUDGET_MS = 90_000;
const enc = new TextEncoder();

/** Découpe un buffer texte en enregistrements CSV complets (RFC4180) + reste. */
function splitRecords(buf: string): { records: string[][]; rest: string } {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let lastComplete = 0;

  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (inQuotes) {
      if (c === '"') {
        if (buf[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { record.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      lastComplete = i + 1;
      continue;
    }
    field += c;
  }
  return { records, rest: buf.slice(lastComplete) };
}

function toObjects(records: string[][], columns: string[]): Record<string, string>[] {
  return records
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      columns.forEach((col, idx) => { o[col] = (r[idx] ?? "").trim(); });
      return o;
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) return json({ error: guard.error }, guard.status);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const downloadId: string | null = body.downloadId ?? body.download_id ?? null;
  if (!downloadId) return json({ error: "downloadId_required" }, 400);

  const { data: dl } = await sb
    .from("qogita_catalog_downloads")
    .select("id, scope, status, download_url, ingest_cursor, ingest_rows, ingest_state, catalog_request_id")
    .eq("id", downloadId)
    .maybeSingle();
  if (!dl) return json({ error: "download_not_found" }, 404);
  if (!dl.download_url) return json({ error: "missing_download_url" }, 400);

  const startedAt = Date.now();
  let cursor: number = Number(dl.ingest_cursor ?? 0);
  let rowsSeen: number = Number(dl.ingest_rows ?? 0);
  const state = (dl.ingest_state ?? {}) as Record<string, unknown>;
  let columns: string[] = Array.isArray(state.columns) ? state.columns as string[] : [];

  await sb.from("qogita_catalog_downloads")
    .update({ status: "ingesting" }).eq("id", downloadId);

  let res: Response;
  try {
    res = await fetch(dl.download_url, {
      headers: cursor > 0 ? { Range: `bytes=${cursor}-` } : {},
    });
  } catch (e) {
    await sb.from("qogita_catalog_downloads").update({
      status: "download_error", error_message: `fetch: ${(e as Error).message}`,
    }).eq("id", downloadId);
    return json({ error: "fetch_failed", detail: (e as Error).message }, 502);
  }

  if (!res.ok || !res.body) {
    const detail = `HTTP ${res.status}`;
    await sb.from("qogita_catalog_downloads").update({
      status: "download_error", error_message: `download_url: ${detail}`,
    }).eq("id", downloadId);
    return json({ error: "download_failed", detail, expired_url: res.status === 403 }, 502);
  }

  const totalBytes = Number(res.headers.get("content-length") ?? 0) + cursor;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bytesRead = 0;
  let upserted = 0;
  let skipped = 0;
  let done = false;
  let pending: Record<string, string>[] = [];
  let lastError: string | null = null;

  async function flush(force = false) {
    while (pending.length >= CHUNK || (force && pending.length > 0)) {
      const slice = pending.slice(0, CHUNK);
      pending = pending.slice(CHUNK);
      const items = slice.map(normalizeCatalogRow).filter(Boolean) as NonNullable<
        ReturnType<typeof normalizeCatalogRow>
      >[];
      skipped += slice.length - items.length;
      if (items.length === 0) continue;

      const gtins = items.map((it) => it.gtin);
      const { data: prods } = await sb.from("products").select("id, gtin").in("gtin", gtins);
      const byGtin = new Map<string, string>(
        (prods || []).map((p: { id: string; gtin: string }) => [p.gtin, p.id]),
      );
      const nowIso = new Date().toISOString();

      const payload = items.map((it) => ({
        gtin: it.gtin,
        qogita_fid: it.qogita_fid,
        name: it.name,
        brand_name: it.brand_name,
        category_slug: it.category_slug,
        category_name: it.category_name,
        indicative_price: it.indicative_price,
        indicative_price_currency: it.indicative_price_currency,
        indicative_price_includes_shipping: true,
        inventory: it.inventory,
        supplier_alias: it.supplier_alias,
        supplier_url: it.supplier_url,
        unit_size: it.unit_size,
        raw: it.raw,
        product_id: byGtin.get(it.gtin) ?? null,
        is_present_in_catalog: true,
        last_seen_at: nowIso,
        disappeared_at: null,
        last_download_id: downloadId,
      }));

      const { error } = await sb.from("qogita_catalog_items")
        .upsert(payload, { onConflict: "gtin" });
      if (error) {
        lastError = error.message;
        console.error("[catalog-ingest] upsert error", error.message);
      } else {
        upserted += payload.length;
      }
    }
  }

  try {
    while (true) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const { value, done: streamDone } = await reader.read();
      if (streamDone) { done = true; break; }
      bytesRead += value!.byteLength;
      buffer += decoder.decode(value!, { stream: true });

      const { records, rest } = splitRecords(buffer);
      buffer = rest;

      let rows = records;
      if (columns.length === 0 && rows.length > 0) {
        columns = rows[0].map((c) => c.trim());
        rows = rows.slice(1);
      }
      const objs = toObjects(rows, columns);
      rowsSeen += objs.length;
      pending.push(...objs);
      await flush();
    }

    if (done) {
      // Dernier enregistrement éventuellement sans newline final.
      buffer += decoder.decode();
      if (buffer.trim() !== "") {
        const { records } = splitRecords(buffer + "\n");
        let rows = records;
        if (columns.length === 0 && rows.length > 0) {
          columns = rows[0].map((c) => c.trim());
          rows = rows.slice(1);
        }
        const objs = toObjects(rows, columns);
        rowsSeen += objs.length;
        pending.push(...objs);
        buffer = "";
      }
    }
    await flush(true);
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
  }

  // Offset exact = octets lus − octets du reste non consommé.
  const consumed = bytesRead - enc.encode(buffer).byteLength;
  cursor += Math.max(0, consumed);

  const patch: Record<string, unknown> = {
    ingest_cursor: done ? cursor : cursor,
    ingest_rows: rowsSeen,
    ingest_state: { ...state, columns, total_bytes: totalBytes || null },
    csv_columns: columns,
    rows_total: rowsSeen,
    rows_updated: (Number(dl.ingest_state && (dl.ingest_state as any).upserted) || 0) + upserted,
    error_message: lastError,
  };

  if (done) {
    patch.status = rowsSeen === 0 ? "completed_empty" : "completed";
    patch.completed_at = new Date().toISOString();
  } else {
    patch.status = "ingesting";
  }
  await sb.from("qogita_catalog_downloads").update(patch).eq("id", downloadId);

  // Poursuite : ré-invocation asynchrone tant que le flux n'est pas épuisé.
  if (!done) {
    fetch(`${supabaseUrl}/functions/v1/qogita-catalog-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ downloadId }),
    }).catch((e) => console.error("[catalog-ingest] self-invoke", (e as Error).message));
  } else {
    await sb.from("sync_logs").insert({
      sync_type: "qogita_catalog_download",
      status: lastError ? "error" : "success",
      records_processed: rowsSeen,
      error_message: lastError,
      metadata: {
        catalog_request_id: dl.catalog_request_id, scope: dl.scope,
        rows: rowsSeen, upserted_this_pass: upserted, skipped_no_gtin: skipped,
        bytes: cursor, columns,
        note: "indicative_price = prix plancher CSV, jamais utilisé pour la marge",
      },
    });
  }

  return json({
    ok: true, download_id: downloadId, done,
    rows_seen: rowsSeen, upserted_this_pass: upserted, skipped_no_gtin: skipped,
    bytes_cursor: cursor, total_bytes: totalBytes || null,
    columns, duration_ms: Date.now() - startedAt, last_error: lastError,
  });
});
