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
} from "../_shared/qogita-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};



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

  // ── 4. completed → enregistrement + délégation au worker d'ingestion ──────
  // On ne parse PLUS le CSV ici : un export FULL (>450k lignes) dépasse le
  // budget mémoire/temps d'un webhook, ce qui laissait le download bloqué.
  const downloadUrl: string | null = obj.download_url ?? obj.downloadUrl ?? null;
  if (!downloadUrl) return json({ error: "missing_download_url" }, 400);

  const nowIso = new Date().toISOString();
  const scope = dl?.scope ?? (obj.filters && Object.keys(obj.filters).length ? "filtered" : "full");
  const generationMs = obj.requested_at && obj.completed_at
    ? new Date(obj.completed_at).getTime() - new Date(obj.requested_at).getTime()
    : null;

  const patch: Record<string, unknown> = {
    status: "ready_to_ingest",
    download_url: downloadUrl,
    ingest_cursor: 0,
    ingest_rows: 0,
    ingest_state: {},
    generation_ms: generationMs,
    filename: obj.filename ?? null,
    filters: obj.filters ?? dl?.filters ?? {},
    error_message: null,
  };


  let downloadId = dl?.id as string | undefined;
  if (!downloadId) {
    const { data: created } = await sb.from("qogita_catalog_downloads").insert({
      catalog_request_id: requestId, scope, triggered_by: "webhook",
      requested_at: obj.requested_at ?? nowIso, ...patch,
    }).select("id").maybeSingle();
    downloadId = created?.id;
  } else {
    await sb.from("qogita_catalog_downloads").update(patch).eq("id", downloadId);
  }

  if (!downloadId) return json({ error: "download_row_unavailable" }, 500);

  // Délégation non bloquante : le worker streame le CSV et se relance seul.
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/qogita-catalog-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ downloadId }),
  }).catch((e) => console.error("[qogita-webhook] ingest dispatch", (e as Error).message));

  return json({
    received: true, status: "ready_to_ingest", download_id: downloadId,
    scope, generation_ms: generationMs,
  });
});

