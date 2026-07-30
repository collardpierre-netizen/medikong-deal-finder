// ─────────────────────────────────────────────────────────────────────────────
// LOT 3 — Receveur des événements webhook Catalog Download (Qogita).
//
// URL publique : /functions/v1/qogita-catalog-webhook (verify_jwt = false).
// Toute requête est rejetée si la signature HMAC n'est pas valide.
//
// catalog_download.completed → GET download_url, parse CSV, upsert idempotent
//                              dans qogita_catalog_items (référentiel/couverture).
// catalog_download.failed    → log + alerte admin + retry borné.
//
// ⚠️ RÈGLE PRIX : le "lowest price incl. shipping" du CSV est stocké en
// `indicative_price` UNIQUEMENT (référentiel). Il n'alimente JAMAIS
// offers.qogita_base_price ni aucun calcul de marge : le coût d'achat réel
// vient de l'endpoint offres (Lot 1).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  loadSigningSecret,
  verifyWebhookSignature,
  parseCsv,
  normalizeCatalogRow,
} from "../_shared/qogita-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

const MAX_RETRY = 2;
const CHUNK = 500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rawBody = await req.text();

  // ── 1. Signature obligatoire ──────────────────────────────────────────────
  let secret: string | null = null;
  try {
    secret = await loadSigningSecret(sb);
  } catch (e) {
    console.error("[qogita-webhook] secret unreadable", (e as Error).message);
    return json({ error: "signing_secret_unavailable" }, 500);
  }
  if (!secret) return json({ error: "webhook_not_registered" }, 500);

  const verdict = await verifyWebhookSignature(req, rawBody, secret);
  if (!verdict.ok) {
    console.error("[qogita-webhook] signature rejected:", verdict.reason);
    return json({ error: "invalid_signature", reason: verdict.reason }, 401);
  }

  // ── 2. Parse de l'événement ───────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "invalid_json" }, 400); }

  const eventType: string = event?.type ?? event?.eventType ?? "";
  const obj = event?.data?.object ?? event?.data ?? {};
  const requestId: string | null = obj.catalog_request_id ?? obj.catalogRequestId ?? null;

  console.log("[qogita-webhook] event", eventType, "request", requestId);

  // "Send a test event" : on accuse réception sans rien ingérer.
  if (!eventType || eventType.includes("test") || (!requestId && !obj.download_url)) {
    await sb.from("qogita_catalog_downloads").insert({
      status: "test_event", scope: "test", triggered_by: "webhook",
      filters: obj?.filters ?? {}, error_message: `test event: ${eventType || "unknown"}`,
    });
    return json({ received: true, mode: "test_event", event_type: eventType || null });
  }

  const { data: dl } = await sb
    .from("qogita_catalog_downloads")
    .select("id, scope, filters")
    .eq("catalog_request_id", requestId)
    .maybeSingle();

  // ── 3. failed ─────────────────────────────────────────────────────────────
  if (eventType.endsWith("failed")) {
    const patch = {
      status: "failed",
      failed_at: obj.failed_at ?? new Date().toISOString(),
      error_code: obj.error_code ?? null,
      error_message: obj.error_message ?? null,
      filters: obj.filters ?? dl?.filters ?? {},
    };
    if (dl) await sb.from("qogita_catalog_downloads").update(patch).eq("id", dl.id);
    else await sb.from("qogita_catalog_downloads").insert({ ...patch, catalog_request_id: requestId, triggered_by: "webhook" });

    await sb.from("sync_logs").insert({
      sync_type: "qogita_catalog_download",
      status: "error",
      error_message: `catalog_download.failed ${obj.error_code ?? ""} ${obj.error_message ?? ""}`.trim(),
      metadata: { catalog_request_id: requestId, filters: obj.filters ?? null },
    });
    return json({ received: true, status: "failed" });
  }

  // ── 4. completed → téléchargement + ingestion ─────────────────────────────
  const downloadUrl: string | null = obj.download_url ?? obj.downloadUrl ?? null;
  if (!downloadUrl) return json({ error: "missing_download_url" }, 400);

  const startedAt = Date.now();
  let csv = "";
  let lastErr = "";
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      csv = await res.text();
      lastErr = "";
      break;
    } catch (e) {
      lastErr = (e as Error).message;
      if (attempt < MAX_RETRY) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  if (lastErr) {
    if (dl) {
      await sb.from("qogita_catalog_downloads").update({
        status: "download_error", error_message: `download_url: ${lastErr}`,
      }).eq("id", dl.id);
    }
    return json({ error: "download_failed", detail: lastErr }, 502);
  }

  const { columns, rows } = parseCsv(csv);
  const items = rows.map(normalizeCatalogRow).filter(Boolean) as NonNullable<ReturnType<typeof normalizeCatalogRow>>[];

  // Enregistrement (ou création si le trigger n'a pas été tracé côté MediKong)
  let downloadId = dl?.id as string | undefined;
  const scope = dl?.scope ?? (obj.filters && Object.keys(obj.filters).length ? "filtered" : "full");
  if (!downloadId) {
    const { data: created } = await sb.from("qogita_catalog_downloads").insert({
      catalog_request_id: requestId, scope, triggered_by: "webhook",
      filters: obj.filters ?? {},
    }).select("id").maybeSingle();
    downloadId = created?.id;
  }

  const seenGtins: string[] = [];
  let upserted = 0;
  const nowIso = new Date().toISOString();

  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    // Résolution produit existante par GTIN (facultative, best effort).
    const gtins = slice.map((it) => it.gtin);
    const { data: prods } = await sb.from("products").select("id, gtin").in("gtin", gtins);
    const byGtin = new Map<string, string>((prods || []).map((p: { id: string; gtin: string }) => [p.gtin, p.id]));

    const payload = slice.map((it) => ({
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
      last_download_id: downloadId ?? null,
    }));

    const { error } = await sb.from("qogita_catalog_items").upsert(payload, { onConflict: "gtin" });
    if (error) console.error("[qogita-webhook] upsert error", error.message);
    else upserted += payload.length;

    seenGtins.push(...gtins);
  }

  // Disparitions : uniquement sur un export FULL (un export filtré ne prouve rien).
  let disappeared = 0;
  if (scope === "full" && items.length > 0) {
    const { count } = await sb
      .from("qogita_catalog_items")
      .update({ is_present_in_catalog: false, disappeared_at: nowIso }, { count: "exact" })
      .eq("is_present_in_catalog", true)
      .lt("last_seen_at", nowIso);
    disappeared = count ?? 0;
  }

  const generationMs = obj.requested_at && obj.completed_at
    ? new Date(obj.completed_at).getTime() - new Date(obj.requested_at).getTime()
    : null;

  if (downloadId) {
    await sb.from("qogita_catalog_downloads").update({
      status: items.length === 0 ? "completed_empty" : "completed",
      completed_at: obj.completed_at ?? nowIso,
      requested_at: obj.requested_at ?? null,
      generation_ms: generationMs,
      filename: obj.filename ?? null,
      rows_total: rows.length,
      rows_updated: upserted,
      csv_columns: columns,
      filters: obj.filters ?? dl?.filters ?? {},
    }).eq("id", downloadId);
  }

  await sb.from("sync_logs").insert({
    sync_type: "qogita_catalog_download",
    status: "success",
    records_processed: upserted,
    metadata: {
      catalog_request_id: requestId, scope, rows: rows.length, columns,
      disappeared, generation_ms: generationMs, ingest_ms: Date.now() - startedAt,
      note: "indicative_price = prix plancher CSV, jamais utilisé pour la marge",
    },
  });

  return json({
    received: true, status: "completed", rows: rows.length,
    upserted, disappeared, columns, generation_ms: generationMs,
  });
});
