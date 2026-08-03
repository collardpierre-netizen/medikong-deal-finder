// ─────────────────────────────────────────────────────────────────────────────
// JOB DE RÉPARATION — offres corrompues par le bug de mapping de prix
// (`unit` lu comme prix → qogita_base_price = 1,00 € → vente 1,25 €).
//
// Cible EXCLUSIVE : offers.price_source = 'qogita_api' AND qogita_base_price = 1.
//
// Fonctionnement :
//   1. sélectionne un lot de produits porteurs d'au moins une offre corrompue ;
//   2. délègue la re-vérification à `sync-qogita-offers-api` avec `repair: true`
//      (seule exception autorisée au gel global `price_writes_enabled=false`),
//      donc mapping corrigé + limiteur de débit / Retry-After mutualisés ;
//   3. toute offre du lot qui reste à 1,00 € après passage API (offre disparue
//      du flux, ou refusée par les garde-fous de plausibilité) est DÉSACTIVÉE,
//      marquée `price_stale` et sa base corrompue est effacée — on ne laisse
//      jamais une valeur fausse en base.
//
// Le job ne ré-ouvre RIEN : il ne touche pas `price_writes_enabled`.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

const DEFAULT_BATCH_PRODUCTS = 40;
const MAX_BATCH_PRODUCTS = 200;
const DEFAULT_WALLTIME_MS = 180_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const batchProducts = Math.min(Math.max(Number(body.batchProducts ?? DEFAULT_BATCH_PRODUCTS), 1), MAX_BATCH_PRODUCTS);
  const rps = Math.min(Math.max(Number(body.rps ?? 2), 0.4), 6);
  const concurrency = Math.min(Math.max(Number(body.concurrency ?? 3), 1), 6);
  const walltimeMs = Math.min(Math.max(Number(body.walltimeMs ?? DEFAULT_WALLTIME_MS), 20_000), 280_000);
  const dryRun = Boolean(body.dryRun);

  const startedAt = Date.now();
  const totals = {
    rounds: 0,
    products_targeted: 0,
    offers_repaired: 0,
    offers_neutralized: 0,
    offers_blocked_floor: 0,
    offers_blocked_implausible: 0,
    sync_errors: 0,
  };

  const { count: remainingBefore } = await sb
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("price_source", "qogita_api")
    .eq("qogita_base_price", 1);

  while (Date.now() - startedAt < walltimeMs) {
    // ── 1. Lot de produits porteurs d'offres corrompues ──
    const { data: corrupted, error: selErr } = await sb
      .from("offers")
      .select("id, product_id")
      .eq("price_source", "qogita_api")
      .eq("qogita_base_price", 1)
      .not("product_id", "is", null)
      .limit(batchProducts * 8);
    if (selErr) {
      return new Response(JSON.stringify({ ok: false, error: selErr.message, totals }), { status: 500, headers: corsHeaders });
    }
    const productIds = [...new Set((corrupted || []).map((o) => o.product_id as string))].slice(0, batchProducts);
    if (productIds.length === 0) break;

    totals.rounds += 1;
    totals.products_targeted += productIds.length;

    if (dryRun) {
      return new Response(JSON.stringify({
        ok: true, dry_run: true, remaining_before: remainingBefore ?? null,
        sample_products: productIds.slice(0, 10), totals,
      }), { headers: corsHeaders });
    }

    // ── 2. Re-vérification API avec le mapping corrigé (écriture autorisée) ──
    try {
      const res = await fetch(`${url}/functions/v1/sync-qogita-offers-api`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds,
          repair: true,
          limit: productIds.length,
          concurrency,
          rps,
          walltimeMs: 50_000,
          fallback: false,
        }),
      });
      const json = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (!res.ok) {
        totals.sync_errors += 1;
        console.error("[repair] sync_http", res.status);
      } else {
        const s = (json?.stats ?? {}) as Record<string, number>;
        totals.offers_repaired += Number(s.offers_upserted ?? 0);
        totals.offers_blocked_floor += Number(s.offers_blocked_floor ?? 0);
        totals.offers_blocked_implausible += Number(s.offers_blocked_implausible ?? 0);
        if (json?.constant_price_alert) {
          console.error("[repair] CONSTANT_PRICE_ALERT", json.constant_price_alert);
        }
      }
    } catch (e) {
      totals.sync_errors += 1;
      console.error("[repair] sync_failed", (e as Error).message);
    }

    // ── 3. Neutralisation des résidus corrompus du lot ──
    const { data: leftovers } = await sb
      .from("offers")
      .select("id, product_id, qogita_offer_qid, qogita_seller_fid")
      .in("product_id", productIds)
      .eq("price_source", "qogita_api")
      .eq("qogita_base_price", 1);

    const leftoverIds = (leftovers || []).map((o) => o.id as string);
    if (leftoverIds.length > 0) {
      const { error: updErr } = await sb.from("offers").update({
        qogita_base_price: null,
        is_active: false,
        price_stale: true,
        price_stale_since: new Date().toISOString(),
      }).in("id", leftoverIds);
      if (updErr) console.error("[repair] neutralize_failed", updErr.message);
      else totals.offers_neutralized += leftoverIds.length;

      for (const o of (leftovers || []).slice(0, 50)) {
        await sb.from("qogita_price_write_anomalies").insert({
          product_id: o.product_id,
          offer_qid: o.qogita_offer_qid,
          seller_fid: o.qogita_seller_fid,
          anomaly_type: "repair_neutralized",
          attempted_base_price: 1,
          details: { reason: "still_base_1_after_api_repair" },
        }).then(() => {}, () => {});
      }
    }
  }

  const { count: remainingAfter } = await sb
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("price_source", "qogita_api")
    .eq("qogita_base_price", 1);

  return new Response(JSON.stringify({
    ok: true,
    duration_ms: Date.now() - startedAt,
    remaining_before: remainingBefore ?? null,
    remaining_after: remainingAfter ?? null,
    done: (remainingAfter ?? 0) === 0,
    totals,
  }), { headers: corsHeaders });
});
